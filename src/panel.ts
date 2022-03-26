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
  let dateScope = '';
  for (const line of histNote.body.split('\n')) {
    const noteTitle = line.match(/\[(.*?)\]/g)[0].slice(1, -1);
    const noteId = line.match(/\((.*?)\)/g)[0].slice(3, -1);
    const noteDate = new Date(line.split(' ')[0]);
    [foldTag, dateScope] = getFoldTag(now, noteDate, dateScope);
    itemHtml.push(`
            ${foldTag}
						<p class="hist-item">
							<a class="hist-item" href="#" data-slug="${noteId}">
								${escapeHtml(noteTitle)}
							</a>
						</p>
					`);
  }
  return itemHtml.join('\n');
}

function getFoldTag(now: Date, noteDate: Date, dateScope: string): [string, string] {
  /* whenever we pass a threshold, we need to close the previous folding section
     and start a new one */
  if ((!dateScope.includes('today')) && (now.getDay() - noteDate.getDay() == 1)) {
    return ['</details><details><summary>Yesterday</summary>', dateScope + 'today,'];
  }
  if ((!dateScope.includes('week')) &&
      (now.getDay() - noteDate.getDay() > 1) &&
      (getDateDay(now) - getDateDay(noteDate) <= 7)) {
    return ['</details><details><summary>Last 7 days</summary>', dateScope + 'week,'];
  }

  let strMonth = getMonthString(noteDate);
  if (strMonth == getMonthString(now))
    strMonth = 'This month';
  if ((!dateScope.includes(strMonth)) &&
      (getDateDay(now) - getDateDay(noteDate) > 7)) {
    return [`</details><details><summary>${strMonth}</summary>`, dateScope + strMonth + ','];
  }

  return ['', dateScope];
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
