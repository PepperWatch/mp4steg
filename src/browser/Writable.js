/* eslint-disable */

class Writable {
	constructor(params = {}) {
		this._prepared = false;
		this._blobs = [];
		this._size = 0;
	}

	size() {
		return this._size;
	}

	async prepare() {
		if (this._prepared) {
			return;
		}
		this._prepared = true;
	}

	async toBlob() {
		let content = new Blob(this._blobs);
		return content;
		// const response = new Response(content, {'Content-Type': 'video/mp4', 'Content-Disposition': 'attachment'});

		// return response;
	}

	async close() {
		this._prepared = false;
	}

	async saveToFile(filename) {
		let content = new Blob(this._blobs);
		const response = new Response(content, {'Content-Type': 'video/mp4', 'Content-Disposition': 'attachment'});
		let blob = await response.blob();

		let blobUrl = window.URL.createObjectURL(blob);
		let link = document.createElement("a");
		link.href = blobUrl;
		link.download = filename;

		document.body.appendChild(link);
		link.innerHTML = "download";
		link.style.display = 'none';
		link.click();

		link.remove();

		window.URL.revokeObjectURL(blobUrl);
	}

	async write(append) {
		if (!this._prepared) {
			await this.prepare();
		}

		if (append.constructor === Uint8Array) {
			this._blobs.push(new Blob([append], { type: 'application/octet-stream'}));
		} else {
			this._blobs.push(new Blob([Uint8Array.from(append)], { type: 'application/octet-stream'}));
		}
		this._size += append.length;
	}

	async toReadable() {
		throw new Error('Does not work in browser for now');
	}
}

module.exports = Writable;