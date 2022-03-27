import joplin from 'api';

export default async function addHistItem(){
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
  if (isDuplicate(histNote, note, date))  // do not duplicate the last item
    return

  const minSecBetweenItems = await joplin.settings.value('minSecBetweenItems') as number;
  if (minSecBetweenItems > 0)
    histNote.body = cleanNewHist(histNote.body, date, minSecBetweenItems);

  const maxHistDays = await joplin.settings.value('maxHistDays') as number;
  if (maxHistDays > 0)
    histNote.body = cleanOldHist(histNote.body, date, maxHistDays);

  let newItem = date.toISOString() + ' [' + note.title + '](:/' + note.id + ')\n';
  if (isDuplicate(histNote, note, date))  // do not duplicate the last item
    newItem = '';

  await joplin.data.put(['notes', histNote.id], null, { body: newItem + histNote.body});

  // const finish = new Date();
  // console.log('took ' + (finish.getTime() - date.getTime()) + 'ms.')
}

function isDuplicate(histNote: any, note: any, date: Date): boolean {
  const ind = histNote.body.search('\n');
  const lastItemId = histNote.body.slice(0,ind).match(/\((.*?)\)/g)[0].slice(3, -1);
  const lastItemDate = new Date(histNote.body.slice(0, 24)).getDate();
  return (lastItemId == note.id) && (lastItemDate == date.getDate())
}

function cleanNewHist(body: string, newItemDate: Date, minSecBetweenItems: number): string {
  const lastItemDate = new Date(body.slice(0, 24));
  if (newItemDate.getTime() - lastItemDate.getTime() >= 1000*minSecBetweenItems)
    return body;
  // remove last item from history
  const ind = body.search('\n')
  return body.slice(ind+1)
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
