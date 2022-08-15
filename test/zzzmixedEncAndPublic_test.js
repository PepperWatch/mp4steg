
const t = require('tap');
const { test } = t;
const EmbedBinary = require('../src/EmbedBinary.js');
const Writable = require('../src/node/Writable.js');
const Convert = require('../src/Convert.js');
const path = require('path');
const fs = require('fs');

const MP4 = require('../src/MP4.js');
let mp4 = null;

test('Embed two files, one public and one encrypted', async t => {
	const key = Convert.hexStringToWordArray('000102030405060708090a0b0c0d0e0f');
	mp4 = new MP4();
	mp4.setKey(key);
	t.ok(mp4, 'MP4 constructor ok');

	await mp4.loadFile({filename: path.join(__dirname, 'test.mp4')});

	await mp4.embedFile({filename: path.join(__dirname, 'test.txt'), meta: {testMeta: 'test'}, password: null});
	await mp4.embedFile({filename: path.join(__dirname, 'test.txt'), meta: {testMeta: 'test2'}});

	const wr = new Writable({filename: path.join(__dirname, 'test_mixed.mp4')});
	// await wr.prepare();
	// await wr.close();
	await mp4.embed(wr);
	await wr.close();

	const restoredMP4 = new MP4();
	restoredMP4.setKey(key);
	await restoredMP4.loadFile({filename: path.join(__dirname, 'test_mixed.mp4')});

	t.ok(restoredMP4.getEmbedFiles()[0].isEncrypted == false, 'There is one public file in container');
	t.ok(restoredMP4.getEmbedFiles()[0].filename == 'test.txt', 'Named test.txt');

	t.ok(restoredMP4.getEmbedFiles()[1].isEncrypted == true, 'There is one encrypted file in container');
	t.ok(restoredMP4.getEmbedFiles()[0].filename == 'test.txt', 'Same name (as used same file)');

	const extractedWritable1 = await restoredMP4.extractFile(0);
	await extractedWritable1.saveToFile(path.join(__dirname, 'test_public.txt'));

	const extractedWritable2 = await restoredMP4.extractFile(1);
	await extractedWritable2.saveToFile(path.join(__dirname, 'test_encrypted.txt'));

	const originalData = fs.readFileSync(path.join(__dirname, 'test.txt'), 'utf-8');
	const restoredData1 = fs.readFileSync(path.join(__dirname, 'test_public.txt'), 'utf-8');
	const restoredData2 = fs.readFileSync(path.join(__dirname, 'test_encrypted.txt'), 'utf-8');

	t.ok(originalData == restoredData1, 'Text data restored ok');
	t.ok(originalData == restoredData2, 'Text data restored ok');
});