/* ============================================
   js/ui.js
   All DOM interactions: tabs, upload zones,
   status messages, capacity bar, result box
   ============================================ */

const UI = (() => {

  // ---- TAB SWITCHING ---- //
  function switchTab(tabName) {
    const tabs   = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.panel');

    tabs.forEach(t => {
      const isActive = t.id === `tab-${tabName}`;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive);
    });

    panels.forEach(p => {
      const isActive = p.id === `panel-${tabName}`;
      p.classList.toggle('active', isActive);
      p.classList.toggle('hidden', !isActive);
    });
  }

  // ---- STATUS MESSAGES ---- //
  const ICONS = {
    success: `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" style="flex-shrink:0" aria-hidden="true"><circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 7.5l2 2 3.5-3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    error:   `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" style="flex-shrink:0" aria-hidden="true"><circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 5l5 5M10 5l-5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    info:    `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" style="flex-shrink:0" aria-hidden="true"><circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7.5 6.5v4M7.5 4.5v.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    warning: `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" style="flex-shrink:0" aria-hidden="true"><path d="M7.5 2L14 13H1L7.5 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M7.5 6v3.5M7.5 11v.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  };

  function showStatus(elementId, type, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.className  = `status ${type}`;
    el.innerHTML  = `${ICONS[type] || ''}<span>${message}</span>`;
    el.classList.remove('hidden');
  }

  function hideStatus(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.classList.add('hidden');
  }

  // ---- IMAGE UPLOAD PREVIEW ---- //
  function showImagePreview(zoneId, contentId, previewId, metaId, nameId, sizeId, file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById(previewId);
      const content = document.getElementById(contentId);
      const meta    = document.getElementById(metaId);

      preview.src = e.target.result;
      preview.classList.remove('hidden');
      content.style.display = 'none';

      // Show meta bar
      document.getElementById(nameId).textContent = file.name;
      document.getElementById(sizeId).textContent = Utils.formatFileSize(file.size);
      meta.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  // ---- CAPACITY BAR ---- //
  function updateCapacityBar(current, max) {
    const fill  = document.getElementById('capacity-fill');
    const label = document.getElementById('capacity-label');
    if (!fill || !label) return;

    if (max === 0) {
      label.textContent = 'Upload an image to see capacity';
      fill.style.width  = '0%';
      return;
    }

    const pct = Math.min(100, Math.round((current / max) * 100));
    fill.style.width = pct + '%';
    label.textContent = `${current} / ${max} chars (${pct}%)`;

    // Color feedback
    if (pct >= 95) {
      fill.style.background = '#f87171';
      fill.classList.add('danger');
    } else if (pct >= 75) {
      fill.style.background = '#fbbf24';
      fill.classList.remove('danger');
    } else {
      fill.style.background = 'var(--accent)';
      fill.classList.remove('danger');
    }
  }

  // ---- RESULT BOX ---- //
  function showResult(message) {
    const box  = document.getElementById('result-box');
    const text = document.getElementById('result-text');
    if (!box || !text) return;
    text.textContent = message;
    box.classList.remove('hidden');
  }

  function hideResult() {
    const box = document.getElementById('result-box');
    if (box) box.classList.add('hidden');
  }

  // ---- COPY TO CLIPBOARD ---- //
  function copyResult() {
    const text = document.getElementById('result-text');
    const btn  = document.getElementById('copy-btn');
    if (!text || !btn) return;

    navigator.clipboard.writeText(text.textContent).then(() => {
      btn.classList.add('copied');
      const original = btn.innerHTML;
      btn.innerHTML = btn.innerHTML.replace('Copy message', 'Copied!');
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = original;
      }, 1500);
    });
  }

  // ---- DRAG AND DROP ---- //
  function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
  }

  function handleDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
  }

  // ---- BUTTON STATE ---- //
  function setButtonLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('loading', loading);
  }

  // ---- PASSWORD TOGGLE ---- //
  function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.style.opacity = isPassword ? '1' : '0.5';
  }

  return {
    switchTab,
    showStatus, hideStatus,
    showImagePreview,
    updateCapacityBar,
    showResult, hideResult,
    copyResult,
    handleDragOver, handleDragLeave,
    setButtonLoading,
    togglePassword,
  };

})();