/* RotasFlow — temas/skins da interface */
(function () {
  const U = RF.utils;
  const STORAGE_KEY = 'rotasflow-theme';
  const DEFAULT_THEME = 'claro';

  const THEMES = [
    {
      id: 'claro',
      name: 'Claro',
      description: 'Azul padrão',
      accent: '#2148eb',
      soft: '#eef4ff',
      bg: '#f1f5f9',
      meta: '#020617'
    },
    {
      id: 'escuro',
      name: 'Escuro',
      description: 'Modo noturno',
      accent: '#3b82f6',
      soft: '#172554',
      bg: '#0b1120',
      meta: '#0b1120'
    },
    {
      id: 'esmeralda',
      name: 'Esmeralda',
      description: 'Verde',
      accent: '#059669',
      soft: '#ecfdf5',
      bg: '#ecfdf5',
      meta: '#022c22'
    },
    {
      id: 'violeta',
      name: 'Violeta',
      description: 'Roxo',
      accent: '#7c3aed',
      soft: '#f5f3ff',
      bg: '#f5f3ff',
      meta: '#2e1065'
    }
  ];

  let current = DEFAULT_THEME;

  function readStored() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function store(id) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (e) { /* armazenamento indisponível */ }
  }

  function find(id) {
    return THEMES.filter((t) => t.id === id)[0] || THEMES[0];
  }

  function syncButtons() {
    document.querySelectorAll('[data-theme-option]').forEach((btn) => {
      const selected = btn.getAttribute('data-theme-option') === current;
      btn.classList.toggle('selected', selected);
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function apply(id, persist) {
    current = find(id).id;
    document.documentElement.setAttribute('data-theme', current);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', find(current).meta);
    if (persist !== false) store(current);
    syncButtons();
  }

  const theme = {
    THEMES: THEMES,
    get current() { return current; },
    get: find,
    set(id) { apply(id, true); },
    sync: syncButtons,
    optionsHtml() {
      return THEMES.map((t) => `
        <button type="button" data-theme-option="${t.id}" class="theme-option" aria-pressed="false" title="${U.escape(t.description)}">
          <span class="theme-option-preview" style="--swatch-accent:${t.accent};--swatch-soft:${t.soft};--swatch-bg:${t.bg}">
            <span></span><span></span><span></span>
          </span>
          <span class="theme-option-label">${U.escape(t.name)}</span>
        </button>`).join('');
    },
    init() { apply(readStored(), false); }
  };

  RF.theme = theme;
  theme.init();
})();
