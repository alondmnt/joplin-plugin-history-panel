import joplin from 'api';

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
  const dateScope = new Set(['today']);
  for (const line of histNote.body.split('\n')) {
    const noteTitle = line.match(/\[(.*?)\]/g)[0].slice(1, -1);
    const noteId = line.match(/\((.*?)\)/g)[0].slice(3, -1);
    const noteDate = new Date(line.split(' ')[0]);
    foldTag = getFoldTag(now, noteDate, dateScope);
    itemHtml.push(`
            ${foldTag}
            <p class="hist-item">
              <a class="hist-item" href="#" data-slug="${noteId}">
                ${escapeHtml(noteTitle)}
              </a>
            </p>
          `);
  }
  console.log(dateScope)
  return itemHtml.join('\n');
}

function getFoldTag(now: Date, noteDate: Date, dateScope: Set<string>): string {
  /* whenever we pass a threshold, we need to close the previous folding section
     and start a new one */
  const dayDiff = getDateDay(now) - getDateDay(noteDate);
  if (!dateScope.has('yesterday') && (dayDiff == 1)) {
    dateScope.add('yesterday');
    return '</details><details><summary>Yesterday</summary>';
  }
  if (!dateScope.has('week') &&
      (dayDiff > 1) && (dayDiff <= 7)) {
    dateScope.add('week');
    return '</details><details><summary>Last 7 days</summary>';
  }

  let strMonth = getMonthString(noteDate);
  if (strMonth == getMonthString(now))
    strMonth = 'This month';
  if (!dateScope.has(strMonth) && (dayDiff > 7)) {
    dateScope.add(strMonth)
    return `</details><details><summary>${strMonth}</summary>`;
  }

  return '';
}

function getDateDay(date: Date): number {
  return Math.ceil(date.getTime() / 86400000);
}

function getMonthString(date: Date): string{
  return date.toString().split(' ')[1] + ' ' + date.toString().split(' ')[3]
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
  const histNoteId = await joplin.settings.value('histNoteId') as string;
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
    <h3>HISTORY</h3>
    <details open>
    <summary>Today</summary>
    ${itemHtml}
    </details>
  </div>
  `);
}
