import joplin from 'api';

async function histLinks(histNoteId:string): Promise<string> {
  let histNote;
  try {
    histNote = await joplin.data.get(['notes', histNoteId], { fields: ['id', 'title', 'body'] });
  } catch {
    return 'Please set a history note (from the Tools menu) to start logging'
  }

  const itemHtml = []
  for (const line of histNote.body.split('\n')) {
    const noteTitle = line.match(/\[(.*?)\]/g)[0].slice(1, -1)
    const noteId = line.match(/\((.*?)\)/g)[0].slice(3, -1)
    // const noteDate = new Date(line.split(' ')[0])
    itemHtml.push(`
						<p class="hist-item">
							<a class="hist-item" href="#" data-slug="${noteId}">
								${escapeHtml(noteTitle)}
							</a>
						</p>
					`);
  }
  return itemHtml.join('\n');
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

  // First create the HTML for each history item:
  const itemHtml = await histLinks(histNoteId);

  // Finally, insert all the items in a container and set the webview HTML:
  await joplin.views.panels.setHtml(panel, `
  <div class="container">
    <h3>HISTORY</h3>
    ${itemHtml}
  </div>
  `);
}
