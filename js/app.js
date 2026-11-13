/* ============================================
   js/app.js
   Entry point — wires all modules together.
   Handles encode and decode button actions.
   ============================================ */

// ---- STATE ---- //
let encodeImageData = null;  // ImageData for the encode canvas
let decodeImageData = null;  // ImageData for the decode canvas
let encodeMaxChars = 0;     // Capacity of currently loaded encode image


// ============================================================
// ENCODE FLOW
// ============================================================

// Called when user selects/drops an image in the encode zone
async function handleEncodeImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const result = await Utils.loadImageToCanvas(file, 'encode-canvas');
    encodeImageData = result.imageData;
    encodeMaxChars = Utils.getMaxChars(encodeImageData.data.length);

    // Show preview
    UI.showImagePreview(
      'encode-zone', 'encode-upload-content', 'encode-preview',
      'encode-meta', 'encode-meta-name', 'encode-meta-size', file
    );

    // Enable encode button and update capacity
    document.getElementById('encode-btn').disabled = false;
    updateCapacity();
    UI.hideStatus('encode-status');

  } catch (err) {
    UI.showStatus('encode-status', 'error', 'Failed to load image: ' + err.message);
  }
}

// Called on every keystroke in the message textarea
function updateCapacity() {
  const msg = document.getElementById('secret-message').value;
  UI.updateCapacityBar(msg.length, encodeMaxChars);
}

// Called when user clicks "Encode & Download"
async function encodeMessage() {
  const message = document.getElementById('secret-message').value.trim();
  const password = document.getElementById('encode-password').value;

  // Validation
  if (!encodeImageData) {
    UI.showStatus('encode-status', 'error', 'Please upload an image first.');
    return;
  }
  if (!message) {
    UI.showStatus('encode-status', 'error', 'Please enter a secret message.');
    return;
  }
  if (message.length > encodeMaxChars) {
    UI.showStatus('encode-status', 'error', `Message too long. Max ${encodeMaxChars} characters for this image.`);
    return;
  }

  UI.setButtonLoading('encode-btn', true);
  UI.hideStatus('encode-status');

  try {
    // Run encode
    const encodedImageData = Steganography.encode(encodeImageData, message, password);

    // Write result back to canvas
    const canvas = document.getElementById('encode-canvas');
    const ctx = canvas.getContext('2d');
    ctx.putImageData(encodedImageData, 0, 0);

    // Download as PNG
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    Utils.downloadCanvasAsPNG(canvas, `stego_encoded_${timestamp}.png`);

    const passNote = password ? ' (password protected)' : '';
    UI.showStatus('encode-status', 'success',
      `Message successfully hidden!${passNote} Download started — save it as PNG.`
    );

  } catch (err) {
    UI.showStatus('encode-status', 'error', err.message);
  } finally {
    UI.setButtonLoading('encode-btn', false);
  }
}


// ============================================================
// DECODE FLOW
// ============================================================

// Called when user selects/drops an image in the decode zone
async function handleDecodeImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const result = await Utils.loadImageToCanvas(file, 'decode-canvas');
    decodeImageData = result.imageData;

    // Show preview
    UI.showImagePreview(
      'decode-zone', 'decode-upload-content', 'decode-preview',
      'decode-meta', 'decode-meta-name', 'decode-meta-size', file
    );

    // Enable decode button
    document.getElementById('decode-btn').disabled = false;
    UI.hideStatus('decode-status');
    UI.hideResult();

  } catch (err) {
    UI.showStatus('decode-status', 'error', 'Failed to load image: ' + err.message);
  }
}

// Called when user clicks "Decode Hidden Message"
async function decodeMessage() {
  const password = document.getElementById('decode-password').value;

  if (!decodeImageData) {
    UI.showStatus('decode-status', 'error', 'Please upload an encoded image first.');
    return;
  }

  UI.setButtonLoading('decode-btn', true);
  UI.hideStatus('decode-status');
  UI.hideResult();

  try {
    const message = Steganography.decode(decodeImageData, password);
    UI.showStatus('decode-status', 'success', 'Hidden message successfully extracted!');
    UI.showResult(message);

  } catch (err) {
    UI.showStatus('decode-status', 'error', err.message);
  } finally {
    UI.setButtonLoading('decode-btn', false);
  }
}


// ============================================================
// GLOBAL HELPERS (called from HTML attributes)
// ============================================================

function switchTab(name) { UI.switchTab(name); }
function togglePassword(id, btn) { UI.togglePassword(id, btn); }
function copyResult() { UI.copyResult(); }

function handleDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add('drag-over');
}

function handleDrop(event, mode) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  const file = event.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) {
    const statusId = mode === 'encode' ? 'encode-status' : 'decode-status';
    UI.showStatus(statusId, 'error', 'Please drop an image file (PNG, JPG, WEBP).');
    return;
  }
  // Reuse the same upload handler by faking the event object
  const fakeEvent = { target: { files: [file] } };
  if (mode === 'encode') handleEncodeImageUpload(fakeEvent);
  else handleDecodeImageUpload(fakeEvent);
}

// ============================================================
// SHAMIR SUB-TAB SWITCHING
// ============================================================
function sssSwitchSubtab(name) {
  document.querySelectorAll('.sss-subtab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sss-subpanel').forEach(p => { p.classList.remove('active'); p.classList.add('hidden'); });
  document.getElementById(`sss-subtab-${name}`).classList.add('active');
  document.getElementById(`sss-panel-${name}`).classList.remove('hidden');
  document.getElementById(`sss-panel-${name}`).classList.add('active');
}

function sssDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  const files = event.dataTransfer.files;
  if (files.length) {
    document.getElementById('sss-upload-input').files = files;
    sssHandleUpload({ target: { files } });
  }
}