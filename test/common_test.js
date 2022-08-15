'use strict'

const t = require('tap');
const { test } = t;

const fs = require('fs');
const path = require('path');

const MP4 = require('../src/MP4.js');
const AES = require('../src/AES.js');
const Convert = require('../src/Convert.js');
const Pack = require('../src/Pack.js');


let bf = null;
let mp4 = null;


const C = AES.CryptoJS;

test('setup', async t => {
	// fs.unlinkSync(path.join(__dirname, 'test_updated.mp4'));
	// fs.unlinkSync(path.join(__dirname, 'text_restored.txt'));

});

test('Sample test', async t => {
	t.ok(true);
	t.equal(1, 1, 'Equals');
});

test('Random Bytes In Interval', async t=>{
	const results = new Array(256);
	results.fill(0);

	let hasEvenIn0 = false;
	let hasOddIn1 = false;
	let hasWrong03 = false;
	let hasWrong13 = false;
	let hasWrong23 = false;
	let hasWrong524 = false;
	let somewrong = false;

	for (let i = 0; i<1000000; i++) {
		const r0 = Convert.randomByteIn(2, 0);
		if (r0 % 2 == 1) {
			hasEvenIn0 = true;
		}
		const r1 = Convert.randomByteIn(2, 1);
		if (r1 % 2 == 0) {
			hasOddIn1 = true;
		}
		const r03 = Convert.randomByteIn(3, 0);
		const r13 = Convert.randomByteIn(3, 1);
		const r23 = Convert.randomByteIn(3, 2);
		if (r03 % 3 != 0) { hasWrong03 = true; }
		if (r13 % 3 != 1) { hasWrong13 = true; }
		if (r23 % 3 != 2) { hasWrong23 = true; }
		if (!Convert.isByteIn(r03, 3, 0)) { hasWrong03 = true;  }
		if (!Convert.isByteIn(r13, 3, 1)) { hasWrong13 = true;  }
		if (!Convert.isByteIn(r23, 3, 2)) { hasWrong23 = true;  }

		const r524 = Convert.randomByteIn(24, 5);
		if (r524 % 24 != 5) { hasWrong524 = true;  }
		if (!Convert.isByteIn(r524, 24, 5)) { hasWrong524 = true;  }

		if (r0 < 0 || r1 < 0 || r03 < 0 || r13 < 0 || r23 < 0 || r524 < 0) {
			console.log(r0, r1, r03, r13, r23);
			somewrong = true;
		}
		if (r0 > 255 || r1 > 255 || r03 > 255 || r13 > 255 || r23 > 255 || r524 > 255) {
			console.log(r0, r1, r03, r13, r23);
			somewrong = true;
		}

		results[r0]++;
		results[r1]++;
	}

	t.ok(!hasEvenIn0);
	t.ok(!hasOddIn1);
	t.ok(!hasWrong03);
	t.ok(!hasWrong13);
	t.ok(!hasWrong23);
	t.ok(!hasWrong524);
	t.ok(!somewrong);
});

test('AES', async t => {
	const dataString = 'teststring';
	const key = Convert.hexStringToWordArray('000102030405060708090a0b0c0d0e0f');
	const salt = C.lib.WordArray.random(128/8);
	const iv = C.PBKDF2("Secret Passphrase", salt, { keySize: C.algo.AES.ivSize, iterations: 1000 });

	const cryptoParams = {
		mode: C.mode.CBC,
		padding: C.pad.Pkcs7,
		iv: iv,
	};

	var aes = C.algo.AES.createEncryptor(key, cryptoParams);
    var ciphertext1 = aes.process(dataString); // dataString 3 times
    var ciphertext2 = aes.process(C.enc.Utf8.parse(dataString));
    var ciphertext3 = aes.process(dataString);
    var ciphertext4 = aes.finalize();

    let ciphertext1frombinary = Convert.convertUint8ArrayToWordArray(Convert.cryptJsWordArrayToUint8Array(ciphertext1));
    let ciphertext2frombinary = Convert.convertUint8ArrayToWordArray(Convert.cryptJsWordArrayToUint8Array(ciphertext2));
    let ciphertext3frombinary = Convert.convertUint8ArrayToWordArray(Convert.cryptJsWordArrayToUint8Array(ciphertext3));
    let ciphertext4frombinary = Convert.convertUint8ArrayToWordArray(Convert.cryptJsWordArrayToUint8Array(ciphertext4));

    let ivToBinary = Convert.cryptJsWordArrayToUint8Array(iv);

    var aesDecryptor = C.algo.AES.createDecryptor(key, cryptoParams);

    let plaintext = '';
    plaintext += Convert.wordArrayToString(aesDecryptor.process(ciphertext1frombinary));//.toString(C.enc.Utf8);
    plaintext += Convert.wordArrayToString(aesDecryptor.process(ciphertext2frombinary));//.toString(C.enc.Utf8);
    plaintext += Convert.wordArrayToString(aesDecryptor.process(ciphertext3frombinary));//.toString(C.enc.Utf8);
    plaintext += Convert.wordArrayToString(aesDecryptor.process(ciphertext4frombinary));//.toString(C.enc.Utf8);
    plaintext += Convert.wordArrayToString(aesDecryptor.finalize());//.toString(C.enc.Utf8);

    t.equal(dataString.repeat(3), plaintext, 'plaintext restored ok');
});


test('typed array word conversions', async t => {
	// const test = Convert.hexStringToWordArray('002102030405060708090a0b0c0d0e0f');
	// console.log(test);

	// let f1 = ()=>{
	// 	let conv1 = new Uint8Array( Int32Array.from(test.words).buffer );
	// }

	// let f2 = ()=>{
	// 	let conv2 = Convert.cryptJsWordArrayToUint8Array(test); // this on is faster
	// }

	// console.time('f1');
	// for (let i = 0; i < 1000000; i++) {
	// 	f1();
	// }
	// console.timeEnd('f1');

	// console.time('f2');
	// for (let i = 0; i < 1000000; i++) {
	// 	f1();
	// }
	// console.timeEnd('f2');



});


test('Header packs', async t => {
	let packed1 = Pack.pack(">Q", [4294967298]); // low, high, unsigned
	let packed2 = Pack.pack(">Q", [[2,1,1]]); // low, high, unsigned
	let restored1 = Pack.unpack(">Q", packed1);
	let restored2 = Pack.unpack(">Q", packed2);
	console.log(restored1);
	console.log(restored2);


	const packedHuge = Pack.pack('>'+('Q'.repeat(10000)), new Uint8Array(10000));
	t.equal(packedHuge.length, 10000 * 8);
	// let packed = Pack.pack(">I4sQ", [1, 'mdat', 4294967295 + 1]);


});


// test('Opens mp4 file', async t => {
// 	t.ok(true);
// 	t.equal(1, 1, 'Equals');

// 	bf = fs.readFileSync(path.join(__dirname, 'test.mp4'), {encoding: null});
// 	t.ok(bf instanceof Buffer, 'buffer ok');

// 	mp4 = new MP4();
// 	t.ok(mp4, 'MP4 constructor ok');

// 	await mp4.loadFile(path.join(__dirname, 'test.mp4'));

// 	t.ok(mp4._readable._buffer, 'MP4 constructor ok');


// 	// await mp4.analizeFile();
// });

// test('Atoms', async t => {
// 	t.ok(mp4.findAtoms(null, 'ftyp').length > 0, 'There re ftyp in mp4 file');
// 	t.ok(mp4.findAtoms(null, 'mdat').length > 0, 'There re mdat in mp4 file');
// 	t.ok(mp4.findAtoms(null, 'moov').length > 0, 'There re ftyp in mp4 file');

// 	t.ok(mp4._atoms.length > 0, 'There re some atoms in mp4 file');

// 	t.ok(mp4.findAtom('ftyp'), 'There is ftyp in mp4 file');
// 	t.ok(mp4.findAtom('mdat'), 'There is mdat in mp4 file');
// 	t.ok(mp4.findAtom('moov'), 'There is ftyp in mp4 file');
// });

// test('Embed data', async t => {
// 	const wr = await mp4.embedFile(path.join(__dirname, 'test.txt'));
// 	await wr.saveToFile(path.join(__dirname, 'test_updated.mp4'));

// 	const originalFileStats = fs.statSync(path.join(__dirname, 'test.mp4'));
// 	const updatedFileStats = fs.statSync(path.join(__dirname, 'test_updated.mp4'));

// 	t.ok(originalFileStats.size < updatedFileStats.size, 'Size is increased with embeded data');

// 	const restoredMP4 = new MP4();
// 	await restoredMP4.loadFile(path.join(__dirname, 'test_updated.mp4'));
// 	const extractedWritable = await restoredMP4.extract();
// 	await extractedWritable.saveToFile(path.join(__dirname, 'text_restored.txt'));

// 	const originalData = fs.readFileSync(path.join(__dirname, 'test.txt'), 'utf-8');
// 	const restoredData = fs.readFileSync(path.join(__dirname, 'text_restored.txt'), 'utf-8');

// 	t.ok(originalData == restoredData, 'Text data restored ok');
// });

test('teardown', async t=>{
});