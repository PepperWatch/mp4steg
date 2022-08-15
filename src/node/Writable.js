
const fsp = require('fs').promises;
const tmp = require("tmp");

const Readable = require('./Readable.js');

class Writable {
	constructor(params = {}) {
		this._uint8Array = new Uint8Array([]);

		if (params.filename) {
			this._filename = params.filename;
		}
		this._prepared = false;
		this._bytesWrote = 0;
	}

	size() {
		return this._uint8Array.length;
	}

	async prepare() {
		if (this._prepared) {
			return;
		}

		if (this._filename) {
			this._fp = await fsp.open(this._filename, 'w');
		}

		this._prepared = true;
	}

	async close() {
		if (this._fp) {
			try {
				await this._fp.close();
			} catch(e) {
				console.error(e);
			}
			this._prepared = false;
		}
	}

	async saveToFile(filename) {
		await fsp.writeFile(filename, this._uint8Array, {encoding: null});
	}

	async write(append) {
		if (!this._prepared) {
			await this.prepare();
		}

		if (this._fp) {
			if (append.constructor === Uint8Array) {
				await this._fp.write(append, 0, append.length); // Uint8Array
				this._bytesWrote += append.length;
			} else {
				await this._fp.write(Uint8Array.from(append), 0, append.length); // just array of bytes passed
				this._bytesWrote += append.length;
			}
		} else {
			const ret = new Uint8Array(this._uint8Array.length + append.length);
			ret.set(this._uint8Array, 0);
			ret.set(append, this._uint8Array.length);
			this._bytesWrote += append.length;

			this._uint8Array = ret;
		}

	}

	async toReadable() {
		let readable = null;
		if (this._filename) {
			readable = new Readable({filename: this._filename});
			await this.close();
		} else {
			const tmpobj = tmp.fileSync();
			await this.saveToFile(tmpobj.name);
			readable = new Readable({filename: tmpobj.name});
			await this.close();
		}

		return readable;
	}
}

module.exports = Writable;