/* eslint-disable */

class Readable {
	constructor(params = {}) {
		console.error(params);

		this._prepared = false;
		this._file = params.file;
		this._size = 0;
	}

	isPrepared() {
		return this._prepared;
	}

	async prepare() {
		if (this._prepared) {
			return;
		}

		this._prepared = true;
	}

	async close() {
		this._prepared = false;
	}

	async getSlice(offset, length) {
		if (!this._prepared) {
			await this.prepare();
		}

		// if (this._file instanceof File) {
			return await new Promise((res, rej)=>{
		    	const fileReader = new FileReader();

				fileReader.onloadend = function(evt) {
					if (evt.target.readyState == FileReader.DONE) { // DONE == 2
						res(new Uint8Array(fileReader.result));
					}
				};

				const blob = this._file.slice(offset, offset + length);
				fileReader.readAsArrayBuffer(blob);
			});
		// } else {
		// 	// is this a blob?
		// 	console.error('THIS IS BLOB!!!');
		// 	const sliced = this._file.slice(offset, offset + length);
		// }
	}

	async size() {
		if (!this._prepared) {
			await this.prepare();
		}

		return this._file.size;
	}
}

module.exports = Readable;