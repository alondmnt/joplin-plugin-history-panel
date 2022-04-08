import joplin from 'api';

const titleExp = new RegExp(/\[(.*?)\]/g);
const idExp = new RegExp(/\((.*?)\)/g);
const linkExp = new RegExp(/{(.*?)}/g);

/**
 * logs a new selected note in the history note.
 */
export default async function addHistItem() {
  // settings
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
  const histNoteId = await joplin.settings.value('histNoteId') as string;
  if (note.id == histNoteId) return;

  let histNote;
  try {
    histNote = await joplin.data.get(['notes', histNoteId], { fields: ['id', 'title', 'body'] });
  } catch {
    console.log('addHistItem: failed when histNoteId = ' + histNoteId);
    return
  }

  const date = new Date();
  if (isDuplicate(histNote.body, note, date))  // do not duplicate the last item
    return

  const minSecBetweenItems = await joplin.settings.value('minSecBetweenItems') as number;
  if (minSecBetweenItems > 0)
    histNote.body = cleanNewHist(histNote.body, date, minSecBetweenItems);

  const maxHistDays = await joplin.settings.value('maxHistDays') as number;
  if (maxHistDays > 0)
    histNote.body = cleanOldHist(histNote.body, date, maxHistDays);

  let newItem = formatItem(date, note.title, note.id, []) + '\n';
  if (isDuplicate(histNote.body, note, date))  // do not duplicate the last item
    newItem = '';

  const lines = (newItem + histNote.body).split('\n');
  const processed = new Set() as Set<string>;
  await addTrajToItem(note, lines, 0, processed, new Set() as Set<number>);
  histNote.body = lines.join('\n');

  await joplin.data.put(['notes', histNote.id], null, { body: histNote.body});

  // const finish = new Date();
  // console.log('took ' + (finish.getTime() - date.getTime()) + 'ms.')
}

/**
 * recursively searches for links to a new history item,
 * and updates the body of the history note with new trajectories.
 */
async function addTrajToItem(note: any, lines: string[], i: number,
    processed: Set<string>, existLevels: Set<number>):
    Promise<[boolean, number]> {
  if (i == lines.length)
    return [false, 1]
  const [itemDate, itemTitle, itemId, itemTraj] = parseItem(lines[i]);

  /* TODO: stop when i is too large, or date is too old*/
  if (i > 20)
    return [false, getNextLevel(existLevels)];  // link not found

  existLevels = setUnion(existLevels, new Set(itemTraj));

  if (!processed.has(itemId)){
    let skip = false;
    let item;
    try {
      item = await joplin.data.get(['notes', itemId], { fields: ['id', 'body'] });
    } catch {
      skip = true;
      console.log('addTrajToItem: bad note');
    }

    if (!skip && isLinked(note.body, note.id, item.body, item.id)) {
      let nextLevel: number;
      if (i == 1)
        nextLevel = 1;
      else
        nextLevel = getNextLevel(existLevels);
      // itemTraj.push(nextLevel);  
      // lines[i] = formatItem(itemDate, itemTitle, itemId, itemTraj);
      return [true, nextLevel];  // link found
    }
    processed.add(itemId);
  }

  // processed, means that it is not linked to the note, continue processing
  const [foundLink, nextLevel] = await addTrajToItem(note, lines, i+1, processed, existLevels);
  if (foundLink){
    itemTraj.push(nextLevel);
    lines[i] = formatItem(itemDate, itemTitle, itemId, itemTraj);
  }
  return [foundLink, nextLevel];
}

function formatItem(date: Date, title: string, id: string, traj: number[]): string {
  let trajString = '';
  if (traj.length > 0)
    trajString = ` {${traj.sort().map(String).join(',')}}`;

  return `${date.toISOString()} [${title}](:/${id})${trajString}`;
}

export function parseItem(line: string): [Date, string, string, number[]] {
  const date = new Date(line.slice(0, 24));

  let title = '';
  const titleMatch = line.match(titleExp);
  if (titleMatch)
    title = titleMatch[0].slice(1, -1)

  let id = '';
  const idMatch = line.match(idExp)
  if (idMatch)
    id = idMatch[0].slice(3, -1);

  let traj = [] as number[];
  const linkMatch = line.match(linkExp);
  if (linkMatch)
    traj = linkMatch[0].slice(1, -1).split(',').map(Number);

  return [date, title, id, traj];
}

function isDuplicate(body: string, note: any, date: Date): boolean {
  const ind = body.search('\n');
  const [itemDate, itemTitle, itemId, itemTraj] = parseItem(body.slice(0, ind));
  // TODO: if this becomes too slow, skip parseItem and get just the date, id
  return (itemId == note.id) && (itemDate.getDate() == date.getDate());
}

/**
 * removes history items if they are too recent.
 */
function cleanNewHist(body: string, newItemDate: Date, minSecBetweenItems: number): string {
  const lastItemDate = new Date(body.slice(0, 24));
  if (newItemDate.getTime() - lastItemDate.getTime() >= 1000*minSecBetweenItems)
    return body;
  // remove last item from history
  const ind = body.search('\n');
  body = cleanNewTraj(body).slice(ind+1);

  return body;
}

function cleanNewTraj(body: string): string {
  const ind = body.search('\n');
  const itemTraj = parseItem(body.slice(0, ind))[3];
  if (itemTraj.length == 0)
    return body;

  const level = itemTraj[0];  // last item has at most one trajectory
  const lines = body.split('\n');
  for (let i = 0; i <= lines.length; i++) {
    const [itemDate, itemTitle, itemId, itemTraj] = parseItem(lines[i]);
    try {
      lines[i] = formatItem(itemDate, itemTitle, itemId, 
          itemTraj.splice(itemTraj.indexOf(level), 1));
    } catch {
      console.log(`cleanNewTraj: failed to format date=${itemDate}\nwhen level=${level}\nline=${lines}`)
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

function isLinked(body1: string, id1: string, body2: string, id2: string): boolean {
  // TODO: search only within links, if this is more efficient
  if (id1 == id2)
    return false;
  return ((body1.search(':/' + id2) > 0) || (body2.search(':/' + id1) > 0));
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
