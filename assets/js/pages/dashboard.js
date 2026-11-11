/* RotasFlow — página Dashboard */
(function () {
  const U = RF.utils;

  function statCard(opts) {
    return `
      <div class="card p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">${U.escape(opts.label)}</p>
            <p class="mt-1 truncate text-2xl font-extrabold text-slate-900">${opts.value}</p>
            ${opts.hint ? `<p class="mt-1 text-xs text-slate-500">${U.escape(opts.hint)}</p>` : ''}
          </div>
          <div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl ${opts.tone || 'bg-brand-50 text-brand-600'}">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${opts.icon}</svg>
          </div>
        </div>
      </div>`;
  }

  const ICONS = {
    orders: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2.25 4.5H6.75A2.25 2.25 0 0 1 4.5 18.25V5.75A2.25 2.25 0 0 1 6.75 3.5h6.879a2.25 2.25 0 0 1 1.59.659l3.622 3.622a2.25 2.25 0 0 1 .659 1.59V18.25a2.25 2.25 0 0 1-2.25 2.25Z"/>',
    running: '<path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"/>',
    check: '<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>',
    money: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>',
    profit: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"/>',
    km: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"/>',
    expense: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"/>'
  };

  async function loadData() {
    const sb = RF.supabase;
    const motoristaId = RF.app.getMotoristaId();
    const isMotorista = RF.auth.isMotorista();

    const select = `
      id, status, data_hora, origem, destino, km_total, valor_cliente, valor_repasse,
      clientes (razao_social_nome),
      motoristas (nome),
      veiculos (placa),
      gastos_servico (valor)`;

    let monthQuery = sb
      .from('ordens_servico')
      .select(select)
      .gte('data_hora', U.startOfMonthISO())
      .lte('data_hora', U.endOfMonthISO())
      .order('data_hora', { ascending: false });

    let recentQuery = sb
      .from('ordens_servico')
      .select(select)
      .order('data_hora', { ascending: false })
      .limit(6);

    if (isMotorista) {
      if (!motoristaId) {
        return { month: [], recent: [], noDriver: true };
      }
      monthQuery = monthQuery.eq('motorista_id', motoristaId);
      recentQuery = recentQuery.eq('motorista_id', motoristaId);
    }

    const [monthRes, recentRes] = await Promise.all([monthQuery, recentQuery]);
    if (monthRes.error) throw monthRes.error;
    if (recentRes.error) throw recentRes.error;

    return { month: monthRes.data || [], recent: recentRes.data || [], noDriver: false };
  }

  function renderContent(data) {
    const isMotorista = RF.auth.isMotorista();
    const canSeeFinance = RF.auth.canSeeFinance();
    const month = data.month || [];

    const emAndamento = month.filter((o) => o.status === 'Em Andamento').length;
    const concluidas = month.filter((o) => o.status === 'Concluída').length;
    const solicitadas = month.filter((o) => o.status === 'Solicitada').length;
    const km = U.sum(month, (o) => o.km_total);
    const gastos = U.sum(month, (o) => U.sum(o.gastos_servico, (g) => g.valor));
    const faturamento = U.sum(month, (o) => o.valor_cliente);
    const repasses = U.sum(month, (o) => o.valor_repasse);
    const lucro = faturamento - repasses - gastos;

    const cards = isMotorista
      ? [
          statCard({ label: 'OS no mês', value: U.int(month.length), hint: 'Ordens atribuídas a você', icon: ICONS.orders }),
          statCard({ label: 'Em andamento', value: U.int(emAndamento), hint: `${solicitadas} solicitada(s)`, icon: ICONS.running, tone: 'bg-blue-50 text-blue-600' }),
          statCard({ label: 'Concluídas', value: U.int(concluidas), hint: 'No mês atual', icon: ICONS.check, tone: 'bg-emerald-50 text-emerald-600' }),
          statCard({ label: 'KM rodados', value: U.number(km, 1), hint: 'Somatório do mês', icon: ICONS.km, tone: 'bg-violet-50 text-violet-600' }),
          statCard({ label: 'Gastos lançados', value: U.currency(gastos), hint: 'Prestação de contas', icon: ICONS.expense, tone: 'bg-amber-50 text-amber-600' })
        ]
      : [
          statCard({ label: 'OS no mês', value: U.int(month.length), hint: `${solicitadas} solicitada(s)`, icon: ICONS.orders }),
          statCard({ label: 'Em andamento', value: U.int(emAndamento), hint: `${concluidas} concluída(s)`, icon: ICONS.running, tone: 'bg-blue-50 text-blue-600' }),
          statCard({ label: 'Faturamento', value: U.currency(faturamento), hint: 'Valor cobrado dos clientes', icon: ICONS.money, tone: 'bg-emerald-50 text-emerald-600' }),
          statCard({ label: 'Lucro líquido', value: U.currency(lucro), hint: `Repasses ${U.currency(repasses)} + gastos ${U.currency(gastos)}`, icon: ICONS.profit, tone: lucro >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600' })
        ];

    const statusOrder = ['Solicitada', 'Em Andamento', 'Concluída', 'Cancelada'];
    const counts = statusOrder.map((s) => ({ status: s, count: month.filter((o) => o.status === s).length }));
    const maxCount = Math.max(1, ...counts.map((c) => c.count));

    const statusBars = counts
      .map((c) => {
        const meta = U.statusMeta(c.status);
        return `
          <div>
            <div class="mb-1 flex items-center justify-between text-xs">
              <span class="font-medium text-slate-600">${U.escape(c.status)}</span>
              <span class="font-bold text-slate-800">${c.count}</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full ${meta.dot}" style="width:${Math.round((c.count / maxCount) * 100)}%"></div>
            </div>
          </div>`;
      })
      .join('');

    const recentRows = (data.recent || [])
      .map(
        (o) => `
        <tr>
          <td class="whitespace-nowrap font-semibold text-slate-700">#${o.id}</td>
          <td class="whitespace-nowrap">${U.dateTime(o.data_hora)}</td>
          <td class="max-w-[180px] truncate">${U.escape(o.clientes ? o.clientes.razao_social_nome : '—')}</td>
          <td class="max-w-[220px]">
            <span class="block truncate">${U.escape(o.origem)}</span>
            <span class="block truncate text-xs text-slate-400">→ ${U.escape(o.destino)}</span>
          </td>
          <td class="max-w-[140px] truncate">${U.escape(o.motoristas ? o.motoristas.nome : '—')}</td>
          <td>${U.statusBadge(o.status)}</td>
          ${canSeeFinance ? `<td class="whitespace-nowrap font-semibold text-slate-800">${U.currency(o.valor_cliente)}</td>` : ''}
          <td class="text-right">
            <button type="button" class="btn-icon" data-open-os="${o.id}" title="Detalhes">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
            </button>
          </td>
        </tr>`
      )
      .join('');

    const actions = isMotorista
      ? `<button type="button" class="btn-primary" data-route="ordens">Ver minhas OS</button>`
      : `<button type="button" class="btn-primary" data-new-os>
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          Nova OS
        </button>
        <button type="button" class="btn-secondary" data-route="relatorios">Relatórios</button>`;

    return `
      ${RF.ui.pageHeader({
        title: isMotorista ? `Olá, ${(RF.state.profile.nome || '').split(' ')[0]}` : 'Visão geral',
        subtitle: 'Resumo do mês atual',
        actions
      })}

      ${data.noDriver ? `
        <div class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Seu usuário é motorista, mas não há um cadastro de motorista com o e-mail <strong>${U.escape(RF.state.profile.email)}</strong>. Peça ao administrador para vincular seu e-mail ao cadastro.
        </div>` : ''}

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">${cards.join('')}</div>

      <div class="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div class="card xl:col-span-2">
          <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 class="text-sm font-bold text-slate-800">Ordens recentes</h3>
            <button type="button" class="text-xs font-semibold text-brand-600 hover:text-brand-700" data-route="ordens">Ver todas</button>
          </div>
          ${recentRows ? `
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>OS</th><th>Data</th><th>Cliente</th><th>Rota</th><th>Motorista</th><th>Status</th>${canSeeFinance ? '<th>Valor</th>' : ''}<th></th></tr></thead>
                <tbody>${recentRows}</tbody>
              </table>
            </div>` : RF.ui.empty({ title: 'Nenhuma ordem de serviço', message: 'As ordens criadas aparecerão aqui.', action: isMotorista ? '' : '<button type="button" class="btn-primary" data-new-os>Nova OS</button>' })}
        </div>

        <div class="card">
          <div class="border-b border-slate-100 px-4 py-3">
            <h3 class="text-sm font-bold text-slate-800">Status das OS no mês</h3>
          </div>
          <div class="space-y-3 p-4">${statusBars}</div>
          <div class="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-500">KM total no mês</span>
              <span class="font-bold text-slate-800">${U.number(km, 1)}</span>
            </div>
            <div class="mt-1 flex items-center justify-between text-xs">
              <span class="text-slate-500">Ticket médio</span>
              <span class="font-bold text-slate-800">${U.currency(month.length ? faturamento / month.length : 0)}</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  RF.pages.dashboard = {
    async render(container) {
      container.innerHTML = `
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          ${'<div class="skeleton h-28"></div>'.repeat(4)}
        </div>
        <div class="mt-6 skeleton h-72"></div>`;

      const data = await loadData();
      container.innerHTML = renderContent(data);

      container.querySelectorAll('[data-new-os]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (RF.pages.ordens && RF.pages.ordens.openForm) RF.pages.ordens.openForm();
        });
      });
      container.querySelectorAll('[data-open-os]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = Number(btn.getAttribute('data-open-os'));
          if (RF.pages.ordens && RF.pages.ordens.openDetail) {
            RF.pages.ordens.openDetail(id);
          } else {
            RF.app.go('ordens');
          }
        });
      });
    }
  };
})();
