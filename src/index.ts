import joplin from 'api';
import { MenuItemLocation, ToolbarButtonLocation } from 'api/types';
import addHistItem from './history';
import { HistSettings, getSettingsSection, updateSettings,
    trailFormat, freqOpen, freqLoc, freqScope, setFolders, includeType } from './settings'
import updateHistView from './panel'

const settings: HistSettings = {
  currentLine: 0,
  histNoteId: '',
  excludeNotes: new Set(),
  excludeFolders: new Set(),
  excludeTags: new Set(['exclude.from.history']),
  includeType: includeType.both,
  detectBacktrack: true,
  markCurrentLine: false,
  secBetweenItems: 0,
  maxDays: 90,
  panelTitle: 'HISTORY',
  panelTitleSize: 13,
  panelTextSize: 12,
  panelTextSpace: 4,
  panelMaxItems: 1000,
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
        updateHistView(panel, settings, false);
      },
    });

    await joplin.commands.register({
      name: 'setHistExclude',
      label: 'Exclude note from history',
      execute: async () => {
        const note = await joplin.workspace.selectedNote();
        if (note == undefined) return;

        settings.excludeNotes.delete('');
        settings.excludeNotes.add(note.id);
        await joplin.settings.setValue('histExcludeNotes', Array(...settings.excludeNotes).toString())
      },
    });

    await joplin.commands.register({
      name: 'setHistInclude',
      label: 'Include note in history (un-exclude)',
      execute: async () => {
        const note = await joplin.workspace.selectedNote();
        if (note == undefined) return;

        settings.excludeNotes.delete(note.id);
        await joplin.settings.setValue('histExcludeNotes', Array(...settings.excludeNotes).toString())
      },
    });

    await joplin.commands.register({
      name: 'setHistExcludeFolder',
      label: 'Exclude notebook from history',
      execute: async () => {
        const folder = await joplin.workspace.selectedFolder();
        if (folder == undefined) return;

        setFolders(true, folder.id, settings);
      },
    });

    await joplin.commands.register({
      name: 'setHistIncludeFolder',
      label: 'Include notebook in history',
      execute: async () => {
        const folder = await joplin.workspace.selectedFolder();
        if (folder == undefined) return;

        setFolders(false, folder.id, settings);
      },
    });

    await joplin.views.menus.create('histMenu', 'History', [
      {
        label: 'menuHistNote',
        commandName: 'setHistNote',
      },
      {
        label: 'menuHistExclude',
        commandName: 'setHistExclude',
      },
      {
        label: 'menuHistInclude',
        commandName: 'setHistInclude',
      },
      {
        label: 'menuHistExcludeFolder',
        commandName: 'setHistExcludeFolder',
      },
      {
        label: 'menuHistIncludeFolder',
        commandName: 'setHistIncludeFolder',
      },
    ], MenuItemLocation.Tools);

    await joplin.commands.register({
      name: 'toggleHistPanel',
      label: 'Toggle history panel',
      iconName: 'far fa-hourglass',
      execute: async () => {
        const vis = await joplin.views.panels.visible(panel);
        if (vis)
          joplin.views.panels.hide(panel);
        else{
          updateHistView(panel, settings, false);
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
        updateHistView(panel, settings, false);
    });

    await joplin.workspace.onNoteSelectionChange(async () => {
      await addHistItem(settings);
      const vis = await joplin.views.panels.visible(panel);
      if (vis)
        updateHistView(panel, settings, false);
    });

    await joplin.workspace.onSyncComplete(async () =>  {
      const vis = await joplin.views.panels.visible(panel);
      if (vis)
        updateHistView(panel, settings, false);
    });

    await joplin.views.panels.onMessage(panel, (message) => {
      if (message.name === 'openHistory') {
        joplin.commands.execute('openNote', message.hash);
        if (settings.markCurrentLine)
          settings.currentLine = Number(message.line) - 1;
      }
      if (message.name === 'loadHistory') {
        updateHistView(panel, settings, true);
      }
    });

    await updateSettings(settings);
    updateHistView(panel, settings, false);
  },
});
