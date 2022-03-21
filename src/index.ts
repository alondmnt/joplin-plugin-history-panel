import joplin from 'api';

const histNoteId = 'acd86f64f8004625b7dd71284b39ba11';
const minSecBetweenItems = 60;
const maxHistDays = 90;

async function addHistItem(noteId: string){
  const note = await joplin.data.get(['notes', noteId], { fields: ['id', 'title'] });
  const date = new Date();
  const newItem = date.toISOString() + ' [' + note.title + '](:/' + note.id + ')\n';
  const histNote = await joplin.data.get(['notes', histNoteId], { fields: ['id', 'title', 'body'] });
  const lastItemDate = new Date(histNote.body.slice(0, 24));

  if (date.getTime() - lastItemDate.getTime() < 1000*minSecBetweenItems)
    return

  if (maxHistDays > 0)
    histNote.body = await cleanOldHist(histNote.body, maxHistDays);
  await joplin.data.put(['notes', histNote.id], null, { body: newItem + histNote.body});

  const finish = new Date();
  console.log('took ' + (finish.getTime() - date.getTime()) + 'ms.')
}

async function cleanOldHist(body: string, maxHistDays: number): Promise<string> {
  const now = new Date().getTime();
  const lines = body.split('\n');
  for (var i = lines.length - 1; i >= 0; i--) {
    const itemDate = new Date(lines[i].split(' ')[0]).getTime();
    if ((now - itemDate) <= maxHistDays*1000*60*60*24)
      break
  }

  console.log('deleted ' + (lines.length - i - 1) + ' history items.');
  return lines.slice(0, i+1).join('\n');
}

joplin.plugins.register({
	onStart: async function() {
		await joplin.workspace.onNoteSelectionChange(
      async ({ value }: { value: [string?] }
    ) => {
      if (histNoteId == undefined) return;
      const noteId = value?.[0] as string;
      if ((noteId == undefined) || (noteId == histNoteId)) return;
      addHistItem(noteId);
		});
	},
});
