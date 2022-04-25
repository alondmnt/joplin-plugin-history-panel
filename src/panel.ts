import joplin from 'api';
import { HistItem, parseItem } from './history';
import { HistSettings, freqScope, freqLoc, freqOpen } from './settings';

const DEBUG = false;

async function getHistHtml(maxItems: number, params: HistSettings): Promise<string> {
  let histNote;
  try {
    histNote = await joplin.data.get(['notes', params.histNoteId], { fields: ['body'] });
  } catch {
    return 'Please set a history note (from the Tools menu) to start logging';
  }

  const first_sec = `<details open class="hist-section"><summary class="hist-section" style="font-size: ${params.panelTextSize}px">Today</summary>`;

  let itemMap = new Map<string, string>();

  const lines = histNote.body.split('\n')
  const [itemHtml, itemCounter] = getItemHtml(lines, itemMap, maxItems, params);

  let statsHtml = '';
  if (params.freqLoc != freqLoc.hide)
    statsHtml = getStatsHtml(itemCounter, itemMap, params);

  let allHtml: string[] = [];
  if (params.freqLoc == freqLoc.top)
    allHtml.push(statsHtml);
  allHtml = allHtml.concat([first_sec], itemHtml);
  if (params.freqLoc == freqLoc.bottom)
    allHtml.push(statsHtml);

  if (maxItems < lines.length)
    allHtml.push(`<p class="hist-loader"><a class="hist-loader" href="#">Load more items</a><br><br></p>`);

  return allHtml.join('\n')
}

function getItemHtml(lines: string[], itemMap: Map<string,
    string>, maxItems: number, params: HistSettings):
    [string[], Map<string, number>] {
  let foldTag: string;
  let plotTag: string;
  const dateScope = new Set(['today']);
  const activeTrail = new Set() as Set<number>;
  let itemCounter = new Map<string, number>();
  let itemHtml: string[] = [];
  const N = Math.min(maxItems, lines.length);

  for (let i = 0; i < N; i++) {
    const [item, error] = parseItem(lines[i]);
    if (error) continue;
    foldTag = getFoldTag(item, dateScope, params.panelTextSize);
    plotTag = getPlotTag(item.trails, activeTrail, params);
    if (params.freqLoc != freqLoc.hide)
      updateStats(item, itemCounter, itemMap, dateScope, params);

    itemHtml.push(`
            ${foldTag}
            <p class="hist-item" style="font-size: ${params.panelTextSize}px; height: ${params.plotSize[1]}px">
              ${plotTag}
              <a class="hist-item" href="#" data-slug="${item.id}">
                ${escapeHtml(item.title)}
              </a>
            </p>
          `);
  }
  itemHtml.push('</details>');
  return [itemHtml, itemCounter];
}

function getFoldTag(item: HistItem, dateScope: Set<string>, fontSize: number): string {
  /* whenever we pass a threshold, we need to close the previous folding section
     and start a new one */
  const now = new Date();
  const dayDiff = getDateDay(now) - getDateDay(item.date);
  if (!dateScope.has('yesterday') && (dayDiff == 1)) {
    dateScope.add('yesterday');
    return `</details><details class="hist-section"><summary class="hist-section" style="font-size: ${fontSize}px">Yesterday</summary>`;
  }
  if (!dateScope.has('week') &&
      (dayDiff > 1) && (dayDiff <= 6)) {
    dateScope.add('week');
    return `</details><details class="hist-section"><summary class="hist-section" style="font-size: ${fontSize}px">Last 7 days</summary>`;
  }

  let strMonth = getMonthString(item.date);
  if (strMonth == getMonthString(now))
    strMonth = 'This month';
  if (!dateScope.has(strMonth) && (dayDiff > 6)) {
    dateScope.add(strMonth);
    return `</details><details class="hist-section"><summary class="hist-section" style="font-size: ${fontSize}px">${strMonth}</summary>`;
  }

  return '';
}

function getPlotTag(trail: number[], activeTrail: Set<number>, params: HistSettings): string {
  const yDot = params.plotSize[1] / 2;  // connector pos
  const rDotMax = 0.5*params.trailDisplay + 2;
  const xBase = params.plotSize[0] - rDotMax;
  const yControl = yDot;
  let plot = `<svg class="hist-plot" style="width: ${params.plotSize[0]}px; height: ${params.plotSize[1]}px">`;

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

function updateStats(item: HistItem, itemCounter: Map<string, number>,
    itemMap: Map<string, string>, dateScope: Set<string>, params: HistSettings) {
  const now = new Date();
  const dayDiff = getDateDay(now) - getDateDay(item.date);
  if ((params.freqScope == freqScope.today) && (dayDiff > 0)) {
    return
  }
  if ((params.freqScope == freqScope.week) && (dayDiff > 6)) {
    return
  }
  if ((params.freqScope == freqScope.month) &&
      (getMonthString(item.date) != getMonthString(now))) {
    return
  }
  if ((params.freqScope == freqScope.year) &&
      (getYearString(item.date) != getYearString(now))) {
    return
  }
  if (!itemCounter.has(item.id)) {
    itemCounter.set(item.id, 0);
    itemMap.set(item.id, item.title);
  }
  itemCounter.set(item.id, itemCounter.get(item.id) + 1);
}

function getStatsHtml(itemCounter: Map<string, number>,
      itemMap: Map<string, string>, params: HistSettings): string {
  const maxR = 0.9*Math.min(params.panelTextSize, params.plotSize[0]) / 2;  // px, leaving 10% margin
  const minR = 1;
  const itemHtml: string[] = [];
  const noteOrder = new Map([...itemCounter.entries()].sort((a, b) => b[1] - a[1]));
  const maxCount = Math.max(...itemCounter.values());

  let strOpen = '';
  if (params.freqOpen == freqOpen.open)
    strOpen = ' open';
  itemHtml.push(`
    <details class="hist-section"${strOpen}>
      <summary class="hist-section" style="font-size: ${params.panelTextSize}px">
      Frequent notes</summary>`);

  let i = 0;
  noteOrder.forEach( (count, id) => {
    i += 1;
    if (i > params.freqDisplay)
      return
    const r = Math.max(minR, maxR * count / maxCount);
    itemHtml.push(`
      <p class="hist-item" style="font-size: ${params.panelTextSize}px; height: ${params.plotSize[1]}px">
      <svg class="hist-plot" style="width: ${params.plotSize[0]}px; height: ${params.plotSize[1]}px">
        <circle r="${r}" cx="${0.9*params.plotSize[0] - maxR}"
            cy="${params.plotSize[1] / 2}"
            stroke="none" fill="${params.trailColors[0]}" />
      </svg>
      <a class="hist-item" href="#" data-slug="${id}">
        ${escapeHtml(`${itemMap.get(id)}`)}
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

export default async function updateHistView(panel:string, params: HistSettings, loadAll: boolean) {
  const start = new Date().getTime();

  // First create the HTML for each history item:
  const N = (loadAll) ? Infinity:params.panelMaxItems;
  const itemHtml = await getHistHtml(N, params);

  // Finally, insert all the items in a container and set the webview HTML:
  await joplin.views.panels.setHtml(panel, `
  <html>
  <style>
  ${params.userStyle}
  </style>
  <div class="container">
    <p class="hist-title">
      <a class="hist-title" href="#" data-slug="${params.histNoteId}"
        style="font-size:${params.panelTitleSize}px">
        ${params.panelTitle}</a></p>
    ${itemHtml}
  </div>
  `);
  const finish = new Date().getTime();
  if (DEBUG) console.log('updateHistView: ' + (finish-start) + 'ms');
}
