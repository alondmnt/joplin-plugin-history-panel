import joplin from 'api';
import { SettingItemType, MenuItemLocation, ToolbarButtonLocation } from 'api/types';
import addHistItem from './history';
import updateHistView from './panel'

joplin.plugins.register({
	onStart: async function() {
    const panel = await joplin.views.panels.create('history');
    await joplin.views.panels.addScript(panel, './webview.css');
    await joplin.views.panels.addScript(panel, './webview.js');
    await joplin.views.panels.setHtml(panel, 'Loading...');

    await joplin.settings.registerSection('HistoryPanel', {
			label: 'History Panel',
			iconName: 'far fa-hourglass',
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
        description: 'Enter 0 for eternity'
			},

			'histPanelTitle': {
				value: 'HISTORY',
				type: SettingItemType.String,
				section: 'HistoryPanel',
				public: true,
				label: 'Panel title',
			},

			'histPanelFontSize': {
				value: 11,
				type: SettingItemType.Int,
				section: 'HistoryPanel',
				public: true,
				label: 'Panel title font size',
			},

      'histUserStyle': {
        value: '',
        type: SettingItemType.String,
        section: 'HistoryPanel',
        public: true,
        label: 'Panel stylesheet',
        description: 'Classes include "hist-section" and "hist-item"'
      },
		});

    await joplin.commands.register({
			name: 'setHistNote',
			label: 'Set history note',
			iconName: 'far fa-hourglass',
			execute: async () => {
        const note = await joplin.workspace.selectedNote();
				await joplin.settings.setValue('histNoteId', note.id);
			},
		});

    await joplin.views.menuItems.create('menuHistNote', 'setHistNote', MenuItemLocation.Tools);

    await joplin.commands.register({
			name: 'toggleHistPanel',
			label: 'Toggle history panel',
			iconName: 'far fa-hourglass',
			execute: async () => {
        const vis = await joplin.views.panels.visible(panel)
        if (vis)
          joplin.views.panels.hide(panel);
        else{
          updateHistView(panel);
          joplin.views.panels.show(panel);
        }
			},
		});

    await joplin.views.menuItems.create('menuHistPanel', 'toggleHistPanel', MenuItemLocation.View);
    await joplin.views.toolbarButtons.create('butHistPanel', 'toggleHistPanel', ToolbarButtonLocation.NoteToolbar);

		await joplin.workspace.onNoteSelectionChange(async () => {
      await addHistItem();
      const vis = await joplin.views.panels.visible(panel)
      if (vis)
        updateHistView(panel);
		});

		await joplin.views.panels.onMessage(panel, (message) => {
			if (message.name === 'openHistory') {
				joplin.commands.execute('openNote', message.hash)
			}
		});

    updateHistView(panel);
	},
});
