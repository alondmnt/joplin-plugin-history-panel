import joplin from 'api';

export default async function addHistItem(noteId: string){
  // settings
  const histNoteId = await joplin.settings.value('histNoteId') as string;
  if ((noteId == undefined) || (noteId == histNoteId)) return;

  let histNote;
  try {
    histNote = await joplin.data.get(['notes', histNoteId], { fields: ['id', 'title', 'body'] });
  } catch {
    console.log('failed when histNoteId = ' + histNoteId);
    return
  }

  const minSecBetweenItems = await joplin.settings.value('minSecBetweenItems') as number;
  const date = new Date();
  if (minSecBetweenItems > 0)
    histNote.body = await cleanNewHist(histNote.body, date, minSecBetweenItems);

  const maxHistDays = await joplin.settings.value('maxHistDays') as number;
  if (maxHistDays > 0)
    histNote.body = await cleanOldHist(histNote.body, date, maxHistDays);

  const note = await joplin.data.get(['notes', noteId], { fields: ['id', 'title'] });
  const newItem = date.toISOString() + ' [' + note.title + '](:/' + note.id + ')\n';
  await joplin.data.put(['notes', histNote.id], null, { body: newItem + histNote.body});

  const finish = new Date();
  console.log('took ' + (finish.getTime() - date.getTime()) + 'ms.')
}

async function cleanNewHist(body: string, newItemDate: Date, minSecBetweenItems: number): Promise<string> {
  const lastItemDate = new Date(body.slice(0, 24));
  if (newItemDate.getTime() - lastItemDate.getTime() >= 1000*minSecBetweenItems)
    return body;
  // remove last item from history
  console.log('first history item removed')
  const ind = body.search('\n')
  return body.slice(ind+1)
}

async function cleanOldHist(body: string, newItemDate: Date, maxHistDays: number): Promise<string> {
  const lines = body.split('\n');
  for (var i = lines.length - 1; i >= 0; i--) {
    const itemDate = new Date(lines[i].split(' ')[0]).getTime();
    if ((newItemDate.getTime() - itemDate) <= maxHistDays*1000*60*60*24)
      break;
  }

  console.log('deleted ' + (lines.length - i - 1) + ' history items.');
  return lines.slice(0, i+1).join('\n');
}
