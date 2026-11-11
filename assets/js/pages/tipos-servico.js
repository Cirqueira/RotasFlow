/* RotasFlow — tipos de serviço */
(function () {
  const U = RF.utils;
  const sb = RF.supabase;
  let cache = [];

  function rowsHtml() {
    if (!cache.length) {
      return `<tr><td colspan="3">${RF.ui.empty({
        title: 'Nenhum tipo de serviço',
        message: 'Cadastre os tipos usados nas ordens de serviço.',
        action: '<button type="button" class="btn-primary" data-new>Novo tipo</button>'
      })}</td></tr>`;
    }

    return cache
      .map(
        (t) => `
        <tr>
          <td>
            <div class="flex items-center gap-3">
              <div class="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"/></svg>
              </div>
              <p class="font-semibold text-slate-800">${U.escape(t.nome)}</p>
            </div>
          </td>
          <td class="max-w-[420px] text-sm text-slate-500">${U.escape(t.descricao || '—')}</td>
          <td class="text-right">
            <div class="flex justify-end gap-1">
              <button type="button" class="btn-icon" data-edit="${t.id}" title="Editar">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"/></svg>
              </button>
              <button type="button" class="btn-icon danger" data-del="${t.id}" title="Excluir">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
              </button>
            </div>
          </td>
        </tr>`
      )
      .join('');
  }

  async function refresh() {
    const tbody = document.getElementById('tipos-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="3"><div class="space-y-2 p-2">${'<div class="skeleton h-8"></div>'.repeat(3)}</div></td></tr>`;
    const { data, error } = await sb.from('tipos_servico').select('*').order('nome', { ascending: true });
    if (error) {
      tbody.innerHTML = `<tr><td colspan="3" class="px-4 py-8 text-center text-sm text-rose-600">${U.escape(U.errorMessage(error))}</td></tr>`;
      return;
    }
    cache = data || [];
    tbody.innerHTML = rowsHtml();
    const countEl = document.getElementById('tipos-count');
    if (countEl) countEl.textContent = `${cache.length} tipo(s) cadastrado(s)`;
    bindRows(tbody);
  }

  function bindRows(scope) {
    scope.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const row = cache.find((t) => String(t.id) === btn.getAttribute('data-edit'));
        if (row) openForm(row);
      })
    );
    scope.querySelectorAll('[data-del]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const row = cache.find((t) => String(t.id) === btn.getAttribute('data-del'));
        if (row) remove(row);
      })
    );
    scope.querySelectorAll('[data-new]').forEach((btn) => btn.addEventListener('click', () => openForm()));
  }

  function openForm(row) {
    const isEdit = !!row;
    const t = row || { nome: '', descricao: '' };

    RF.ui.openModal({
      title: isEdit ? 'Editar tipo de serviço' : 'Novo tipo de serviço',
      size: 'max-w-lg',
      content: `
        <form id="tipo-form" class="space-y-4">
          <div>
            <label class="label" for="tp-nome">Nome</label>
            <input id="tp-nome" class="input" required maxlength="50" value="${U.escape(t.nome)}" placeholder="Ex.: Transporte, Coleta, Entrega" />
          </div>
          <div>
            <label class="label" for="tp-desc">Descrição</label>
            <textarea id="tp-desc" class="input" rows="3" placeholder="Detalhes opcionais">${U.escape(t.descricao || '')}</textarea>
          </div>
        </form>`,
      footer: `
        <button type="button" class="btn-secondary" data-modal-close>Cancelar</button>
        <button type="submit" form="tipo-form" class="btn-primary" data-save>${isEdit ? 'Salvar alterações' : 'Cadastrar tipo'}</button>`,
      onMount(root, close) {
        const form = root.querySelector('#tipo-form');
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!form.reportValidity()) return;
          const saveBtn = root.querySelector('[data-save]');
          saveBtn.disabled = true;
          saveBtn.textContent = 'Salvando…';
          RF.ui.loading(true);

          const payload = {
            nome: root.querySelector('#tp-nome').value.trim(),
            descricao: root.querySelector('#tp-desc').value.trim() || null
          };

          try {
            if (isEdit) {
              const { error } = await sb.from('tipos_servico').update(payload).eq('id', t.id);
              if (error) throw error;
            } else {
              const { error } = await sb.from('tipos_servico').insert(payload);
              if (error) throw error;
            }
            close();
            RF.ui.toast(isEdit ? 'Tipo atualizado.' : 'Tipo cadastrado.');
            refresh();
          } catch (err) {
            RF.ui.toast(U.errorMessage(err), 'error');
          } finally {
            RF.ui.loading(false);
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Salvar alterações' : 'Cadastrar tipo';
          }
        });
      }
    });
  }

  async function remove(row) {
    const ok = await RF.ui.confirm({
      title: 'Excluir tipo de serviço',
      message: `Deseja excluir "${row.nome}"? Tipos usados em ordens de serviço não podem ser removidos.`,
      confirmLabel: 'Excluir',
      danger: true
    });
    if (!ok) return;
    RF.ui.loading(true);
    const { error } = await sb.from('tipos_servico').delete().eq('id', row.id);
    RF.ui.loading(false);
    if (error) {
      RF.ui.toast(U.errorMessage(error), 'error');
      return;
    }
    RF.ui.toast('Tipo excluído.');
    refresh();
  }

  RF.pages.tipos = {
    async render(container) {
      container.innerHTML = `
        ${RF.ui.pageHeader({
          title: 'Tipos de Serviço',
          subtitle: 'Categorias utilizadas nas ordens de serviço',
          actions: `<button type="button" class="btn-primary" data-new>
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Novo tipo
          </button>`
        })}
        <div class="card">
          <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 class="text-sm font-bold text-slate-800">Tipos cadastrados</h3>
            <p id="tipos-count" class="text-xs font-medium text-slate-500"></p>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Tipo</th><th>Descrição</th><th></th></tr></thead>
              <tbody id="tipos-tbody"></tbody>
            </table>
          </div>
        </div>`;

      container.querySelectorAll('[data-new]').forEach((btn) => btn.addEventListener('click', () => openForm()));
      await refresh();
    },
    openForm
  };
})();
