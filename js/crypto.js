/* ============================================
   js/crypto.js
   XOR cipher for password-based encryption
   ============================================ */

const Crypto = (() => {

  // XOR-encrypt or decrypt a string with a password key.
  // XOR is its own inverse: encrypt(encrypt(str, key), key) === str
  function xorCipher(str, key) {
    if (!key || key.length === 0) return str;
    let result = '';
    for (let i = 0; i < str.length; i++) {
      const strCode  = str.charCodeAt(i);
      const keyCode  = key.charCodeAt(i % key.length);
      result += String.fromCharCode(strCode ^ keyCode);
    }
    return result;
  }

  // Encrypt a plaintext message with a password.
  // Returns the XOR-ciphered string.
  function encrypt(plaintext, password) {
    if (!password) return plaintext;
    return xorCipher(plaintext, password);
  }

  // Decrypt a ciphered message with a password.
  // XOR is symmetric so this is the same operation.
  function decrypt(ciphertext, password) {
    if (!password) return ciphertext;
    return xorCipher(ciphertext, password);
  }

  return { encrypt, decrypt };

})();