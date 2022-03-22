import joplin from 'api';
import { SettingItemType, MenuItemLocation, ToolbarButtonLocation } from 'api/types';
import addHistItem from './history';

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
