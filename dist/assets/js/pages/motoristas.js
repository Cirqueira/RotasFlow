/* RotasFlow — cadastro de motoristas */
(function () {
  const U = RF.utils;
  const sb = RF.supabase;
  let search = '';
  let cache = [];

  function cnhStatus(dateStr) {
    if (!dateStr) return '<span class="text-xs text-slate-400">—</span>';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr + 'T00:00:00');
    const diff = Math.ceil((d - today) / 86400000);
    if (isNaN(d.getTime())) return '<span class="text-xs text-slate-400">—</span>';
    if (diff < 0) return `<span class="badge badge-rose">Vencida ${U.date(dateStr + 'T00:00:00')}</span>`;
    if (diff <= 30) return `<span class="badge badge-amber">${U.date(dateStr + 'T00:00:00')}</span>`;
    return `<span class="text-xs text-slate-600">${U.date(dateStr + 'T00:00:00')}</span>`;
  }

  function rowsHtml(data) {
    const term = search.trim().toLowerCase();
    const filtered = !term
      ? data
      : data.filter((m) =>
          [m.nome, m.cpf, m.email, m.celular_whatsapp, m.cnh, m.chave_pix]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(term)
        );

    if (!filtered.length) {
      return `<tr><td colspan="6">${RF.ui.empty({
        title: term ? 'Nenhum motorista encontrado' : 'Nenhum motorista cadastrado',
        message: term ? 'Ajuste a busca e tente novamente.' : 'Cadastre motoristas para atribuir ordens de serviço.',
        action: term ? '' : '<button type="button" class="btn-primary" data-new>Novo motorista</button>'
      })}</td></tr>`;
    }

    return filtered
      .map(
        (m) => `
        <tr>
          <td>
            <div class="flex items-center gap-3">
              <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">${U.escape(U.initials(m.nome))}</div>
              <div class="min-w-0">
                <p class="truncate font-semibold text-slate-800">${U.escape(m.nome)}</p>
                <p class="truncate text-xs text-slate-500">${U.escape(m.email || 'sem e-mail vinculado')}</p>
              </div>
            </div>
          </td>
          <td class="whitespace-nowrap font-mono text-xs">${U.escape(m.cpf)}</td>
          <td class="whitespace-nowrap">${U.escape(m.celular_whatsapp)}</td>
          <td><span class="badge ${m.tipo === 'Proprio' ? 'badge-blue' : 'badge-violet'}">${U.escape(m.tipo)}</span></td>
          <td class="whitespace-nowrap">${cnhStatus(m.cnh_validade)}</td>
          <td class="text-right">
            <div class="flex justify-end gap-1">
              <button type="button" class="btn-icon" data-edit="${m.id}" title="Editar">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"/></svg>
              </button>
              <button type="button" class="btn-icon danger" data-del="${m.id}" title="Excluir">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
              </button>
            </div>
          </td>
        </tr>`
      )
      .join('');
  }

  async function refresh() {
    const tbody = document.getElementById('motoristas-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6"><div class="space-y-2 p-2">${'<div class="skeleton h-8"></div>'.repeat(4)}</div></td></tr>`;
    const { data, error } = await sb.from('motoristas').select('*').order('nome', { ascending: true });
    if (error) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-rose-600">${U.escape(U.errorMessage(error))}</td></tr>`;
      return;
    }
    cache = data || [];
    tbody.innerHTML = rowsHtml(cache);
    const countEl = document.getElementById('motoristas-count');
    if (countEl) countEl.textContent = `${cache.length} motorista(s) cadastrado(s)`;
    bindRows(tbody);
  }

  function bindRows(scope) {
    scope.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const row = cache.find((m) => String(m.id) === btn.getAttribute('data-edit'));
        if (row) openForm(row);
      })
    );
    scope.querySelectorAll('[data-del]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const row = cache.find((m) => String(m.id) === btn.getAttribute('data-del'));
        if (row) remove(row);
      })
    );
    scope.querySelectorAll('[data-new]').forEach((btn) => btn.addEventListener('click', () => openForm()));
  }

  function openForm(row) {
    const isEdit = !!row;
    const m = row || {
      nome: '',
      cpf: '',
      cnh: '',
      cnh_validade: '',
      endereco: '',
      email: '',
      celular_whatsapp: '',
      tipo: 'Proprio',
      chave_pix: ''
    };

    RF.ui.openModal({
      title: isEdit ? 'Editar motorista' : 'Novo motorista',
      subtitle: 'Dados pessoais, CNH e dados de pagamento',
      size: 'max-w-3xl',
      content: `
        <form id="motorista-form" class="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <div class="sm:col-span-4">
            <label class="label" for="mt-nome">Nome completo</label>
            <input id="mt-nome" class="input" required maxlength="150" value="${U.escape(m.nome)}" />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="mt-tipo">Tipo</label>
            <select id="mt-tipo" class="input" required>
              <option value="Proprio" ${m.tipo === 'Proprio' ? 'selected' : ''}>Próprio</option>
              <option value="Terceirizado" ${m.tipo === 'Terceirizado' ? 'selected' : ''}>Terceirizado</option>
            </select>
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="mt-cpf">CPF</label>
            <input id="mt-cpf" class="input" required data-mask="cpf" value="${U.escape(m.cpf)}" />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="mt-cel">Celular / WhatsApp</label>
            <input id="mt-cel" class="input" required data-mask="phone" value="${U.escape(m.celular_whatsapp)}" />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="mt-email">E-mail de acesso</label>
            <input id="mt-email" type="email" class="input" maxlength="100" value="${U.escape(m.email || '')}" placeholder="vincula o login do motorista" />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="mt-cnh">CNH</label>
            <input id="mt-cnh" class="input" maxlength="20" value="${U.escape(m.cnh || '')}" />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="mt-val">Validade da CNH</label>
            <input id="mt-val" type="date" class="input" value="${U.escape(m.cnh_validade || '')}" />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="mt-pix">Chave PIX</label>
            <input id="mt-pix" class="input" maxlength="100" value="${U.escape(m.chave_pix || '')}" />
          </div>
          <div class="sm:col-span-6">
            <label class="label" for="mt-end">Endereço</label>
            <textarea id="mt-end" class="input" rows="2">${U.escape(m.endereco || '')}</textarea>
          </div>
          <p class="sm:col-span-6 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            O e-mail informado deve ser o mesmo usado no login do motorista para que ele visualize as próprias ordens de serviço.
          </p>
        </form>`,
      footer: `
        <button type="button" class="btn-secondary" data-modal-close>Cancelar</button>
        <button type="submit" form="motorista-form" class="btn-primary" data-save>${isEdit ? 'Salvar alterações' : 'Cadastrar motorista'}</button>`,
      onMount(root, close) {
        const form = root.querySelector('#motorista-form');
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!form.reportValidity()) return;
          const saveBtn = root.querySelector('[data-save]');
          saveBtn.disabled = true;
          saveBtn.textContent = 'Salvando…';
          RF.ui.loading(true);

          const payload = {
            nome: root.querySelector('#mt-nome').value.trim(),
            cpf: root.querySelector('#mt-cpf').value.trim(),
            cnh: root.querySelector('#mt-cnh').value.trim() || null,
            cnh_validade: root.querySelector('#mt-val').value || null,
            endereco: root.querySelector('#mt-end').value.trim() || null,
            email: root.querySelector('#mt-email').value.trim() || null,
            celular_whatsapp: root.querySelector('#mt-cel').value.trim(),
            tipo: root.querySelector('#mt-tipo').value,
            chave_pix: root.querySelector('#mt-pix').value.trim() || null
          };

          try {
            if (isEdit) {
              const { error } = await sb.from('motoristas').update(payload).eq('id', m.id);
              if (error) throw error;
            } else {
              const { error } = await sb.from('motoristas').insert(payload);
              if (error) throw error;
            }
            close();
            RF.ui.toast(isEdit ? 'Motorista atualizado.' : 'Motorista cadastrado.');
            refresh();
          } catch (err) {
            RF.ui.toast(U.errorMessage(err), 'error');
          } finally {
            RF.ui.loading(false);
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Salvar alterações' : 'Cadastrar motorista';
          }
        });
      }
    });
  }

  async function remove(row) {
    const ok = await RF.ui.confirm({
      title: 'Excluir motorista',
      message: `Deseja excluir "${row.nome}"? Motoristas com ordens de serviço não podem ser removidos.`,
      confirmLabel: 'Excluir',
      danger: true
    });
    if (!ok) return;
    RF.ui.loading(true);
    const { error } = await sb.from('motoristas').delete().eq('id', row.id);
    RF.ui.loading(false);
    if (error) {
      RF.ui.toast(U.errorMessage(error), 'error');
      return;
    }
    RF.ui.toast('Motorista excluído.');
    refresh();
  }

  RF.pages.motoristas = {
    async render(container) {
      search = '';
      container.innerHTML = `
        ${RF.ui.pageHeader({
          title: 'Motoristas',
          subtitle: 'Equipe própria e terceirizada',
          actions: `<button type="button" class="btn-primary" data-new>
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Novo motorista
          </button>`
        })}
        <div class="card">
          <div class="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="relative w-full sm:max-w-xs">
              <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
              <input id="motoristas-search" class="input pl-9" placeholder="Buscar por nome, CPF ou e-mail" />
            </div>
            <p id="motoristas-count" class="text-xs font-medium text-slate-500"></p>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Motorista</th><th>CPF</th><th>WhatsApp</th><th>Tipo</th><th>CNH válida até</th><th></th></tr></thead>
              <tbody id="motoristas-tbody"></tbody>
            </table>
          </div>
        </div>`;

      const input = container.querySelector('#motoristas-search');
      input.addEventListener('input', U.debounce(() => {
        search = input.value;
        const tbody = document.getElementById('motoristas-tbody');
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
