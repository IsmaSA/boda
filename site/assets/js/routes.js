// "Rutas desde…": one tab per city. Click, or ← → Home End on the keyboard.
// Without JavaScript every city is shown one after another.
let selected = 0; // kept across language switches

export function initRoutes(root) {
  const box = root.querySelector('[data-routes]');
  if (!box) return;
  const tabs = [...box.querySelectorAll('[role="tab"]')];
  const panels = [...box.querySelectorAll('[data-route-panel]')];

  const select = (i, focus) => {
    selected = (i + tabs.length) % tabs.length;
    tabs.forEach((tab, j) => {
      const on = j === selected;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      panels[j].hidden = !on;
    });
    if (focus) tabs[selected].focus();
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i, false));
    tab.addEventListener('keydown', (e) => {
      const moves = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (e.key in moves) { e.preventDefault(); select(moves[e.key], true); }
    });
  });
  box.classList.add('is-tabs');
  select(Math.min(selected, tabs.length - 1), false);
}
