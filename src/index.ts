import joplin from 'api';

const histNoteId = 'acd86f64f8004625b7dd71284b39ba11';
const minSecBetweenItems = 60;

async function addHistItem(noteId: string){
  if (noteId == undefined) return;
  const note = await joplin.data.get(['notes', noteId], { fields: ['id', 'title'] });
  const date = new Date();
  const newLine = date.toISOString() + ' [' + note.title + '](:/' + note.id + ')\n';
  const histNote = await joplin.data.get(['notes', histNoteId], { fields: ['id', 'title', 'body'] });
  const lastItemDate = new Date(histNote.body.split(' ')[0])

  if (date.getTime() - lastItemDate.getTime() > 1000*minSecBetweenItems)
    await joplin.data.put(['notes', histNote.id], null, { body: newLine + histNote.body});
}

joplin.plugins.register({
	onStart: async function() {
		await joplin.workspace.onNoteSelectionChange(
      async ({ value }: { value: [string?] }
    ) => {
      if (histNoteId == undefined) return;
      const noteId = value?.[0] as string;
      if (histNoteId == noteId) return;
      addHistItem(noteId);
		});
	},
});
