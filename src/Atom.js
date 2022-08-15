const MAX_INT32 = 4294967295;
const BUFFER_SIZE = 100000;
// const bufferpack = require('bufferpack');

const Pack = require('./Pack.js');

class Atom {
	constructor(params = {}) {
		this.readable = params.readable;
		this.name = params.name;
		this.start = params.start;
		this.size = params.size;
		this.header_size = params.header_size;
		this.mother = params.mother || null;

		this.childs = [];
		this.contents = null;
	}

	async writeHeader(writable) {
		if (this.size > MAX_INT32 && this.header_size == 8) {
			throw new Error('Size too large for comact header');
		}

		if (this.size < MAX_INT32) {
			return await writable.write( Pack.pack(">I4s", [this.size, this.name]) );
		} else {
			return await writable.write( Pack.pack(">I4sQ", [1, this.name, this.size]) );
		}
	}

	async writePayload(writable) {
		if (this.childs.length) {
			for (let a of this.childs) {
				await a.write(writable);
			}
		} else {
			let bodySize = this.size - this.header_size;
			if (this.readable) {
				for (let i = 0; i < bodySize; i+= BUFFER_SIZE) {
					let copySize = BUFFER_SIZE;
					if (i + BUFFER_SIZE > bodySize) {
						copySize = bodySize - i;
					}
					// console.log(this.name, this.start + this.header_size + i, copySize);
					let chunk = await this.readable.getSlice(this.start + this.header_size + i, copySize);
					// console.log(chunk.length)
					await writable.write(chunk);
					// console.log(writable.size(), this.readable.size());
					// await writable.write(await this.readable.getSlice(this.start + this.header_size + i, copySize));
				}
			} else if (this.contents) {
				if (this.contents.length == bodySize) {
					await writable.write(this.contents);
				} else {
					throw new Error('Invalid bodySize for contents chunk');
				}
			} else {
				// throw new Error('No content to write');
				// @todo: not ready here
				//
				if (bodySize > 0) {
					await writable.write(new Uint8Array([0]));
				}
			}
		}
	}

	async write(writable) {
		await this.writeHeader(writable);
		await this.writePayload(writable);
	}
}

module.exports = Atom;