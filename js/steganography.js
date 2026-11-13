/* ============================================
   js/steganography.js
   Core LSB encode / decode engine

   ENCODING FORMAT:
   The message + a 3-null-byte delimiter is
   converted to bits and embedded one bit per
   RGB channel LSB. Alpha is never touched.
   Decode reads bits until it finds the
   delimiter, then stops.
   ============================================ */

const Steganography = (() => {

  // 3 null bytes = 24 zero bits — very unlikely to appear naturally
  const DELIMITER = '\x00\x00\x00';

  // ---- ENCODE ----
  function encode(imageData, message, password) {
    // 1. Encrypt if password provided
    const processed = Crypto.encrypt(message, password);
    const payload   = processed + DELIMITER;

    // 2. Convert to bits
    const allBits = Utils.stringToBits(payload);

    // 3. Check capacity
    const maxChars = Utils.getMaxChars(imageData.data.length);
    if (message.length > maxChars) {
      throw new Error(`Message too long. Max ${maxChars} characters for this image.`);
    }

    // 4. Embed each bit into the LSB of R, G, B channels (skip alpha)
    const data   = new Uint8ClampedArray(imageData.data);
    let   bitIdx = 0;

    for (let i = 0; i < data.length && bitIdx < allBits.length; i++) {
      if ((i + 1) % 4 === 0) continue; // skip alpha
      data[i] = (data[i] & 0xFE) | allBits[bitIdx];
      bitIdx++;
    }

    return new ImageData(data, imageData.width, imageData.height);
  }

  // ---- DECODE ----
  function decode(imageData, password) {
    const data = imageData.data;
    const bits = [];

    // 1. Extract all LSBs (skip alpha)
    for (let i = 0; i < data.length; i++) {
      if ((i + 1) % 4 === 0) continue;
      bits.push(data[i] & 1);
    }

    // 2. Convert all bits back to string, scan for delimiter
    //    Process in chunks to avoid hitting the delimiter mid-character
    let raw = '';
    const chunkSize = 800; // 100 characters at a time
    for (let i = 0; i < bits.length; i += chunkSize) {
      const chunk = bits.slice(i, i + chunkSize);
      // Pad to multiple of 8 if needed
      while (chunk.length % 8 !== 0) chunk.push(0);
      raw += Utils.bitsToString(chunk);

      // Check if we've found the delimiter yet
      const delimIdx = raw.indexOf(DELIMITER);
      if (delimIdx !== -1) {
        const encoded = raw.substring(0, delimIdx);

        // 3. Decrypt
        const message = Crypto.decrypt(encoded, password);

        // 4. Sanity check (wrong password = garbled unprintable output)
        if (!Utils.isPrintable(message)) {
          throw new Error('Wrong password — decoded output contains unreadable characters.');
        }

        if (message.trim() === '') {
          throw new Error('No hidden message found in this image.');
        }

        return message;
      }
    }

    throw new Error('No hidden message found, or this image was not encoded with StegoAI.');
  }

  return { encode, decode };

})();