
const t = require('tap');
const { test } = t;
const EmbedBinary = require('../src/EmbedBinary.js');
const Writable = require('../src/node/Writable.js');
const Convert = require('../src/Convert.js');
const path = require('path');
const fs = require('fs');

test('EmbedBinary without encryption', async t => {
	const embedBinary = new EmbedBinary({filename: path.join(__dirname, 'test.txt')});
	const writable = new Writable();

	await embedBinary.writeTo(writable);

	t.ok(writable.size() > 0);

	const readable = await writable.toReadable();

	const restored = await EmbedBinary.restoreFromReadable(readable);

	await restored.saveToFile(path.join(__dirname, 'test_restored_raw.txt'));

	const originalTXT = fs.readFileSync(path.join(__dirname, 'test.txt'), {encoding: 'utf-8'});
	const restoredTXT = fs.readFileSync(path.join(__dirname, 'test_restored_raw.txt'), {encoding: 'utf-8'});

	t.equal(originalTXT, restoredTXT);
});


test('EmbedBinary with key encryption', async t => {
	const key = Convert.hexStringToWordArray('000102030405060708090a0b0c0d0e0f');
	const embedBinary = new EmbedBinary({filename: path.join(__dirname, 'test.txt'), key: key});
	const writable = new Writable();

	await embedBinary.writeTo(writable);

	t.ok(writable.size() > 0);

	const readable = await writable.toReadable();

	const restored = await EmbedBinary.restoreFromReadable(readable, {key: key});

	await restored.saveToFile(path.join(__dirname, 'test_restored_key.txt'));

	const originalTXT = fs.readFileSync(path.join(__dirname, 'test.txt'), {encoding: 'utf-8'});
	const restoredTXT = fs.readFileSync(path.join(__dirname, 'test_restored_key.txt'), {encoding: 'utf-8'});

	t.equal(originalTXT, restoredTXT);
});

test('EmbedBinary with password encryption', async t => {
	const password = 'testpassword';
	const embedBinary = new EmbedBinary({filename: path.join(__dirname, 'test.txt'), password: password});
	const writable = new Writable();

	await embedBinary.writeTo(writable);

	t.ok(writable.size() > 0);
	const readable = await writable.toReadable();

	const restored = await EmbedBinary.restoreFromReadable(readable, {password: password});

	await restored.saveToFile(path.join(__dirname, 'test_restored_pass.txt'));

	const originalTXT = fs.readFileSync(path.join(__dirname, 'test.txt'), {encoding: 'utf-8'});
	const restoredTXT = fs.readFileSync(path.join(__dirname, 'test_restored_pass.txt'), {encoding: 'utf-8'});

	t.equal(originalTXT, restoredTXT);
});

test('EmbedBinary with password encryption in the middle', async t => {
	const password = 'testpassword';
	const embedBinary = new EmbedBinary({filename: path.join(__dirname, 'test.txt'), password: password});
	const writable = new Writable();

	await writable.write(new Uint8Array(100000));
	await embedBinary.writeTo(writable);

	const expectedSize = await embedBinary.getExpectedSize();
	await embedBinary._readable.close();
	await writable.write(new Uint8Array(100000));

	t.ok(writable.size() > 200000);

	const readable = await writable.toReadable();

	const restored = await EmbedBinary.restoreFromReadable(readable, {password: password}, 100000, expectedSize);

	await restored.saveToFile(path.join(__dirname, 'test_restored_pass.txt'));

	const originalTXT = fs.readFileSync(path.join(__dirname, 'test.txt'), {encoding: 'utf-8'});
	const restoredTXT = fs.readFileSync(path.join(__dirname, 'test_restored_pass.txt'), {encoding: 'utf-8'});

	t.equal(originalTXT, restoredTXT);
});


test('teardown', async t=>{
	try {
		fs.unlinkSync(path.join(__dirname, 'test_restored_raw.txt'));
		fs.unlinkSync(path.join(__dirname, 'test_restored_key.txt'));
		fs.unlinkSync(path.join(__dirname, 'test_restored_pass.txt'));
	} catch(e) {}
});