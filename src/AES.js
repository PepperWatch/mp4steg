const CryptoJS = require("crypto-js");
const Convert = require('./Convert.js');

//
// The problem with this is its insecurity. ECB mode is very insecure.

// Never use ECB mode. It's deterministic and therefore not semantically secure. You should at the very least use a randomized mode like CBC or CTR. The IV/nonce is not secret, so you can send it along with the ciphertext. A common way is to put it in front of the ciphertext.

// It is better to authenticate your ciphertexts so that attacks like a padding oracle attack are not possible. This can be done with authenticated modes like GCM or EAX, or with an encrypt-then-MAC scheme.

// Keys can be derived from passwords, but a proper scheme such as PBKDF2 should be used. Java and CryptoJS both support these.

class AES {
	constructor(params = {}) {
		this._key = params.key || null;
		this._password = params.password || null;
		this._kdfSalt = params.kdfSalt || 'todo';
		this._iv = params.iv || null;

		if (!this._key && this._password) {
			this.genKeyFromPassword();
		}

		if (this._key.constructor === Uint8Array) {
			// It's a Uint8Array
			this.getKeyFromUint8Array();
		}

		if (!this._iv) {
			this.genIV();
		}

		// console.error('AES', this._key, this._password, this._iv);
	}

	getCryptoParams() {
		return {
			mode: CryptoJS.mode.CTR,
			padding: CryptoJS.pad.NoPadding,  // CTR + NoPadding = same size of cipher and input
			iv: this._iv,
		};
	}

	genKeyFromPassword() {
		this._key = CryptoJS.PBKDF2(this._password, this._kdfSalt, { keySize: CryptoJS.algo.AES.keySize, iterations: 1000 });
	}

	getKeyFromUint8Array() {
		this._key = CryptoJS.PBKDF2(this._key.join(''), this._kdfSalt, { keySize: CryptoJS.algo.AES.keySize, iterations: 1000 });
	}

	genIV() {
		const salt = CryptoJS.lib.WordArray.random(CryptoJS.algo.AES.ivSize);
		this._iv = CryptoJS.PBKDF2("Secret Passphrase", salt, { keySize: CryptoJS.algo.AES.ivSize, iterations: 1000 });
		this._iv.clamp();
	}

	encrypt(wordArray, finalize = false) {
		if (!this._encryptor) {
			this._encryptor = CryptoJS.algo.AES.createEncryptor(this._key, this.getCryptoParams());
		}
		if (finalize) {
			if (wordArray) {
				return Convert.cryptJsWordArrayToUint8Array(this._encryptor.finalize(wordArray));
			} else {
				return Convert.cryptJsWordArrayToUint8Array(this._encryptor.finalize());
			}
		} else {
			return Convert.cryptJsWordArrayToUint8Array(this._encryptor.process(wordArray));
		}
	}

	decrypt(wordArray, finalize = false) {
		if (!this._decryptor) {
			this._decryptor = CryptoJS.algo.AES.createDecryptor(this._key, this.getCryptoParams());
		}
		if (finalize) {
			if (wordArray) {
				return this._decryptor.finalize(wordArray);
			} else {
				return this._decryptor.finalize();
			}
		} else {
			return this._decryptor.process(wordArray);
		}
	}



	// async encryptObject(object) {



	// 	// CryptoJS.kdf.OpenSSL.

	// 	let key = CryptoJS.kdf.OpenSSL.execute(this._key, CryptoJS.algo.AES.keySize, CryptoJS.algo.AES.ivSize, this._kdfSalt);
	// 	console.log('original: '+key.key);
	// 	console.log('original: '+key.iv);


	// 	let data = CryptoJS.enc.Utf8.parse(JSON.stringify(object));
	// 	console.log('original data: ', data);

	// 	const cipher = CryptoJS.AES.encrypt(
	// 		data,
	// 		key.key,
	// 		{
	// 			iv: key.iv,
	// 			mode: CryptoJS.mode.ECB,
	// 			padding: CryptoJS.pad.NoPadding,
	// 		}
	//     );

	//     // console.log('original cipher: ', cipher.ciphertext);
	//     // console.log('original cipher salt: ', cipher.salt);
	//     // console.log('original cipher: ', cipher);

	//     return this.cryptJsCypherToUint8Array(cipher);


	// 	// return CryptoJS.AES.encrypt(JSON.stringify(object), this._key);
	// }

	// async decryptObject(data) {
	// 	console.log('to restore binary', data.subarray(CryptoJS.algo.AES.ivSize * 4));
	// 	let key = CryptoJS.kdf.OpenSSL.execute(this._key, CryptoJS.algo.AES.keySize, CryptoJS.algo.AES.ivSize, this._kdfSalt);
	// 	let dataPart = this.convertUint8ArrayToWordArray( data.subarray(CryptoJS.algo.AES.ivSize * 4) );

	// 	console.log('to restore: '+key.key);
	// 	console.log('to restore: '+key.iv);


	// 	let cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: dataPart });
	//     // dataPart.words.push(649443215);
	//     // console.log('to restore cipher: ', dataPart);
	//     // console.log('to restore cipher salt: ', cipherParams.salt);

	//     // console.log('to restore cipher: ', cipherParams);


	// 	const c = CryptoJS.AES.decrypt(cipherParams, key.key, {
	// 		mode: CryptoJS.mode.ECB,
	// 		padding: CryptoJS.pad.NoPadding,
	// 		iv: key.iv,
	// 	});

	// 	console.log(1);
	// 	console.log('restored data: ', c);
	// 	console.log(''+c);
	// 	console.log(c.toString());
	// 	console.log(CryptoJS.enc.Utf8.stringify(c));

	// }


	// static cryptJsCypherToUint8Array(cipher) {
	//     const result = new Uint8Array(cipher.iv.sigBytes + cipher.ciphertext.sigBytes);
	// 	result.set(this.cryptJsWordArrayToUint8Array(cipher.iv), 0);
	// 	result.set(this.cryptJsWordArrayToUint8Array(cipher.ciphertext), cipher.iv.sigBytes);

	// 	console.log('original binary:', this.cryptJsWordArrayToUint8Array(cipher.ciphertext));

	// 	return result;
	// }

	// /**
	//  * https://github.com/brix/crypto-js/issues/274#issuecomment-600039187
	//  * @param  {[type]} wordArray [description]
	//  * @return {[type]}           [description]
	//  */
	// static cryptJsWordArrayToUint8Array(wordArray) {
	// 	// console.log(CryptoJS.enc.Base64.stringify(wordArray));

	//     const l = wordArray.sigBytes;
	//     const words = wordArray.words;
	//     const result = new Uint8Array(l);
	//     var i=0 /*dst*/, j=0 /*src*/;
	//     while(true) {
	//         // here i is a multiple of 4
	//         if (i==l)
	// 			break;
	//         var w = words[j++];
	//         result[i++] = (w & 0xff000000) >>> 24;
	//         if (i==l)
	// 			break;
	//         result[i++] = (w & 0x00ff0000) >>> 16;
	//         if (i==l)
	// 			break;
	//         result[i++] = (w & 0x0000ff00) >>> 8;
	//         if (i==l)
	// 			break;
	//         result[i++] = (w & 0x000000ff);
	//     }
	//     return result;
	// }

	// static convertUint8ArrayToWordArray(u8Array) {
	// 	var words = [], i = 0, len = u8Array.length;

	// 	while (i < len) {
	// 		words.push(
	// 			(u8Array[i++] << 24) |
	// 			(u8Array[i++] << 16) |
	// 			(u8Array[i++] << 8)  |
	// 			(u8Array[i++])
	// 		);
	// 	}

	// 	return {
	// 		sigBytes: words.length * 4,
	// 		words: words
	// 	};
	// }
}

AES.CryptoJS = CryptoJS;
AES.ivByteLength = CryptoJS.algo.AES.ivSize * 4;

module.exports = AES;