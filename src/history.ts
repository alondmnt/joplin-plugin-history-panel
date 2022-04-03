import joplin from 'api';

const titleExp = new RegExp(/\[(.*?)\]/g);
const idExp = new RegExp(/\((.*?)\)/g);
const linkExp = new RegExp(/{(.*?)}/g);

export default async function addHistItem() {
  // settings
  const note = await joplin.workspace.selectedNote();
  if (note.title == '')
    note.title = 'Untitled';
  if (note == undefined) return;
  const histNoteId = await joplin.settings.value('histNoteId') as string;
  if (note.id == histNoteId) return;

  let histNote;
  try {
    histNote = await joplin.data.get(['notes', histNoteId], { fields: ['id', 'title', 'body'] });
  } catch {
    console.log('failed when histNoteId = ' + histNoteId);
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

  let newItem = `${date.toISOString()} [${note.title}](:/${note.id})\n`;
  if (isDuplicate(histNote.body, note, date))  // do not duplicate the last item
    newItem = '';

  histNote.body = await addLinkToLastItem(histNote.body, note);

  await joplin.data.put(['notes', histNote.id], null, { body: newItem + histNote.body});

  // const finish = new Date();
  // console.log('took ' + (finish.getTime() - date.getTime()) + 'ms.')
}

function isDuplicate(body: string, note: any, date: Date): boolean {
  const [ind, lastItemId, lastItemDate] = getLastItem(body);
  return (lastItemId == note.id) && (lastItemDate.getDate() == date.getDate());
}

function getLastItem(body: string): [number, string, Date] {
  // TODO: if this becomes too slow, skip parseItem and get just the date, id
  const ind = body.search('\n');
  const [date, title, id, links] = parseItem(body.slice(0,ind));
  return [ind, id, date];
}

export function parseItem(line: string): [Date, string, string, string] {
  // TODO: this parser should take care of linking states as well in the future
  const date = new Date(line.slice(0, 24));
  const title = line.match(titleExp)[0].slice(1, -1);
  const id = line.match(idExp)[0].slice(3, -1);
  const linkMatch = line.match(linkExp);

  let links = '';
  if (linkMatch)
    links = linkMatch[0].slice(1, -1);

  return [date, title, id, links];
}

function cleanNewHist(body: string, newItemDate: Date, minSecBetweenItems: number): string {
  const lastItemDate = new Date(body.slice(0, 24));
  if (newItemDate.getTime() - lastItemDate.getTime() >= 1000*minSecBetweenItems)
    return body;
  // remove last item from history
  const ind = body.search('\n');
  return body.slice(ind+1);
}

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
  return ((body1.search(id2) > 0) || (body2.search(id1) > 0));
}

async function addLinkToLastItem(body: string, note: any): Promise<string> {
  const [ind, lastItemId, lastItemDate] = getLastItem(body);
  const lastItem = await joplin.data.get(['notes', lastItemId], { fields: ['id', 'title', 'body'] });
  if (!lastItem)
    return body;

  if (isLinked(lastItem.body, lastItem.id, note.body, note.id)) {
    // set link state
    return `${lastItemDate.toISOString()} [${lastItem.title}](:/${lastItem.id}) {1}\n`
      + body.slice(ind+1);
  } else {
    // remove link state
    // TODO: keep other links, if exist
    /* TODO: do we need to change isDuplicate() logic?
      (scenario: A is last, click B which is linked to A,
      and then back to A so B is removed, but A still shows a link forward) */
    return `${lastItemDate.toISOString()} [${lastItem.title}](:/${lastItem.id})\n`
      + body.slice(ind+1);
  }
}
