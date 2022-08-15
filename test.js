const path = require('path');

const MP4 = require('./src/MP4.js');
const Writable = require('./src/node/Writable.js');

const in22 = require('./test/test.js')('test');

(async()=>{
	// const red = new MP4();
	// await red.loadFile(path.join(__dirname, 'test/large.mp4'));
	// await red.analizeFile();
	// red.printAtoms();

	// await red.embedFile(path.join(__dirname, 'test/image.jpg'));
	// const wr = new Writable({filename: path.join(__dirname, 'test/large_updated.mp4')});
	// await red.embed(wr);
	// await wr.close();

	// let red2 = new MP4();
	// await red2.loadFile(path.join(__dirname, 'test/large_updated.mp4'));
	// await red2.analizeFile();

	// const extractedWritable = await red2.extractFile(0);
	// await extractedWritable.saveToFile(path.join(__dirname, 'test/image_restored.jpg'));
	// red2.printAtoms();
	// red.findSampleOffsets();
})();