/* RotasFlow — prestação de contas */
(function () {
  const U = RF.utils;
  const sb = RF.supabase;
  const BUCKET = RF.config.BUCKET_NAME;
  const CATEGORIAS = ['Combustível', 'Refeição', 'Pedágio', 'Estacionamento', 'Outros'];

  let filters = { search: '', categoria: '', start: '', end: '' };
  let cache = [];

  const SELECT = `
    id, categoria, valor, observacao, data_gasto, criado_em, ordem_servico_id,
    comprovantes_gasto (id, url_arquivo, nome_arquivo),
    ordens_servico (
      id, data_hora, status, motorista_id, valor_cliente, valor_repasse,
      clientes (razao_social_nome),
      motoristas (nome)
    )`;

  async function removeStorageFile(url) {
    try {
      const marker = `/object/public/${BUCKET}/`;
      const idx = String(url).indexOf(marker);
      if (idx < 0) return;
      const path = decodeURIComponent(String(url).slice(idx + marker.length).split('?')[0]);
      await sb.storage.from(BUCKET).remove([path]);
    } catch (e) {
      /* silencioso */
    }
  }

  function buildQuery() {
    let query = sb
      .from('gastos_servico')
      .select(SELECT)
      .order('data_gasto', { ascending: false })
      .order('criado_em', { ascending: false });

    if (RF.auth.isMotorista() && !RF.app.getMotoristaId()) return null;
    if (filters.categoria) query = query.eq('categoria', filters.categoria);
    if (filters.start) query = query.gte('data_gasto', filters.start);
    if (filters.end) query = query.lte('data_gasto', filters.end);

    return query;
  }

  function filteredData() {
    const term = filters.search.trim().toLowerCase();
    if (!term) return cache;
    return cache.filter((g) => {
      const os = g.ordens_servico || {};
      return [
        g.categoria,
        g.observacao,
        String(os.id || ''),
        os.clientes ? os.clientes.razao_social_nome : '',
        os.motoristas ? os.motoristas.nome : ''
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }

  function summaryHtml(data) {
    const total = U.sum(data, (g) => g.valor);
    const comprovantes = U.sum(data, (g) => (g.comprovantes_gasto || []).length);
    const osIds = new Set(data.map((g) => g.ordem_servico_id).filter(Boolean));
    const canSeeFinance = RF.auth.canSeeFinance();

    const osMap = new Map();
    data.forEach((g) => {
      const os = g.ordens_servico;
      if (os && !osMap.has(os.id)) osMap.set(os.id, os);
    });
    const osList = Array.from(osMap.values());
    const valorCliente = U.sum(osList, (o) => o.valor_cliente);
    const repasses = U.sum(osList, (o) => o.valor_repasse);
    const lucro = valorCliente - repasses - total;

    return `
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div class="card p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total de gastos</p>
          <p class="mt-1 text-2xl font-extrabold text-slate-900">${U.currency(total)}</p>
          <p class="mt-1 text-xs text-slate-500">Despesas lançadas no filtro atual</p>
        </div>
        <div class="card p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lançamentos</p>
          <p class="mt-1 text-2xl font-extrabold text-slate-900">${U.int(data.length)}</p>
          <p class="mt-1 text-xs text-slate-500">Registros de despesa</p>
        </div>
        <div class="card p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Comprovantes</p>
          <p class="mt-1 text-2xl font-extrabold text-slate-900">${U.int(comprovantes)}</p>
          <p class="mt-1 text-xs text-slate-500">Arquivos anexados</p>
        </div>
        <div class="card p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">OS com gastos</p>
          <p class="mt-1 text-2xl font-extrabold text-slate-900">${U.int(osIds.size)}</p>
          <p class="mt-1 text-xs text-slate-500">Ordens de serviço envolvidas</p>
        </div>
      </div>

      ${canSeeFinance ? `
      <div class="mt-4 card p-4">
        <div class="flex flex-wrap items-center gap-x-8 gap-y-3">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Financeiro das OS listadas</p>
          <div class="flex items-center gap-2 text-sm"><span class="text-slate-500">Cliente</span><strong class="text-slate-800">${U.currency(valorCliente)}</strong></div>
          <div class="flex items-center gap-2 text-sm"><span class="text-slate-500">Repasses</span><strong class="text-blue-700">${U.currency(repasses)}</strong></div>
          <div class="flex items-center gap-2 text-sm"><span class="text-slate-500">Gastos</span><strong class="text-amber-700">${U.currency(total)}</strong></div>
          <div class="flex items-center gap-2 text-sm"><span class="text-slate-500">Lucro</span><strong class="${lucro >= 0 ? 'text-emerald-700' : 'text-rose-700'}">${U.currency(lucro)}</strong></div>
        </div>
      </div>` : ''}`;
  }

  function rowsHtml(data) {
    if (!data.length) {
      return `<tr><td colspan="8">${RF.ui.empty({
        title: 'Nenhum gasto encontrado',
        message: 'Lance despesas para iniciar a prestação de contas.',
        action: '<button type="button" class="btn-primary" data-add>Lançar gasto</button>'
      })}</td></tr>`;
    }

    return data
      .map((g) => {
        const os = g.ordens_servico || {};
        const comps = g.comprovantes_gasto || [];
        const osCell = os.id
          ? `<button type="button" class="text-left" data-open-os="${os.id}">
               <span class="block font-bold text-slate-700">OS #${os.id}</span>
               <span class="block max-w-[170px] truncate text-xs text-slate-500">${U.escape(os.clientes ? os.clientes.razao_social_nome : '—')}</span>
             </button>`
          : `<span class="block font-bold text-slate-500">Sem OS</span>
             <span class="block max-w-[170px] truncate text-xs text-slate-400">Gasto avulso</span>`;
        return `
        <tr>
          <td class="whitespace-nowrap text-xs text-slate-500">${U.date(g.data_gasto ? g.data_gasto + 'T00:00:00' : g.criado_em)}</td>
          <td>${osCell}</td>
          <td class="max-w-[130px] truncate">${U.escape(os.motoristas ? os.motoristas.nome : '—')}</td>
          <td><span class="badge badge-slate">${U.escape(g.categoria)}</span></td>
          <td class="max-w-[220px] truncate text-xs text-slate-500">${U.escape(g.observacao || '—')}</td>
          <td class="whitespace-nowrap text-right font-bold text-slate-800">${U.currency(g.valor)}</td>
          <td>
            <button type="button" class="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50" data-view-comprovantes="${g.id}">
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13"/></svg>
              ${comps.length}
            </button>
          </td>
          <td class="text-right">
            <div class="flex justify-end gap-1">
              <button type="button" class="btn-icon" data-edit="${g.id}" title="Editar gasto">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"/></svg>
              </button>
              <button type="button" class="btn-icon danger" data-del="${g.id}" title="Excluir gasto">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
      })
      .join('');
  }

  function openComprovantes(gasto) {
    const comps = gasto.comprovantes_gasto || [];
    const content = comps.length
      ? `<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          ${comps
            .map((c) => {
              const url = U.escape(c.url_arquivo);
              const label = U.escape(U.fileLabel(c.url_arquivo, c.nome_arquivo));
              return `
                <a href="${url}" target="_blank" rel="noopener" class="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  ${U.isImage(c.url_arquivo)
                    ? `<div class="thumb"><img src="${url}" alt="${label}" loading="lazy" /></div>`
                    : `<div class="flex aspect-square flex-col items-center justify-center gap-1 p-2 text-center text-slate-500">
                         <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>
                         <span class="line-clamp-2 text-[10px]">${label}</span>
                       </div>`}
                  <span class="block truncate px-2 py-1 text-[10px] text-slate-500">${label}</span>
                </a>`;
            })
            .join('')}
        </div>`
      : '<p class="text-sm text-slate-500">Nenhum comprovante anexado.</p>';

    RF.ui.openModal({
      title: 'Comprovantes',
      subtitle: `${gasto.categoria} • ${U.currency(gasto.valor)}`,
      size: 'max-w-lg',
      content,
      footer: `<button type="button" class="btn-secondary" data-modal-close>Fechar</button>`
    });
  }

  function bindRows(scope) {
    scope.querySelectorAll('[data-open-os]').forEach((btn) =>
      btn.addEventListener('click', () => RF.pages.ordens.openDetail(Number(btn.getAttribute('data-open-os'))))
    );
    scope.querySelectorAll('[data-view-comprovantes]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const row = cache.find((g) => String(g.id) === btn.getAttribute('data-view-comprovantes'));
        if (row) openComprovantes(row);
      })
    );
    scope.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const row = cache.find((g) => String(g.id) === btn.getAttribute('data-edit'));
        if (row) RF.pages.ordens.openGastoForm(row.ordens_servico, row, refresh);
      })
    );
    scope.querySelectorAll('[data-del]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const row = cache.find((g) => String(g.id) === btn.getAttribute('data-del'));
        if (row) remove(row);
      })
    );
    scope.querySelectorAll('[data-add]').forEach((btn) => btn.addEventListener('click', () => openAddGasto()));
  }

  async function refresh() {
    const tbody = document.getElementById('contas-tbody');
    const summary = document.getElementById('contas-summary');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8"><div class="space-y-2 p-2">${'<div class="skeleton h-8"></div>'.repeat(4)}</div></td></tr>`;

    if (RF.auth.isMotorista() && !RF.app.getMotoristaId()) {
      if (summary) summary.innerHTML = '';
      tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-sm text-amber-700">Seu usuário ainda não está vinculado a um cadastro de motorista. Fale com o administrador.</td></tr>`;
      return;
    }

    const query = buildQuery();
    if (!query) return;

    const { data, error } = await query;
    if (error) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-sm text-rose-600">${U.escape(U.errorMessage(error))}</td></tr>`;
      return;
    }

    cache = data || [];
    const shown = filteredData();

    if (summary) summary.innerHTML = summaryHtml(shown);
    tbody.innerHTML = rowsHtml(shown);
    bindRows(tbody);

    const countEl = document.getElementById('contas-count');
    if (countEl) countEl.textContent = `${shown.length} lançamento(s) • ${U.currency(U.sum(shown, (g) => g.valor))}`;
  }

  function openAddGasto() {
    RF.pages.ordens.openGastoForm();
  }

  async function remove(row) {
    const ok = await RF.ui.confirm({
      title: 'Excluir gasto',
      message: `Deseja excluir o gasto de ${U.currency(row.valor)} (${row.categoria})? Os comprovantes também serão removidos.`,
      confirmLabel: 'Excluir',
      danger: true
    });
    if (!ok) return;
    RF.ui.loading(true);
    try {
      const { error } = await sb.from('gastos_servico').delete().eq('id', row.id);
      if (error) throw error;
      for (const c of row.comprovantes_gasto || []) {
        await removeStorageFile(c.url_arquivo);
      }
      RF.ui.toast('Gasto excluído.');
      await refresh();
    } catch (err) {
      RF.ui.toast(U.errorMessage(err), 'error');
    } finally {
      RF.ui.loading(false);
    }
  }

  RF.pages.contas = {
    async render(container) {
      filters = { search: '', categoria: '', start: '', end: '' };
      const canManage = RF.auth.canManage();

      container.innerHTML = `
        ${RF.ui.pageHeader({
          title: 'Prestação de Contas',
          subtitle: 'Despesas, repasses e comprovantes',
          actions: `<button type="button" class="btn-primary" data-add>
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Lançar gasto
          </button>`
        })}

        <div id="contas-summary"></div>

        <div class="card mt-4 mb-4">
          <div class="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <div class="relative lg:col-span-2">
              <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
              <input id="contas-search" class="input pl-9" placeholder="Buscar por OS, cliente, motorista ou descrição" />
            </div>
            <select id="contas-categoria" class="input">
              <option value="">Todas as categorias</option>
              ${CATEGORIAS.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
            <input id="contas-start" type="date" class="input" title="Data inicial" />
            <input id="contas-end" type="date" class="input" title="Data final" />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
            <p id="contas-count" class="text-xs font-medium text-slate-500"></p>
            <button type="button" class="text-xs font-semibold text-slate-500 hover:text-slate-800" data-clear>Limpar filtros</button>
          </div>
        </div>

        <div class="card">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr>
                <th>Data</th><th>OS / Cliente</th><th>Motorista</th><th>Categoria</th>
                <th>Observação</th><th class="text-right">Valor</th><th>Comprovantes</th><th></th>
              </tr></thead>
              <tbody id="contas-tbody"></tbody>
            </table>
          </div>
        </div>

        ${canManage ? '' : ''}`;

      const searchInput = container.querySelector('#contas-search');
      searchInput.addEventListener('input', U.debounce(() => {
        filters.search = searchInput.value;
        const tbody = document.getElementById('contas-tbody');
        const summary = document.getElementById('contas-summary');
        const shown = filteredData();
        if (summary) summary.innerHTML = summaryHtml(shown);
        if (tbody) {
          tbody.innerHTML = rowsHtml(shown);
          bindRows(tbody);
        }
        const countEl = document.getElementById('contas-count');
        if (countEl) countEl.textContent = `${shown.length} lançamento(s) • ${U.currency(U.sum(shown, (g) => g.valor))}`;
      }, 180));

      const catSelect = container.querySelector('#contas-categoria');
      catSelect.addEventListener('change', () => { filters.categoria = catSelect.value; refresh(); });

      const startInput = container.querySelector('#contas-start');
      const endInput = container.querySelector('#contas-end');
      startInput.addEventListener('change', () => { filters.start = startInput.value; refresh(); });
      endInput.addEventListener('change', () => { filters.end = endInput.value; refresh(); });

      container.querySelector('[data-clear]').addEventListener('click', () => {
        filters = { search: '', categoria: '', start: '', end: '' };
        searchInput.value = '';
        catSelect.value = '';
        startInput.value = '';
        endInput.value = '';
        refresh();
      });

      container.querySelectorAll('[data-add]').forEach((btn) => btn.addEventListener('click', () => openAddGasto()));

      await refresh();
    }
  };
})();
