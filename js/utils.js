/* ============================================
   js/utils.js
   Low-level helpers: bits, canvas, files
   ============================================ */

const Utils = (() => {

  // Convert a string to an array of bits (0s and 1s)
  function stringToBits(str) {
    const bits = [];
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      for (let b = 7; b >= 0; b--) {
        bits.push((charCode >> b) & 1);
      }
    }
    return bits;
  }

  // Convert an array of bits back to a string
  function bitsToString(bits) {
    let str = '';
    for (let i = 0; i + 7 < bits.length; i += 8) {
      let charCode = 0;
      for (let b = 0; b < 8; b++) {
        charCode = (charCode << 1) | bits[i + b];
      }
      str += String.fromCharCode(charCode);
    }
    return str;
  }

  // Load an image file into a canvas and return the ImageData + canvas
  function loadImageToCanvas(file, canvasId) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.getElementById(canvasId);
          canvas.width  = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          resolve({ canvas, ctx, imageData, width: img.width, height: img.height });
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  // Get max characters that can be hidden in given pixel data
  // 3 channels (RGB) per pixel, skip alpha; 8 bits per character
  function getMaxChars(pixelDataLength) {
    const totalPixels  = pixelDataLength / 4; // RGBA = 4 bytes
    const usableBits   = totalPixels * 3;     // R, G, B channels only
    const headerBits   = 32;                  // 32-bit length header
    return Math.floor((usableBits - headerBits) / 8);
  }

  // Trigger a file download of a canvas as PNG
  function downloadCanvasAsPNG(canvas, filename) {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = filename || 'encoded_image.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  // Format bytes into human-readable size string
  function formatFileSize(bytes) {
    if (bytes < 1024)       return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Check if a string contains only printable characters
  function isPrintable(str) {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      // Allow tab (9), newline (10), carriage return (13), space (32) and above
      if (code < 9 || (code > 13 && code < 32)) return false;
    }
    return true;
  }

  return { stringToBits, bitsToString, loadImageToCanvas, getMaxChars, downloadCanvasAsPNG, formatFileSize, isPrintable };

})();