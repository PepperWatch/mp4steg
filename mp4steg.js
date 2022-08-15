const MP4 = require('./src/MP4.js');

const isNode = typeof process !== 'undefined'
  && process.versions != null
  && process.versions.node != null;
const Readable = require('./src/'+(isNode ? 'node' : 'browser')+'/Readable.js');
const Writable = require('./src/'+(isNode ? 'node' : 'browser')+'/Writable.js');

module.exports = {
	MP4,
	Writable,
	Readable,
};