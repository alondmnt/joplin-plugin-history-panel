import joplin from 'api';
import { HistSettings, parseItem } from './history';

async function getItemHtml(params: HistSettings): Promise<string> {
  const now = new Date();
  let histNote;
  try {
    histNote = await joplin.data.get(['notes', params.histNoteId], { fields: ['body'] });
  } catch {
    return 'Please set a history note (from the Tools menu) to start logging';
  }

  const itemHtml = [];
  let foldTag: string;
  let plotTag: string;
  const dateScope = new Set(['today']);
  const activeTrail = new Set() as Set<number>;

  for (const line of histNote.body.split('\n')) {
    const [noteDate, noteTitle, noteId, noteTrail] = parseItem(line);
    foldTag = getFoldTag(now, noteDate, dateScope);
    plotTag = getPlotTag(noteTrail, activeTrail, params);

    itemHtml.push(`
            ${foldTag}
            <p class="hist-item">
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

function getPlotTag(trail: number[], activeTrail: Set<number>, params: HistSettings): string {
  const plotSize = [params.trailWidth, 14];  // 'calc(var(--joplin-font-size) + 2px)'
  const yDot = plotSize[1] / 2;  // connector pos
  const rDotMax = 0.5*params.trailDisplay + 2;
  const xBase = plotSize[0] - rDotMax;
  const yControl = plotSize[1] / 2;
  let plot = `<svg class="hist-plot" style="width: ${params.trailWidth}px">`;

  for (let i = 1; i <= params.trailDisplay; i++){
    const color = params.trailColors[(i-1) % params.trailColors.length];
    const xLevel = xBase * (1 - (i-1)/(params.trailDisplay));
    const rLevel = rDotMax - (i-1)/2;

    if (trail.includes(i)) {
      if (activeTrail.has(i))  // continue trail
        plot += `
            <line x1="${xLevel}" y1="0" x2="${xLevel}" y2="${plotSize[1]}"
              style="stroke:${color};" />
          `;
      else {  // start trail
        activeTrail.add(i);
        plot += `
          <path d="M ${xBase} ${yDot} C ${xBase} ${yControl}, ${xLevel} ${yControl}, ${xLevel} ${plotSize[1]}"
            stroke="${color}" fill="none" />
          <circle cx="${xBase}" cy="${yDot}" r="${rLevel}"
            stroke="none" fill="${color}" />
          `;
      }
    } else if (activeTrail.has(i)){ // end trail
        activeTrail.delete(i);
        plot += `
          <path d="M ${xLevel} 0 C ${xLevel} ${yControl}, ${xBase} ${yControl}, ${xBase} ${yDot}"
            stroke="${color}" fill="none" />
          <circle cx="${xBase}" cy="${yDot}" r="${rLevel}"
            stroke="none" fill="${color}" />
          `;
    }
  }
  return plot + '</svg>';
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

export default async function updateHistView(panel:string, params: HistSettings) {
  // const start = new Date().getTime();

  // First create the HTML for each history item:
  const itemHtml = await getItemHtml(params);

  // Finally, insert all the items in a container and set the webview HTML:
  await joplin.views.panels.setHtml(panel, `
  <html>
  <style>
  ${params.userStyle}
  </style>
  <div class="container">
    <p class="hist-title"><a class="hist-title" href="#" data-slug="${params.histNoteId}" style="font-size:${params.panelFontSize}pt">${params.panelTitle}</a></p>
    <details open class="hist-section">
    <summary class="hist-section">Today</summary>
    ${itemHtml}
    </details>
  </div>
  `);
  // const finish = new Date().getTime();
  // console.log('updateHistView: ' + (finish-start) + 'ms')
}
