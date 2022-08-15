/* eslint-disable */

const Pack = require('./Pack.js');
const AES = require('./AES.js');
const Convert = require('./Convert.js');
const constants = require('./constants.js');

class EmbedObject {
	constructor(params = {}) {
		if (params.object) {
			this._object = params.object;
			this._binary = Convert.objectToWordArray(this._object); // @todo: make lazy loading
		}

		this._key = params.key || null;
		this._password = params.password || null;
		this._iv = params.iv || null;

		this._readBytes = params.readBytes || 0;
	}

	/**
	 * Number of bytes read from readable when this embedObject was extracted
	 * @return {Number} [description]
	 */
	get readBytes() {
		return this._readBytes;
	}

	async getExpectedSize() {
		if (this._key || this._password) {
			return 2 + AES.ivByteLength + 4 + this._binary.sigBytes;
		} else {
			return 2 + 4 + this._binary.sigBytes;
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

	static async restoreFromReadable(readable, params = {}, offset = 0) {
		const firstByte = (await readable.getSlice(offset + 0, 1))[0];
		const typeByte = (await readable.getSlice(offset + 1, 1))[0];
		const ivLength = AES.ivByteLength;

		let size = null;
		let sizeDecryptor = null;
		let readBytes = 2; // firstByte + typeByte

		if (Convert.isByteIn(firstByte, 2, 1)) {
			// encrypted
			const iv = await readable.getSlice(offset + 2, ivLength);
			readBytes += ivLength;

			params.iv = Convert.convertUint8ArrayToWordArray(iv);
			sizeDecryptor = new AES(params);

			const sizeChunk = await readable.getSlice(offset + ivLength + 2, 4);
			readBytes += 4;

			const sizeDecrypted = sizeDecryptor.decrypt(Convert.convertUint8ArrayToWordArray(sizeChunk), true);

			const decryptedAsUInt = Convert.cryptJsWordArrayToUint8Array(sizeDecrypted);

			size = Pack.unpack('>I', decryptedAsUInt)[0];
		} else {
			// raw
			const sizeBytes = (await readable.getSlice(offset + 2, 4));
			readBytes += 4;

			size = Pack.unpack('>I', sizeBytes)[0];
		}
		readBytes += size;

		if (!size) {
			throw new Error('Can not get size of EmbedObject to restore');
		}

		if (size > constants.MAX_HEADER_SIZE) {
			// though we probably can support this, huge header looks strange and we probably don't want to check it.
			throw new Error('Header is too large to extract');
		}

		// read (size...chunk) in encrypted, (chunk) if not encrypted.
		const chunk = await readable.getSlice(offset + (sizeDecryptor ? ivLength : 4) + 2, size + (sizeDecryptor ? 4 : 0));
		let decryptor = null;

		if (sizeDecryptor) {
			decryptor = new AES(params);
			const decrypted = decryptor.decrypt(Convert.convertUint8ArrayToWordArray(chunk), true);

			decrypted.words.shift(); // remove size word
			decrypted.sigBytes-=4;

			params.object = Convert.wordArrayToObject(decrypted);
		} else {
			params.object = Convert.wordArrayToObject( Convert.convertUint8ArrayToWordArray(chunk) );
		}



		delete params.iv;
		await readable.close();

		params.readBytes = readBytes;
		return new EmbedObject(params);
	}

	async writeTo(writable) {
		const binary = this.getBinary();
		await writable.write(binary);
	}

	getBinary() {
		if (this._key || this._password) {
			return this.getEncrypted();
		} else {
			return this.getRaw();
		}
	}

	getRaw() {
		// const toEnc = Convert.objectToWordArray(this._object);
		const payload = Convert.cryptJsWordArrayToUint8Array(this._binary);
		const ret = new Uint8Array(payload.length + 2 + 4);

		// 1st byte - (byte mod 2 == 0) - not encrypted
		const firstByte = Convert.randomByteIn(2,0);
		// // type == 0 - object
		const secondByte = Convert.randomByteIn(11,0);
		ret.set([firstByte], 0);  //(mod 2 == 0)
		ret.set([secondByte], 1); // type == 0 - object
		ret.set(Pack.pack('>I', [this._binary.sigBytes]), 2); // size
		ret.set(payload, 6);

		return ret;
	}

	getEncrypted() {
		const encryptor = this.getEncryptor();
		// const binarySize = this._binary.sigBytes; // expecting binary size here to be <4GB, remember this is for json objects
		// const packedSize = Pack.pack('<I', [binarySize]);


		// prepend binary with size word
		const packedSize = Pack.pack('>I', [this._binary.sigBytes]);


		const sizeWord = (
			(packedSize[0] << 24) |
			(packedSize[1] << 16) |
			(packedSize[2] << 8)  |
			(packedSize[3])
		);


		this._binary.words.unshift(sizeWord);
		this._binary.sigBytes+=4;

		const payload = encryptor.encrypt(this._binary, true);
		const iv = this.getIV();
		const ivUa = Convert.cryptJsWordArrayToUint8Array(iv);

		const ret = new Uint8Array(ivUa.length + payload.length + 2);
		// 1st byte - (byte mod 2 == 1) - encrypted
		const firstByte = Convert.randomByteIn(2,1);
		// // type == 0 - object
		const secondByte = Convert.randomByteIn(11,0);
		ret.set([firstByte], 0);  //(mod 2 == 1)
		ret.set([secondByte], 1); // type == 0 - object
		ret.set(ivUa, 2);
		ret.set(payload, ivUa.length + 2);
		// ret.set([Convert.randomByteIn(4,0)]); // number of bytes to unpad from the end of the payload

		return ret;
	}
}

module.exports = EmbedObject;