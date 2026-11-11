/* RotasFlow — relatórios e exportações */
(function () {
  const U = RF.utils;
  const sb = RF.supabase;
  const STATUS_OPTIONS = ['Solicitada', 'Em Andamento', 'Concluída', 'Cancelada'];

  const SELECT = `
    id, status, data_hora, origem, destino, passageiro_carga,
    km_inicial, km_final, km_total, valor_cliente, valor_repasse,
    clientes (razao_social_nome, cnpj_cpf),
    motoristas (nome, chave_pix, tipo),
    veiculos (placa, modelo, marca),
    tipos_servico (nome),
    gastos_servico (id, categoria, valor, observacao)`;

  let filters = { start: '', end: '', status: '', cliente: '', motorista: '' };
  let lookups = { clientes: [], motoristas: [] };
  let cache = [];

  function totalsFor(o) {
    const gastos = U.sum(o.gastos_servico, (g) => g.valor);
    const cliente = Number(o.valor_cliente || 0);
    const repasse = Number(o.valor_repasse || 0);
    return { gastos, cliente, repasse, lucro: cliente - (repasse + gastos) };
  }

  function summary() {
    const totalCliente = U.sum(cache, (o) => o.valor_cliente);
    const totalRepasse = U.sum(cache, (o) => o.valor_repasse);
    const totalGastos = U.sum(cache, (o) => U.sum(o.gastos_servico, (g) => g.valor));
    const totalKm = U.sum(cache, (o) => o.km_total);
    return {
      count: cache.length,
      totalCliente,
      totalRepasse,
      totalGastos,
      totalKm,
      lucro: totalCliente - totalRepasse - totalGastos,
      ticket: cache.length ? totalCliente / cache.length : 0
    };
  }

  function buildQuery() {
    let query = sb.from('ordens_servico').select(SELECT).order('data_hora', { ascending: false });
    if (filters.start) query = query.gte('data_hora', U.startOfDayISO(filters.start));
    if (filters.end) query = query.lte('data_hora', U.endOfDayISO(filters.end));
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.cliente) query = query.eq('cliente_id', Number(filters.cliente));
    if (filters.motorista) query = query.eq('motorista_id', Number(filters.motorista));
    return query;
  }

  function cardsHtml() {
    const s = summary();
    const items = [
      { label: 'Ordens no período', value: U.int(s.count), hint: `Ticket médio ${U.currency(s.ticket)}` },
      { label: 'Faturamento', value: U.currency(s.totalCliente), hint: 'Valor cobrado dos clientes' },
      { label: 'Repasses', value: U.currency(s.totalRepasse), hint: 'Valor pago aos motoristas' },
      { label: 'Gastos', value: U.currency(s.totalGastos), hint: 'Prestação de contas' },
      {
        label: 'Lucro líquido',
        value: U.currency(s.lucro),
        hint: 'Faturamento − repasses − gastos',
        tone: s.lucro >= 0 ? 'text-emerald-700' : 'text-rose-700'
      },
      { label: 'KM rodados', value: U.number(s.totalKm, 1), hint: 'Somatório do período' }
    ];

    return items
      .map(
        (i) => `
        <div class="card p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">${i.label}</p>
          <p class="mt-1 truncate text-xl font-extrabold ${i.tone || 'text-slate-900'}">${i.value}</p>
          <p class="mt-1 text-xs text-slate-500">${i.hint}</p>
        </div>`
      )
      .join('');
  }

  function previewHtml() {
    if (!cache.length) {
      return RF.ui.empty({
        title: 'Nenhuma ordem no período',
        message: 'Ajuste o período ou os filtros para gerar o relatório.'
      });
    }

    const rows = cache
      .map((o) => {
        const t = totalsFor(o);
        return `
          <tr>
            <td class="whitespace-nowrap font-semibold text-slate-700">#${o.id}</td>
            <td class="whitespace-nowrap text-xs">${U.date(o.data_hora)}</td>
            <td class="max-w-[150px] truncate">${U.escape(o.clientes ? o.clientes.razao_social_nome : '—')}</td>
            <td class="max-w-[120px] truncate">${U.escape(o.motoristas ? o.motoristas.nome : '—')}</td>
            <td class="hidden whitespace-nowrap font-mono text-xs lg:table-cell">${U.escape(o.veiculos ? o.veiculos.placa : '—')}</td>
            <td>${U.statusBadge(o.status)}</td>
            <td class="whitespace-nowrap text-right">${U.number(o.km_total, 1)}</td>
            <td class="whitespace-nowrap text-right">${U.currency(t.cliente)}</td>
            <td class="whitespace-nowrap text-right">${U.currency(t.repasse)}</td>
            <td class="whitespace-nowrap text-right">${U.currency(t.gastos)}</td>
            <td class="whitespace-nowrap text-right font-semibold ${t.lucro >= 0 ? 'text-emerald-700' : 'text-rose-700'}">${U.currency(t.lucro)}</td>
          </tr>`;
      })
      .join('');

    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>OS</th><th>Data</th><th>Cliente</th><th>Motorista</th><th class="hidden lg:table-cell">Veículo</th>
            <th>Status</th><th class="text-right">KM</th><th class="text-right">Cliente</th>
            <th class="text-right">Repasse</th><th class="text-right">Gastos</th><th class="text-right">Lucro</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  async function load() {
    const cards = document.getElementById('rel-cards');
    const preview = document.getElementById('rel-preview');
    if (!cards || !preview) return;

    preview.innerHTML = `<div class="space-y-2 p-4">${'<div class="skeleton h-9"></div>'.repeat(5)}</div>`;

    const { data, error } = await buildQuery();
    if (error) {
      cards.innerHTML = '';
      preview.innerHTML = `<p class="p-6 text-center text-sm text-rose-600">${U.escape(U.errorMessage(error))}</p>`;
      return;
    }
    cache = data || [];
    cards.innerHTML = cardsHtml();
    preview.innerHTML = previewHtml();
  }

  function excelRows() {
    return cache.map((o) => {
      const t = totalsFor(o);
      return {
        OS: o.id,
        Data: U.dateTime(o.data_hora),
        Status: o.status,
        Cliente: o.clientes ? o.clientes.razao_social_nome : '',
        'CNPJ/CPF': o.clientes ? o.clientes.cnpj_cpf : '',
        Motorista: o.motoristas ? o.motoristas.nome : '',
        'Tipo motorista': o.motoristas ? o.motoristas.tipo : '',
        'Chave PIX': o.motoristas ? o.motoristas.chave_pix || '' : '',
        'Veículo': o.veiculos ? `${o.veiculos.placa} - ${o.veiculos.marca} ${o.veiculos.modelo}` : '',
        'Tipo de serviço': o.tipos_servico ? o.tipos_servico.nome : '',
        Origem: o.origem,
        Destino: o.destino,
        'Passageiro/Carga': o.passageiro_carga || '',
        'KM inicial': Number(o.km_inicial || 0),
        'KM final': Number(o.km_final || 0),
        'KM total': Number(o.km_total || 0),
        'Valor cliente': t.cliente,
        'Repasse': t.repasse,
        'Gastos': t.gastos,
        'Lucro líquido': t.lucro
      };
    });
  }

  function exportExcel() {
    if (!cache.length) {
      RF.ui.toast('Nenhum dado para exportar.', 'warning');
      return;
    }
    try {
      const s = summary();
      const rows = excelRows();
      const wb = XLSX.utils.book_new();

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 7 }, { wch: 17 }, { wch: 13 }, { wch: 30 }, { wch: 18 }, { wch: 24 },
        { wch: 14 }, { wch: 24 }, { wch: 28 }, { wch: 15 }, { wch: 30 }, { wch: 30 },
        { wch: 20 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 14 }, { wch: 13 },
        { wch: 13 }, { wch: 14 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Ordens');

      const resumo = [
        { Indicador: 'Período', Valor: U.periodLabel(filters.start, filters.end) },
        { Indicador: 'Ordens de serviço', Valor: s.count },
        { Indicador: 'KM rodados', Valor: Number(s.totalKm.toFixed(2)) },
        { Indicador: 'Faturamento cliente (R$)', Valor: Number(s.totalCliente.toFixed(2)) },
        { Indicador: 'Repasses (R$)', Valor: Number(s.totalRepasse.toFixed(2)) },
        { Indicador: 'Gastos (R$)', Valor: Number(s.totalGastos.toFixed(2)) },
        { Indicador: 'Lucro líquido (R$)', Valor: Number(s.lucro.toFixed(2)) },
        { Indicador: 'Ticket médio (R$)', Valor: Number(s.ticket.toFixed(2)) },
        { Indicador: 'Gerado em', Valor: U.dateTime(new Date().toISOString()) }
      ];
      const wsResumo = XLSX.utils.json_to_sheet(resumo);
      wsResumo['!cols'] = [{ wch: 32 }, { wch: 38 }];
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

      XLSX.writeFile(wb, `rotasflow-relatorio-${U.slugDate()}.xlsx`);
      RF.ui.toast('Planilha Excel gerada.');
    } catch (err) {
      RF.ui.toast('Erro ao gerar Excel: ' + U.errorMessage(err), 'error');
    }
  }

  function pdfTemplate() {
    const s = summary();
    const rows = cache
      .map((o) => {
        const t = totalsFor(o);
        return `<tr>
          <td>#${o.id}</td>
          <td>${U.date(o.data_hora)}</td>
          <td>${U.escape(o.clientes ? o.clientes.razao_social_nome : '—')}</td>
          <td>${U.escape(o.motoristas ? o.motoristas.nome : '—')}</td>
          <td>${U.escape(o.veiculos ? o.veiculos.placa : '—')}</td>
          <td>${U.escape(o.status)}</td>
          <td style="text-align:right">${U.number(o.km_total, 1)}</td>
          <td style="text-align:right">${U.currency(t.cliente)}</td>
          <td style="text-align:right">${U.currency(t.repasse)}</td>
          <td style="text-align:right">${U.currency(t.gastos)}</td>
          <td style="text-align:right">${U.currency(t.lucro)}</td>
        </tr>`;
      })
      .join('');

    return `
      <div class="pdf-sheet" style="width:297mm;min-height:210mm;padding:10mm">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2148eb;padding-bottom:8px;margin-bottom:10px">
          <div>
            <h1 style="margin:0;color:#1e2f8a">RotasFlow</h1>
            <p style="margin:2px 0 0;color:#64748b;font-size:10px">Relatório de ordens de serviço</p>
          </div>
          <div style="text-align:right;font-size:9px;color:#475569">
            <p style="margin:0"><strong>Período:</strong> ${U.escape(U.periodLabel(filters.start, filters.end))}</p>
            <p style="margin:2px 0 0">Gerado em ${U.dateTime(new Date().toISOString())}</p>
          </div>
        </div>

        <table style="margin-bottom:10px">
          <tbody>
            <tr>
              <td style="border:0;padding:0 8px 0 0;width:25%"><strong>Ordens:</strong> ${s.count}</td>
              <td style="border:0;padding:0 8px;width:25%"><strong>KM total:</strong> ${U.number(s.totalKm, 1)}</td>
              <td style="border:0;padding:0 8px;width:25%"><strong>Faturamento:</strong> ${U.currency(s.totalCliente)}</td>
              <td style="border:0;padding:0;width:25%"><strong>Lucro:</strong> ${U.currency(s.lucro)}</td>
            </tr>
            <tr>
              <td style="border:0;padding:4px 8px 0 0"><strong>Repasses:</strong> ${U.currency(s.totalRepasse)}</td>
              <td style="border:0;padding:4px 8px 0"><strong>Gastos:</strong> ${U.currency(s.totalGastos)}</td>
              <td style="border:0;padding:4px 8px 0"><strong>Ticket médio:</strong> ${U.currency(s.ticket)}</td>
              <td style="border:0;padding:4px 0 0"></td>
            </tr>
          </tbody>
        </table>

        <table>
          <thead>
            <tr>
              <th>OS</th><th>Data</th><th>Cliente</th><th>Motorista</th><th>Veículo</th><th>Status</th>
              <th style="text-align:right">KM</th><th style="text-align:right">Cliente</th>
              <th style="text-align:right">Repasse</th><th style="text-align:right">Gastos</th><th style="text-align:right">Lucro</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <p style="margin-top:10px;font-size:8px;color:#94a3b8;text-align:right">RotasFlow — Gestão de transportes</p>
      </div>`;
  }

  async function exportPdf() {
    if (!cache.length) {
      RF.ui.toast('Nenhum dado para exportar.', 'warning');
      return;
    }
    if (typeof html2pdf === 'undefined') {
      RF.ui.toast('Biblioteca de PDF não carregada.', 'error');
      return;
    }
    RF.ui.loading(true);
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;';
    wrapper.innerHTML = pdfTemplate();
    document.body.appendChild(wrapper);

    try {
      await html2pdf()
        .set({
          margin: 0,
          filename: `rotasflow-relatorio-${U.slugDate()}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
          pagebreak: { mode: ['css', 'legacy'] }
        })
        .from(wrapper.firstElementChild)
        .save();
      RF.ui.toast('PDF gerado.');
    } catch (err) {
      RF.ui.toast('Erro ao gerar PDF: ' + U.errorMessage(err), 'error');
    } finally {
      wrapper.remove();
      RF.ui.loading(false);
    }
  }

  async function loadLookups() {
    const [clientes, motoristas] = await Promise.all([
      sb.from('clientes').select('id, razao_social_nome').order('razao_social_nome'),
      sb.from('motoristas').select('id, nome').order('nome')
    ]);
    lookups = { clientes: clientes.data || [], motoristas: motoristas.data || [] };
  }

  function options(items, labelFn) {
    return items.map((i) => `<option value="${i.id}">${U.escape(labelFn(i))}</option>`).join('');
  }

  RF.pages.relatorios = {
    async render(container) {
      const first = new Date();
      const startDefault = U.toDateInput(new Date(first.getFullYear(), first.getMonth(), 1));
      const endDefault = U.toDateInput(first);
      filters = { start: startDefault, end: endDefault, status: '', cliente: '', motorista: '' };

      await loadLookups();

      container.innerHTML = `
        ${RF.ui.pageHeader({
          title: 'Relatórios',
          subtitle: 'Consolidação operacional e financeira',
          actions: `
            <button type="button" class="btn-secondary" data-export-excel>
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
              Excel
            </button>
            <button type="button" class="btn-primary" data-export-pdf>
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
              PDF
            </button>`
        })}

        <div class="card mb-4">
          <div class="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <label class="label" for="rel-start">Data inicial</label>
              <input id="rel-start" type="date" class="input" value="${startDefault}" />
            </div>
            <div>
              <label class="label" for="rel-end">Data final</label>
              <input id="rel-end" type="date" class="input" value="${endDefault}" />
            </div>
            <div>
              <label class="label" for="rel-status">Status</label>
              <select id="rel-status" class="input">
                <option value="">Todos</option>
                ${STATUS_OPTIONS.map((s) => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="label" for="rel-cliente">Cliente</label>
              <select id="rel-cliente" class="input">
                <option value="">Todos</option>
                ${options(lookups.clientes, (c) => c.razao_social_nome)}
              </select>
            </div>
            <div>
              <label class="label" for="rel-motorista">Motorista</label>
              <select id="rel-motorista" class="input">
                <option value="">Todos</option>
                ${options(lookups.motoristas, (m) => m.nome)}
              </select>
            </div>
            <div class="flex items-end">
              <button type="button" class="btn-primary w-full justify-center" data-apply>Gerar relatório</button>
            </div>
          </div>
        </div>

        <div id="rel-cards" class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6"></div>

        <div class="card overflow-hidden">
          <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 class="text-sm font-bold text-slate-800">Prévia do relatório</h3>
            <p id="rel-period" class="text-xs text-slate-500">${U.periodLabel(startDefault, endDefault)}</p>
          </div>
          <div id="rel-preview"></div>
        </div>`;

      const startInput = container.querySelector('#rel-start');
      const endInput = container.querySelector('#rel-end');
      const statusSelect = container.querySelector('#rel-status');
      const clienteSelect = container.querySelector('#rel-cliente');
      const motoristaSelect = container.querySelector('#rel-motorista');

      container.querySelector('[data-apply]').addEventListener('click', async () => {
        filters = {
          start: startInput.value,
          end: endInput.value,
          status: statusSelect.value,
          cliente: clienteSelect.value,
          motorista: motoristaSelect.value
        };
        container.querySelector('#rel-period').textContent = U.periodLabel(filters.start, filters.end);
        await load();
      });

      [startInput, endInput, statusSelect, clienteSelect, motoristaSelect].forEach((el) => {
        el.addEventListener('change', () => {
          filters = {
            start: startInput.value,
            end: endInput.value,
            status: statusSelect.value,
            cliente: clienteSelect.value,
            motorista: motoristaSelect.value
          };
          container.querySelector('#rel-period').textContent = U.periodLabel(filters.start, filters.end);
          load();
        });
      });

      container.querySelector('[data-export-excel]').addEventListener('click', exportExcel);
      container.querySelector('[data-export-pdf]').addEventListener('click', exportPdf);

      await load();
    }
  };
})();
