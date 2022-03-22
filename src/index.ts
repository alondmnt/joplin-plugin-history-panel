import joplin from 'api';
import { SettingItemType, MenuItemLocation, ToolbarButtonLocation } from 'api/types';

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

  const date = new Date();
  if (minSecBetweenItems > 0)
    histNote.body = await cleanNewHist(histNote.body, date, minSecBetweenItems);

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
				value: 0,
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

    await joplin.commands.register({
			name: 'setHistNote',
			label: 'Set history note',
			iconName: 'fas fa-history',
			execute: async () => {
        const note = await joplin.workspace.selectedNote();
				await joplin.settings.setValue('histNoteId', note.id);
			},
		});

    await joplin.views.menuItems.create('menuHistNote', 'setHistNote', MenuItemLocation.Tools);

		await joplin.workspace.onNoteSelectionChange(
      async ({ value }: { value: [string?] }
    ) => {
      const noteId = value?.[0] as string;
      addHistItem(noteId);
		});
	},
});
