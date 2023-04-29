

const EmbedObject = require('./EmbedObject.js');
const EmbedBinary = require('./EmbedBinary.js');


class Embed {
	constructor(params = {}) {
		this._mp4 = params.mp4;

		this._files = [];

		this._headerEmbed = null;
		this._publicHeaderEmbed = null;

		this.hasEncryptedFiles = false;
		this.hasPublicFiles = false;

		this._key = params.key || null;
		this._password = params.password || null;
	}

	basename(path) {
		return (''+path).split(/[\\/]/).pop();
	}

	async addFile(params) {
		let file = params.file || null;
		let filename = params.filename || null;
		let meta = params.meta || null;

		let isEncrypted = false;
		if ((this._key || this._password) && params.key !== null && params.password !== null) {
			isEncrypted = true;
		}

		let embedBinary = null;
		if (isEncrypted) {
			embedBinary = new EmbedBinary({filename: filename, file: file, key: this._key, password: this._password});
		} else {
			embedBinary = new EmbedBinary({filename: filename, file: file});
		}

		// const embedBinary = new EmbedBinary({filename: filename, file: file, key: this._key, password: this._password});
		if (!filename && file) {
			filename = file.name;
		}

		let fileEntity = {
			filename: filename,
			embedBinary: embedBinary,
			isEncrypted: isEncrypted,
		};

		if (meta) {
			fileEntity.meta = meta;
		}

		this._files.push(fileEntity);
	}

	async composeHeader() {
		const headerObject = {
			files: [],
		};
		const publicHeaderObject = {
			files: [],
		};

		for (let fileEntity of this._files) {

			const size = await fileEntity.embedBinary.getExpectedSize();
			const fileRecord = {
				filename: this.basename(fileEntity.filename),
				size: size,
			};
			if (fileEntity.meta) {
				fileRecord.meta = fileEntity.meta;
			}

			if (fileEntity.isEncrypted) {
				headerObject.files.push(fileRecord);
				this.hasEncryptedFiles = true;
			} else {
				publicHeaderObject.files.push(fileRecord);
				this.hasPublicFiles = true;
			}
		}

		this._publicHeaderEmbed = new EmbedObject({object: publicHeaderObject});
		this._headerEmbed = new EmbedObject({object: headerObject, key: this._key, password: this._password});

		return true;
	}

	async getExpectedSize() {
		await this.composeHeader();
		let size = 0;
		if (this.hasEncryptedFiles) {
			size += await this._headerEmbed.getExpectedSize();
		}
		if (this.hasPublicFiles) {
			size += await this._publicHeaderEmbed.getExpectedSize();
		}

		for (let file of this._headerEmbed.object.files) {
			size+=file.size;
		}
		for (let file of this._publicHeaderEmbed.object.files) {
			size+=file.size;
		}

		return size;
	}

	async writeTo(writable) {
		await this.composeHeader();
		if (this.hasPublicFiles) {
			await this._publicHeaderEmbed.writeTo(writable);
		}
		if (this.hasEncryptedFiles) {
			await this._headerEmbed.writeTo(writable);
		}
		// await this._headerEmbed.writeTo(writable);
		for (let file of this._files) {
			await file.embedBinary.writeTo(writable);
		}
	}

	async restoreFromReadable(readable, params = {}, offset = 0) {
		const publicParams = {};
		Object.assign(publicParams, params);
		Object.assign(publicParams, {password: null, key: null});

		// if there're both public and encrypted header,
		// first one - is always public
		// we try to read the public one, if there's - try to read also encrypted one after it
		let encryptedHeaderOffset = 0;
		try {
			this._publicHeaderEmbed = await EmbedObject.restoreFromReadable(readable, publicParams, offset);
			encryptedHeaderOffset = this._publicHeaderEmbed.readBytes;
		} catch(e) {
			// store empty files list in memory
			this._publicHeaderEmbed = new EmbedObject({object: {files: []}});
		}

		if (this._publicHeaderEmbed._object && this._publicHeaderEmbed._object.files && this._publicHeaderEmbed._object.files.length) {
			this.hasPublicFiles = true;
		} else {
			this.hasPublicFiles = false;
		}

		try {
			this._headerEmbed = await EmbedObject.restoreFromReadable(readable, params, offset + encryptedHeaderOffset);
		} catch(e) {
			// store empty files list in memory
			this._headerEmbed = new EmbedObject({object: {files: []}, key: this._key, password: this._password});
		}

		if (this._headerEmbed._object && this._headerEmbed._object.files && this._headerEmbed._object.files.length) {
			this.hasEncryptedFiles = true;
		} else {
			this.hasEncryptedFiles = false;
		}
	}

	getFilesToExtract() {
		const filesToExtract = [];
		let offset = 0;
		offset += this._publicHeaderEmbed.readBytes;
		offset += this._headerEmbed.readBytes;
		for (let fileRecord of this._publicHeaderEmbed._object.files) {
			filesToExtract.push(Object.assign({}, fileRecord, {isEncrypted: false, offset: offset}));
			offset += fileRecord.size;
		}
		for (let fileRecord of this._headerEmbed._object.files) {
			filesToExtract.push(Object.assign({}, fileRecord, {isEncrypted: true, offset: offset}));
			offset += fileRecord.size;
		}

		return filesToExtract;
	}

	async restoreBinary(readable, params, n, offset, writable) {
		if (!this._headerEmbed && !this._publicHeaderEmbed) {
			await this.restoreFromReadable(readable, params, offset);
		}

		let filesToExtract = this.getFilesToExtract();
		if (!filesToExtract[n]) {
			throw new Error('There is no file '+n+' found in this container');
		}

		let fileSize = filesToExtract[n].size;
		let fileOffset = offset + filesToExtract[n].offset;

		if (filesToExtract[n].isEncrypted) {
			writable = await EmbedBinary.restoreFromReadable(readable, params, fileOffset, fileSize, writable);
		} else {
			const publicParams = {};
			Object.assign(publicParams, params);
			Object.assign(publicParams, {password: null, key: null});

			writable = await EmbedBinary.restoreFromReadable(readable, publicParams, fileOffset, fileSize, writable);
		}

		return writable;
	}


}

module.exports = Embed;