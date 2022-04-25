import joplin from 'api';
import { settings } from 'cluster';
import { HistSettings } from './settings';

const linkExp = new RegExp(/{(.*?)}/g);
const noteExp = new RegExp(/\[(?<title>[^\[]+)\]\(:\/(?<id>.*)\)/g);

/**
 * logs a new selected note in the history note.
 */
export default async function addHistItem(params: HistSettings) {
  let note;
  try {
    note = await joplin.workspace.selectedNote();
    if (note == undefined) return;
    if (note.title == '')
      note.title = 'Untitled';
  } catch{
    console.log('addHistItem: failed to get selected note');
    return;
  }
  if ((note.id == params.histNoteId) || params.excludeNotes.has(note.id)) return;

  let histNote;
  try {
    histNote = await joplin.data.get(['notes', params.histNoteId], { fields: ['id', 'title', 'body'] });
  } catch {
    console.log('addHistItem: failed when histNoteId = ' + params.histNoteId);
    return
  }

  const date = new Date();
  if (isDuplicate(histNote.body, note, date))  // do not duplicate the last item
    return

  if (params.secBetweenItems > 0)
    histNote.body = cleanNewHist(histNote.body, date,
        params.secBetweenItems, params.trailFormat);

  if (params.maxDays > 0)
    histNote.body = cleanOldHist(histNote.body, date, params.maxDays);

  if (isDuplicate(histNote.body, note, date)) {  // do not duplicate the last item
    await joplin.data.put(['notes', histNote.id], null, { body: histNote.body });
    return
  }

  histNote.body = await fixUntitledItem(histNote.body, params.trailFormat);

  const newItem = formatItem(date, note.title, note.id, [], params.trailFormat) + '\n';
  histNote.body = newItem + histNote.body;

  if (params.trailRecords > 0) {
    const lines = histNote.body.split('\n');
    const processed = new Set() as Set<string>;
    await addTrailToItem(note, lines, 0, processed, new Set() as Set<number>, params);
    histNote.body = lines.join('\n');
  }

  await joplin.data.put(['notes', histNote.id], null, { body: histNote.body});

  // const finish = new Date();
  // console.log('took ' + (finish.getTime() - date.getTime()) + 'ms.')
}

/**
 * recursively searches for links to a new history item,
 * and updates the body of the history note with new trails.
 */
async function addTrailToItem(note: any, lines: string[], i: number,
    processed: Set<string>, existLevels: Set<number>, params: HistSettings):
    Promise<[boolean, number]> {
  if (i == lines.length)
    return [false, 1]
  const [itemDate, itemTitle, itemId, itemTrail] = parseItem(lines[i]);

  if (i > params.trailLength)
    return [false, getNextLevel(existLevels)];  // link not found

  existLevels = setUnion(existLevels, new Set(itemTrail));
  const nl = getNextLevel(existLevels);
  if ((i > 1) && (nl > params.trailRecords))
    return [false, nl];  // link not found

  if ((i > 0) && !processed.has(itemId)){
    let skip = false;
    let item;
    try {
      item = await joplin.data.get(['notes', itemId], { fields: ['id', 'body'] });
    } catch {
      skip = true;
      console.log('addTrailToItem: bad note');
    }

    if (!skip && isLinked(item.body, item.id, note.body, note.id, params.trailBacklinks)) {
      let nextLevel: number;
      if (i == 1)
        nextLevel = 1;
      else
        nextLevel = getNextLevel(existLevels);
      // add trail to all previous items (but not to current)
      return [true, nextLevel];  // link found
    }
    processed.add(itemId);
  }

  // processed, means that it is not linked to the note, continue processing
  const [foundLink, nextLevel] = await addTrailToItem(note, lines, i+1, processed, existLevels, params);
  if (foundLink){
    itemTrail.push(nextLevel);
    lines[i] = formatItem(itemDate, itemTitle, itemId, itemTrail, params.trailFormat);
  }
  return [foundLink, nextLevel];
}

function formatItem(date: Date, title: string, id: string, trail: number[],
      trailFormat: number): string {
  let trailString = '';
  trail = trail.sort();
  if (trailFormat == 0)
      trail = trail.reverse();
  if (trail.length > 0)
    trailString = ` {${trail.map(String).join(',')}}`;

  if (trailFormat == 0) {
    return `${date.toISOString()}${trailString} [${title}](:/${id})`;
  } else {
    return `${date.toISOString()} [${title}](:/${id})${trailString}`;
  }
}

/**
 * @returns [date, title, id, trail]
 */
export function parseItem(line: string): [Date, string, string, number[]] {
  const date = new Date(line.slice(0, 24));

  noteExp.lastIndex = 0;
  const noteMatch = noteExp.exec(line);
  let title = '';
  let id = '';
  if (noteMatch){
    title = noteMatch.groups.title;
    id = noteMatch.groups.id;
  }
  if (title.length == 0)
    console.log('parseItem: bad parse, line=' + line);

  let trail = [] as number[];
  const linkMatch = line.match(linkExp);
  if (linkMatch)
    trail = linkMatch[0].slice(1, -1).split(',').map(Number);

  return [date, title, id, trail];
}

function isDuplicate(body: string, note: any, date: Date): boolean {
  const ind = body.search('\n');
  const [itemDate, itemTitle, itemId, itemTrail] = parseItem(body.slice(0, ind));
  // TODO: if this becomes too slow, skip parseItem and get just the date, id
  return (itemId == note.id) && (itemDate.getDate() == date.getDate());
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
  const itemTrail = parseItem(body.slice(0, ind))[3];
  if (itemTrail.length == 0)
    return body;

  const level = itemTrail[0];  // last item has at most one trail

  if (level == 1) {
    return body  // last line will be removed by calling function
  }

  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    try {
      const [itemDate, itemTitle, itemId, itemTrail] = parseItem(lines[i]);
      const ind = itemTrail.indexOf(level)
      if (ind < 0)  // once the trail ends
        break
      itemTrail.splice(ind, 1)
      lines[i] = formatItem(itemDate, itemTitle, itemId, itemTrail, trailFormat);
    } catch {
      console.log(`cleanNewTrail: failed on line ${i}:\n${lines[i]}`);
    }
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
  let [itemDate, itemTitle, itemId, itemTrail] = parseItem(body.slice(0, ind));
  if (itemTitle != 'Untitled')
    return body

  body = body.slice(ind + 1);  // remove untitled item
  try {
    const note = await joplin.data.get(['notes', itemId], { fields: ['title'] });
    if (note)
      if (note.title == '') note.title = 'Untitled';
    body = formatItem(itemDate, note.title, itemId, itemTrail, trailFormat) + '\n' + body;
  } catch {
    console.log('fixUntitledItem: failed to open untitled note');
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
