function showToast(message, kind = 'info', ms = 3000) {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = message; wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(()=>el.remove(), 200); }, ms);
}

// simple alias for Bootstrap-like alerts in pages that use showMessage
function showMessageToast(text, type){ showToast(text, type === 'danger' ? 'danger' : (type === 'success' ? 'success' : 'info'), 4000); }
