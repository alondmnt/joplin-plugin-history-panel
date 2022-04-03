import joplin from 'api';
import { parseItem } from './history';

async function histLinks(histNoteId:string): Promise<string> {
  const now = new Date();
  let histNote;
  try {
    histNote = await joplin.data.get(['notes', histNoteId], { fields: ['id', 'title', 'body'] });
  } catch {
    return 'Please set a history note (from the Tools menu) to start logging';
  }

  const itemHtml = [];
  let foldTag: string;
  let plotTag: string;
  const dateScope = new Set(['today']);

  for (const line of histNote.body.split('\n')) {
    const [noteDate, noteTitle, noteId, noteLinks] = parseItem(line);
    foldTag = getFoldTag(now, noteDate, dateScope);
    plotTag = getPlotTag(noteLinks);

    itemHtml.push(`
            ${foldTag}
            <p class="hist-item" style="margin:0px">
              ${plotTag}
              <a class="hist-item" href="#" data-slug="${noteId}">
                ${escapeHtml(noteTitle)}
              </a>
            </p>
          `);
  }
  return itemHtml.join('\n');
}

function getFoldTag(now: Date, noteDate: Date, dateScope: Set<string>): string {
  /* whenever we pass a threshold, we need to close the previous folding section
     and start a new one */
  const dayDiff = getDateDay(now) - getDateDay(noteDate);
  if (!dateScope.has('yesterday') && (dayDiff == 1)) {
    dateScope.add('yesterday');
    return '</details><details class="hist-section"><summary class="hist-section">Yesterday</summary>';
  }
  if (!dateScope.has('week') &&
      (dayDiff > 1) && (dayDiff <= 7)) {
    dateScope.add('week');
    return '</details><details class="hist-section"><summary class="hist-section">Last 7 days</summary>';
  }

  let strMonth = getMonthString(noteDate);
  if (strMonth == getMonthString(now))
    strMonth = 'This month';
  if (!dateScope.has(strMonth) && (dayDiff > 7)) {
    dateScope.add(strMonth);
    return `</details><details class="hist-section"><summary class="hist-section">${strMonth}</summary>`;
  }

  return '';
}

function getPlotTag(links: string): string {
  if (links.length == 0)
    return '<svg class="hist-plot"></svg>';

  return '<svg class="hist-plot"><line x1="0%" y1="0%" x2="0%" y2="100%" style="stroke:rgb(255,0,0);stroke-width:2" /></svg>';
}

function getDateDay(date: Date): number {
  return Math.ceil((date.getTime() - 1000*60*date.getTimezoneOffset()) / 86400000);
}

function getMonthString(date: Date): string{
  return date.toUTCString().split(' ')[2] + ' ' + date.toString().split(' ')[3]
}

// From https://stackoverflow.com/a/6234804/561309
function escapeHtml(unsafe:string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default async function updateHistView(panel:string) {
  // const start = new Date().getTime();
  const histNoteId = await joplin.settings.value('histNoteId') as string;
  const userTitle = await joplin.settings.value('histPanelTitle') as string;
  const userFontsize = await joplin.settings.value('histPanelFontSize') as number;
  const userStyle = await joplin.settings.value('histUserStyle') as string;

  // First create the HTML for each history item:
  const itemHtml = await histLinks(histNoteId);

  // Finally, insert all the items in a container and set the webview HTML:
  await joplin.views.panels.setHtml(panel, `
  <html>
  <style>
  ${userStyle}
  </style>
  <div class="container">
    <p class="hist-title"><a class="hist-title" href="#" data-slug="${histNoteId}" style="font-size:${userFontsize}pt">${userTitle}</a></p>
    <details open class="hist-section">
    <summary class="hist-section">Today</summary>
    ${itemHtml}
    </details>
  </div>
  `);
  // const finish = new Date().getTime();
  // console.log('updateHistView: ' + (finish-start) + 'ms')
}
