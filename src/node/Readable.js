const fsp = require('fs').promises;

class Readable {
	constructor(params = {}) {
		this._filename = params.filename;
		this._prepared = false;

		this._size = 0;
	}

	isPrepared() {
		return this._prepared;
	}

	async prepare() {
		if (this._prepared) {
			return;
		}

		if (this._filename) {
			this._fp = await fsp.open(this._filename, 'r');
			const stats = await this._fp.stat();

			this._size = stats.size;
		}

		this._prepared = true;
		// this._buffer = fs.readFileSync(this._filename, {encoding: null});
		// this._prepared = true;
	}

	async close() {
		try {
			await this._fp.close();
		} catch(e) {
			console.error(e);
		}
		this._prepared = false;
	}

	async getSlice(offset, length) {
		if (!this._prepared) {
			await this.prepare();
		}

		let ret = new Uint8Array(length);
		await this._fp.read(ret, 0, length, offset);

		return ret;
	}

	async size() {
		if (!this._prepared) {
			await this.prepare();
		}

		return this._size;

		// if (this._buffer instanceof ArrayBuffer) {
		// 	return this._buffer.byteLength;
		// } else {
		// 	return this._buffer.length;
		// }
	}
}

module.exports = Readable;