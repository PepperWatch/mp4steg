/* eslint-disable */

const Atom = require('./Atom.js');
const Embed = require('./Embed.js');
const Pack = require('./Pack.js');
const constants = require('./constants.js');
const debug = require('debug')('mp4steg');

const isNode = typeof process !== 'undefined'
  && process.versions != null
  && process.versions.node != null;
const Readable = require('./'+(isNode ? 'node' : 'browser')+'/Readable.js');
const Writable = require('./'+(isNode ? 'node' : 'browser')+'/Writable.js');


const MAX_INT32 = 4294967295;

// @todo: lock files, https://github.com/moxystudio/node-proper-lockfile
//
// @todo: 64 bits: https://github.com/davidbuzz/MAVAgent/blob/96891db2270faa6a4a7058c25fddc72578c0158d/local_modules/jspack/test/int64.js
//
//
class MP4 {
	constructor(params = {}) {
		this._analized = false;

		this._readable = null;

		this._embed = null;

		this._key = null;
		this._password = null;


		this._atoms = [];
		this._initialMdatStart = null;
	}

	getEmbedFiles() {
		if (this._initialEmbed && this._initialEmbed) {
			return this._initialEmbed.getFilesToExtract();
		}
		return [];
	}

	setKey(key) {
		this._key = key;
		this._password = null;
	}

	setPassword(password) {
		this._password = password;
		this._key = null;
	}

	async loadFile(params) {
		this._readable = new Readable(params);
		await this.analizeFile();
		await this._readable.close(); // will be re-opened when needed
	}

	async embedFile(params) {
		if (!this._embed) {
			this._embed = new Embed({mp4: this, key: this._key, password: this._password});
		}

		await this._embed.addFile(params);
	}

	/**
	 * Get expected size of result MP4 container without actually doing encoding
	 * @return {Number} in bytes
	 */
	async getExpectedSize() {
		let expectedSize = 0;

		const ftyp = this.findAtom('ftyp');
		const mdat = this.findAtom('mdat');
		const moov = this.findAtom('moov');

		if (!ftyp || !mdat || !moov) {
			throw new Error('ftyp, mdat and moov atoms required');
		}

		const extendOffset = this._embed ? ( await this._embed.getExpectedSize() ) : 0;//  toAppedSize + embedHeaderSize;
		let mdatOffset = 0;
		let mdatNewSize = mdat.size - mdat.header_size;

		// await ftyp.write(writable);
		mdatOffset += ftyp.size;
		expectedSize += ftyp.size;
//
		let tempH = mdat.header_size;
		let tempL = mdat.size;

		if (mdatNewSize <= constants.MAX_INT32) {
			let freeAtom = new Atom({
				name: 'free',
				start: null,
				size: 8,
				header_size: 8,
				mother: null,
			});
			expectedSize += freeAtom.size;
			// await freeAtom.write(writable);
			mdat.size += extendOffset;
			// await mdat.writeHeader(writable);

			expectedSize += mdat.header_size;

			mdatOffset += 8;
			mdatOffset += 8;
		} else {
			mdat.size += extendOffset;
			mdat.header_size = 16;
			// await mdat.writeHeader(writable);

			expectedSize += mdat.header_size;

			mdatOffset += 16;
		}

		mdat.header_size = tempH;
		mdat.size = tempL;

		if (this._embed) {
			const embedSize = await this._embed.getExpectedSize();
			expectedSize += embedSize;
		}

		expectedSize += (mdat.size - mdat.header_size);

		const shiftOffsets = extendOffset + (mdatOffset - this._initialMdatStart);
		await this.adjustSampleOffsets(shiftOffsets);

		expectedSize += moov.size;

		return expectedSize;
	}

	async adjustSampleOffsets(offset) {
		const sampleAtoms = this.findAtoms(null, 'stco').concat( this.findAtoms(null, 'co64') ); // both 32 and 64 bits offsets

		debug('adjusting sample offsets by', offset, 'stco co64 atoms count: ', sampleAtoms.length);
		for (let atom of sampleAtoms) {

			let data = await this._readable.getSlice(atom.start + atom.header_size, 8);
			let unpacked = Pack.unpack('>II', data);
			let verFlags = unpacked[0];
			let count = unpacked[1];

			let sampleOffsets = [];

			if (atom.name == 'stco') {
				// can't read everything directly, as may get call stack filled, so we are reading offsets in chunksZ

				for (let i = 0; i < count; i+= 1024) {
					let cToRead = 1024;
					if (i + 1024 > count) {
						cToRead = count - i;
					}

					let readOffsets = Pack.unpack('>'+('I'.repeat(cToRead)), await this._readable.getSlice(atom.start + atom.header_size + 8 + i*4, cToRead*4));
					Array.prototype.push.apply(sampleOffsets, readOffsets); // merge read offsets to offsets
				}
			} else if (atom.name == 'co64') {
				// can't read everything directly, as may get call stack filled, so we are reading offsets in chunks

				for (let i = 0; i < count; i+= 1024) {
					let cToRead = 1024;
					if (i + 1024 > count) {
						cToRead = count - i;
					}

					let readOffsets = Pack.unpack('>'+('Q'.repeat(cToRead)), await this._readable.getSlice(atom.start + atom.header_size + 8 + i*8, cToRead*8));
					Array.prototype.push.apply(sampleOffsets, readOffsets); // merge read offsets to offsets
				}
			}

			for (let i = 0; i < sampleOffsets.length; i++) {
				sampleOffsets[i] = sampleOffsets[i] + offset;
				if (atom.name == 'stco' && sampleOffsets[i] >= constants.MAX_INT32) {
					atom.name = 'co64';
				}
			}


			if (atom.name == 'stco') {
				atom.contents = Pack.pack('>II', [verFlags,count]).concat(Pack.pack('>'+('I'.repeat(count)), sampleOffsets));
				atom.size = atom.contents.length + 8;
				// console.error('size updated to', atom.contents.length);
			} else {
				// co64
				atom.contents = Pack.pack('>II', [verFlags,count]).concat(Pack.pack('>'+('Q'.repeat(count)), sampleOffsets));
				atom.size = atom.contents.length + 8;
			}


			atom.readable = null;
		}
	}

	async extractEmbedHeader() {
		const mdat = this.findAtom('mdat');
		let offset = mdat.start + mdat.header_size;

		this._initialEmbed = new Embed({mp4: this});
		return await this._initialEmbed.restoreFromReadable(this._readable, {key: this._key, password: this._password}, offset);
	}

	async extractFile(n, writable = null) {
		const mdat = this.findAtom('mdat');
		let offset = mdat.start + mdat.header_size;

		const writab = await this._initialEmbed.restoreBinary(this._readable, {key: this._key, password: this._password}, n, offset, writable);
		return writab;
	}

	async embed(writable) {
		const ftyp = this.findAtom('ftyp');
		const mdat = this.findAtom('mdat');
		const moov = this.findAtom('moov');

		if (!ftyp || !mdat || !moov) {
			throw new Error('ftyp, mdat and moov atoms required');
		}

		if (!writable) {
			writable = new Writable();
		}

		// const toAppedSize = await this._embed.size();
		// const embedHeaderSize = await this._embed.headerSize();

		// if (this._embed) {
		// 	console.log('writing with embed');
		// } else {
		// 	console.log('writing without embed');

		// }

		const extendOffset = this._embed ? ( await this._embed.getExpectedSize() ) : 0;//  toAppedSize + embedHeaderSize;
		let mdatOffset = 0;
		let mdatNewSize = mdat.size - mdat.header_size;

		await ftyp.write(writable);
		mdatOffset += ftyp.size;
//
		let tempH = mdat.header_size;
		let tempL = mdat.size;

		if (mdatNewSize <= constants.MAX_INT32) {
			let freeAtom = new Atom({
				name: 'free',
				start: null,
				size: 8,
				header_size: 8,
				mother: null,
			});
			await freeAtom.write(writable);
			mdat.size += extendOffset;
			await mdat.writeHeader(writable);


			mdatOffset += 8;

			mdatOffset += 8;
		} else {
			mdat.size += extendOffset;
			mdat.header_size = 16;
			await mdat.writeHeader(writable);


			mdatOffset += 16;
		}

		debug('writing mdat atom start', mdatOffset);

		mdat.header_size = tempH;
		mdat.size = tempL;

		if (this._embed) {
			await this._embed.writeTo(writable);
		}

		await mdat.writePayload(writable);

		const shiftOffsets = extendOffset + (mdatOffset - this._initialMdatStart);
		await this.adjustSampleOffsets(shiftOffsets);

		await moov.write(writable);

		await this._readable.close(); // will be re-opened when needed
		await writable.close();  // will be re-opened when needed

		return writable;
	}

	async analizeFile() {
		this._atoms = [];

		const size = await this._readable.size();
		await this.parseAtoms(0, size, null);

		this._analized = true;

		const mdat = this.findAtom('mdat');
		// saving this to shift sample offsets in case we move mdat
		this._initialMdatStart = mdat.start + mdat.header_size;
		debug('initial mdat atom start', this._initialMdatStart);

		try {
			await this.extractEmbedHeader();
		} catch(e) {}

		// this.printAtoms();

		return this._atoms;
	}

	printAtoms(atoms, level = 0) {
		atoms = atoms || this._atoms;
		for (let a of atoms) {
			console.log(a.start, ('').padStart(level, '-'), a.name, a.size, a.header_size);
			if (a.childs.length) {
				this.printAtoms(a.childs, level+1);
			}
		}
	}

	findAtom(name) {
		if (!this._analized) {
			throw new Error('Run await analizeFile() first');
		}

		// no need to find all
		const atoms = this.findAtoms(null, name);
		return atoms.length ? atoms[0] : null;
	}

	findAtoms(atoms, name) {
		if (!this._analized) {
			throw new Error('Run await analizeFile() first');
		}

		atoms = atoms || this._atoms;

		let ret = [];
		for (let a of atoms) {
			if (a.name == name) {
				ret.push(a);
			}
			if (a.childs.length) {
				ret = ret.concat( this.findAtoms(a.childs, name) );
			}
		}

		return ret;
	}

	async parseAtoms(start, end, mother) {
		let offset = start;
		let atomSize = null;
		let atomHeaderSize = null;
		let atomType = null;

		while (offset < end) {
			atomSize = Pack.unpack('>I', await this._readable.getSlice(offset, 4) )[0];
			atomType = Pack.unpack('>4s', await this._readable.getSlice(offset+4, 4) )[0];

			// atomSize = bufferpack.unpack(">I", this.getBufferSlice(offset, 4) )[0];
   //          atomType = bufferpack.unpack(">4s", this.getBufferSlice(offset + 4, 4) )[0];

			if (atomSize == 1) {
				atomSize = Pack.unpack('>Q', await this._readable.getSlice(offset+8, 8) )[0];
				// @todo: check for Number.MAX_SAFE_INTEGER
				// atomSize = atomSize[0] + atomSize[1] * Math.pow(2, 32);
				// console.error(atomSize, 'atomSize');

				// atomSize = bufferpack.unpack(">Q", this.getBufferSlice(offset + 8, 8) )[0];
				atomHeaderSize = 16; // extended
			} else {
				atomHeaderSize = 8; // compact
				if (atomSize == 0) {
					atomSize = end - offset;
				}
			}

			const atom = new Atom({
				readable: this._readable,
				name: atomType,
				start: offset,
				size: atomSize,
				header_size: atomHeaderSize,
				mother: mother,
			});


			if (mother) {
				mother.childs.push(atom);
			} else {
				this._atoms.push(atom);
			}

			if (["moov","trak","mdia","minf","stbl","edts","udta"].indexOf(atomType) != -1) {
				// parse deeper
				await this.parseAtoms(offset + atomHeaderSize, offset + atomSize, atom);
			}

			offset = offset + atomSize;
		}

		return this._atoms;
	}
}

module.exports = MP4;