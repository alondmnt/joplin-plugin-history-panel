import joplin from 'api';
import { HistSettings, parseItem, freqScope, freqLoc, freqOpen } from './history';

async function getItemHtml(params: HistSettings): Promise<string> {
  let histNote;
  try {
    histNote = await joplin.data.get(['notes', params.histNoteId], { fields: ['body'] });
  } catch {
    return 'Please set a history note (from the Tools menu) to start logging';
  }

  const itemHtml: string[] = [];
  itemHtml.push('<details open class="hist-section"><summary class="hist-section">Today</summary>');

  let foldTag: string;
  let plotTag: string;
  const dateScope = new Set(['today']);
  const activeTrail = new Set() as Set<number>;
  let noteCounter = new Map<string, number>();
  let noteMap = new Map<string, string>();

  for (const line of histNote.body.split('\n')) {
    const [noteDate, noteTitle, noteId, noteTrail] = parseItem(line);
    foldTag = getFoldTag(noteDate, dateScope);
    plotTag = getPlotTag(noteTrail, activeTrail, params);
    if (params.freqLoc != freqLoc.hide)
      updateStats(noteId, noteTitle, noteDate, noteCounter, noteMap, dateScope, params);

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
  itemHtml.push('</details>')

  let statsHtml = '';
  if (params.freqLoc != freqLoc.hide)
    statsHtml = getStatsHtml(noteCounter, noteMap, params);
  console.log(noteCounter);

  let allHtml = '';
  if (params.freqLoc == freqLoc.top)
    allHtml += statsHtml;
  allHtml += itemHtml.join('\n');
  if (params.freqLoc == freqLoc.bottom)
    allHtml += statsHtml;

  return allHtml
}

function getFoldTag(noteDate: Date, dateScope: Set<string>): string {
  /* whenever we pass a threshold, we need to close the previous folding section
     and start a new one */
  const now = new Date();
  const dayDiff = getDateDay(now) - getDateDay(noteDate);
  if (!dateScope.has('yesterday') && (dayDiff == 1)) {
    dateScope.add('yesterday');
    return '</details><details class="hist-section"><summary class="hist-section">Yesterday</summary>';
  }
  if (!dateScope.has('week') &&
      (dayDiff > 1) && (dayDiff <= 6)) {
    dateScope.add('week');
    return '</details><details class="hist-section"><summary class="hist-section">Last 7 days</summary>';
  }

  let strMonth = getMonthString(noteDate);
  if (strMonth == getMonthString(now))
    strMonth = 'This month';
  if (!dateScope.has(strMonth) && (dayDiff > 6)) {
    dateScope.add(strMonth);
    return `</details><details class="hist-section"><summary class="hist-section">${strMonth}</summary>`;
  }

  return '';
}

function getPlotTag(trail: number[], activeTrail: Set<number>, params: HistSettings): string {
  const yDot = params.plotSize[1] / 2;  // connector pos
  const rDotMax = 0.5*params.trailDisplay + 2;
  const xBase = params.plotSize[0] - rDotMax;
  const yControl = params.plotSize[1] / 2;
  let plot = `<svg class="hist-plot" style="width: ${params.plotSize[0]}px">`;

  for (let i = 1; i <= params.trailDisplay; i++) {
    const color = params.trailColors[(i-1) % params.trailColors.length];
    const xLevel = xBase * (1 - (i-1)/(params.trailDisplay));
    const rLevel = rDotMax - (i-1)/2;

    if (trail.includes(i)) {
      if (activeTrail.has(i))  // continue trail
        plot += `
            <line x1="${xLevel}" y1="0" x2="${xLevel}" y2="${params.plotSize[1]}"
              style="stroke:${color};" />
          `;
      else {  // start trail
        activeTrail.add(i);
        plot += `
          <path d="M ${xBase} ${yDot} C ${xBase} ${yControl}, ${xLevel} ${yControl}, ${xLevel} ${params.plotSize[1]}"
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

function updateStats(noteId: string, noteTitle: string, noteDate: Date,
    noteCounter: Map<string, number>, noteMap: Map<string, string>,
    dateScope: Set<string>, params: HistSettings) {
  const now = new Date();
  const dayDiff = getDateDay(now) - getDateDay(noteDate);
  if ((params.freqScope == freqScope.today) && (dayDiff > 0)) {
    return
  }
  if ((params.freqScope == freqScope.week) && (dayDiff > 6)) {
    return
  }
  if ((params.freqScope == freqScope.month) &&
      (getMonthString(noteDate) != getMonthString(now))) {
    return
  }
  if ((params.freqScope == freqScope.year) &&
      (getYearString(noteDate) != getYearString(now))) {
    return
  }
  if (!noteCounter.has(noteId)) {
    noteCounter.set(noteId, 0);
    noteMap.set(noteId, noteTitle);
  }
  noteCounter.set(noteId, noteCounter.get(noteId) + 1);
}

function getStatsHtml(noteCounter: Map<string, number>,
      noteMap: Map<string, string>, params: HistSettings): string {
  const maxR = 5;  // px
  const itemHtml: string[] = [];
  const noteOrder = new Map([...noteCounter.entries()].sort((a, b) => b[1] - a[1]));
  const maxCount = Math.max(...noteCounter.values());

  let strOpen = '';
  if (params.freqOpen == freqOpen.open)
    strOpen = ' open';
  itemHtml.push(`<details class="hist-section"${strOpen}><summary class="hist-section">Frequent notes</summary>`);

  let i = 0;
  noteOrder.forEach( (count, id) => {
    i += 1;
    if (i > params.freqDisplay)
      return
    itemHtml.push(`
      <p class="hist-item">
      <svg class="hist-plot" style="width: ${params.plotSize[0]}px">
      <circle cx="${params.plotSize[0] / 2}" cy="${params.plotSize[1] / 2}" r="${maxR*count/maxCount}"
        stroke="none" fill="${params.trailColors[0]}" />
      </svg>
      <a class="hist-item" href="#" data-slug="${id}">
        ${escapeHtml(`${noteMap.get(id)}`)}
      </a>
      </p>
    `);
  });
  itemHtml.push('</details>')
  return itemHtml.join('\n');
}

function getDateDay(date: Date): number {
  return Math.ceil((date.getTime() - 1000*60*date.getTimezoneOffset()) / 86400000);
}

function getMonthString(date: Date): string {
  return date.toUTCString().split(' ')[2] + ' ' + getYearString(date)
}

function getYearString(date: Date): string {
  return date.toUTCString().split(' ')[3]
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
    <p class="hist-title"><a class="hist-title" href="#" data-slug="${params.histNoteId}" style="font-size:${params.panelTitleSize}pt">${params.panelTitle}</a></p>
    ${itemHtml}
  </div>
  `);
  // const finish = new Date().getTime();
  // console.log('updateHistView: ' + (finish-start) + 'ms')
}
