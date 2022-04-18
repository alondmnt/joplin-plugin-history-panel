import joplin from 'api';
import { SettingItem, SettingItemType } from 'api/types';

export interface HistSettings {
  histNoteId: string;
  secBetweenItems: number;
  maxDays: number;
  panelTitle: string;
  panelTitleSize: number;
  panelTextSize: number;
  panelTextSpace: number;
  trailDisplay: number;
  trailRecords: number;
  trailBacklinks: boolean;
  trailLength: number;
  trailWidth: number;
  plotSize: number[];
  trailColors: string[];
  trailFormat: trailFormat;
  freqLoc: freqLoc;
  freqOpen: freqOpen;
  freqDisplay: number;
  freqScope: freqScope;
  userStyle: string;
  }
  
export enum trailFormat {
  'beforeTitle',
  'afterTitle',
}

export enum freqScope {
  'today',
  'week',
  'month',
  'year',
  'all',
}

export enum freqLoc {
  'top',
  'bottom',
  'hide',
}

export enum freqOpen {
  'close',
  'open',
}
  
export async function updateSettings(settings) {
  settings.histNoteId = await joplin.settings.value('histNoteId');
  settings.secBetweenItems = await joplin.settings.value('histSecBetweenItems');
  settings.maxDays = await joplin.settings.value('histMaxDays');
  settings.panelTitle = await joplin.settings.value('histPanelTitle');
  settings.panelTitleSize = await joplin.settings.value('histPanelTitleSize');
  settings.panelTextSize = await joplin.settings.value('histPanelTextSize');
  settings.trailDisplay = await joplin.settings.value('histTrailDisplay');
  settings.trailRecords = await joplin.settings.value('histTrailRecords');
  settings.trailBacklinks = await joplin.settings.value('histTrailBacklinks');
  settings.trailLength = await joplin.settings.value('histTrailLength');
  settings.trailWidth = await joplin.settings.value('histTrailWidth');
  settings.plotSize = [settings.trailWidth,
      settings.panelTextSize + settings.panelTextSpace];
  settings.trailColors = (await joplin.settings.value('histTrailColors')).split(',');
  settings.trailFormat = await joplin.settings.value('histTrailFormat');
  settings.freqDisplay = await joplin.settings.value('histFreqDisplay');
  settings.freqOpen = await joplin.settings.value('histFreqOpen');
  settings.freqLoc = await joplin.settings.value('histFreqLoc');
  settings.freqScope = await joplin.settings.value('histFreqScope');
  settings.userStyle = await joplin.settings.value('histUserStyle');
};

export function getSettingsSection(settings): Record<string, SettingItem> {
  return {
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
      label: 'Panel: title font size (px)',
    },

    'histPanelTextSize': {
      value: settings.panelTextSize,
      type: SettingItemType.Int,
      section: 'HistoryPanel',
      public: true,
      label: 'Panel: text font size (px)',
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
  }
}
