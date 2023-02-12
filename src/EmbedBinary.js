
const AES = require('./AES.js');
const Convert = require('./Convert.js');
const constants = require('./constants.js');

const isNode = typeof process !== 'undefined'
  && process.versions != null
  && process.versions.node != null;
const Readable = require('./'+(isNode ? 'node' : 'browser')+'/Readable.js');
const Writable = require('./'+(isNode ? 'node' : 'browser')+'/Writable.js');

class EmbedBinary {
	constructor(params = {}) {
		if (params.readable) {
			this._readable = params.readable;
		} else if (params.filename && !params.file) {
			this._readable = new Readable({filename: params.filename});
		} else if (params.file) {

			this._readable = new Readable({file: params.file});
		}

		this._key = params.key || null;
		this._password = params.password || null;
		this._iv = params.iv || null;
	}

	async getExpectedSize() {
		const readableSize = await this._readable.size();

		if (this._key || this._password) {
			return 2 + AES.ivByteLength + readableSize;
		} else {
			return 2 + readableSize;
		}
	}

	get object() {
		return this._object;
	}

	getEncryptor() {
		if (this._encryptor) {
			return this._encryptor;
		}

		this._encryptor = new AES({
			key: this._key,
			password: this._password,
			iv: this._iv,
		});

		if (!this._iv) {
			this._iv = this._encryptor._iv;
		}

		return this._encryptor;
	}

	getIV() {
		if (!this._iv) {
			throw new Error('IV is not yet ready. Run getEncryptor() first, or specify one yourself');
		}

		return this._iv;
	}


	static async restoreFromReadable(readable, params = {}, offset = 0, size = null, writable = null) {
		const firstByte = (await readable.getSlice(offset + 0, 1))[0];
		const typeByte = (await readable.getSlice(offset + 1, 1))[0];

		if (!size) {
			size = (await readable.size()) - offset;
		}

		let decryptor = null;

		if (Convert.isByteIn(firstByte, 2, 1)) {

			// encrypted
			const ivLength = AES.ivByteLength;
			const iv = await readable.getSlice(offset + 2, ivLength);

			params.iv = Convert.convertUint8ArrayToWordArray(iv);
			decryptor = new AES(params);
		}

		if (Convert.isByteIn(typeByte, 11, 1)) { // binary

			if (!writable) {
				writable = new Writable();
			}

			let bodySize = size - 2;
			if (decryptor) {
				bodySize = bodySize - AES.ivByteLength;
				offset = offset + AES.ivByteLength;
			}

			for (let i = 0; i < bodySize; i+= constants.BUFFER_SIZE) {
				let copySize = constants.BUFFER_SIZE;
				if (i + constants.BUFFER_SIZE > bodySize) {
					copySize = bodySize - i;
				}
				let chunk = await readable.getSlice(offset + 2 + i, copySize);
				if (decryptor) {
					await writable.write(Convert.cryptJsWordArrayToUint8Array(decryptor.decrypt(Convert.convertUint8ArrayToWordArray(chunk) ))); // @todo: make writable accept wordarray
				} else {
					await writable.write(chunk);
				}
			}

			if (decryptor) {
				await writable.write(Convert.cryptJsWordArrayToUint8Array(decryptor.decrypt(null, true))); // @todo: make writable accept wordarray
			}

			await readable.close();

			return writable;
		}
	}


	async writeTo(writable) {
		if (this._readable) {
			let encryptor = null;
			let firstByte = Convert.randomByteIn(2,0);//  Math.ceil(1 + Math.random()*126)*2; // (byte mod 2 == 0) - not encrypted, (byte mod 2 == 1) - encrypted
			if (this._key || this._password) {
				encryptor = this.getEncryptor();
				// console.error('writing encrypted');

				firstByte = Convert.randomByteIn(2,1); // (byte mod 2 == 1) - encrypted
			}

			await writable.write([firstByte]);
			await writable.write([Convert.randomByteIn(11,1)]); // type == 1 - binary

			if (this._key || this._password) {
				const iv = this.getIV();
				const ivUa = Convert.cryptJsWordArrayToUint8Array(iv);
				await writable.write(ivUa);
			}

			const bodySize = await this._readable.size();
			for (let i = 0; i < bodySize; i+= constants.BUFFER_SIZE) {
				let copySize = constants.BUFFER_SIZE;
				if (i + constants.BUFFER_SIZE > bodySize) {
					copySize = bodySize - i;
				}
				let chunk = await this._readable.getSlice(i, copySize);
				if (encryptor) {
					await writable.write(encryptor.encrypt(Convert.convertUint8ArrayToWordArray(chunk)));
					// console.error('writing encrypted');
				} else {
					await writable.write(chunk);
				}
			}

			if (encryptor) {
				let final = encryptor.encrypt(null, true);

				await writable.write(final);
			}

			await this._readable.close();
		}
	}
}

module.exports = EmbedBinary;