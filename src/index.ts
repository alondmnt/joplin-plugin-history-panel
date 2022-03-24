import joplin from 'api';
import { SettingItemType, MenuItemLocation } from 'api/types';
import addHistItem from './history';
import updateHistView from './panel'

joplin.plugins.register({
	onStart: async function() {
    const panel = await joplin.views.panels.create('history');
    await joplin.views.panels.addScript(panel, './webview.css');
    await joplin.views.panels.setHtml(panel, 'Loading...');

    await joplin.settings.registerSection('HistoryPanel', {
			label: 'History Panel',
			iconName: 'fas fa-hourglass',
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
			iconName: 'fas fa-hourglass',
			execute: async () => {
        const note = await joplin.workspace.selectedNote();
				await joplin.settings.setValue('histNoteId', note.id);
			},
		});

    await joplin.views.menuItems.create('menuHistNote', 'setHistNote', MenuItemLocation.Tools);

		await joplin.workspace.onNoteSelectionChange(async () => {
      await addHistItem();
      updateHistView(panel);
		});

    updateHistView(panel);
	},
});
