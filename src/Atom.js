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

	findAtoms(atoms, name) {
		atoms = atoms || this.childs;

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

	isVideo() {
		const vmhdAtoms = this.findAtoms(null, 'vmhd');
		if (vmhdAtoms && vmhdAtoms.length) {
			return true;
		}
	}


	isAudio() {
		const vmhdAtoms = this.findAtoms(null, 'smhd');
		if (vmhdAtoms && vmhdAtoms.length) {
			return true;
		}
	}

	async getChunksInfo() {
		const chunks = [];
		const chunkOffsets = await this.getChunkOffsets();
        const samplesPerChunk = await this.getSampleToChunk();
        console.log('samplesPerChunk', samplesPerChunk);
        const sampleSizes = await this.getSampleSize();
        console.log('sampleSizes', sampleSizes);

        let chunkN = 1;
		for (let offset of chunkOffsets) {
			let skipSamplesCalculate = 0;
			let lastSamplesCount = 0;
			let diffWithN = 0;

			for (let i = 0; i < samplesPerChunk.length; i++) {
				const samplesPerChunkItem = samplesPerChunk[i];
				if (samplesPerChunkItem.firstChunk <= chunkN) {
					const nextSamplesPerChunkItem = samplesPerChunk[i+1];
					if (nextSamplesPerChunkItem && nextSamplesPerChunkItem.firstChunk < chunkN) {
						// chunk is not in current range
						// console.log('diff', (nextSamplesPerChunkItem.firstChunk - samplesPerChunkItem.firstChunk), samplesPerChunkItem.samplesPerChunk);
						skipSamplesCalculate += (nextSamplesPerChunkItem.firstChunk - samplesPerChunkItem.firstChunk)*samplesPerChunkItem.samplesPerChunk;
					} else {
						diffWithN = chunkN - samplesPerChunkItem.firstChunk;
						// console.log('diffWithN', diffWithN, samplesPerChunkItem.samplesPerChunk);
						skipSamplesCalculate += diffWithN * samplesPerChunkItem.samplesPerChunk;
					}

					lastSamplesCount = samplesPerChunkItem.samplesPerChunk;
				}
			}

			// for (let samplesPerChunkItem of samplesPerChunk) {
			// 	if (samplesPerChunkItem.firstChunk <= chunkN) {
			// 		diffWithN = chunkN - samplesPerChunkItem.firstChunk;
			// 		skipSamplesCalculate += samplesPerChunkItem.samplesPerChunk;
			// 		lastSamplesCount = samplesPerChunkItem.samplesPerChunk * diffWithN;
			// 	}
			// }

			// skipSamplesCalculate += samplesPerChunkItem.samplesPerChunk;
			// skipSamplesCalculate -= lastSamplesCount;
			// skipSamplesCalculate += lastSamplesCount * diffWithN;

			// console.log('chunk', chunkN, diffWithN, skipSamplesCalculate, lastSamplesCount);

			let chunkLength = 0;
			// let countSamples = 0;
			const sizes = [];
			for (let i = skipSamplesCalculate; i < skipSamplesCalculate + lastSamplesCount; i++) {
				chunkLength += sampleSizes[i].sampleSize;
				// countSamples++;
				sizes.push(sampleSizes[i].sampleSize);
			}

			// console.log(countSamples);

			chunks.push({
				n: chunkN,
				offset: offset,
				length: chunkLength,
				nextOffset: (offset+chunkLength),
				s: skipSamplesCalculate,
				sizes: sizes,
			});

			chunkN++;
		}

		return chunks;
	}

	async getChunkOffsets() {
		let atom = this;
		let sampleOffsets = [];
		if (atom.name !== 'stco' && atom.name !== 'co64') {
			// try to find in childs
			const sampleAtoms = this.findAtoms(null, 'stco').concat( this.findAtoms(null, 'co64') ); // both 32 and 64 bits offsets
			for (let atom of sampleAtoms) {
				sampleOffsets = sampleOffsets.concat(await atom.getChunkOffsets());
			}

			return sampleOffsets;
		}

		let data = await this.readable.getSlice(atom.start + atom.header_size, 8);
		let unpacked = Pack.unpack('>II', data);
		// let verFlags = unpacked[0];
		let count = unpacked[1];

		if (this.name == 'stco') {
				// can't read everything directly, as may get call stack filled, so we are reading offsets in chunksZ
				for (let i = 0; i < count; i+= 1024) {
					let cToRead = 1024;
					if (i + 1024 > count) {
						cToRead = count - i;
					}

					let readOffsets = Pack.unpack('>'+('I'.repeat(cToRead)), await this.readable.getSlice(atom.start + atom.header_size + 8 + i*4, cToRead*4));
					Array.prototype.push.apply(sampleOffsets, readOffsets); // merge read offsets to offsets
				}
		} else if (this.name == 'co64') {
			// can't read everything directly, as may get call stack filled, so we are reading offsets in chunks

			for (let i = 0; i < count; i+= 1024) {
				let cToRead = 1024;
				if (i + 1024 > count) {
					cToRead = count - i;
				}

				let readOffsets = Pack.unpack('>'+('Q'.repeat(cToRead)), await this.readable.getSlice(atom.start + atom.header_size + 8 + i*8, cToRead*8));
				Array.prototype.push.apply(sampleOffsets, readOffsets); // merge read offsets to offsets
			}
		}

		return sampleOffsets;
	}

	async getSampleToChunk() {
		let entries = [];
		if (this.name !== 'stsc') {
			const sampleAtoms = this.findAtoms(null, 'stsc');

			for (let atom of sampleAtoms) {
				entries = entries.concat(await atom.getSampleToChunk());
			}

			return entries;
		}

		try {

			let offset = this.start + 4 + 4 + 1 + 3;
			// https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-33068
			let numberOfEntries = Pack.unpack('>I', await this.readable.getSlice(offset, 4))[0];
			console.error('numberOfEntries', numberOfEntries);

			offset += 4; // after numberOfEntries
			for (let i = 0; i < numberOfEntries; i++) {
				const bytes = await this.readable.getSlice(offset, 12);
				const entry = Pack.unpack('>III', bytes);

				entries.push({
					firstChunk: entry[0],
					samplesPerChunk: entry[1],
					sampleDescriptionId: entry[2],
				});

				offset += 12;
			}

			return entries;
		} catch(e) {
			return [];
		}
	}

	async getSampleSize() {
		let entries = [];
		if (this.name !== 'stsz') {
			const sampleAtoms = this.findAtoms(null, 'stsz');

			for (let atom of sampleAtoms) {
				entries = entries.concat(await atom.getSampleSize());
			}

			return entries;
		}

		try {

			let offset = this.start + 4 + 4 + 1 + 3;
			// https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-33068
			let sampleSize = Pack.unpack('>I', await this.readable.getSlice(offset, 4))[0];
			if (sampleSize != 0) {
				entries.push({sampleSize: sampleSize});
				return entries;
			}

			offset += 4; // after sampleSize
			let numberOfEntries = Pack.unpack('>I', await this.readable.getSlice(offset, 4))[0];

			console.error('numberOfEntries', numberOfEntries);

			offset += 4; // after numberOfEntries
			for (let i = 0; i < numberOfEntries; i++) {
				const bytes = await this.readable.getSlice(offset, 4);
				const entry = Pack.unpack('>I', bytes);

				entries.push({
					sampleSize: entry[0],
				});

				offset += 4;
			}

			return entries;
		} catch(e) {
			return [];
		}
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