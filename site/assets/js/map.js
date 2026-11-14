// Google Maps next to the venue address.
// Google Maps sets its own cookies, so by default it only loads after the guest
// presses «Mostrar mapa». The choice is remembered in this browser, so on later
// visits (and after a language switch) the map appears directly.
const KEY = 'maps-ok';
let accepted = false;
const remembered = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const remember = () => { try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ } };

export function initMap(root) {
  const box = root.querySelector('[data-map]');
  if (!box) return;

  const load = (focus) => {
    if (box.querySelector('iframe')) return;
    const frame = document.createElement('iframe');
    frame.className = 'map__frame';
    frame.src = box.dataset.src;
    frame.title = box.dataset.title;
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer-when-downgrade';
    frame.allowFullscreen = true;
    box.querySelector('[data-map-placeholder]')?.remove();
    box.append(frame);
    box.classList.add('is-loaded');
    if (focus) frame.focus();
  };

  if (!box.dataset.ask || accepted || remembered()) { load(false); return; }
  box.querySelector('[data-map-load]').addEventListener('click', () => {
    accepted = true;
    remember();
    load(true);
  });
}
