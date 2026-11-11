/* RotasFlow — cadastro de clientes */
(function () {
  const U = RF.utils;
  const sb = RF.supabase;
  let search = '';

  function tipoBadge(tipo) {
    return tipo === 'PJ'
      ? '<span class="badge badge-blue">PJ</span>'
      : '<span class="badge badge-violet">PF</span>';
  }

  function rowsHtml(data) {
    const term = search.trim().toLowerCase();
    const filtered = !term
      ? data
      : data.filter((c) =>
          [c.razao_social_nome, c.cnpj_cpf, c.contato_whatsapp, c.endereco, c.inscricao_estadual]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(term)
        );

    if (!filtered.length) {
      return `<tr><td colspan="6">${RF.ui.empty({
        title: term ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado',
        message: term ? 'Ajuste a busca e tente novamente.' : 'Cadastre o primeiro cliente para começar a emitir ordens de serviço.',
        action: term ? '' : '<button type="button" class="btn-primary" data-new>Novo cliente</button>'
      })}</td></tr>`;
    }

    return filtered
      .map(
        (c) => `
        <tr>
          <td>
            <div class="flex items-center gap-3">
              <div class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">${U.escape(U.initials(c.razao_social_nome))}</div>
              <div class="min-w-0">
                <p class="truncate font-semibold text-slate-800">${U.escape(c.razao_social_nome)}</p>
                <p class="truncate text-xs text-slate-500">${U.escape(c.endereco || '—')}</p>
              </div>
            </div>
          </td>
          <td>${tipoBadge(c.tipo)}</td>
          <td class="whitespace-nowrap font-mono text-xs">${U.escape(c.cnpj_cpf || '—')}</td>
          <td class="whitespace-nowrap">${U.escape(c.contato_whatsapp || '—')}</td>
          <td class="hidden max-w-[200px] truncate text-xs text-slate-500 md:table-cell">${U.escape(c.inscricao_estadual || '—')}</td>
          <td class="text-right">
            <div class="flex justify-end gap-1">
              <button type="button" class="btn-icon" data-edit="${c.id}" title="Editar">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"/></svg>
              </button>
              <button type="button" class="btn-icon danger" data-del="${c.id}" title="Excluir">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
              </button>
            </div>
          </td>
        </tr>`
      )
      .join('');
  }

  async function refresh() {
    const tbody = document.getElementById('clientes-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6"><div class="space-y-2 p-2">${'<div class="skeleton h-8"></div>'.repeat(4)}</div></td></tr>`;
    const { data, error } = await sb.from('clientes').select('*').order('razao_social_nome', { ascending: true });
    if (error) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-rose-600">${U.escape(U.errorMessage(error))}</td></tr>`;
      return;
    }
    tbody.innerHTML = rowsHtml(data || []);
    bindRows(tbody, data || []);
    const countEl = document.getElementById('clientes-count');
    if (countEl) countEl.textContent = `${(data || []).length} cliente(s) cadastrado(s)`;
  }

  function bindRows(scope, data) {
    scope.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = data.find((c) => String(c.id) === btn.getAttribute('data-edit'));
        if (row) openForm(row);
      });
    });
    scope.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = data.find((c) => String(c.id) === btn.getAttribute('data-del'));
        if (row) remove(row);
      });
    });
    scope.querySelectorAll('[data-new]').forEach((btn) => btn.addEventListener('click', () => openForm()));
  }

  function openForm(row) {
    const isEdit = !!row;
    const c = row || { tipo: 'PJ', razao_social_nome: '', cnpj_cpf: '', inscricao_estadual: '', endereco: '', contato_whatsapp: '' };
    const modal = RF.ui.openModal({
      title: isEdit ? 'Editar cliente' : 'Novo cliente',
      subtitle: isEdit ? c.razao_social_nome : 'Preencha os dados do cliente PJ ou PF',
      size: 'max-w-2xl',
      content: `
        <form id="cliente-form" class="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <div class="sm:col-span-2">
            <label class="label" for="cl-tipo">Tipo</label>
            <select id="cl-tipo" class="input" required>
              <option value="PJ" ${c.tipo === 'PJ' ? 'selected' : ''}>Pessoa Jurídica (PJ)</option>
              <option value="PF" ${c.tipo === 'PF' ? 'selected' : ''}>Pessoa Física (PF)</option>
            </select>
          </div>
          <div class="sm:col-span-4">
            <label class="label" for="cl-nome">Razão social / Nome</label>
            <input id="cl-nome" class="input" required maxlength="150" value="${U.escape(c.razao_social_nome)}" />
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="cl-doc">CNPJ / CPF</label>
            <input id="cl-doc" class="input" required data-mask="${c.tipo === 'PJ' ? 'cnpj' : 'cpf'}" value="${U.escape(c.cnpj_cpf)}" />
          </div>
          <div class="sm:col-span-3">
            <label class="label" for="cl-ie">Inscrição estadual</label>
            <input id="cl-ie" class="input" maxlength="30" value="${U.escape(c.inscricao_estadual || '')}" />
          </div>
          <div class="sm:col-span-6">
            <label class="label" for="cl-end">Endereço</label>
            <textarea id="cl-end" class="input" required rows="2">${U.escape(c.endereco)}</textarea>
          </div>
          <div class="sm:col-span-4">
            <label class="label" for="cl-whats">Contato WhatsApp</label>
            <input id="cl-whats" class="input" required data-mask="phone" value="${U.escape(c.contato_whatsapp)}" />
          </div>
        </form>`,
      footer: `
        <button type="button" class="btn-secondary" data-modal-close>Cancelar</button>
        <button type="submit" form="cliente-form" class="btn-primary" data-save>${isEdit ? 'Salvar alterações' : 'Cadastrar cliente'}</button>`,
      onMount(root, close) {
        const form = root.querySelector('#cliente-form');
        const tipo = root.querySelector('#cl-tipo');
        const doc = root.querySelector('#cl-doc');

        tipo.addEventListener('change', () => {
          doc.setAttribute('data-mask', tipo.value === 'PJ' ? 'cnpj' : 'cpf');
          doc.value = U.applyMask(doc.value, tipo.value === 'PJ' ? 'cnpj' : 'cpf');
        });

        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!form.reportValidity()) return;
          const saveBtn = root.querySelector('[data-save]');
          saveBtn.disabled = true;
          saveBtn.textContent = 'Salvando…';
          RF.ui.loading(true);

          const payload = {
            tipo: tipo.value,
            razao_social_nome: root.querySelector('#cl-nome').value.trim(),
            cnpj_cpf: doc.value.trim(),
            inscricao_estadual: root.querySelector('#cl-ie').value.trim() || null,
            endereco: root.querySelector('#cl-end').value.trim(),
            contato_whatsapp: root.querySelector('#cl-whats').value.trim()
          };

          try {
            if (isEdit) {
              const { error } = await sb.from('clientes').update(payload).eq('id', c.id);
              if (error) throw error;
            } else {
              const { error } = await sb.from('clientes').insert(payload);
              if (error) throw error;
            }
            close();
            RF.ui.toast(isEdit ? 'Cliente atualizado.' : 'Cliente cadastrado.');
            refresh();
          } catch (err) {
            RF.ui.toast(U.errorMessage(err), 'error');
          } finally {
            RF.ui.loading(false);
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Salvar alterações' : 'Cadastrar cliente';
          }
        });
      }
    });
    return modal;
  }

  async function remove(row) {
    const ok = await RF.ui.confirm({
      title: 'Excluir cliente',
      message: `Deseja excluir "${row.razao_social_nome}"? Clientes com ordens de serviço não podem ser removidos.`,
      confirmLabel: 'Excluir',
      danger: true
    });
    if (!ok) return;
    RF.ui.loading(true);
    const { error } = await sb.from('clientes').delete().eq('id', row.id);
    RF.ui.loading(false);
    if (error) {
      RF.ui.toast(U.errorMessage(error), 'error');
      return;
    }
    RF.ui.toast('Cliente excluído.');
    refresh();
  }

  RF.pages.clientes = {
    async render(container) {
      search = '';
      container.innerHTML = `
        ${RF.ui.pageHeader({
          title: 'Clientes',
          subtitle: 'Pessoas físicas e jurídicas atendidas',
          actions: `<button type="button" class="btn-primary" data-new>
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Novo cliente
          </button>`
        })}
        <div class="card">
          <div class="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="relative w-full sm:max-w-xs">
              <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
              <input id="clientes-search" class="input pl-9" placeholder="Buscar por nome, documento ou telefone" />
            </div>
            <p id="clientes-count" class="text-xs font-medium text-slate-500"></p>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Cliente</th><th>Tipo</th><th>CNPJ / CPF</th><th>WhatsApp</th><th class="hidden md:table-cell">Inscrição estadual</th><th></th></tr></thead>
              <tbody id="clientes-tbody"></tbody>
            </table>
          </div>
        </div>`;

      const input = container.querySelector('#clientes-search');
      input.addEventListener('input', U.debounce(() => {
        search = input.value;
        refresh();
      }, 180));
      container.querySelectorAll('[data-new]').forEach((btn) => btn.addEventListener('click', () => openForm()));

      await refresh();
    },
    openForm
  };
})();
