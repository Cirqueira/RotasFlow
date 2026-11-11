/* RotasFlow — ordens de serviço */
(function () {
  const U = RF.utils;
  const sb = RF.supabase;
  const BUCKET = RF.config.BUCKET_NAME;
  const CATEGORIAS = ['Combustível', 'Refeição', 'Pedágio', 'Estacionamento', 'Outros'];
  const STATUS_OPTIONS = ['Solicitada', 'Em Andamento', 'Concluída', 'Cancelada'];

  const SELECT = `
    id, cliente_id, motorista_id, veiculo_id, tipo_servico_id, status, data_hora,
    origem, destino, passageiro_carga, observacoes,
    km_inicial, km_final, km_total, data_inicio, data_fim,
    valor_cliente, valor_repasse, criado_em,
    clientes (id, razao_social_nome, cnpj_cpf, contato_whatsapp),
    motoristas (id, nome, email, chave_pix, tipo),
    veiculos (id, placa, modelo, marca),
    tipos_servico (id, nome),
    anexos_ordem_servico (id, url_arquivo, nome_arquivo, enviado_em),
    gastos_servico (id, categoria, valor, observacao, criado_em, comprovantes_gasto (id, url_arquivo, nome_arquivo))`;

  let filters = { search: '', status: '', motorista: '', cliente: '', start: '', end: '' };
  let cache = [];
  let lookups = { clientes: [], motoristas: [], veiculos: [], tipos: [] };
  let containerRef = null;

  function financeTotals(order) {
    const gastos = U.sum(order.gastos_servico, (g) => g.valor);
    const cliente = Number(order.valor_cliente || 0);
    const repasse = Number(order.valor_repasse || 0);
    return { gastos, cliente, repasse, lucro: cliente - (repasse + gastos) };
  }

  function optionList(items, selected, labelFn, valueFn = (i) => i.id) {
    return items
      .map((i) => {
        const value = valueFn(i);
        return `<option value="${value}" ${String(selected) === String(value) ? 'selected' : ''}>${U.escape(labelFn(i))}</option>`;
      })
      .join('');
  }

  async function loadLookups() {
    const [clientes, motoristas, veiculos, tipos] = await Promise.all([
      sb.from('clientes').select('id, razao_social_nome, cnpj_cpf').order('razao_social_nome'),
      sb.from('motoristas').select('id, nome, email, tipo').order('nome'),
      sb.from('veiculos').select('id, marca, modelo, placa').order('placa'),
      sb.from('tipos_servico').select('id, nome').order('nome')
    ]);
    lookups = {
      clientes: clientes.data || [],
      motoristas: motoristas.data || [],
      veiculos: veiculos.data || [],
      tipos: tipos.data || []
    };
  }

  function buildQuery() {
    let query = sb.from('ordens_servico').select(SELECT).order('data_hora', { ascending: false });

    if (RF.auth.isMotorista()) {
      const motoristaId = RF.app.getMotoristaId();
      if (!motoristaId) return null;
      query = query.eq('motorista_id', motoristaId);
    } else if (filters.motorista) {
      query = query.eq('motorista_id', Number(filters.motorista));
    }

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.cliente) query = query.eq('cliente_id', Number(filters.cliente));
    if (filters.start) query = query.gte('data_hora', U.startOfDayISO(filters.start));
    if (filters.end) query = query.lte('data_hora', U.endOfDayISO(filters.end));

    const term = filters.search.trim().replace(/[,()%]/g, ' ').trim();
    if (term) {
      const parts = [`origem.ilike.%${term}%`, `destino.ilike.%${term}%`, `passageiro_carga.ilike.%${term}%`];
      if (/^\d+$/.test(term)) parts.push(`id.eq.${term}`);
      query = query.or(parts.join(','));
    }

    return query;
  }

  function rowsHtml(data) {
    const canSeeFinance = RF.auth.canSeeFinance();
    const canManage = RF.auth.canManage();

    if (!data.length) {
      return `<tr><td colspan="${canSeeFinance ? 9 : 8}">${RF.ui.empty({
        title: 'Nenhuma ordem de serviço encontrada',
        message: 'Ajuste os filtros ou crie uma nova ordem de serviço.',
        action: canManage ? '<button type="button" class="btn-primary" data-new>Nova OS</button>' : ''
      })}</td></tr>`;
    }

    return data
      .map(
        (o) => `
        <tr>
          <td class="whitespace-nowrap font-bold text-slate-700">#${o.id}</td>
          <td class="whitespace-nowrap">${U.dateTime(o.data_hora)}</td>
          <td class="max-w-[170px] truncate">${U.escape(o.clientes ? o.clientes.razao_social_nome : '—')}</td>
          <td class="max-w-[230px]">
            <span class="block truncate font-medium text-slate-700">${U.escape(o.origem)}</span>
            <span class="block truncate text-xs text-slate-400">→ ${U.escape(o.destino)}</span>
          </td>
          <td class="max-w-[130px] truncate">${U.escape(o.motoristas ? o.motoristas.nome : 'A definir')}</td>
          <td class="hidden whitespace-nowrap font-mono text-xs text-slate-600 lg:table-cell">${U.escape(o.veiculos ? o.veiculos.placa : '—')}</td>
          <td>${U.statusBadge(o.status)}</td>
          ${canSeeFinance ? `<td class="whitespace-nowrap font-semibold text-slate-800">${U.currency(o.valor_cliente)}</td>` : ''}
          <td class="text-right">
            <div class="flex justify-end gap-1">
              <button type="button" class="btn-icon" data-detail="${o.id}" title="Detalhes">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
              </button>
              <button type="button" class="btn-icon" data-edit="${o.id}" title="Editar">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"/></svg>
              </button>
              ${canManage ? `<button type="button" class="btn-icon danger" data-del="${o.id}" title="Excluir">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
              </button>` : ''}
            </div>
          </td>
        </tr>`
      )
      .join('');
  }

  async function load() {
    const tbody = document.getElementById('ordens-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="${RF.auth.canSeeFinance() ? 9 : 8}"><div class="space-y-2 p-2">${'<div class="skeleton h-8"></div>'.repeat(5)}</div></td></tr>`;

    if (RF.auth.isMotorista() && !RF.app.getMotoristaId()) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-sm text-amber-700">Seu usuário ainda não está vinculado a um cadastro de motorista. Fale com o administrador.</td></tr>`;
      return;
    }

    const query = buildQuery();
    if (!query) return;

    const { data, error } = await query;
    if (error) {
      tbody.innerHTML = `<tr><td colspan="${RF.auth.canSeeFinance() ? 9 : 8}" class="px-4 py-8 text-center text-sm text-rose-600">${U.escape(U.errorMessage(error))}</td></tr>`;
      return;
    }

    cache = data || [];
    tbody.innerHTML = rowsHtml(cache);
    bindRows(tbody);

    const countEl = document.getElementById('ordens-count');
    if (countEl) countEl.textContent = `${cache.length} ordem(ns) encontrada(s)`;
  }

  async function refreshList() {
    if (document.getElementById('ordens-tbody')) {
      await load();
    } else {
      RF.app.refresh();
    }
  }

  function bindRows(scope) {
    scope.querySelectorAll('[data-detail]').forEach((btn) =>
      btn.addEventListener('click', () => openDetail(Number(btn.getAttribute('data-detail'))))
    );
    scope.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = cache.find((o) => String(o.id) === btn.getAttribute('data-edit'));
        if (row) openForm(row);
      });
    });
    scope.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = cache.find((o) => String(o.id) === btn.getAttribute('data-del'));
        if (row) remove(row);
      });
    });
    scope.querySelectorAll('[data-new]').forEach((btn) => btn.addEventListener('click', () => openForm()));
  }

  /* ============ Uploads ============ */
  async function uploadFiles(files, folder) {
    const result = [];
    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined
      });
      if (error) throw error;
      const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
      result.push({ url: data.publicUrl, nome_arquivo: file.name });
    }
    return result;
  }

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

  function selectedFilesText(inputId) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(inputId + '-list');
    if (!input || !list) return;
    list.innerHTML = Array.from(input.files || [])
      .map((f) => `<p class="truncate">• ${U.escape(f.name)} <span class="text-slate-400">(${Math.round(f.size / 1024)} KB)</span></p>`)
      .join('');
  }

  /* ============ Formulário de OS ============ */
  function openForm(row) {
    if (RF.auth.isMotorista()) {
      if (row) return openExecution(row);
      RF.ui.toast('Somente administradores ou operadores podem criar ordens de serviço.', 'warning');
      return;
    }

    const isEdit = !!row;
    const o = row || {
      status: 'Solicitada',
      motorista_id: RF.app.getMotoristaId(),
      data_hora: new Date().toISOString(),
      origem: '',
      destino: '',
      passageiro_carga: '',
      observacoes: '',
      km_inicial: 0,
      km_final: 0,
      valor_cliente: 0,
      valor_repasse: 0
    };

    RF.ui.openModal({
      title: isEdit ? `Editar OS #${o.id}` : 'Nova ordem de serviço',
      subtitle: isEdit ? 'Atualize os dados da ordem' : 'Preencha os dados da solicitação',
      size: 'max-w-4xl',
      content: `
        <form id="os-form" class="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <div class="sm:col-span-3">
            <label class="label" for="os-cliente">Cliente</label>
            <select id="os-cliente" class="input" required>
              <option value="">Selecione…</option>
              ${optionList(lookups.clientes, o.cliente_id, (c) => c.razao_social_nome)}
            </select>
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="os-tipo">Tipo de serviço</label>
            <select id="os-tipo" class="input" required>
              <option value="">Selecione…</option>
              ${optionList(lookups.tipos, o.tipo_servico_id, (t) => t.nome)}
            </select>
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="os-motorista">Motorista</label>
            <select id="os-motorista" class="input">
              <option value="">A definir</option>
              ${optionList(lookups.motoristas, o.motorista_id, (m) => `${m.nome}${m.tipo === 'Terceirizado' ? ' (terceirizado)' : ''}`)}
            </select>
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="os-veiculo">Veículo</label>
            <select id="os-veiculo" class="input">
              <option value="">A definir</option>
              ${optionList(lookups.veiculos, o.veiculo_id, (v) => `${v.placa} — ${v.marca} ${v.modelo}`)}
            </select>
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="os-status">Status</label>
            <select id="os-status" class="input">
              ${STATUS_OPTIONS.map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="os-data">Data e hora da solicitação</label>
            <input id="os-data" type="datetime-local" class="input" required value="${U.toDateTimeInput(o.data_hora)}" />
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="os-origem">Origem</label>
            <input id="os-origem" class="input" required value="${U.escape(o.origem)}" placeholder="Endereço / local de saída" />
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="os-destino">Destino</label>
            <input id="os-destino" class="input" required value="${U.escape(o.destino)}" placeholder="Endereço / local de entrega" />
          </div>
          <div class="sm:col-span-6">
            <label class="label" for="os-passageiro">Passageiro / Carga</label>
            <input id="os-passageiro" class="input" value="${U.escape(o.passageiro_carga || '')}" placeholder="Nome do passageiro ou descrição da carga" />
          </div>
          <div class="sm:col-span-6">
            <label class="label" for="os-obs">Observações</label>
            <textarea id="os-obs" class="input" rows="2">${U.escape(o.observacoes || '')}</textarea>
          </div>

          <div class="sm:col-span-6 mt-1 border-t border-slate-100 pt-4">
            <h4 class="text-sm font-bold text-slate-800">Execução</h4>
            <p class="text-xs text-slate-500">KM e horários podem ser preenchidos pelo motorista.</p>
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="os-kmi">KM inicial</label>
            <input id="os-kmi" type="number" step="0.01" min="0" class="input" value="${Number(o.km_inicial || 0)}" />
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="os-kmf">KM final</label>
            <input id="os-kmf" type="number" step="0.01" min="0" class="input" value="${Number(o.km_final || 0)}" />
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="os-inicio">Início da execução</label>
            <input id="os-inicio" type="datetime-local" class="input" value="${U.toDateTimeInput(o.data_inicio)}" />
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="os-fim">Fim da execução</label>
            <input id="os-fim" type="datetime-local" class="input" value="${U.toDateTimeInput(o.data_fim)}" />
          </div>

          <div class="sm:col-span-6 mt-1 border-t border-slate-100 pt-4">
            <h4 class="text-sm font-bold text-slate-800">Financeiro</h4>
            <p class="text-xs text-slate-500">Valores visíveis apenas para administradores e operadores.</p>
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="os-vcli">Valor cobrado do cliente (R$)</label>
            <input id="os-vcli" type="number" step="0.01" min="0" class="input" value="${Number(o.valor_cliente || 0)}" />
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="os-vrep">Valor de repasse ao motorista (R$)</label>
            <input id="os-vrep" type="number" step="0.01" min="0" class="input" value="${Number(o.valor_repasse || 0)}" />
          </div>
        </form>`,
      footer: `
        <button type="button" class="btn-secondary" data-modal-close>Cancelar</button>
        <button type="submit" form="os-form" class="btn-primary" data-save>${isEdit ? 'Salvar alterações' : 'Criar ordem de serviço'}</button>`,
      onMount(root, close) {
        const form = root.querySelector('#os-form');
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!form.reportValidity()) return;
          const kmInicial = U.toNumber(root.querySelector('#os-kmi').value);
          const kmFinal = U.toNumber(root.querySelector('#os-kmf').value);
          if (kmFinal < kmInicial) {
            RF.ui.toast('O KM final não pode ser menor que o KM inicial.', 'error');
            return;
          }
          const saveBtn = root.querySelector('[data-save]');
          saveBtn.disabled = true;
          saveBtn.textContent = 'Salvando…';
          RF.ui.loading(true);

          const payload = {
            cliente_id: Number(root.querySelector('#os-cliente').value),
            tipo_servico_id: Number(root.querySelector('#os-tipo').value),
            motorista_id: root.querySelector('#os-motorista').value ? Number(root.querySelector('#os-motorista').value) : null,
            veiculo_id: root.querySelector('#os-veiculo').value ? Number(root.querySelector('#os-veiculo').value) : null,
            status: root.querySelector('#os-status').value,
            data_hora: new Date(root.querySelector('#os-data').value).toISOString(),
            origem: root.querySelector('#os-origem').value.trim(),
            destino: root.querySelector('#os-destino').value.trim(),
            passageiro_carga: root.querySelector('#os-passageiro').value.trim() || null,
            observacoes: root.querySelector('#os-obs').value.trim() || null,
            km_inicial: kmInicial,
            km_final: kmFinal,
            data_inicio: root.querySelector('#os-inicio').value ? new Date(root.querySelector('#os-inicio').value).toISOString() : null,
            data_fim: root.querySelector('#os-fim').value ? new Date(root.querySelector('#os-fim').value).toISOString() : null,
            valor_cliente: U.toNumber(root.querySelector('#os-vcli').value),
            valor_repasse: U.toNumber(root.querySelector('#os-vrep').value)
          };

          try {
            if (isEdit) {
              const { error } = await sb.from('ordens_servico').update(payload).eq('id', o.id);
              if (error) throw error;
            } else {
              const { error } = await sb.from('ordens_servico').insert(payload);
              if (error) throw error;
            }
            close();
            RF.ui.toast(isEdit ? 'Ordem de serviço atualizada.' : 'Ordem de serviço criada.');
            if (isEdit) {
              openDetail(o.id);
            } else {
              await refreshList();
            }
          } catch (err) {
            RF.ui.toast(U.errorMessage(err), 'error');
          } finally {
            RF.ui.loading(false);
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Salvar alterações' : 'Criar ordem de serviço';
          }
        });
      }
    });
  }

  /* ============ Registro de execução (todos os perfis) ============ */
  function openExecution(row) {
    const o = row;
    RF.ui.openModal({
      title: `Execução da OS #${o.id}`,
      subtitle: 'Apontamento de KM, horários e status',
      size: 'max-w-2xl',
      content: `
        <form id="exec-form" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="label" for="ex-status">Status</label>
            <select id="ex-status" class="input">
              ${STATUS_OPTIONS.map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label" for="ex-kmi">KM inicial</label>
            <input id="ex-kmi" type="number" step="0.01" min="0" class="input" value="${Number(o.km_inicial || 0)}" />
          </div>
          <div>
            <label class="label" for="ex-kmf">KM final</label>
            <input id="ex-kmf" type="number" step="0.01" min="0" class="input" value="${Number(o.km_final || 0)}" />
          </div>
          <div>
            <label class="label" for="ex-inicio">Início</label>
            <input id="ex-inicio" type="datetime-local" class="input" value="${U.toDateTimeInput(o.data_inicio)}" />
          </div>
          <div>
            <label class="label" for="ex-fim">Fim</label>
            <input id="ex-fim" type="datetime-local" class="input" value="${U.toDateTimeInput(o.data_fim)}" />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="ex-obs">Observações</label>
            <textarea id="ex-obs" class="input" rows="3">${U.escape(o.observacoes || '')}</textarea>
          </div>
          <p class="sm:col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            KM total calculado automaticamente: <strong>${U.number(Math.max(0, Number(o.km_final || 0) - Number(o.km_inicial || 0)), 2)}</strong> km (atual).
          </p>
        </form>`,
      footer: `
        <button type="button" class="btn-secondary" data-modal-close>Cancelar</button>
        <button type="submit" form="exec-form" class="btn-primary" data-save>Salvar execução</button>`,
      onMount(root, close) {
        const form = root.querySelector('#exec-form');
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const kmInicial = U.toNumber(root.querySelector('#ex-kmi').value);
          const kmFinal = U.toNumber(root.querySelector('#ex-kmf').value);
          if (kmFinal < kmInicial) {
            RF.ui.toast('O KM final não pode ser menor que o KM inicial.', 'error');
            return;
          }
          const saveBtn = root.querySelector('[data-save]');
          saveBtn.disabled = true;
          saveBtn.textContent = 'Salvando…';
          RF.ui.loading(true);

          const payload = {
            status: root.querySelector('#ex-status').value,
            km_inicial: kmInicial,
            km_final: kmFinal,
            data_inicio: root.querySelector('#ex-inicio').value ? new Date(root.querySelector('#ex-inicio').value).toISOString() : null,
            data_fim: root.querySelector('#ex-fim').value ? new Date(root.querySelector('#ex-fim').value).toISOString() : null,
            observacoes: root.querySelector('#ex-obs').value.trim() || null
          };

          try {
            const { error } = await sb.from('ordens_servico').update(payload).eq('id', o.id);
            if (error) throw error;
            close();
            RF.ui.toast('Execução atualizada.');
            openDetail(o.id);
          } catch (err) {
            RF.ui.toast(U.errorMessage(err), 'error');
          } finally {
            RF.ui.loading(false);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar execução';
          }
        });
      }
    });
  }

  /* ============ Detalhes da OS ============ */
  function fileCard(url, name, kind, id) {
    const label = U.fileLabel(url, name);
    const isImg = U.isImage(url);
    const deleteAttr = kind === 'anexo' ? `data-del-anexo="${id}"` : `data-del-comprovante="${id}"`;
    return `
      <div class="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <a href="${U.escape(url)}" target="_blank" rel="noopener" class="block">
          ${isImg
            ? `<div class="thumb"><img src="${U.escape(url)}" alt="${U.escape(label)}" loading="lazy" /></div>`
            : `<div class="flex aspect-square flex-col items-center justify-center gap-1 p-2 text-center text-slate-500">
                 <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>
                 <span class="line-clamp-2 text-[10px]">${U.escape(label)}</span>
               </div>`}
        </a>
        <button type="button" ${deleteAttr} class="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-white/90 text-slate-500 shadow-sm opacity-0 transition hover:text-rose-600 group-hover:opacity-100" title="Remover">
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
        </button>
      </div>`;
  }

  function detailContent(o) {
    const canSeeFinance = RF.auth.canSeeFinance();
    const canManage = RF.auth.canManage();
    const totals = financeTotals(o);
    const anexos = o.anexos_ordem_servico || [];
    const gastos = o.gastos_servico || [];

    const anexosHtml = anexos.length
      ? `<div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">${anexos.map((a) => fileCard(a.url_arquivo, a.nome_arquivo, 'anexo', a.id)).join('')}</div>`
      : '<p class="text-sm text-slate-500">Nenhum anexo enviado.</p>';

    const gastosHtml = gastos.length
      ? `<div class="space-y-2">
          ${gastos
            .map(
              (g) => `
              <div class="rounded-lg border border-slate-200 p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="badge badge-slate">${U.escape(g.categoria)}</span>
                    <span class="text-sm font-bold text-slate-800">${U.currency(g.valor)}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="text-xs text-slate-400">${U.dateTime(g.criado_em)}</span>
                    <button type="button" class="btn-icon danger" data-del-gasto="${g.id}" title="Excluir gasto">
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
                    </button>
                  </div>
                </div>
                ${g.observacao ? `<p class="mt-1 text-xs text-slate-500">${U.escape(g.observacao)}</p>` : ''}
                ${g.comprovantes_gasto && g.comprovantes_gasto.length
                  ? `<div class="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">${g.comprovantes_gasto.map((c) => fileCard(c.url_arquivo, c.nome_arquivo, 'comprovante', c.id)).join('')}</div>`
                  : ''}
              </div>`
            )
            .join('')}
        </div>`
      : '<p class="text-sm text-slate-500">Nenhum gasto lançado.</p>';

    return `
      <div class="space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            ${U.statusBadge(o.status)}
            <span class="text-xs text-slate-500">${U.dateTime(o.data_hora)}</span>
          </div>
          <span class="text-sm font-semibold text-slate-600">${U.escape(o.tipos_servico ? o.tipos_servico.nome : '—')}</span>
        </div>

        <dl class="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2 lg:grid-cols-3">
          ${RF.ui.infoRow('Cliente', U.escape(o.clientes ? o.clientes.razao_social_nome : '—'))}
          ${RF.ui.infoRow('Documento', U.escape(o.clientes ? o.clientes.cnpj_cpf : '—'))}
          ${RF.ui.infoRow('WhatsApp', U.escape(o.clientes ? o.clientes.contato_whatsapp : '—'))}
          ${RF.ui.infoRow('Motorista', U.escape(o.motoristas ? o.motoristas.nome : 'A definir'))}
          ${RF.ui.infoRow('Veículo', U.escape(o.veiculos ? `${o.veiculos.placa} — ${o.veiculos.marca} ${o.veiculos.modelo}` : '—'))}
          ${RF.ui.infoRow('Passageiro / Carga', U.escape(o.passageiro_carga || '—'))}
          <div class="sm:col-span-2 lg:col-span-3">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Rota</dt>
            <dd class="mt-1 flex flex-col gap-1 text-sm text-slate-800 sm:flex-row sm:items-center sm:gap-3">
              <span class="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">${U.escape(o.origem)}</span>
              <svg class="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>
              <span class="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">${U.escape(o.destino)}</span>
            </dd>
          </div>
          <div class="sm:col-span-2 lg:col-span-3">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Observações</dt>
            <dd class="mt-0.5 whitespace-pre-line text-sm text-slate-700">${U.escape(o.observacoes || '—')}</dd>
          </div>
        </dl>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-lg border border-slate-200 p-3">
            <p class="text-[10px] font-bold uppercase tracking-wide text-slate-400">KM inicial</p>
            <p class="mt-1 text-lg font-bold text-slate-800">${U.number(o.km_inicial, 2)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 p-3">
            <p class="text-[10px] font-bold uppercase tracking-wide text-slate-400">KM final</p>
            <p class="mt-1 text-lg font-bold text-slate-800">${U.number(o.km_final, 2)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 p-3">
            <p class="text-[10px] font-bold uppercase tracking-wide text-slate-400">KM total</p>
            <p class="mt-1 text-lg font-bold text-brand-700">${U.number(o.km_total, 2)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 p-3">
            <p class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Duração</p>
            <p class="mt-1 text-sm font-bold text-slate-800">${U.time(o.data_inicio)} → ${U.time(o.data_fim)}</p>
            <p class="text-[11px] text-slate-400">${U.date(o.data_inicio)}</p>
          </div>
        </div>

        ${canSeeFinance ? `
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Valor cliente</p>
              <p class="mt-1 text-lg font-bold text-emerald-800">${U.currency(totals.cliente)}</p>
            </div>
            <div class="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
              <p class="text-[10px] font-bold uppercase tracking-wide text-blue-700">Repasse</p>
              <p class="mt-1 text-lg font-bold text-blue-800">${U.currency(totals.repasse)}</p>
            </div>
            <div class="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <p class="text-[10px] font-bold uppercase tracking-wide text-amber-700">Gastos</p>
              <p class="mt-1 text-lg font-bold text-amber-800">${U.currency(totals.gastos)}</p>
            </div>
            <div class="rounded-lg border ${totals.lucro >= 0 ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'} p-3">
              <p class="text-[10px] font-bold uppercase tracking-wide ${totals.lucro >= 0 ? 'text-emerald-700' : 'text-rose-700'}">Lucro líquido</p>
              <p class="mt-1 text-lg font-bold ${totals.lucro >= 0 ? 'text-emerald-800' : 'text-rose-800'}">${U.currency(totals.lucro)}</p>
            </div>
          </div>` : ''}

        <section>
          <div class="mb-2 flex items-center justify-between">
            <h4 class="text-sm font-bold text-slate-800">Anexos e comprovantes da OS</h4>
            <span class="text-xs text-slate-400">${anexos.length} arquivo(s)</span>
          </div>
          ${anexosHtml}
          <div class="mt-3">
            ${RF.ui.uploadBox('os-anexos', 'Enviar fotos/canhotos')}
          </div>
        </section>

        <section>
          <div class="mb-2 flex items-center justify-between">
            <h4 class="text-sm font-bold text-slate-800">Prestação de contas</h4>
            <button type="button" class="btn-secondary" data-add-gasto>
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
              Lançar gasto
            </button>
          </div>
          ${gastosHtml}
        </section>
      </div>`;
  }

  async function openDetail(id) {
    RF.ui.loading(true);
    const { data, error } = await sb.from('ordens_servico').select(SELECT).eq('id', id).maybeSingle();
    RF.ui.loading(false);
    if (error) {
      RF.ui.toast(U.errorMessage(error), 'error');
      return;
    }
    if (!data) {
      RF.ui.toast('Ordem de serviço não encontrada.', 'warning');
      return;
    }

    if (RF.auth.isMotorista()) {
      const motoristaId = RF.app.getMotoristaId();
      if (!motoristaId || data.motorista_id !== motoristaId) {
        RF.ui.toast('Você não tem acesso a esta ordem de serviço.', 'error');
        return;
      }
    }

    const canManage = RF.auth.canManage();
    RF.ui.closeAllModals();

    RF.ui.openModal({
      title: `Ordem de serviço #${data.id}`,
      subtitle: data.clientes ? data.clientes.razao_social_nome : '',
      size: 'max-w-5xl',
      content: detailContent(data),
      footer: `
        <button type="button" class="btn-ghost" data-modal-close>Fechar</button>
        <button type="button" class="btn-secondary" data-exec>Registrar execução</button>
        <button type="button" class="btn-primary" data-edit-os>Editar OS</button>
        ${canManage ? `<button type="button" class="btn-danger" data-del-os>Excluir</button>` : ''}`,
      onMount(root, close) {
        const input = root.querySelector('#os-anexos');
        if (input) {
          input.addEventListener('change', async () => {
            selectedFilesText('os-anexos');
            const files = Array.from(input.files || []);
            if (!files.length) return;
            RF.ui.loading(true);
            try {
              const uploaded = await uploadFiles(files, `ordens/${data.id}`);
              const rows = uploaded.map((u) => ({
                ordem_servico_id: data.id,
                url_arquivo: u.url,
                nome_arquivo: u.nome_arquivo
              }));
              if (rows.length) {
                const { error: insErr } = await sb.from('anexos_ordem_servico').insert(rows);
                if (insErr) throw insErr;
              }
              RF.ui.toast('Anexo(s) enviado(s).');
              openDetail(data.id);
            } catch (err) {
              RF.ui.toast(U.errorMessage(err), 'error');
            } finally {
              RF.ui.loading(false);
            }
          });
        }

        root.querySelectorAll('[data-del-anexo]').forEach((btn) =>
          btn.addEventListener('click', async () => {
            const anexoId = Number(btn.getAttribute('data-del-anexo'));
            const anexo = (data.anexos_ordem_servico || []).find((a) => a.id === anexoId);
            const ok = await RF.ui.confirm({
              title: 'Remover anexo',
              message: 'Deseja remover este anexo?',
              confirmLabel: 'Remover',
              danger: true
            });
            if (!ok) return;
            RF.ui.loading(true);
            const { error: delErr } = await sb.from('anexos_ordem_servico').delete().eq('id', anexoId);
            if (!delErr && anexo) await removeStorageFile(anexo.url_arquivo);
            RF.ui.loading(false);
            if (delErr) {
              RF.ui.toast(U.errorMessage(delErr), 'error');
              return;
            }
            RF.ui.toast('Anexo removido.');
            openDetail(data.id);
          })
        );

        root.querySelectorAll('[data-del-comprovante]').forEach((btn) =>
          btn.addEventListener('click', async () => {
            const compId = Number(btn.getAttribute('data-del-comprovante'));
            let comp = null;
            (data.gastos_servico || []).forEach((g) => {
              (g.comprovantes_gasto || []).forEach((c) => {
                if (c.id === compId) comp = c;
              });
            });
            const ok = await RF.ui.confirm({
              title: 'Remover comprovante',
              message: 'Deseja remover este comprovante?',
              confirmLabel: 'Remover',
              danger: true
            });
            if (!ok) return;
            RF.ui.loading(true);
            const { error: delErr } = await sb.from('comprovantes_gasto').delete().eq('id', compId);
            if (!delErr && comp) await removeStorageFile(comp.url_arquivo);
            RF.ui.loading(false);
            if (delErr) {
              RF.ui.toast(U.errorMessage(delErr), 'error');
              return;
            }
            RF.ui.toast('Comprovante removido.');
            openDetail(data.id);
          })
        );

        root.querySelectorAll('[data-del-gasto]').forEach((btn) =>
          btn.addEventListener('click', async () => {
            const gastoId = Number(btn.getAttribute('data-del-gasto'));
            const gasto = (data.gastos_servico || []).find((g) => g.id === gastoId);
            const ok = await RF.ui.confirm({
              title: 'Excluir gasto',
              message: 'Deseja excluir este gasto e seus comprovantes?',
              confirmLabel: 'Excluir',
              danger: true
            });
            if (!ok) return;
            RF.ui.loading(true);
            const { error: delErr } = await sb.from('gastos_servico').delete().eq('id', gastoId);
            if (!delErr && gasto) {
              for (const c of gasto.comprovantes_gasto || []) {
                await removeStorageFile(c.url_arquivo);
              }
            }
            RF.ui.loading(false);
            if (delErr) {
              RF.ui.toast(U.errorMessage(delErr), 'error');
              return;
            }
            RF.ui.toast('Gasto excluído.');
            openDetail(data.id);
          })
        );

        root.querySelector('[data-add-gasto]').addEventListener('click', () => openGastoForm(data));
        root.querySelector('[data-exec]').addEventListener('click', () => openExecution(data));
        root.querySelector('[data-edit-os]').addEventListener('click', () => openForm(data));
        const delBtn = root.querySelector('[data-del-os]');
        if (delBtn) delBtn.addEventListener('click', () => remove(data));
      }
    });
  }

  /* ============ Gasto ============ */
  function openGastoForm(order) {
    RF.ui.openModal({
      title: `Lançar gasto — OS #${order.id}`,
      subtitle: 'Despesas entram no cálculo do lucro líquido',
      size: 'max-w-xl',
      content: `
        <form id="gasto-form" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="gs-cat">Categoria</label>
            <select id="gs-cat" class="input" required>
              ${CATEGORIAS.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label" for="gs-val">Valor (R$)</label>
            <input id="gs-val" type="number" step="0.01" min="0.01" class="input" required placeholder="0,00" />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="gs-obs">Observação</label>
            <input id="gs-obs" class="input" maxlength="255" placeholder="Ex.: abastecimento no posto X" />
          </div>
          <div class="sm:col-span-2">
            <label class="label">Comprovantes</label>
            ${RF.ui.uploadBox('gasto-files', 'Anexar recibos')}
          </div>
        </form>`,
      footer: `
        <button type="button" class="btn-secondary" data-modal-close>Cancelar</button>
        <button type="submit" form="gasto-form" class="btn-primary" data-save>Salvar gasto</button>`,
      onMount(root, close) {
        const input = root.querySelector('#gasto-files');
        input.addEventListener('change', () => selectedFilesText('gasto-files'));

        const form = root.querySelector('#gasto-form');
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!form.reportValidity()) return;
          const saveBtn = root.querySelector('[data-save]');
          saveBtn.disabled = true;
          saveBtn.textContent = 'Salvando…';
          RF.ui.loading(true);

          try {
            const payload = {
              ordem_servico_id: order.id,
              categoria: root.querySelector('#gs-cat').value,
              valor: U.toNumber(root.querySelector('#gs-val').value),
              observacao: root.querySelector('#gs-obs').value.trim() || null
            };
            const { data: gasto, error } = await sb.from('gastos_servico').insert(payload).select().single();
            if (error) throw error;

            const files = Array.from(input.files || []);
            if (files.length) {
              const uploaded = await uploadFiles(files, `gastos/${gasto.id}`);
              const rows = uploaded.map((u) => ({
                gasto_servico_id: gasto.id,
                url_arquivo: u.url,
                nome_arquivo: u.nome_arquivo
              }));
              const { error: compErr } = await sb.from('comprovantes_gasto').insert(rows);
              if (compErr) throw compErr;
            }

            RF.ui.toast('Gasto lançado.');
            openDetail(order.id);
          } catch (err) {
            RF.ui.toast(U.errorMessage(err), 'error');
          } finally {
            RF.ui.loading(false);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar gasto';
          }
        });
      }
    });
  }

  async function remove(row) {
    const ok = await RF.ui.confirm({
      title: 'Excluir ordem de serviço',
      message: `Deseja excluir a OS #${row.id}? Anexos, gastos e comprovantes vinculados também serão removidos.`,
      confirmLabel: 'Excluir',
      danger: true
    });
    if (!ok) return;
    RF.ui.loading(true);
    try {
      const files = [];
      (row.anexos_ordem_servico || []).forEach((a) => files.push(a.url_arquivo));
      (row.gastos_servico || []).forEach((g) => (g.comprovantes_gasto || []).forEach((c) => files.push(c.url_arquivo)));
      const { error } = await sb.from('ordens_servico').delete().eq('id', row.id);
      if (error) throw error;
      for (const url of files) await removeStorageFile(url);
      RF.ui.closeAllModals();
      RF.ui.toast('Ordem de serviço excluída.');
      await refreshList();
    } catch (err) {
      RF.ui.toast(U.errorMessage(err), 'error');
    } finally {
      RF.ui.loading(false);
    }
  }

  /* ============ Página ============ */
  RF.pages.ordens = {
    async render(container) {
      containerRef = container;
      filters = { search: '', status: '', motorista: '', cliente: '', start: '', end: '' };
      const isMotorista = RF.auth.isMotorista();
      const canManage = RF.auth.canManage();

      await loadLookups();

      container.innerHTML = `
        ${RF.ui.pageHeader({
          title: isMotorista ? 'Minhas ordens de serviço' : 'Ordens de Serviço',
          subtitle: isMotorista ? 'Serviços atribuídos a você' : 'Solicitações, execução e prestação de contas',
          actions: canManage ? `<button type="button" class="btn-primary" data-new>
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Nova OS
          </button>` : ''
        })}

        <div class="card mb-4">
          <div class="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
            <div class="relative lg:col-span-2">
              <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
              <input id="os-search" class="input pl-9" placeholder="Buscar por rota, carga ou nº da OS" />
            </div>
            <select id="os-fstatus" class="input">
              <option value="">Todos os status</option>
              ${STATUS_OPTIONS.map((s) => `<option value="${s}">${s}</option>`).join('')}
            </select>
            ${isMotorista ? '' : `
              <select id="os-fmotorista" class="input">
                <option value="">Todos os motoristas</option>
                ${optionList(lookups.motoristas, '', (m) => m.nome)}
              </select>
              <select id="os-fcliente" class="input">
                <option value="">Todos os clientes</option>
                ${optionList(lookups.clientes, '', (c) => c.razao_social_nome)}
              </select>`}
            <div class="${isMotorista ? 'lg:col-span-2' : 'lg:col-span-1'} grid grid-cols-2 gap-2">
              <input id="os-fstart" type="date" class="input" title="Data inicial" />
              <input id="os-fend" type="date" class="input" title="Data final" />
            </div>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
            <p id="ordens-count" class="text-xs font-medium text-slate-500"></p>
            <button type="button" class="text-xs font-semibold text-slate-500 hover:text-slate-800" data-clear>Limpar filtros</button>
          </div>
        </div>

        <div class="card">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr>
                <th>OS</th><th>Data</th><th>Cliente</th><th>Rota</th><th>Motorista</th>
                <th class="hidden lg:table-cell">Veículo</th><th>Status</th>
                ${RF.auth.canSeeFinance() ? '<th>Valor</th>' : ''}<th></th>
              </tr></thead>
              <tbody id="ordens-tbody"></tbody>
            </table>
          </div>
        </div>`;

      const searchInput = container.querySelector('#os-search');
      searchInput.addEventListener('input', U.debounce(() => {
        filters.search = searchInput.value;
        load();
      }, 250));

      const statusSelect = container.querySelector('#os-fstatus');
      statusSelect.addEventListener('change', () => {
        filters.status = statusSelect.value;
        load();
      });

      const mSel = container.querySelector('#os-fmotorista');
      if (mSel) mSel.addEventListener('change', () => { filters.motorista = mSel.value; load(); });

      const cSel = container.querySelector('#os-fcliente');
      if (cSel) cSel.addEventListener('change', () => { filters.cliente = cSel.value; load(); });

      const startInput = container.querySelector('#os-fstart');
      const endInput = container.querySelector('#os-fend');
      startInput.addEventListener('change', () => { filters.start = startInput.value; load(); });
      endInput.addEventListener('change', () => { filters.end = endInput.value; load(); });

      container.querySelector('[data-clear]').addEventListener('click', () => {
        filters = { search: '', status: '', motorista: '', cliente: '', start: '', end: '' };
        searchInput.value = '';
        statusSelect.value = '';
        if (mSel) mSel.value = '';
        if (cSel) cSel.value = '';
        startInput.value = '';
        endInput.value = '';
        load();
      });

      container.querySelectorAll('[data-new]').forEach((btn) => btn.addEventListener('click', () => openForm()));

      await load();
    },
    openForm,
    openDetail,
    openGastoForm
  };
})();
