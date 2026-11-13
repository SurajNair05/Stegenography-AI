/* ============================================
   js/shamirsui.js
   UI controller for the Shamir's Secret Sharing tab.
   Handles split + encode into N images, and
   decode + reconstruct from K uploaded images.
   ============================================ */

// ── STATE ──
let sssShareImages = [];   // Array of { canvas, shareStr, prompt } after generation
let sssUploadedShares = []; // Array of decoded share strings from uploaded images

// ============================================================
// SPLIT FLOW — user clicks "Generate Shares & Hide in Images"
// ============================================================
async function sssGenerateShares() {
    const message = document.getElementById('sss-message').value.trim();
    const prompt = document.getElementById('sss-prompt').value.trim();
    const n = parseInt(document.getElementById('sss-n').value);
    const k = parseInt(document.getElementById('sss-k').value);

    // Validation
    if (!message) { UI.showStatus('sss-split-status', 'error', 'Please enter a secret message.'); return; }
    if (!prompt) { UI.showStatus('sss-split-status', 'error', 'Please enter an image style prompt.'); return; }
    if (isNaN(n) || n < 2 || n > 8) { UI.showStatus('sss-split-status', 'error', 'Total shares N must be between 2 and 8.'); return; }
    if (isNaN(k) || k < 2 || k > n) { UI.showStatus('sss-split-status', 'error', `Threshold K must be between 2 and ${n}.`); return; }

    // Reset state
    sssShareImages = [];
    document.getElementById('sss-images-grid').innerHTML = '';
    document.getElementById('sss-images-section').classList.add('hidden');
    UI.hideStatus('sss-split-status');
    setSssLoading(true, `Splitting secret into ${n} shares...`);

    try {
        // Step 1: Shamir split
        const shares = Shamirs.split(message, n, k);
        UI.showStatus('sss-split-status', 'info', `Secret split into ${n} shares. Now generating ${n} AI images... (this takes a while)`);

        // Step 2: generate N images and encode one share into each
        for (let i = 0; i < n; i++) {
            setSssLoading(true, `Generating AI image ${i + 1} of ${n}...`);

            // Generate unique prompt per image so they all look different
            const imagePrompt = `${prompt}, variation ${i + 1}, unique composition`;
            const imgElement = await puterGenerateImage(imagePrompt);

            // Draw to a fresh off-screen canvas
            const canvas = document.createElement('canvas');
            const imageData = await drawImageDataFromElement(imgElement, canvas);

            // LSB-encode the share string into the image
            const encodedData = Steganography.encode(imageData, shares[i], '');
            canvas.getContext('2d').putImageData(encodedData, 0, 0);

            sssShareImages.push({ canvas, shareStr: shares[i], index: i + 1 });

            // Add card to grid
            addShareCard(canvas, i + 1, n, k);
        }

        setSssLoading(false);
        document.getElementById('sss-images-section').classList.remove('hidden');
        UI.showStatus('sss-split-status', 'success',
            `Done! ${n} images generated. Any ${k} of them can reconstruct the secret. Download all images below.`
        );

    } catch (err) {
        setSssLoading(false);
        UI.showStatus('sss-split-status', 'error', 'Failed: ' + err.message);
    }
}

// Add a share card to the grid with preview + download button
function addShareCard(canvas, index, n, k) {
    const grid = document.getElementById('sss-images-grid');
    const card = document.createElement('div');
    card.className = 'sss-share-card';
    card.innerHTML = `
    <div class="sss-card-header">
      <span class="sss-card-badge">Share ${index} of ${n}</span>
      <span class="sss-card-hint">Need ${k} to decode</span>
    </div>
    <img class="sss-card-img" src="" alt="Share ${index} image" />
    <button class="sss-download-btn" onclick="downloadShareImage(${index - 1})">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v7M4 6l2.5 2.5L9 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 11h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      Download Share ${index}
    </button>
  `;
    // Set preview from canvas
    canvas.toBlob(blob => {
        card.querySelector('img').src = URL.createObjectURL(blob);
    }, 'image/png');
    grid.appendChild(card);
}

// Download a specific share image
function downloadShareImage(idx) {
    if (!sssShareImages[idx]) return;
    Utils.downloadCanvasAsPNG(sssShareImages[idx].canvas, `share_${idx + 1}_of_${sssShareImages.length}.png`);
}

// Download all share images at once
function downloadAllShares() {
    if (sssShareImages.length === 0) return;
    sssShareImages.forEach((s, i) => {
        setTimeout(() => Utils.downloadCanvasAsPNG(s.canvas, `share_${i + 1}_of_${sssShareImages.length}.png`), i * 400);
    });
}

// ============================================================
// RECONSTRUCT FLOW — user uploads K+ images
// ============================================================
function sssHandleUpload(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    sssUploadedShares = [];
    document.getElementById('sss-uploaded-list').innerHTML = '';
    document.getElementById('sss-reconstruct-btn').disabled = true;
    UI.hideStatus('sss-reconstruct-status');
    document.getElementById('sss-result-box').classList.add('hidden');

    UI.showStatus('sss-reconstruct-status', 'info', `Loading ${files.length} image(s)...`);

    const promises = files.map((file, i) => loadShareFromFile(file, i));
    Promise.all(promises).then(results => {
        sssUploadedShares = results.filter(r => r !== null);
        const count = sssUploadedShares.length;

        if (count === 0) {
            UI.showStatus('sss-reconstruct-status', 'error', 'No valid share images found. Make sure you upload images from the Split tab.');
            return;
        }

        // Try to get K from first share
        let kNeeded = '?';
        try {
            const parts = sssUploadedShares[0].split(':');
            kNeeded = parseInt(parts[4]);
        } catch (e) { }

        UI.showStatus('sss-reconstruct-status', 'info', `${count} share(s) loaded. ${count >= kNeeded ? 'Ready to reconstruct!' : `Need at least ${kNeeded} shares.`}`);
        document.getElementById('sss-reconstruct-btn').disabled = count < 2;
        renderUploadedList(files, count);
    });
}

async function loadShareFromFile(file, idx) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const shareStr = Steganography.decode(imageData, '');
                    if (!shareStr.startsWith('SSS:')) throw new Error('Not a valid share image');
                    resolve(shareStr);
                } catch (err) {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function renderUploadedList(files, validCount) {
    const list = document.getElementById('sss-uploaded-list');
    list.innerHTML = '';
    files.forEach((f, i) => {
        const item = document.createElement('div');
        item.className = 'sss-upload-item';
        const valid = sssUploadedShares[i] !== undefined && sssUploadedShares[i] !== null;
        item.innerHTML = `
      <span class="sss-upload-icon">${valid ? '✓' : '✗'}</span>
      <span class="sss-upload-name">${f.name}</span>
      <span class="sss-upload-status ${valid ? 'valid' : 'invalid'}">${valid ? 'Valid share' : 'No share found'}</span>
    `;
        list.appendChild(item);
    });
}

function sssReconstruct() {
    try {
        const validShares = sssUploadedShares.filter(s => s && s.startsWith('SSS:'));
        if (validShares.length === 0) throw new Error('No valid shares found.');

        const message = Shamirs.reconstruct(validShares);

        UI.showStatus('sss-reconstruct-status', 'success', 'Secret successfully reconstructed!');
        document.getElementById('sss-result-text').textContent = message;
        document.getElementById('sss-result-box').classList.remove('hidden');
    } catch (err) {
        UI.showStatus('sss-reconstruct-status', 'error', err.message);
    }
}

function sssCopyResult() {
    const text = document.getElementById('sss-result-text').textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('sss-copy-btn');
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = orig, 1500);
    });
}

// ============================================================
// PUTER IMAGE GENERATION HELPER
// ============================================================
async function puterGenerateImage(prompt) {
    const rawImg = await puter.ai.txt2img(prompt, { model: 'flux-1-schnell' });
    if (!rawImg || !rawImg.src) throw new Error('Puter returned no image.');

    // Re-load the image with CORS enabled to prevent canvas tainting
    const imgElement = new Image();
    imgElement.crossOrigin = "Anonymous";
    
    await new Promise((resolve, reject) => {
        imgElement.onload = resolve;
        imgElement.onerror = () => reject(new Error("Failed to load image with CORS enabled"));
        imgElement.src = rawImg.src;
    });

    return imgElement;
}

async function drawImageDataFromElement(imgElement, canvas) {
    return new Promise((resolve, reject) => {
        const draw = () => {
            try {
                canvas.width = imgElement.naturalWidth || 1024;
                canvas.height = imgElement.naturalHeight || 1024;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(imgElement, 0, 0);
                resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
            } catch (e) { reject(e); }
        };
        if (imgElement.complete && imgElement.naturalWidth > 0) draw();
        else { imgElement.onload = draw; imgElement.onerror = () => reject(new Error('Image load failed')); }
    });
}

// ============================================================
// N/K SLIDER SYNC
// ============================================================
function sssUpdateN(val) {
    document.getElementById('sss-n-val').textContent = val;
    const k = parseInt(document.getElementById('sss-k').value);
    if (k > parseInt(val)) {
        document.getElementById('sss-k').value = val;
        document.getElementById('sss-k-val').textContent = val;
    }
    document.getElementById('sss-k').max = val;
    sssUpdateThresholdHint();
}

function sssUpdateK(val) {
    document.getElementById('sss-k-val').textContent = val;
    sssUpdateThresholdHint();
}

function sssUpdateThresholdHint() {
    const n = parseInt(document.getElementById('sss-n').value);
    const k = parseInt(document.getElementById('sss-k').value);
    document.getElementById('sss-threshold-hint').textContent =
        `Any ${k} of the ${n} images can reconstruct the secret. ${n - k} image(s) can be lost safely.`;
}

// ============================================================
// LOADING HELPER
// ============================================================
function setSssLoading(show, text) {
    const btn = document.getElementById('sss-generate-btn');
    const info = document.getElementById('sss-loading-info');
    if (show) {
        if (btn) btn.disabled = true;
        if (info) { info.textContent = text; info.classList.remove('hidden'); }
    } else {
        if (btn) btn.disabled = false;
        if (info) info.classList.add('hidden');
    }
}