import joplin from 'api';
import { parseItem, HistState } from './history';
import { HistSettings, freqScope, freqLoc, freqOpen } from './settings';

async function getHistHtml(params: HistSettings, state: HistState): Promise<string> {
  const refreshSize = params.trailLength + 1;
  let histNote;
  try {
    histNote = await joplin.data.get(['notes', params.histNoteId], { fields: ['body'] });
  } catch {
    return 'Please set a history note (from the Tools menu) to start logging';
  }
  if (histNote.body == state.cacheHist.join('\n'))
    return '';
  const lines = histNote.body.split('\n');
  const renewCache = (
    lines.slice(refreshSize + state.newItems).join('\n')
    != state.cacheHist.join('\n'))

  let itemHtml: string[] = [];
  itemHtml.push(`<details open class="hist-section"><summary class="hist-section" style="font-size: ${params.panelTextSize}px">Today</summary>`);

  const dateScope = new Set(['today']);
  const activeTrail = new Set() as Set<number>;
  let itemMap = new Map<string, string>();

  // generate up to where cached HTML starts
  console.log(state)
  const [tempHtml, tempCounter] = getItemHtml(
    lines.slice(0, refreshSize + state.newItems),
    itemMap, dateScope, activeTrail, params);

  if (renewCache) {
    console.log('renew cache');
    state.cacheHist = lines.slice(refreshSize + state.newItems);
    [state.cacheHtml, state.cacheCounter] = getItemHtml(state.cacheHist,
      itemMap, dateScope, activeTrail, params);
  }
  itemHtml = itemHtml.concat(tempHtml, state.cacheHtml);
  const itemCounter = sumCounters(tempCounter, state.cacheCounter);

  // update cache
  if (state.newItems > 0){
    console.log('added item')
    // re-run just for the line to be added to the cached HTML
    const newHist = lines.slice(refreshSize, refreshSize + state.newItems);
    const [newHtml, newCounter] = getItemHtml(
      newHist, itemMap, dateScope, activeTrail, params);
    state.cacheHist = newHist.concat(state.cacheHist);
    state.cacheHtml = newHtml.concat(state.cacheHtml);
    state.cacheCounter = sumCounters(newCounter, state.cacheCounter);
  }

  /*
  need a function that returns `itemHtml` as an array, `itemCounter` for first trailRecords,
  and `itemCounter` for the rest of the history.
  (also need a function that can sum two itemCounters.)

  then slice `itemHtml` and save everything but the first trailRecords as `prevHtml`.

  if a new note was added since the last html update (store this in a flag), we need to go over
  trailRecords+1 notes and add them to the previous `prevHtml`. 
  if an item was replaced, we need to go over trailRecords notes.
  otherwise, I think the hash should be the same (check me).
  what if the last item was removed? (because we switched back to a previous note,
  from 2 updates ago)

  statsHtml needs to be updated every time using the sum of 2-3 itemCounters.

  when we toggle view (and sync, and maybe similar scenarios) we will need to: 1. check hash;
  2. if not identical recalculate everything from scratch. so I think we need an overwrite
  flag. and in any case, if the hash is the same - do nothing, regardless of any flag.
  */
  itemHtml.push('</details>')

  let statsHtml = '';
  if (params.freqLoc != freqLoc.hide)
    statsHtml = getStatsHtml(itemCounter, itemMap, params);

  let allHtml = '';
  if (params.freqLoc == freqLoc.top)
    allHtml += statsHtml;
  allHtml += itemHtml.join('\n');
  if (params.freqLoc == freqLoc.bottom)
    allHtml += statsHtml;

  return allHtml
}

function sumCounters(counter1: Map<string, number>, counter2: Map<string, number>):
    Map<string, number> {
  let resCounter = new Map([...counter1]);  // do not change in-place
  counter2.forEach( (count, id) => {
    if (resCounter.has(id))
      resCounter.set(id, resCounter.get(id) + count);
    else
      resCounter.set(id, count);
  });
  return resCounter;
}

function getItemHtml(lines: string[], itemMap: Map<string,
    string>, dateScope: Set<string>, activeTrail: Set<number>, params: HistSettings):
    [string[], Map<string, number>] {
  let foldTag: string;
  let plotTag: string;
  let itemCounter = new Map<string, number>();
  let itemHtml: string[] = [];

  for (const line of lines) {
    const [noteDate, noteTitle, noteId, noteTrail] = parseItem(line);
    foldTag = getFoldTag(noteDate, dateScope, params.panelTextSize);
    plotTag = getPlotTag(noteTrail, activeTrail, params);
    if (params.freqLoc != freqLoc.hide)
      updateStats(noteId, noteTitle, noteDate, itemCounter, itemMap, dateScope, params);

    itemHtml.push(`
            ${foldTag}
            <p class="hist-item" style="font-size: ${params.panelTextSize}px; height: ${params.plotSize[1]}px">
              ${plotTag}
              <a class="hist-item" href="#" data-slug="${noteId}">
                ${escapeHtml(noteTitle)}
              </a>
            </p>
          `);
  }

return [itemHtml, itemCounter];
}

function getFoldTag(noteDate: Date, dateScope: Set<string>, fontSize: number): string {
  /* whenever we pass a threshold, we need to close the previous folding section
     and start a new one */
  const now = new Date();
  const dayDiff = getDateDay(now) - getDateDay(noteDate);
  if (!dateScope.has('yesterday') && (dayDiff == 1)) {
    dateScope.add('yesterday');
    return `</details><details class="hist-section"><summary class="hist-section" style="font-size: ${fontSize}px">Yesterday</summary>`;
  }
  if (!dateScope.has('week') &&
      (dayDiff > 1) && (dayDiff <= 6)) {
    dateScope.add('week');
    return `</details><details class="hist-section"><summary class="hist-section" style="font-size: ${fontSize}px">Last 7 days</summary>`;
  }

  let strMonth = getMonthString(noteDate);
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

function updateStats(noteId: string, noteTitle: string, noteDate: Date,
    itemCounter: Map<string, number>, itemMap: Map<string, string>,
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
  if (!itemCounter.has(noteId))
    itemCounter.set(noteId, 0);
  if (!itemMap.has(noteId))
    itemMap.set(noteId, noteTitle);

  itemCounter.set(noteId, itemCounter.get(noteId) + 1);
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

export default async function updateHistView(panel:string, params: HistSettings,
      state: HistState) {
  const start = new Date().getTime();

  // First create the HTML for each history item:
  const itemHtml = await getHistHtml(params, state);
  if (itemHtml.length == 0){
    console.log('skipped HTML');
    return
  }

  const finish = new Date().getTime();
  console.log('updateHistView: ' + (finish-start) + 'ms')
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
}
