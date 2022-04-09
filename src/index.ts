import joplin from 'api';
import { SettingItemType, MenuItemLocation, ToolbarButtonLocation } from 'api/types';
import addHistItem, { HistSettings } from './history';
import updateHistView from './panel'

const settings:HistSettings = {
  histNoteId: '',
  secBetweenItems: 0,
  maxDays: 90,
  panelTitle: 'HISTORY',
  panelFontSize: 10,
  trailDisplay: 3,
  trailRecords: 6,
  trailBacklinks: true,
  trailLength: 10,
  trailWidth: 20,
  trailColors: ['#e07a5f', '#81b29a', '#f2cc8f', '#6083c5', '#8e646b', '#858935'],
  userStyle: '',
}

async function updateSettings() {
  settings.histNoteId = await joplin.settings.value('histNoteId');
  settings.secBetweenItems = await joplin.settings.value('histSecBetweenItems');
  settings.maxDays = await joplin.settings.value('histMaxDays');
  settings.panelTitle = await joplin.settings.value('histPanelTitle');
  settings.panelFontSize = await joplin.settings.value('histPanelFontSize');
  settings.trailDisplay = await joplin.settings.value('histTrailDisplay');
  settings.trailRecords = await joplin.settings.value('histTrailRecords');
  settings.trailBacklinks = await joplin.settings.value('histTrailBacklinks');
  settings.trailLength = await joplin.settings.value('histTrailLength');
  settings.trailWidth = await joplin.settings.value('histTrailWidth');
  settings.trailColors = (await joplin.settings.value('histTrailColors')).split(',');
  settings.userStyle = await joplin.settings.value('histUserStyle');
};

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
        value: settings.histNoteId,
        type: SettingItemType.String,
        section: 'HistoryPanel',
        public: true,
        label: 'History note ID',
      },

      'histSecBetweenItems': {
        value: settings.secBetweenItems,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        public: true,
        label: 'Min seconds between history items',
      },

      'histMaxDays': {
        value: settings.maxDays,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        public: true,
        label: 'Days of history to keep',
        description: 'Enter 0 for eternity'
      },

      'histPanelTitle': {
        value: settings.panelTitle,
        type: SettingItemType.String,
        section: 'HistoryPanel',
        public: true,
        label: 'Panel title',
      },

      'histPanelFontSize': {
        value: settings.panelFontSize,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        public: true,
        label: 'Panel title font size',
      },

      'histTrailDisplay': {
        value: settings.trailDisplay,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        public: true,
        label: 'No. of trails (note links) levels to display',
        description: 'Enter 0 to hide',
      },

      'histTrailRecords': {
        value: settings.trailRecords,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        public: true,
        label: 'No. of trails levels to record in logs',
      },

      'histTrailBacklinks': {
        value: settings.trailBacklinks,
        type: SettingItemType.Bool,
        section: 'HistoryPanel',
        public: true,
        label: 'Trails include backlinks',
      },

      'histTrailLength': {
        value: settings.trailLength,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        public: true,
        label: 'Max trail length',
      },

      'histTrailWidth': {
        value: settings.trailWidth,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        public: true,
        label: 'Trail plot width (px)',
      },

      'histTrailColors': {
        value: settings.trailColors.join(','),
        type: SettingItemType.String,
        section: 'HistoryPanel',
        public: true,
        label: 'Trails color map',
        description: 'Comma-separated colors'
      },

      'histUserStyle': {
        value: settings.userStyle,
        type: SettingItemType.String,
        section: 'HistoryPanel',
        public: true,
        label: 'Panel stylesheet',
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
        const vis = await joplin.views.panels.visible(panel);
        if (vis)
          joplin.views.panels.hide(panel);
        else{
          updateHistView(panel, settings);
          joplin.views.panels.show(panel);
        }
      },
    });

    await joplin.views.menuItems.create('menuHistPanel', 'toggleHistPanel', MenuItemLocation.View);
    await joplin.views.toolbarButtons.create('butHistPanel', 'toggleHistPanel', ToolbarButtonLocation.NoteToolbar);

    await joplin.settings.onChange(async () => {
      await updateSettings();
      updateHistView(panel, settings);
    });

    await joplin.workspace.onNoteSelectionChange(async () => {
      await addHistItem(settings);
      const vis = await joplin.views.panels.visible(panel);
      if (vis)
        updateHistView(panel, settings);
    });

    await joplin.views.panels.onMessage(panel, (message) => {
      if (message.name === 'openHistory') {
        joplin.commands.execute('openNote', message.hash);
      }
    });

    await updateSettings();
    updateHistView(panel, settings);
  },
});
