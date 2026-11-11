/* RotasFlow — usuários e perfis */
(function () {
  const U = RF.utils;
  const sb = RF.supabase;
  let cache = [];
  let search = '';

  const NIVEIS = [
    { value: 'admin', label: 'Administrador' },
    { value: 'operador', label: 'Operador' },
    { value: 'motorista', label: 'Motorista' }
  ];

  function rowsHtml() {
    const term = search.trim().toLowerCase();
    const filtered = !term
      ? cache
      : cache.filter((p) => [p.nome, p.email, p.nivel_acesso].filter(Boolean).join(' ').toLowerCase().includes(term));

    if (!filtered.length) {
      return `<tr><td colspan="5">${RF.ui.empty({
        title: 'Nenhum perfil encontrado',
        message: 'Cadastre o perfil de um usuário criado no Supabase Auth.'
      })}</td></tr>`;
    }

    return filtered
      .map(
        (p) => `
        <tr>
          <td>
            <div class="flex items-center gap-3">
              <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">${U.escape(U.initials(p.nome))}</div>
              <div class="min-w-0">
                <p class="truncate font-semibold text-slate-800">${U.escape(p.nome)}</p>
                <p class="truncate text-xs text-slate-500">${U.escape(p.email)}</p>
              </div>
            </div>
          </td>
          <td>${U.roleBadge(p.nivel_acesso)}</td>
          <td>${p.ativo === false ? '<span class="badge badge-rose">Inativo</span>' : '<span class="badge badge-emerald">Ativo</span>'}</td>
          <td class="hidden whitespace-nowrap text-xs text-slate-500 md:table-cell">${U.date(p.criado_em)}</td>
          <td class="text-right">
            <button type="button" class="btn-icon" data-edit="${p.id}" title="Editar perfil">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"/></svg>
            </button>
          </td>
        </tr>`
      )
      .join('');
  }

  async function refresh() {
    const tbody = document.getElementById('perfis-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5"><div class="space-y-2 p-2">${'<div class="skeleton h-8"></div>'.repeat(3)}</div></td></tr>`;
    const { data, error } = await sb.from('perfis_usuarios').select('*').order('nome', { ascending: true });
    if (error) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-sm text-rose-600">${U.escape(U.errorMessage(error))}</td></tr>`;
      return;
    }
    cache = data || [];
    tbody.innerHTML = rowsHtml();
    const countEl = document.getElementById('perfis-count');
    if (countEl) countEl.textContent = `${cache.length} perfil(is)`;
    bindRows(tbody);
  }

  function bindRows(scope) {
    scope.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const row = cache.find((p) => String(p.id) === btn.getAttribute('data-edit'));
        if (row) openForm(row);
      })
    );
  }

  function openForm(row) {
    const isEdit = !!row;
    const p = row || { id: '', nome: '', email: '', nivel_acesso: 'motorista', ativo: true };

    RF.ui.openModal({
      title: isEdit ? 'Editar perfil' : 'Novo perfil',
      subtitle: isEdit ? p.email : 'Vincule um usuário do Supabase Auth',
      size: 'max-w-lg',
      content: `
        <form id="perfil-form" class="space-y-4">
          <div>
            <label class="label" for="pf-id">UUID do usuário (Auth)</label>
            <input id="pf-id" class="input font-mono text-xs" ${isEdit ? 'disabled' : 'required'} value="${U.escape(p.id)}" placeholder="00000000-0000-0000-0000-000000000000" />
            ${isEdit ? '' : '<p class="mt-1 text-xs text-slate-500">Copie o UUID em Supabase &gt; Authentication &gt; Users.</p>'}
          </div>
          <div>
            <label class="label" for="pf-nome">Nome</label>
            <input id="pf-nome" class="input" required maxlength="150" value="${U.escape(p.nome)}" />
          </div>
          <div>
            <label class="label" for="pf-email">E-mail</label>
            <input id="pf-email" type="email" class="input" required maxlength="100" value="${U.escape(p.email)}" ${isEdit ? 'disabled' : ''} />
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="label" for="pf-nivel">Nível de acesso</label>
              <select id="pf-nivel" class="input">
                ${NIVEIS.map((n) => `<option value="${n.value}" ${p.nivel_acesso === n.value ? 'selected' : ''}>${n.label}</option>`).join('')}
              </select>
            </div>
            <div class="flex items-end">
              <label class="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                <input id="pf-ativo" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" ${p.ativo === false ? '' : 'checked'} />
                <span class="text-sm font-medium text-slate-700">Usuário ativo</span>
              </label>
            </div>
          </div>
          <p class="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Para motoristas, use o mesmo e-mail cadastrado no módulo de Motoristas. Assim o usuário verá apenas as próprias ordens de serviço.
          </p>
        </form>`,
      footer: `
        <button type="button" class="btn-secondary" data-modal-close>Cancelar</button>
        <button type="submit" form="perfil-form" class="btn-primary" data-save>${isEdit ? 'Salvar alterações' : 'Cadastrar perfil'}</button>`,
      onMount(root, close) {
        const form = root.querySelector('#perfil-form');
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!form.reportValidity()) return;

          if (isEdit && RF.state.profile && p.id === RF.state.profile.id) {
            if (!root.querySelector('#pf-ativo').checked) {
              RF.ui.toast('Você não pode desativar o seu próprio acesso.', 'error');
              return;
            }
            if (root.querySelector('#pf-nivel').value !== 'admin') {
              RF.ui.toast('Você não pode remover o seu próprio nível de administrador.', 'error');
              return;
            }
          }

          const payload = {
            nome: root.querySelector('#pf-nome').value.trim(),
            nivel_acesso: root.querySelector('#pf-nivel').value,
            ativo: root.querySelector('#pf-ativo').checked
          };

          if (!isEdit) {
            const id = root.querySelector('#pf-id').value.trim();
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
              RF.ui.toast('Informe um UUID válido.', 'error');
              return;
            }
            payload.id = id;
            payload.email = root.querySelector('#pf-email').value.trim();
          }

          const saveBtn = root.querySelector('[data-save]');
          saveBtn.disabled = true;
          saveBtn.textContent = 'Salvando…';
          RF.ui.loading(true);

          try {
            if (isEdit) {
              const { error } = await sb.from('perfis_usuarios').update(payload).eq('id', p.id);
              if (error) throw error;
            } else {
              const { error } = await sb.from('perfis_usuarios').insert(payload);
              if (error) throw error;
            }
            close();
            RF.ui.toast(isEdit ? 'Perfil atualizado.' : 'Perfil cadastrado.');
            refresh();
          } catch (err) {
            RF.ui.toast(U.errorMessage(err), 'error');
          } finally {
            RF.ui.loading(false);
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Salvar alterações' : 'Cadastrar perfil';
          }
        });
      }
    });
  }

  RF.pages.perfis = {
    async render(container) {
      search = '';
      container.innerHTML = `
        ${RF.ui.pageHeader({
          title: 'Usuários e Perfis',
          subtitle: 'Controle de acesso ao RotasFlow',
          actions: `<button type="button" class="btn-primary" data-new>
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Novo perfil
          </button>`
        })}

        <div class="mb-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <p class="font-semibold">Como funciona o acesso</p>
          <ul class="mt-1 list-inside list-disc space-y-0.5 text-xs text-brand-800">
            <li>Usuários são criados no Supabase em <strong>Authentication &gt; Users</strong> (ou pela tela de criação de conta).</li>
            <li>Cada usuário precisa de um registro em <strong>perfis_usuarios</strong>, vinculado pelo UUID.</li>
            <li>O primeiro usuário sem perfil vira administrador automaticamente; os demais entram como motorista até serem promovidos.</li>
          </ul>
        </div>

        <div class="card">
          <div class="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="relative w-full sm:max-w-xs">
              <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
              <input id="perfis-search" class="input pl-9" placeholder="Buscar por nome, e-mail ou nível" />
            </div>
            <p id="perfis-count" class="text-xs font-medium text-slate-500"></p>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Usuário</th><th>Nível</th><th>Status</th><th class="hidden md:table-cell">Criado em</th><th></th></tr></thead>
              <tbody id="perfis-tbody"></tbody>
            </table>
          </div>
        </div>`;

      const input = container.querySelector('#perfis-search');
      input.addEventListener('input', U.debounce(() => {
        search = input.value;
        const tbody = document.getElementById('perfis-tbody');
        if (tbody) {
          tbody.innerHTML = rowsHtml();
          bindRows(tbody);
        }
      }, 180));

      container.querySelectorAll('[data-new]').forEach((btn) => btn.addEventListener('click', () => openForm()));
      await refresh();
    }
  };
})();
