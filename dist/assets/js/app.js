/* RotasFlow — shell, navegação e roteamento */
(function () {
  const U = RF.utils;

  const ICONS = {
    dashboard: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"/>',
    orders: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2.25 4.5H6.75A2.25 2.25 0 0 1 4.5 18.25V5.75A2.25 2.25 0 0 1 6.75 3.5h6.879a2.25 2.25 0 0 1 1.59.659l3.622 3.622a2.25 2.25 0 0 1 .659 1.59V18.25a2.25 2.25 0 0 1-2.25 2.25Z"/>',
    money: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"/>',
    clients: '<path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"/>',
    drivers: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/>',
    vehicles: '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/>',
    types: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z"/>',
    reports: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/>',
    users: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/>'
  };

  const NAV = [
    {
      label: 'Principal',
      items: [{ route: 'dashboard', label: 'Dashboard', icon: 'dashboard' }]
    },
    {
      label: 'Operação',
      items: [
        { route: 'ordens', label: 'Ordens de Serviço', icon: 'orders' },
        { route: 'contas', label: 'Prestação de Contas', icon: 'money' }
      ]
    },
    {
      label: 'Cadastros',
      items: [
        { route: 'clientes', label: 'Clientes', icon: 'clients', roles: ['admin', 'operador'] },
        { route: 'motoristas', label: 'Motoristas', icon: 'drivers', roles: ['admin', 'operador'] },
        { route: 'veiculos', label: 'Veículos', icon: 'vehicles', roles: ['admin', 'operador'] },
        { route: 'tipos', label: 'Tipos de Serviço', icon: 'types', roles: ['admin', 'operador'] }
      ]
    },
    {
      label: 'Gestão',
      items: [
        { route: 'relatorios', label: 'Relatórios', icon: 'reports', roles: ['admin', 'operador'] },
        { route: 'perfis', label: 'Usuários e Perfis', icon: 'users', roles: ['admin'] }
      ]
    }
  ];

  RF.routes = {
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Visão geral da operação',
      roles: ['admin', 'operador', 'motorista'],
      render: (c) => RF.pages.dashboard.render(c)
    },
    ordens: {
      title: 'Ordens de Serviço',
      subtitle: 'Solicitações, execução e comprovantes',
      roles: ['admin', 'operador', 'motorista'],
      render: (c) => RF.pages.ordens.render(c)
    },
    contas: {
      title: 'Prestação de Contas',
      subtitle: 'Despesas, repasses e comprovantes',
      roles: ['admin', 'operador', 'motorista'],
      render: (c) => RF.pages.contas.render(c)
    },
    clientes: {
      title: 'Clientes',
      subtitle: 'Cadastro de clientes PJ e PF',
      roles: ['admin', 'operador'],
      render: (c) => RF.pages.clientes.render(c)
    },
    motoristas: {
      title: 'Motoristas',
      subtitle: 'Cadastro e documentação de motoristas',
      roles: ['admin', 'operador'],
      render: (c) => RF.pages.motoristas.render(c)
    },
    veiculos: {
      title: 'Veículos',
      subtitle: 'Frota própria e terceirizada',
      roles: ['admin', 'operador'],
      render: (c) => RF.pages.veiculos.render(c)
    },
    tipos: {
      title: 'Tipos de Serviço',
      subtitle: 'Categorias de atendimento',
      roles: ['admin', 'operador'],
      render: (c) => RF.pages.tipos.render(c)
    },
    relatorios: {
      title: 'Relatórios',
      subtitle: 'Consolidação financeira e operacional',
      roles: ['admin', 'operador'],
      render: (c) => RF.pages.relatorios.render(c)
    },
    perfis: {
      title: 'Usuários e Perfis',
      subtitle: 'Controle de acesso ao sistema',
      roles: ['admin'],
      render: (c) => RF.pages.perfis.render(c)
    }
  };

  let current = null;

  function icon(name, cls = '') {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  function renderNav() {
    const role = RF.state.profile ? RF.state.profile.nivel_acesso : null;
    const nav = document.getElementById('sidebar-nav');
    let html = '';

    NAV.forEach((group) => {
      const items = group.items.filter((item) => !item.roles || item.roles.includes(role));
      if (!items.length) return;
      html += `<p class="nav-section">${group.label}</p>`;
      items.forEach((item) => {
        html += `<a href="#/${item.route}" class="nav-item" data-route="${item.route}">
          ${icon(item.icon)}
          <span class="truncate">${item.label}</span>
        </a>`;
      });
    });

    nav.innerHTML = html;
    markActive(current);
  }

  function markActive(route) {
    document.querySelectorAll('#sidebar-nav .nav-item').forEach((node) => {
      node.classList.toggle('active', node.getAttribute('data-route') === route);
    });
  }

  function updateUserChips() {
    const profile = RF.state.profile || {};
    const nome = profile.nome || 'Usuário';
    const role = U.ROLES[profile.nivel_acesso] || profile.nivel_acesso || '—';
    const initials = U.initials(nome);

    document.getElementById('sidebar-user-name').textContent = nome;
    document.getElementById('sidebar-user-role').textContent = role;
    document.getElementById('sidebar-avatar').textContent = initials;
    document.getElementById('topbar-avatar').textContent = initials;
    document.getElementById('topbar-avatar').title = `${nome} · ${role}`;
  }

  function closeSidebar() {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');
  }

  function openSidebar() {
    document.getElementById('sidebar').classList.remove('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.remove('hidden');
  }

  function parseRoute() {
    const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return raw || 'dashboard';
  }

  async function navigate(route) {
    const profile = RF.state.profile;
    if (!profile) return;

    let key = RF.routes[route] ? route : 'dashboard';
    let def = RF.routes[key];

    if (def.roles && !def.roles.includes(profile.nivel_acesso)) {
      key = 'dashboard';
      def = RF.routes.dashboard;
      if (location.hash !== '#/dashboard') {
        location.hash = '#/dashboard';
        return;
      }
    }

    current = key;
    markActive(key);

    document.getElementById('page-title').textContent = def.title;
    document.getElementById('page-subtitle').textContent = def.subtitle || '';

    const container = document.getElementById('page-content');
    container.innerHTML = '';
    RF.ui.loading(true);
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

    try {
      await def.render(container);
    } catch (err) {
      console.error(err);
      container.innerHTML = `
        <div class="card p-8 text-center">
          <div class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-600">
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
          </div>
          <h3 class="mt-3 text-base font-bold text-slate-900">Não foi possível carregar a página</h3>
          <p class="mx-auto mt-1 max-w-lg text-sm text-slate-500">${U.escape(U.errorMessage(err))}</p>
          <button type="button" class="btn-primary mx-auto mt-4" data-action="refresh">Tentar novamente</button>
        </div>`;
      RF.ui.toast(U.errorMessage(err), 'error');
    } finally {
      RF.ui.loading(false);
    }
  }

  const app = {};

  app.go = function (route) {
    if (parseRoute() === route) {
      navigate(route);
    } else {
      location.hash = '#/' + route;
    }
  };

  app.refresh = function () {
    if (current) navigate(current);
  };

  app.onAuthenticated = function () {
    renderNav();
    updateUserChips();
    navigate(parseRoute());
  };

  app.onLoggedOut = function () {
    current = null;
    RF.ui.closeAllModals();
    document.getElementById('sidebar-nav').innerHTML = '';
    document.getElementById('page-content').innerHTML = '';
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  };

  app.getMotoristaId = function () {
    return RF.state.motorista ? RF.state.motorista.id : null;
  };

  app.canSeeFinance = function () {
    return RF.auth.canSeeFinance();
  };

  RF.app = app;

  document.addEventListener('click', (event) => {
    const routeLink = event.target.closest('[data-route]');
    if (routeLink) {
      event.preventDefault();
      app.go(routeLink.getAttribute('data-route'));
      return;
    }
    if (event.target.closest('[data-action="refresh"]')) {
      app.refresh();
    }
  });

  document.addEventListener('input', (event) => {
    const mask = event.target.getAttribute && event.target.getAttribute('data-mask');
    if (!mask) return;
    const start = event.target.selectionStart;
    const before = event.target.value;
    const masked = U.applyMask(before, mask);
    if (masked !== before) {
      event.target.value = masked;
      const delta = masked.length - before.length;
      try {
        event.target.setSelectionRange(start + delta, start + delta);
      } catch (e) { /* ignore */ }
    }
  });

  window.addEventListener('hashchange', () => {
    if (RF.state.profile) navigate(parseRoute());
  });

  document.getElementById('sidebar-open').addEventListener('click', openSidebar);
  document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  document.getElementById('topbar-avatar').addEventListener('click', () => {
    const p = RF.state.profile;
    if (!p) return;
    RF.ui.openModal({
      title: 'Sua conta',
      size: 'max-w-md',
      content: `
        <div class="flex items-center gap-4">
          <div class="grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-lg font-bold text-white">${U.escape(U.initials(p.nome))}</div>
          <div class="min-w-0">
            <p class="truncate text-base font-bold text-slate-900">${U.escape(p.nome || '—')}</p>
            <p class="truncate text-sm text-slate-500">${U.escape(p.email || '—')}</p>
            <div class="mt-1">${U.roleBadge(p.nivel_acesso)}</div>
          </div>
        </div>
        <dl class="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
          <div><dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</dt><dd class="text-sm font-medium ${p.ativo === false ? 'text-rose-600' : 'text-emerald-600'}">${p.ativo === false ? 'Inativo' : 'Ativo'}</dd></div>
          <div><dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Motorista vinculado</dt><dd class="text-sm font-medium text-slate-800">${RF.state.motorista ? U.escape(RF.state.motorista.nome) : '—'}</dd></div>
        </dl>`,
      footer: `<button type="button" class="btn-secondary" data-modal-close>Fechar</button>`
    });
  });

  RF.auth.init();
})();
