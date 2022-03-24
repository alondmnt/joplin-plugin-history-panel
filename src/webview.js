document.addEventListener('click', event => {
	const element = event.target;
	if (element.className === 'hist-item') {
		// Post the message and slug info back to the plugin:
		webviewApi.postMessage({
			name: 'openHistory',
			hash: element.dataset.slug,
		});
	}
});
