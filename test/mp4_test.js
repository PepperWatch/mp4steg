'use strict'

const t = require('tap');
const { test } = t;

const fs = require('fs');
const path = require('path');

const MP4 = require('../src/MP4.js');
const AES = require('../src/AES.js');
const Convert = require('../src/Convert.js');
const Writable = require('../src/node/Writable.js');


let bf = null;
let mp4 = null;

const C = AES.CryptoJS;

test('setup', async t => {
});


test('Opens mp4 file', async t => {
	t.ok(true);
	t.equal(1, 1, 'Equals');

	bf = fs.readFileSync(path.join(__dirname, 'test.mp4'), {encoding: null});
	t.ok(bf instanceof Buffer, 'buffer ok');

	mp4 = new MP4();
	t.ok(mp4, 'MP4 constructor ok');

	await mp4.loadFile({filename: path.join(__dirname, 'test.mp4')});



	// await mp4.analizeFile();
});

test('Atoms', async t => {
	t.ok(mp4.findAtoms(null, 'ftyp').length > 0, 'There re ftyp in mp4 file');
	t.ok(mp4.findAtoms(null, 'mdat').length > 0, 'There re mdat in mp4 file');
	t.ok(mp4.findAtoms(null, 'moov').length > 0, 'There re ftyp in mp4 file');

	t.ok(mp4._atoms.length > 0, 'There re some atoms in mp4 file');

	t.ok(mp4.findAtom('ftyp'), 'There is ftyp in mp4 file');
	t.ok(mp4.findAtom('mdat'), 'There is mdat in mp4 file');
	t.ok(mp4.findAtom('moov'), 'There is ftyp in mp4 file');
});


// test('Embed data', async t => {
// 	await mp4.embedFile(path.join(__dirname, 'test.txt'));
// 	const wr = await mp4.embed();
// 	await wr.saveToFile(path.join(__dirname, 'test_updated.mp4'));

// 	const originalFileStats = fs.statSync(path.join(__dirname, 'test.mp4'));
// 	const updatedFileStats = fs.statSync(path.join(__dirname, 'test_updated.mp4'));

// 	t.ok(originalFileStats.size < updatedFileStats.size, 'Size is increased with embeded data');

// 	const restoredMP4 = new MP4();
// 	await restoredMP4.loadFile(path.join(__dirname, 'test_updated.mp4'));

// 	const extractedWritable = await restoredMP4.extractFile(0);
// 	await extractedWritable.saveToFile(path.join(__dirname, 'test_frommp4.txt'));

// 	const originalData = fs.readFileSync(path.join(__dirname, 'test.txt'), 'utf-8');
// 	const restoredData = fs.readFileSync(path.join(__dirname, 'test_frommp4.txt'), 'utf-8');

// 	t.ok(originalData == restoredData, 'Text data restored ok');
// });


// test('Embed data with password', async t => {
// 	mp4 = new MP4();
// 	mp4.setPassword('test');
// 	t.ok(mp4, 'MP4 constructor ok');

// 	await mp4.loadFile(path.join(__dirname, 'test.mp4'));

// 	await mp4.embedFile(path.join(__dirname, 'test.txt'));
// 	const wr = await mp4.embed();
// 	await wr.saveToFile(path.join(__dirname, 'test_updated.mp4'));

// 	const originalFileStats = fs.statSync(path.join(__dirname, 'test.mp4'));
// 	const updatedFileStats = fs.statSync(path.join(__dirname, 'test_updated.mp4'));

// 	t.ok(originalFileStats.size < updatedFileStats.size, 'Size is increased with embeded data');

// 	const restoredMP4 = new MP4();
// 	restoredMP4.setPassword('test');
// 	await restoredMP4.loadFile(path.join(__dirname, 'test_updated.mp4'));

// 	const extractedWritable = await restoredMP4.extractFile(0);
// 	console.log(extractedWritable);

// 	await extractedWritable.saveToFile(path.join(__dirname, 'test_frommp4.txt'));

// 	const originalData = fs.readFileSync(path.join(__dirname, 'test.txt'), 'utf-8');
// 	const restoredData = fs.readFileSync(path.join(__dirname, 'test_frommp4.txt'), 'utf-8');

// 	t.ok(originalData == restoredData, 'Text data restored ok');
// });

test('Embed data with key', async t => {
	const key = Convert.hexStringToWordArray('000102030405060708090a0b0c0d0e0f');

	mp4 = new MP4();
	mp4.setKey(key);
	t.ok(mp4, 'MP4 constructor ok');

	await mp4.loadFile({filename: path.join(__dirname, 'test.mp4')});

	await mp4.embedFile({filename: path.join(__dirname, 'test.txt')});
	const wr = new Writable({filename: path.join(__dirname, 'test_updated.mp4')});
	// await wr.prepare();
	// await wr.close();
	await mp4.embed(wr);
	await wr.close();
	// await wr.saveToFile(path.join(__dirname, 'test_updated.mp4'));

	const originalFileStats = fs.statSync(path.join(__dirname, 'test.mp4'));
	const updatedFileStats = fs.statSync(path.join(__dirname, 'test_updated.mp4'));

	t.ok(originalFileStats.size < updatedFileStats.size, 'Size is increased with embeded data');

	const restoredMP4 = new MP4();
	restoredMP4.setKey(key);
	await restoredMP4.loadFile({filename: path.join(__dirname, 'test_updated.mp4')});

	t.ok(restoredMP4.getEmbedFiles()[0].isEncrypted, 'There is one encrypted file in container');
	t.ok(restoredMP4.getEmbedFiles()[0].filename == 'test.txt', 'Named test.txt');

	// console.error(restoredMP4.getEmbedFiles());

	const extractedWritable = await restoredMP4.extractFile(0);
	await extractedWritable.saveToFile(path.join(__dirname, 'test_frommp4.txt'));

	const originalData = fs.readFileSync(path.join(__dirname, 'test.txt'), 'utf-8');
	const restoredData = fs.readFileSync(path.join(__dirname, 'test_frommp4.txt'), 'utf-8');

	t.ok(originalData == restoredData, 'Text data restored ok');
});


// test('Large file test', async t => {
// 	const key = Convert.hexStringToWordArray('000102030405060708090a0b0c0d0e0f');

// 	mp4 = new MP4();
// 	mp4.setKey(key);
// 	t.ok(mp4, 'MP4 constructor ok');

// 	await mp4.loadFile(path.join(__dirname, 'large.mp4'));

// 	mp4.printAtoms();

// 	// await mp4.embedFile(path.join(__dirname, 'test.txt'));
// 	const wr = new Writable({filename: path.join(__dirname, 'large_updated.mp4')});
// 	// await wr.prepare();
// 	// await wr.close();
// 	await mp4.embed(wr);
// 	await wr.close();

// 	// t.ok(mp4.findAtoms(null, 'ftyp').length > 0, 'There re ftyp in mp4 file');
// 	// t.ok(mp4.findAtoms(null, 'mdat').length > 0, 'There re mdat in mp4 file');
// 	// t.ok(mp4.findAtoms(null, 'moov').length > 0, 'There re ftyp in mp4 file');

// 	// t.ok(mp4._atoms.length > 0, 'There re some atoms in mp4 file');

// 	// t.ok(mp4.findAtom('ftyp'), 'There is ftyp in mp4 file');
// 	// t.ok(mp4.findAtom('mdat'), 'There is mdat in mp4 file');
// 	// t.ok(mp4.findAtom('moov'), 'There is ftyp in mp4 file');
// });


test('teardown', async t=>{
	try {
		// fs.unlinkSync(path.join(__dirname, 'test_updated.mp4'));
		fs.unlinkSync(path.join(__dirname, 'test_frommp4.txt'));
	} catch(e) {}
});