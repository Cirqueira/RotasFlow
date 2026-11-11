/* RotasFlow — cadastro de veículos */
(function () {
  const U = RF.utils;
  const sb = RF.supabase;
  let search = '';
  let cache = [];
  let supportsAtivo = true;

  async function detectColumns() {
    const { error } = await sb.from('veiculos').select('ativo').limit(1);
    supportsAtivo = !error;
  }

  function rowsHtml(data) {
    const term = search.trim().toLowerCase();
    const filtered = !term
      ? data
      : data.filter((v) => [v.marca, v.modelo, v.placa].filter(Boolean).join(' ').toLowerCase().includes(term));

    if (!filtered.length) {
      return `<tr><td colspan="${supportsAtivo ? 4 : 3}">${RF.ui.empty({
        title: term ? 'Nenhum veículo encontrado' : 'Nenhum veículo cadastrado',
        message: term ? 'Ajuste a busca e tente novamente.' : 'Cadastre a frota para vincular às ordens de serviço.',
        action: term ? '' : '<button type="button" class="btn-primary" data-new>Novo veículo</button>'
      })}</td></tr>`;
    }

    return filtered
      .map(
        (v) => `
        <tr>
          <td>
            <div class="flex items-center gap-3">
              <div class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/></svg>
              </div>
              <div class="min-w-0">
                <p class="truncate font-semibold text-slate-800">${U.escape(v.marca)} ${U.escape(v.modelo)}</p>
                <p class="truncate text-xs text-slate-500">Cadastrado em ${U.date(v.criado_em)}</p>
              </div>
            </div>
          </td>
          <td><span class="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-slate-700">${U.escape(v.placa)}</span></td>
          ${supportsAtivo ? `<td>${v.ativo === false ? '<span class="badge badge-rose">Inativo</span>' : '<span class="badge badge-emerald">Ativo</span>'}</td>` : ''}
          <td class="text-right">
            <div class="flex justify-end gap-1">
              <button type="button" class="btn-icon" data-edit="${v.id}" title="Editar">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"/></svg>
              </button>
              <button type="button" class="btn-icon danger" data-del="${v.id}" title="Excluir">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
              </button>
            </div>
          </td>
        </tr>`
      )
      .join('');
  }

  async function refresh() {
    const tbody = document.getElementById('veiculos-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="${supportsAtivo ? 4 : 3}"><div class="space-y-2 p-2">${'<div class="skeleton h-8"></div>'.repeat(4)}</div></td></tr>`;
    const { data, error } = await sb.from('veiculos').select('*').order('marca', { ascending: true });
    if (error) {
      tbody.innerHTML = `<tr><td colspan="${supportsAtivo ? 4 : 3}" class="px-4 py-8 text-center text-sm text-rose-600">${U.escape(U.errorMessage(error))}</td></tr>`;
      return;
    }
    cache = data || [];
    tbody.innerHTML = rowsHtml(cache);
    const countEl = document.getElementById('veiculos-count');
    if (countEl) countEl.textContent = `${cache.length} veículo(s) cadastrado(s)`;
    bindRows(tbody);
  }

  function bindRows(scope) {
    scope.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const row = cache.find((v) => String(v.id) === btn.getAttribute('data-edit'));
        if (row) openForm(row);
      })
    );
    scope.querySelectorAll('[data-del]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const row = cache.find((v) => String(v.id) === btn.getAttribute('data-del'));
        if (row) remove(row);
      })
    );
    scope.querySelectorAll('[data-new]').forEach((btn) => btn.addEventListener('click', () => openForm()));
  }

  function openForm(row) {
    const isEdit = !!row;
    const v = row || { marca: '', modelo: '', placa: '', ativo: true };

    RF.ui.openModal({
      title: isEdit ? 'Editar veículo' : 'Novo veículo',
      size: 'max-w-lg',
      content: `
        <form id="veiculo-form" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="vc-marca">Marca</label>
            <input id="vc-marca" class="input" required maxlength="50" value="${U.escape(v.marca)}" />
          </div>
          <div>
            <label class="label" for="vc-modelo">Modelo</label>
            <input id="vc-modelo" class="input" required maxlength="50" value="${U.escape(v.modelo)}" />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="vc-placa">Placa</label>
            <input id="vc-placa" class="input font-mono uppercase" required data-mask="plate" maxlength="7" value="${U.escape(v.placa)}" />
          </div>
          ${supportsAtivo ? `
          <div class="sm:col-span-2">
            <label class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
              <input id="vc-ativo" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" ${v.ativo === false ? '' : 'checked'} />
              <span class="text-sm font-medium text-slate-700">Veículo ativo para operação</span>
            </label>
          </div>` : ''}
        </form>`,
      footer: `
        <button type="button" class="btn-secondary" data-modal-close>Cancelar</button>
        <button type="submit" form="veiculo-form" class="btn-primary" data-save>${isEdit ? 'Salvar alterações' : 'Cadastrar veículo'}</button>`,
      onMount(root, close) {
        const form = root.querySelector('#veiculo-form');
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!form.reportValidity()) return;
          const saveBtn = root.querySelector('[data-save]');
          saveBtn.disabled = true;
          saveBtn.textContent = 'Salvando…';
          RF.ui.loading(true);

          const payload = {
            marca: root.querySelector('#vc-marca').value.trim(),
            modelo: root.querySelector('#vc-modelo').value.trim(),
            placa: root.querySelector('#vc-placa').value.trim().toUpperCase()
          };
          if (supportsAtivo) {
            const chk = root.querySelector('#vc-ativo');
            payload.ativo = chk ? chk.checked : true;
          }

          try {
            if (isEdit) {
              const { error } = await sb.from('veiculos').update(payload).eq('id', v.id);
              if (error) throw error;
            } else {
              const { error } = await sb.from('veiculos').insert(payload);
              if (error) throw error;
            }
            close();
            RF.ui.toast(isEdit ? 'Veículo atualizado.' : 'Veículo cadastrado.');
            refresh();
          } catch (err) {
            RF.ui.toast(U.errorMessage(err), 'error');
          } finally {
            RF.ui.loading(false);
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Salvar alterações' : 'Cadastrar veículo';
          }
        });
      }
    });
  }

  async function remove(row) {
    const ok = await RF.ui.confirm({
      title: 'Excluir veículo',
      message: `Deseja excluir "${row.marca} ${row.modelo}" (${row.placa})? Veículos vinculados a ordens de serviço não podem ser removidos.`,
      confirmLabel: 'Excluir',
      danger: true
    });
    if (!ok) return;
    RF.ui.loading(true);
    const { error } = await sb.from('veiculos').delete().eq('id', row.id);
    RF.ui.loading(false);
    if (error) {
      RF.ui.toast(U.errorMessage(error), 'error');
      return;
    }
    RF.ui.toast('Veículo excluído.');
    refresh();
  }

  RF.pages.veiculos = {
    async render(container) {
      search = '';
      await detectColumns();
      container.innerHTML = `
        ${RF.ui.pageHeader({
          title: 'Veículos',
          subtitle: 'Frota disponível para as ordens de serviço',
          actions: `<button type="button" class="btn-primary" data-new>
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Novo veículo
          </button>`
        })}
        <div class="card">
          <div class="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="relative w-full sm:max-w-xs">
              <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
              <input id="veiculos-search" class="input pl-9" placeholder="Buscar por marca, modelo ou placa" />
            </div>
            <p id="veiculos-count" class="text-xs font-medium text-slate-500"></p>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Veículo</th><th>Placa</th>${supportsAtivo ? '<th>Status</th>' : ''}<th></th></tr></thead>
              <tbody id="veiculos-tbody"></tbody>
            </table>
          </div>
        </div>`;

      const input = container.querySelector('#veiculos-search');
      input.addEventListener('input', U.debounce(() => {
        search = input.value;
        const tbody = document.getElementById('veiculos-tbody');
        if (tbody) {
          tbody.innerHTML = rowsHtml(cache);
          bindRows(tbody);
        }
      }, 180));
      container.querySelectorAll('[data-new]').forEach((btn) => btn.addEventListener('click', () => openForm()));

      await refresh();
    },
    openForm
  };
})();
