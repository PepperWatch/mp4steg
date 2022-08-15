
const t = require('tap');
const { test } = t;
const EmbedObject = require('../src/EmbedObject.js');
const Writable = require('../src/node/Writable.js');
const Convert = require('../src/Convert.js');


test('EmbedObject without encryption', async t => {
	const object = {test: "3"};
	const embedObject = new EmbedObject({object: object});
	const writable = new Writable();

	await embedObject.writeTo(writable);

	const readable = await writable.toReadable();

	const restored = await EmbedObject.restoreFromReadable(readable);


	t.equal(restored.object.test, embedObject.object.test, 'restored ok');
	t.equal(restored.object.test, object.test, 'restored as original');
});

test('EmbedObject with password encryption', async t => {
	const object = {test: "5"};
	const embedObject = new EmbedObject({object: object, password: 'test'});
	const writable = new Writable();

	await embedObject.writeTo(writable);

	const readable = await writable.toReadable();

	const restored = await EmbedObject.restoreFromReadable(readable, {password: 'test'});

	t.equal(restored.object.test, embedObject.object.test, 'restored ok');
	t.equal(restored.object.test, object.test, 'restored as original');
});

test('EmbedObject with key encryption', async t => {
	const object = {test: "5"};
	const key = Convert.hexStringToWordArray('000102030405060708090a0b0c0d0e0f');
	const embedObject = new EmbedObject({object: object, key: key});
	const writable = new Writable();

	await embedObject.writeTo(writable);

	const readable = await writable.toReadable();

	const restored = await EmbedObject.restoreFromReadable(readable, {key: key});

	t.equal(restored.object.test, embedObject.object.test, 'restored ok');
	t.equal(restored.object.test, object.test, 'restored as original');
});

test('Huge EmbedObject with key encryption', async t => {
	const object = {test: "13", somearray: [], someother: [], subobject: {}};
	for (let i = 0; i < 1000; i++) {
		object.somearray.push(i);
		object.someother.push('👙');
		object.subobject['property_'+i] = {t: 'test_'+i};
	}

	const key = Convert.hexStringToWordArray('000102030405060708090a0b0c0d0e0f');
	const embedObject = new EmbedObject({object: object, key: key});
	const writable = new Writable();

	await embedObject.writeTo(writable);

	const readable = await writable.toReadable();

	const restored = await EmbedObject.restoreFromReadable(readable, {key: key});

	t.equal(restored.object.test, embedObject.object.test);
	t.equal(restored.object.test, "13");
	t.equal(restored.object.somearray.length, 1000);
	t.equal(restored.object.someother.length, 1000);
	t.equal(restored.object.someother[0], '👙');
	t.equal(restored.object.someother[999], '👙');
	t.equal(restored.object.subobject.property_0.t, 'test_0');
	t.equal(restored.object.subobject.property_999.t, 'test_999');
});


test('Few EmbedObjects in the middle of binary', async t => {
	const object = {test: "5"};
	const object2 = {test2: "53"};
	const key = Convert.hexStringToWordArray('000102030405060708090a0b0c0d0e0f');
	const embedObject = new EmbedObject({object: object, key: key});
	const expectedSize = await embedObject.getExpectedSize();
	const embedObject2 = new EmbedObject({object: object2, key: key});
	const writable = new Writable();

	await writable.write(new Uint8Array(100000));
	await embedObject.writeTo(writable);
	await writable.write(new Uint8Array(100000));
	await embedObject2.writeTo(writable);
	await writable.write(new Uint8Array(100000));

	const gotSize = await writable.size();
	t.ok(gotSize > 300000);

	const readable = await writable.toReadable();

	const restored = await EmbedObject.restoreFromReadable(readable, {key: key}, 100000);

	const restored2 = await EmbedObject.restoreFromReadable(readable, {key: key}, 100000 + 100000 + expectedSize);

	t.equal(restored.object.test, embedObject.object.test, 'restored ok');
	t.equal(restored.object.test, object.test, 'restored as original');

	t.equal(restored2.object.test2, embedObject2.object.test2, 'second restored ok');
	t.equal(restored2.object.test2, object2.test2, 'second  restored as original');
});