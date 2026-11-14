// Photo viewer: opens any photo full size in a native <dialog>.
// Keyboard: ← → to move, Esc to close. Touch: swipe left/right (buttons too).
import { ui } from './ui.js';
import { t, viewerPhotos, photoFiles } from './render.js';

export function initGallery(root, cfg, lang) {
  const dialog = root.querySelector('[data-viewer]');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const photos = viewerPhotos(cfg);
  const img = dialog.querySelector('[data-viewer-img]');
  const count = dialog.querySelector('[data-viewer-count]');
  const prev = dialog.querySelector('[data-viewer-prev]');
  const next = dialog.querySelector('[data-viewer-next]');
  const u = ui[lang].viewer;
  let index = 0;
  let opener = null;

  const show = (i) => {
    index = (i + photos.length) % photos.length;
    const p = photos[index];
    img.src = photoFiles(p).src;
    img.width = p.width;
    img.height = p.height;
    img.alt = t(p.alt, lang);
    count.textContent = photos.length > 1 ? u.count(index + 1, photos.length) : '';
    prev.hidden = next.hidden = photos.length < 2;
  };

  root.querySelectorAll('[data-photo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      opener = btn;
      show(Number(btn.dataset.photo));
      dialog.showModal();
      dialog.querySelector('[data-viewer-close]').focus();
    });
  });
  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  dialog.querySelector('[data-viewer-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { img.removeAttribute('src'); opener?.focus(); });
  // click on the dark backdrop (outside the photo and buttons) closes
  dialog.addEventListener('click', (e) => { if (e.target === dialog || e.target.classList.contains('viewer__stage')) dialog.close(); });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
  });
  let x0 = null;
  dialog.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  dialog.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    x0 = null;
  });
}
