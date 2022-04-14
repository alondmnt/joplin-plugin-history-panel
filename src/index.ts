import joplin from 'api';
import { SettingItemType, MenuItemLocation, ToolbarButtonLocation } from 'api/types';
import addHistItem, { HistSettings, trailFormat, freqScope, freqLoc, freqOpen } from './history';
import updateHistView from './panel'

const settings: HistSettings = {
  histNoteId: '',
  secBetweenItems: 0,
  maxDays: 90,
  panelTitle: 'HISTORY',
  panelTitleSize: 10,
  trailDisplay: 3,
  trailRecords: 6,
  trailBacklinks: true,
  trailLength: 10,
  trailWidth: 20,
  plotSize: [20, 14],
  trailColors: ['#e07a5f', '#81b29a', '#f2cc8f', '#6083c5', '#8e646b', '#858935'],
  trailFormat: trailFormat.beforeTitle,
  freqDisplay: 5,
  freqOpen: freqOpen.close,
  freqLoc: freqLoc.top,
  freqScope: freqScope.week,
  userStyle: '',
}

async function updateSettings() {
  settings.histNoteId = await joplin.settings.value('histNoteId');
  settings.secBetweenItems = await joplin.settings.value('histSecBetweenItems');
  settings.maxDays = await joplin.settings.value('histMaxDays');
  settings.panelTitle = await joplin.settings.value('histPanelTitle');
  settings.panelTitleSize = await joplin.settings.value('histPanelTitleSize');
  settings.trailDisplay = await joplin.settings.value('histTrailDisplay');
  settings.trailRecords = await joplin.settings.value('histTrailRecords');
  settings.trailBacklinks = await joplin.settings.value('histTrailBacklinks');
  settings.trailLength = await joplin.settings.value('histTrailLength');
  settings.trailWidth = await joplin.settings.value('histTrailWidth');
  settings.plotSize = [settings.trailWidth, 14];  // 'calc(var(--joplin-font-size) + 2px)'
  settings.trailColors = (await joplin.settings.value('histTrailColors')).split(',');
  settings.trailFormat = await joplin.settings.value('histTrailFormat');
  settings.freqDisplay = await joplin.settings.value('histFreqDisplay');
  settings.freqOpen = await joplin.settings.value('histFreqOpen');
  settings.freqLoc = await joplin.settings.value('histFreqLoc');
  settings.freqScope = await joplin.settings.value('histFreqScope');
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
        label: 'History: note ID',
      },

      'histSecBetweenItems': {
        value: settings.secBetweenItems,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        public: true,
        label: 'History: Min seconds between items',
      },

      'histMaxDays': {
        value: settings.maxDays,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        public: true,
        label: 'History: Days of history to keep',
        description: 'Enter 0 for eternity'
      },

      'histPanelTitle': {
        value: settings.panelTitle,
        type: SettingItemType.String,
        section: 'HistoryPanel',
        public: true,
        label: 'Panel: title',
      },

      'histPanelTitleSize': {
        value: settings.panelTitleSize,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        public: true,
        label: 'Panel: title font size',
      },

      'histTrailDisplay': {
        value: settings.trailDisplay,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        public: true,
        label: 'Trails: No. of trails (note links) levels to display',
        description: 'Enter 0 to hide',
      },

      'histTrailRecords': {
        value: settings.trailRecords,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        public: true,
        label: 'Trails: No. of trails levels to record in logs',
      },

      'histTrailBacklinks': {
        value: settings.trailBacklinks,
        type: SettingItemType.Bool,
        section: 'HistoryPanel',
        public: true,
        label: 'Trails: include backlinks',
      },

      'histTrailLength': {
        value: settings.trailLength,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        public: true,
        label: 'Trails: Max trail length (no. of items)',
      },

      'histTrailWidth': {
        value: settings.trailWidth,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        public: true,
        label: 'Trails: plot width (px)',
      },

      'histTrailColors': {
        value: settings.trailColors.join(','),
        type: SettingItemType.String,
        section: 'HistoryPanel',
        public: true,
        label: 'Trails: color map',
        description: 'Comma-separated colors'
      },

      'histTrailFormat': {
        value: settings.trailFormat,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        isEnum: true,
        public: true,
        label: 'Trails: markdown format',
        options: {
          '0': 'Before note title',
          '1': 'After note title',
        }
      },

      'histFreqLoc': {
        value: settings.freqLoc,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        isEnum: true,
        public: true,
        label: 'Frequent notes: location',
        options: {
          '0': 'Top of panel',
          '1': 'Bottom of panel',
          '2': 'Hidden',
        }
      },

      'histFreqOpen': {
        value: settings.freqOpen,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        isEnum: true,
        public: true,
        label: 'Frequent notes: panel section default state',
        options: {
          '0': 'Closed',
          '1': 'Open',
        }
      },

      'histFreqDisplay': {
        value: settings.freqDisplay,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        public: true,
        label: 'Frequent notes: no. of items',
      },

      'histFreqScope': {
        value: settings.freqScope,
        type: SettingItemType.Int,
        section: 'HistoryPanel',
        isEnum: true,
        public: true,
        label: 'Frequent notes: statistics time period',
        options: {
          '0': 'Today',
          '1': 'Last 7 days',
          '2': 'This month',
          '3': 'This year',
          '4': 'All',
        }
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
        updateHistView(panel, settings);
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
