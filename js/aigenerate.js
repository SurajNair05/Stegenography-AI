/* ============================================
   js/aigenerate.js
   AI Image Generation via Puter.js
   + automatic LSB encode in one step.

   WHY PUTER.JS WORKS (no CORS issues):
   puter.ai.txt2img() returns an <img> element
   whose src is a base64 data: URL — this is
   local data, not cross-origin, so canvas
   getImageData() works perfectly with no proxy.
   Free, no API key, no signup needed.
   ============================================ */

// ---- STATE ---- //
let aiGeneratedImageData = null;
let aiEncodedCanvas      = null;
let aiMaxChars           = 0;

// ============================================================
// MAIN — Generate image + encode message in one click
// ============================================================
async function aiGenerateAndEncode() {
  const prompt   = document.getElementById('ai-prompt').value.trim();
  const message  = document.getElementById('ai-secret-message').value.trim();
  const password = document.getElementById('ai-password').value;

  if (!prompt)  { UI.showStatus('ai-status', 'error', 'Please enter a description for the AI image.'); return; }
  if (!message) { UI.showStatus('ai-status', 'error', 'Please enter a secret message to hide.'); return; }

  const imageData = await generateAIImage(prompt);
  if (!imageData) return;

  const maxChars = Utils.getMaxChars(imageData.data.length);
  if (message.length > maxChars) {
    UI.showStatus('ai-status', 'error', `Message too long. Max ${maxChars} characters for this image.`);
    return;
  }

  try {
    setAiLoading(true, 'Hiding message inside pixels...');
    const encodedData = Steganography.encode(imageData, message, password);

    const canvas = document.getElementById('ai-canvas');
    const ctx = canvas.getContext('2d');
    ctx.putImageData(encodedData, 0, 0);
    aiEncodedCanvas = canvas;

    setAiLoading(false);
    const passNote = password ? ' with password protection' : '';
    UI.showStatus('ai-status', 'success', `Done! Message hidden${passNote}. Click Download to save.`);
    document.getElementById('ai-action-row').classList.remove('hidden');

  } catch (err) {
    setAiLoading(false);
    UI.showStatus('ai-status', 'error', 'Encoding failed: ' + err.message);
  }
}

// ============================================================
// GENERATE — calls puter.ai.txt2img, draws to canvas
// ============================================================
async function generateAIImage(prompt) {
  setAiLoading(true, 'Generating AI image... (may take 10–20 seconds)');
  UI.hideStatus('ai-status');
  document.getElementById('ai-action-row').classList.add('hidden');
  document.getElementById('ai-generated-preview').classList.add('hidden');
  document.getElementById('ai-preview-placeholder').style.display = 'block';

  try {
    // Call Puter.js with a specific model to fix the 'Missing model' error
    const rawImg = await puter.ai.txt2img(prompt, { model: 'flux-1-schnell' });

    // Re-load the image with CORS enabled to prevent canvas tainting
    const imgElement = new Image();
    imgElement.crossOrigin = "Anonymous";
    
    await new Promise((resolve, reject) => {
      imgElement.onload = resolve;
      imgElement.onerror = () => reject(new Error("Failed to load image with CORS enabled"));
      imgElement.src = rawImg.src;
    });

    // Show preview
    const preview = document.getElementById('ai-generated-preview');
    preview.src = imgElement.src;
    preview.classList.remove('hidden');
    preview.style.display = 'block';

    // Draw to canvas — base64 src = same origin = no CORS issue
    const imageData = await drawImageToCanvas(imgElement);
    aiGeneratedImageData = imageData;
    aiMaxChars = Utils.getMaxChars(imageData.data.length);
    updateAiCapacity();
    setAiLoading(false);
    return imageData;

  } catch (err) {
    setAiLoading(false);
    document.getElementById('ai-preview-placeholder').style.display = 'flex';
    UI.showStatus('ai-status', 'error', `Image generation failed: ${err.message || err}`);
    return null;
  }
}

// ============================================================
// DRAW IMAGE TO CANVAS — returns ImageData
// ============================================================
function drawImageToCanvas(imgElement) {
  return new Promise((resolve, reject) => {
    const canvas = document.getElementById('ai-canvas');
    const doDrawn = () => {
      try {
        canvas.width  = imgElement.naturalWidth  || imgElement.width  || 1024;
        canvas.height = imgElement.naturalHeight || imgElement.height || 1024;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      } catch (e) {
        reject(new Error('Canvas pixel read failed: ' + e.message));
      }
    };

    if (imgElement.complete && imgElement.naturalWidth) {
      doDrawn(); // already loaded
    } else {
      imgElement.onload  = doDrawn;
      imgElement.onerror = () => reject(new Error('Image failed to load into canvas.'));
    }
  });
}

// ============================================================
// REGENERATE — same prompt, fresh image
// ============================================================
async function aiRegenerateImage() {
  const prompt  = document.getElementById('ai-prompt').value.trim();
  if (!prompt) { UI.showStatus('ai-status', 'error', 'Please enter a prompt first.'); return; }

  aiEncodedCanvas = null;
  document.getElementById('ai-action-row').classList.add('hidden');

  const message = document.getElementById('ai-secret-message').value.trim();
  if (message) await aiGenerateAndEncode();
  else         await generateAIImage(prompt);
}

// ============================================================
// DOWNLOAD encoded PNG
// ============================================================
function downloadAiEncodedImage() {
  if (!aiEncodedCanvas) {
    UI.showStatus('ai-status', 'error', 'No encoded image ready. Please generate first.');
    return;
  }
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  Utils.downloadCanvasAsPNG(aiEncodedCanvas, `ai_stego_${ts}.png`);
}

// ============================================================
// CAPACITY BAR
// ============================================================
function updateAiCapacity() {
  const msg   = document.getElementById('ai-secret-message').value;
  const fill  = document.getElementById('ai-capacity-fill');
  const label = document.getElementById('ai-capacity-label');
  if (!aiMaxChars) {
    if (label) label.textContent = 'Generate an image first to see capacity';
    if (fill)  fill.style.width  = '0%';
    return;
  }
  const pct = Math.min(100, Math.round((msg.length / aiMaxChars) * 100));
  if (fill) {
    fill.style.width      = pct + '%';
    fill.style.background = pct >= 95 ? '#f87171' : pct >= 75 ? '#fbbf24' : 'var(--accent)';
  }
  if (label) label.textContent = `${msg.length} / ${aiMaxChars} chars (${pct}%)`;
}

// ============================================================
// LOADING HELPER
// ============================================================
function setAiLoading(show, text) {
  const loading     = document.getElementById('ai-loading');
  const loadingText = document.getElementById('ai-loading-text');
  const btn         = document.getElementById('ai-generate-btn');
  if (show) {
    loading.classList.remove('hidden');
    if (loadingText && text) loadingText.textContent = text;
    if (btn) btn.disabled = true;
  } else {
    loading.classList.add('hidden');
    if (btn) btn.disabled = false;
  }
}