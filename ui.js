// Reusable UI helpers: toast, confirm dialog, empty/error blocks.
window.UI = (function () {
  const esc = U.esc;
  function toast(text, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'error' ? ' error' : '');
    el.textContent = (kind === 'error' ? 'Error: ' : 'Success: ') + text;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
  // Native <dialog>: focus trap, Esc and aria-modal come built in.
  function confirmDialog(opts) {
    const d = document.getElementById('modal');
    let busy = false;
    d.innerHTML = '<h2 id="modal-title">' + esc(opts.title) + '</h2><p id="modal-desc" class="muted">' + esc(opts.message) + '</p>' +
      '<p class="alert" role="alert" hidden></p><div class="foot"><button type="button" class="btn" data-cancel>Cancel</button>' +
      '<button type="button" class="btn danger" data-ok>' + esc(opts.confirmLabel) + '</button></div>';
    const ok = d.querySelector('[data-ok]'), cancel = d.querySelector('[data-cancel]'), alertEl = d.querySelector('.alert');
    cancel.onclick = () => { if (!busy) d.close(); };
    d.oncancel = (e) => { if (busy) e.preventDefault(); };
    ok.onclick = async () => {
      if (busy) return; // blocks duplicate clicks
      busy = true; ok.disabled = cancel.disabled = true; alertEl.hidden = true;
      ok.innerHTML = '<span class="spinner"></span> Deleting…';
      try { await opts.onConfirm(); d.close(); }
      catch (e) { alertEl.textContent = 'Error: ' + e.message; alertEl.hidden = false; ok.textContent = opts.confirmLabel; ok.disabled = cancel.disabled = false; busy = false; }
    };
    d.showModal();
    cancel.focus();
  }
  const empty = (title, actionHTML) => '<div class="card empty"><p>' + esc(title) + '</p>' + (actionHTML || '') + '</div>';
  const errorBlock = (msg) => '<div class="card empty" role="alert"><p>' + esc(msg) + '</p><button type="button" class="btn" data-retry>Retry</button></div>';
  const skeletons = (n) => new Array(n).fill('<div class="skeleton"></div>').join('');
  return { toast, confirmDialog, empty, errorBlock, skeletons };
})();
