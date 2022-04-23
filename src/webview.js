document.addEventListener('click', event => {
	const element = event.target;
	if ((element.className === 'hist-item') || (element.className === 'hist-title')) {
		// Post the message and slug info back to the plugin:
		webviewApi.postMessage({
			name: 'openHistory',
			hash: element.dataset.slug,
		});
	}
	if (element.className === 'hist-loader') {
		webviewApi.postMessage({
			name: 'loadHistory',
		})
	}
});
