
const t = require('tap');
const { test } = t;
const EmbedBinary = require('../src/EmbedBinary.js');
const Writable = require('../src/node/Writable.js');
const Convert = require('../src/Convert.js');
const path = require('path');
const fs = require('fs');

const MP4 = require('../src/MP4.js');
let mp4 = null;

test('Embed with meta info without encryption', async t => {
	mp4 = new MP4();
	// mp4.setKey(key);
	t.ok(mp4, 'MP4 constructor ok');

	await mp4.loadFile({filename: path.join(__dirname, 'test.mp4')});

	await mp4.embedFile({filename: path.join(__dirname, 'test.txt'), meta: {testMeta: 'test'}});
	const wr = new Writable({filename: path.join(__dirname, 'test_with_meta.mp4')});
	// await wr.prepare();
	// await wr.close();
	await mp4.embed(wr);
	await wr.close();

	const restoredMP4 = new MP4();
	// restoredMP4.setKey(key);
	await restoredMP4.loadFile({filename: path.join(__dirname, 'test_with_meta.mp4')});

	t.ok(restoredMP4.getEmbedFiles()[0].meta.testMeta == 'test', 'Text meta restored ok');

	// const extractedWritable = await restoredMP4.extractFile(0);
	// await extractedWritable.saveToFile(path.join(__dirname, 'test_frommp4_with_meta.txt'));

	// const restoredData = fs.readFileSync(path.join(__dirname, 'test_frommp4_with_meta.txt'), 'utf-8');
});


test('Embed with meta info with key encryption', async t => {
	const key = Convert.hexStringToWordArray('000102030405060708090a0b0c0d0e0f');
	mp4 = new MP4();
	mp4.setKey(key);
	t.ok(mp4, 'MP4 constructor ok');

	await mp4.loadFile({filename: path.join(__dirname, 'test.mp4')});

	await mp4.embedFile({filename: path.join(__dirname, 'test.txt'), meta: {testMeta: 'test'}});
	const wr = new Writable({filename: path.join(__dirname, 'test_with_meta.mp4')});
	// await wr.prepare();
	// await wr.close();
	await mp4.embed(wr);
	await wr.close();

	const restoredMP4 = new MP4();
	restoredMP4.setKey(key);
	await restoredMP4.loadFile({filename: path.join(__dirname, 'test_with_meta.mp4')});

	t.ok(restoredMP4.getEmbedFiles()[0].meta.testMeta == 'test', 'Text meta restored ok');

	// const extractedWritable = await restoredMP4.extractFile(0);
	// await extractedWritable.saveToFile(path.join(__dirname, 'test_frommp4_with_meta.txt'));

	// const restoredData = fs.readFileSync(path.join(__dirname, 'test_frommp4_with_meta.txt'), 'utf-8');
});

