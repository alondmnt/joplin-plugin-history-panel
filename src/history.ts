import joplin from 'api';
import { HistSettings } from './settings';

const DEBUG = false;

const linkExp = new RegExp(/{(.*?)}/g);
const noteExp = new RegExp(/\[(?<title>[^\[]+)\]\(:\/(?<id>.*)\)/g);

export interface HistItem {
  date: Date;
  id: string;
  title: string;
  trails: number[];
}

/**
 * logs a new selected note in the history note.
 */
export default async function addHistItem(params: HistSettings) {
  // get current note
  let note;
  try {
    note = await joplin.workspace.selectedNote();
    if (note == undefined) return;
    if (note.title == '')
      note.title = 'Untitled';
  } catch{
    if (DEBUG) console.log('addHistItem: failed to get selected note');
    return;
  }
  if (params.histNoteId == note.id) return;
  if (params.excludeNotes.has(note.id)) return;
  if (params.excludeFolders.has(note.parent_id)) return;
  if (params.excludeToDo && note.is_todo) return;

  // get history note
  let histNote;
  try {
    histNote = await joplin.data.get(['notes', params.histNoteId], { fields: ['id', 'title', 'body'] });
  } catch {
    if (DEBUG) console.log('addHistItem: failed when histNoteId = ' + params.histNoteId);
    return
  }

  // tidy up history
  const item: HistItem = {
    date: new Date(),
    id: note.id,
    title: note.title,
    trails: [],
  }
  if (isDuplicate(histNote.body, note, item.date))  // do not duplicate the last item
    return

  if (params.secBetweenItems > 0)
    histNote.body = cleanNewHist(histNote.body, item.date,
        params.secBetweenItems, params.trailFormat);

  if (params.maxDays > 0)
    histNote.body = cleanOldHist(histNote.body, item.date, params.maxDays);

  if (isDuplicate(histNote.body, note, item.date)) {  // do not duplicate the last item
    await joplin.data.put(['notes', histNote.id], null, { body: histNote.body });
    return
  }

  histNote.body = await fixUntitledItem(histNote.body, params.trailFormat);

  // add new item
  const newItem = formatItem(item, params.trailFormat) + '\n';
  histNote.body = newItem + histNote.body;

  if (params.trailRecords > 0) {
    const lines = histNote.body.split('\n');
    const processed = new Set() as Set<string>;
    await addTrailToItem(note, lines, 0, processed, new Set() as Set<number>, params);
    histNote.body = lines.join('\n');
  }

  await joplin.data.put(['notes', histNote.id], null, { body: histNote.body});

  const finish = new Date();
  if (DEBUG)
    console.log('addHistItem: ' + (finish.getTime() - item.date.getTime()) + 'ms');
}

/**
 * recursively searches for links to a new history item,
 * and updates the body of the history note with new trails.
 */
async function addTrailToItem(noteDest: any, lines: string[], i: number,
    processed: Set<string>, existLevels: Set<number>, params: HistSettings):
    Promise<[boolean, number]> {
  if (i == lines.length)
    return [false, 1]
  const [item, error] = parseItem(lines[i]);

  if (i > params.trailLength)
    return [false, getNextLevel(existLevels)];  // link not found

  existLevels = setUnion(existLevels, new Set(item.trails));
  const nl = getNextLevel(existLevels);
  if ((i > 1) && (nl > params.trailRecords))
    return [false, nl];  // link not found

  if ((i > 0) && !processed.has(item.id)){
    let skip = false;
    let noteSource;
    try {
      noteSource = await joplin.data.get(['notes', item.id], { fields: ['id', 'body'] });
    } catch {
      skip = true;
      if (DEBUG) console.log(`addTrailToItem: bad note = ${item}`);
    }

    if (!skip && isLinked(noteSource.body, noteSource.id, noteDest.body, noteDest.id, params.trailBacklinks)) {
      let nextLevel: number;
      if (i == 1)
        nextLevel = 1;
      else
        nextLevel = getNextLevel(existLevels);
      // add trail to all previous items (but not to current)
      return [true, nextLevel];  // link found
    }
    processed.add(item.id);
  }

  // processed, means that it is not linked to the note, continue processing
  const [foundLink, nextLevel] = await addTrailToItem(noteDest, lines, i+1, processed, existLevels, params);
  if ((foundLink) && (!error)) {
    item.trails.push(nextLevel);
    lines[i] = formatItem(item, params.trailFormat);
  }
  return [foundLink, nextLevel];
}

function formatItem(item: HistItem, trailFormat: number): string {
  let trailString = '';
  let trail = item.trails.sort();
  if (trailFormat == 0)
      trail = trail.reverse();
  if (trail.length > 0)
    trailString = ` {${trail.map(String).join(',')}}`;

  try {
    if (trailFormat == 0) {
      return `${item.date.toISOString()}${trailString} [${item.title}](:/${item.id})`;
    } else {
      return `${item.date.toISOString()} [${item.title}](:/${item.id})${trailString}`;
    }
  } catch {
    if (DEBUG) console.log(`formatItem: bad data = ${item}`);
    return '';
  }
}

/**
 * @returns [date, title, id, trail]
 */
export function parseItem(line: string): [HistItem, boolean] {
  const item: HistItem = {
    date: new Date(),
    id: '',
    title: '',
    trails: [],
  };

  try {
    item.date = new Date(line.slice(0, 24));
    if (isNaN(item.date.valueOf())) throw 'bad date';

    noteExp.lastIndex = 0;
    const noteMatch = noteExp.exec(line);
    if (noteMatch){
      item.title = noteMatch.groups.title;
      item.id = noteMatch.groups.id;
    }

    const linkMatch = line.match(linkExp);
    if (linkMatch)
      item.trails = linkMatch[0].slice(1, -1).split(',').map(Number);

    return [item, false];
  } catch {
    if (DEBUG) console.log('parseItem: bad line=' + line);
    return [item, true];
  }
}

function isDuplicate(body: string, note: any, date: Date): boolean {
  const ind = body.search('\n');
  const [item, error] = parseItem(body.slice(0, ind));
  if (error) return false
  // TODO: if this becomes too slow, skip parseItem and get just the date, id
  return (item.id == note.id) && (item.date.getDate() == date.getDate());
}

/**
 * removes history items if they are too recent.
 */
function cleanNewHist(body: string, newItemDate: Date, minSecBetweenItems: number,
    trailFormat: number): string {
  const lastItemDate = new Date(body.slice(0, 24));
  if (newItemDate.getTime() - lastItemDate.getTime() >= 1000*minSecBetweenItems)
    return body;

  // remove last item from history
  body = cleanNewTrail(body, trailFormat);
  const ind = body.search('\n');
  return body.slice(ind+1);
}

function cleanNewTrail(body: string, trailFormat: number): string {
  const ind = body.search('\n');
  const [item, error] = parseItem(body.slice(0, ind));
  if (item.trails.length == 0)
    return body;

  const level = item.trails[0];  // last item has at most one trail

  if (level == 1) {
    return body  // last line will be removed by calling function
  }

  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const [item, error] = parseItem(lines[i]);
    if (error) {
      if (DEBUG) console.log(`cleanNewTrail: failed on line ${i}:\n${lines[i]}`);
      continue;
    }
    const ind = item.trails.indexOf(level);
    if (ind < 0)  // once the trail ends
      break
    item.trails.splice(ind, 1);
    lines[i] = formatItem(item, trailFormat);
  }
  return lines.join('\n');
}

/**
 * removes history items if they are too old.
 */
function cleanOldHist(body: string, newItemDate: Date, maxHistDays: number): string {
  const lines = body.split('\n');
  for (var i = lines.length - 1; i >= 0; i--) {
    const itemDate = new Date(lines[i].split(' ')[0]).getTime();
    if ((newItemDate.getTime() - itemDate) <= maxHistDays*1000*60*60*24)
      break;
  }
  return lines.slice(0, i+1).join('\n');
}

/**
 * if the last item is untitled, which happens in the case of a
 * newly created note, this function tries to update its title.
 */
async function fixUntitledItem(body: string, trailFormat: number): Promise<string> {
  const ind = body.search('\n');
  let [item, error] = parseItem(body.slice(0, ind));
  if ((item.title != 'Untitled') || (error))
    return body

  body = body.slice(ind + 1);  // remove untitled item
  try {
    const note = await joplin.data.get(['notes', item.id], { fields: ['title'] });
    if (note) {
      if (note.title == '') item.title = 'Untitled';
      else item.title = note.title;
    }
    body = formatItem(item, trailFormat) + '\n' + body;
  } catch {
    if (DEBUG) console.log('fixUntitledItem: failed to open untitled note');
  }

  return body
}

function isLinked(body1: string, id1: string, body2: string, id2: string, backlinks: boolean): boolean {
  if (id1 == id2)
    return true;
  let res = (body1.search(':/' + id2) > 0);
  if (backlinks)
    res = res || (body2.search(':/' + id1) > 0);
  return res;
}

function setUnion(setA: Set<number>, setB: Set<number>): Set<number> {
  let _union = new Set(setA);
  for (let elem of setB)
      _union.add(elem);
  return _union
}

function setDiff(setA: Set<number>, setB: Set<number>): Set<number> {
  let _difference = new Set(setA);
  for (let elem of setB)
    _difference.delete(elem);
  return _difference
}

/**
 * returns [2, 3, ..., maxNum].
 * level 1 is reserved for direct links between consecutive items.
 */
function getLevelSeries(maxNum: number): number[] {
  let a = [] as number[];
  for (var i = 2; i <= maxNum; i++)
    a.push(i);
  return a
}

function getNextLevel(existLevels: Set<number>): number {
  if (existLevels.size == 0)
    return 2;
  const maxExist = Math.max.apply(this, [...existLevels]) as number;
  if (maxExist < 2)
    return 2;
  const allLevels = new Set(getLevelSeries(maxExist + 1));
  return Math.min.apply(this, [...setDiff(allLevels, existLevels)]);
}
