import joplin from 'api';
import { MenuItemLocation, ToolbarButtonLocation } from 'api/types';
import addHistItem from './history';
import { HistSettings, getSettingsSection, updateSettings,
    trailFormat, freqOpen, freqLoc, freqScope } from './settings'
import updateHistView from './panel'

const settings: HistSettings = {
  histNoteId: '',
  secBetweenItems: 0,
  maxDays: 90,
  panelTitle: 'HISTORY',
  panelTitleSize: 13,
  panelTextSize: 12,
  panelTextSpace: 4,
  trailDisplay: 3,
  trailRecords: 6,
  trailBacklinks: true,
  trailLength: 10,
  trailWidth: 20,
  plotSize: [20, 16],
  trailColors: ['#e07a5f', '#81b29a', '#f2cc8f', '#6083c5', '#8e646b', '#858935'],
  trailFormat: trailFormat.beforeTitle,
  freqDisplay: 5,
  freqOpen: freqOpen.close,
  freqLoc: freqLoc.top,
  freqScope: freqScope.week,
  userStyle: '',
}

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

    await joplin.settings.registerSettings(getSettingsSection(settings));

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
      await updateSettings(settings);
      const vis = await joplin.views.panels.visible(panel);
      if (vis)
        updateHistView(panel, settings);
    });

    await joplin.workspace.onNoteSelectionChange(async () => {
      await addHistItem(settings);
      const vis = await joplin.views.panels.visible(panel);
      if (vis)
        updateHistView(panel, settings);
    });

    await joplin.workspace.onSyncComplete(async () =>  {
      const vis = await joplin.views.panels.visible(panel);
      if (vis)
        updateHistView(panel, settings);
    });

    await joplin.views.panels.onMessage(panel, (message) => {
      if (message.name === 'openHistory') {
        joplin.commands.execute('openNote', message.hash);
      }
    });

    await updateSettings(settings);
    updateHistView(panel, settings);
  },
});
