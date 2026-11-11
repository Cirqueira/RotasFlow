/* RotasFlow — componentes de interface */
(function () {
  const U = RF.utils;
  const ui = {};
  const modalRoot = () => document.getElementById('modal-root');

  ui.loading = function (show) {
    const el = document.getElementById('app-loader');
    if (!el) return;
    el.classList.toggle('hidden', !show);
    el.classList.toggle('grid', !!show);
  };

  ui.toast = function (message, type = 'success', timeout = 4200) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const colors = {
      success: 'text-emerald-600',
      error: 'text-rose-600',
      info: 'text-brand-600',
      warning: 'text-amber-600'
    };
    const icons = {
      success: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>',
      error: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>',
      info: '<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/>',
      warning: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>'
    };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <svg class="mt-0.5 h-4 w-4 shrink-0 ${colors[type] || colors.info}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[type] || icons.info}</svg>
      <p class="flex-1 leading-snug">${U.escape(message)}</p>
      <button type="button" class="shrink-0 text-slate-400 hover:text-slate-700" aria-label="Fechar">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
      </button>`;
    const remove = () => el.remove();
    el.querySelector('button').addEventListener('click', remove);
    root.appendChild(el);
    setTimeout(remove, timeout);
  };

  ui.openModal = function (opts) {
    const options = Object.assign({
      title: '',
      subtitle: '',
      content: '',
      footer: '',
      size: 'max-w-2xl',
      closable: true,
      onMount: null
    }, opts || {});

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-panel ${options.size}" role="dialog" aria-modal="true">
        <div class="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div class="min-w-0">
            <h2 class="truncate text-base font-bold text-slate-900">${U.escape(options.title)}</h2>
            ${options.subtitle ? `<p class="mt-0.5 text-xs text-slate-500">${U.escape(options.subtitle)}</p>` : ''}
          </div>
          ${options.closable ? `<button type="button" data-modal-close class="btn-icon -mr-1 -mt-1" aria-label="Fechar">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
          </button>` : ''}
        </div>
        <div class="px-5 py-4">${options.content}</div>
        ${options.footer ? `<div class="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3 rounded-b-2xl">${options.footer}</div>` : ''}
      </div>`;

    const close = () => {
      if (!backdrop.isConnected) return;
      backdrop.remove();
      if (!modalRoot().querySelector('.modal-backdrop')) {
        document.body.classList.remove('overflow-hidden');
      }
    };

    if (options.closable) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close();
      });
      backdrop.querySelectorAll('[data-modal-close]').forEach((btn) => btn.addEventListener('click', close));
    }
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape' && backdrop.isConnected && options.closable) {
        close();
        document.removeEventListener('keydown', escHandler);
      }
    });

    modalRoot().appendChild(backdrop);
    document.body.classList.add('overflow-hidden');
    if (typeof options.onMount === 'function') options.onMount(backdrop, close);
    return { root: backdrop, close };
  };

  ui.closeAllModals = function () {
    modalRoot().querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
    document.body.classList.remove('overflow-hidden');
  };

  ui.confirm = function (opts) {
    const options = Object.assign({
      title: 'Confirmar ação',
      message: 'Deseja continuar?',
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      danger: false
    }, opts || {});

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        controller.close();
        resolve(value);
      };

      const controller = ui.openModal({
        title: options.title,
        size: 'max-w-md',
        content: `<p class="text-sm leading-relaxed text-slate-600">${U.escape(options.message)}</p>`,
        footer: `
          <button type="button" data-cancel class="btn-secondary">${U.escape(options.cancelLabel)}</button>
          <button type="button" data-confirm class="${options.danger ? 'btn-danger' : 'btn-primary'}">${U.escape(options.confirmLabel)}</button>`,
        onMount(root) {
          root.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
          root.querySelector('[data-confirm]').addEventListener('click', () => finish(true));
          root.addEventListener('click', (e) => {
            if (e.target === root) finish(false);
          });
        }
      });
    });
  };

  ui.pageHeader = function (opts) {
    const options = Object.assign({ title: '', subtitle: '', actions: '' }, opts || {});
    return `
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <h2 class="text-xl font-bold text-slate-900">${U.escape(options.title)}</h2>
          ${options.subtitle ? `<p class="mt-0.5 text-sm text-slate-500">${U.escape(options.subtitle)}</p>` : ''}
        </div>
        ${options.actions ? `<div class="flex flex-wrap items-center gap-2">${options.actions}</div>` : ''}
      </div>`;
  };

  ui.empty = function (opts) {
    const options = Object.assign({
      title: 'Nenhum registro encontrado',
      message: 'Comece cadastrando o primeiro registro.',
      action: ''
    }, opts || {});
    return `
      <div class="flex flex-col items-center justify-center px-6 py-14 text-center">
        <div class="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/></svg>
        </div>
        <h3 class="mt-3 text-sm font-semibold text-slate-800">${U.escape(options.title)}</h3>
        <p class="mt-1 max-w-sm text-sm text-slate-500">${U.escape(options.message)}</p>
        ${options.action ? `<div class="mt-4">${options.action}</div>` : ''}
      </div>`;
  };

  ui.skeletonTable = function (rows = 5) {
    let body = '';
    for (let i = 0; i < rows; i++) {
      body += `<tr>${'<td class="px-4 py-3"><div class="skeleton h-4 w-full max-w-[180px]"></div></td>'.repeat(5)}</tr>`;
    }
    return `<div class="card overflow-hidden"><div class="table-wrap"><table class="data-table"><tbody>${body}</tbody></table></div></div>`;
  };

  ui.infoRow = function (label, value) {
    return `
      <div>
        <dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">${U.escape(label)}</dt>
        <dd class="mt-0.5 text-sm text-slate-800">${value === null || value === undefined || value === '' ? '—' : value}</dd>
      </div>`;
  };

  ui.section = function (title, content, actions = '') {
    return `
      <section class="card">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 class="text-sm font-bold text-slate-800">${U.escape(title)}</h3>
          ${actions || ''}
        </div>
        <div class="p-4">${content}</div>
      </section>`;
  };

  ui.uploadBox = function (id, label = 'Selecionar arquivos', accept = 'image/*,application/pdf') {
    return `
      <label for="${id}" class="upload-drop flex cursor-pointer flex-col items-center justify-center gap-1 px-4 py-6 text-center">
        <svg class="h-6 w-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/></svg>
        <span class="text-sm font-medium text-slate-700">${U.escape(label)}</span>
        <span class="text-xs text-slate-500">Imagens ou PDF (vários arquivos)</span>
        <input id="${id}" type="file" multiple accept="${accept}" class="hidden" />
      </label>
      <div id="${id}-list" class="mt-2 space-y-1 text-xs text-slate-600"></div>`;
  };

  ui.spinner = function (size = 'h-4 w-4') {
    return `<svg class="${size} animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"></path></svg>`;
  };

  RF.ui = ui;
})();
