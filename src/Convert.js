/* eslint-disable */
const CryptoJS = require("crypto-js");

class Convert {
	static randomByteIn(maxOptions, option) {
		return Math.floor(Math.random()*(255 / maxOptions)) * maxOptions + option;
	}

	static isByteIn(byte, maxOptions, option) {
		return (byte % maxOptions == option);
	}

	static objectToWordArray(object) {
		return CryptoJS.enc.Utf8.parse(JSON.stringify(object));
	}

	static wordArrayToObject(wordArray) {
		return JSON.parse(CryptoJS.enc.Utf8.stringify(wordArray));
	}

	static hexStringToWordArray(str) {
		return CryptoJS.enc.Hex.parse(str);
	}

	static wordArrayToString(wordArray) {
		return CryptoJS.enc.Utf8.stringify(wordArray);
	}

	// https://gitlab.skotty.io/forks/filer/commit/82f4648ef584c2a6e424426d3f7c7956baf05bf7?view=parallel

	/**
	 * https://github.com/brix/crypto-js/issues/274#issuecomment-600039187
	 * @param  {[type]} wordArray [description]
	 * @return {[type]}           [description]
	 */
	static cryptJsWordArrayToUint8Array(wordArray) {
		if (!wordArray.sigBytes && wordArray.sigBytes !== 0) {
			throw new Error('Invalid WordArray');
		}

		const l = wordArray.sigBytes;
		const words = wordArray.words;
		const result = new Uint8Array(l);
		var i=0 /*dst*/, j=0 /*src*/;
		while(true) {
			// here i is a multiple of 4
			if (i==l)
				break;
			var w = words[j++];
			result[i++] = (w & 0xff000000) >>> 24;
			if (i==l)
				break;
			result[i++] = (w & 0x00ff0000) >>> 16;
			if (i==l)
				break;
			result[i++] = (w & 0x0000ff00) >>> 8;
			if (i==l)
				break;
			result[i++] = (w & 0x000000ff);
		}
		return result;
	}

	static convertUint8ArrayToWordArray(u8Array) {
		let words = [];
		let i = 0, len = u8Array.length;

		while (i < len) {
			words.push(
				(u8Array[i++] << 24) |
				(u8Array[i++] << 16) |
				(u8Array[i++] << 8)  |
				(u8Array[i++])
			);
		}

		return {
			sigBytes: len,
			words: words
		};
	}
};

module.exports = Convert;