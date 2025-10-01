(() => {
  const ROOT_ID = 'hh-modal-root';
  const existing = document.getElementById(ROOT_ID);
  if (existing) {
    // Bring to front instead of removing
    existing.style.removeProperty('display'); // ensure visible
    existing.style.zIndex = '2147483647';     // max-ish z-index
    existing.querySelector('.hh-modal')?.focus?.();
    return;
  }

  const STYLE_ID = 'hh-modal-style';
  if (!document.getElementById(STYLE_ID)) {
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('modal.css');
    document.head.appendChild(link);
  }

  const root = document.createElement('div');
  root.className = 'hh-modal-root';
  root.id = ROOT_ID;

  const backdrop = document.createElement('div');
  backdrop.className = 'hh-modal-backdrop';
  backdrop.addEventListener('click', () => root.remove());

  const modal = document.createElement('div');
  modal.className = 'hh-modal';
  modal.style.top = '80px';
  modal.style.left = '80px';

  const header = document.createElement('div');
  header.className = 'hh-modal-header';
  const title = document.createElement('div');
  title.className = 'hh-modal-title';
  title.textContent = 'Helping Hand';
  const close = document.createElement('button');
  close.className = 'hh-modal-btn';
  close.textContent = 'Close';
  close.addEventListener('click', () => root.remove());
  header.appendChild(title);
  header.appendChild(close);

  const body = document.createElement('div');
  body.className = 'hh-modal-body';
  const iframe = document.createElement('iframe');
  iframe.className = 'hh-modal-iframe';
  iframe.src = chrome.runtime.getURL('app-shell.html?surface=modal');
  try { iframe.allow = 'microphone; clipboard-read; clipboard-write'; } catch (e) {}
  body.appendChild(iframe);

  const handle = document.createElement('div');
  handle.className = 'hh-modal-handle';

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(handle);

  root.appendChild(backdrop);
  root.appendChild(modal);
  document.documentElement.appendChild(root);

  // Allow iframe to request close via postMessage
  window.addEventListener('message', (e) => {
    try {
      if (e?.data && e.data.type === 'hh-close-modal') {
        root.remove();
      }
    } catch {}
  });

  // Drag logic
  (() => {
    let isDragging = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = modal.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      document.addEventListener('mousemove', onMouseMove, true);
      document.addEventListener('mouseup', onMouseUp, true);
      e.preventDefault();
      e.stopPropagation();
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      modal.style.left = Math.max(0, startLeft + dx) + 'px';
      modal.style.top = Math.max(0, startTop + dy) + 'px';
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('mouseup', onMouseUp, true);
    };

    header.addEventListener('mousedown', onMouseDown, true);
  })();

  // Resize logic
  (() => {
    let resizing = false;
    let startX = 0, startY = 0, startW = 0, startH = 0;

    const onDown = (e) => {
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = modal.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup', onUp, true);
      e.preventDefault();
      e.stopPropagation();
    };

    const onMove = (e) => {
      if (!resizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      modal.style.width = Math.max(320, startW + dx) + 'px';
      modal.style.height = Math.max(220, startH + dy) + 'px';
    };

    const onUp = () => {
      resizing = false;
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
    };

    handle.addEventListener('mousedown', onDown, true);
  })();
})();
