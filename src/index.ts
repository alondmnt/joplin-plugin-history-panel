import joplin from 'api';
import { SettingItemType, ToolbarButtonLocation } from 'api/types';

async function addHistItem(noteId: string){
  // settings
  const histNoteId = await joplin.settings.value('histNoteId') as string;
  const minSecBetweenItems = await joplin.settings.value('minSecBetweenItems') as number;
  const maxHistDays = await joplin.settings.value('maxHistDays') as number;

  if ((noteId == undefined) || (noteId == histNoteId)) return;
  let histNote;
  try {
    histNote = await joplin.data.get(['notes', histNoteId], { fields: ['id', 'title', 'body'] });
  } catch {
    console.log('failed when histNoteId = ' + histNoteId);
    return
  }

  const lastItemDate = new Date(histNote.body.slice(0, 24));
  const date = new Date();
  if (date.getTime() - lastItemDate.getTime() < 1000*minSecBetweenItems)
    return

  if (maxHistDays > 0)
    histNote.body = await cleanOldHist(histNote.body, maxHistDays);

  const note = await joplin.data.get(['notes', noteId], { fields: ['id', 'title'] });
  const newItem = date.toISOString() + ' [' + note.title + '](:/' + note.id + ')\n';
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
    await joplin.settings.registerSection('HistoryPanel', {
			label: 'History Panel',
			iconName: 'fas fa-history',
		});

		await joplin.settings.registerSettings({
			'histNoteId': {
				value: '',
				type: SettingItemType.String,
				section: 'HistoryPanel',
				public: true,
				label: 'History note ID',
			},

			'minSecBetweenItems': {
				value: 60,
				type: SettingItemType.Int,
				section: 'HistoryPanel',
				public: true,
				label: 'Min seconds between history items',
			},

			'maxHistDays': {
				value: 90,
				type: SettingItemType.Int,
				section: 'HistoryPanel',
				public: true,
				label: 'Days of history to keep',
			},
		});

		await joplin.workspace.onNoteSelectionChange(
      async ({ value }: { value: [string?] }
    ) => {
      const noteId = value?.[0] as string;
      addHistItem(noteId);
		});
	},
});
