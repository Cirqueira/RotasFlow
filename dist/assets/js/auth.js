/* RotasFlow — autenticação e controle de acesso */
(function () {
  const sb = RF.supabase;
  const U = RF.utils;
  let signupMode = false;
  let handling = false;

  const auth = {};

  function el(id) {
    return document.getElementById(id);
  }

  function showAuthScreen() {
    el('boot-loader').classList.add('hidden');
    el('app-screen').classList.add('hidden');
    el('auth-screen').classList.remove('auth-hidden');
  }

  function showAppScreen() {
    el('boot-loader').classList.add('hidden');
    el('auth-screen').classList.add('auth-hidden');
    el('app-screen').classList.remove('hidden');
  }

  function setAuthError(message) {
    const box = el('login-error');
    if (!box) return;
    if (!message) {
      box.textContent = '';
      box.classList.add('hidden');
    } else {
      box.textContent = message;
      box.classList.remove('hidden');
    }
  }

  function setSignupMode(enabled) {
    signupMode = enabled;
    el('auth-title').textContent = enabled ? 'Criar conta' : 'Acessar o sistema';
    el('auth-subtitle').textContent = enabled
      ? 'Cadastre-se para acessar. O administrador define seu nível de acesso.'
      : 'Entre com seu e-mail e senha corporativos.';
    el('login-name-field').classList.toggle('hidden', !enabled);
    el('login-name').required = enabled;
    el('login-submit').querySelector('.btn-label').textContent = enabled ? 'Criar conta' : 'Entrar';
    el('auth-toggle-signup').textContent = enabled ? 'Já tenho conta' : 'Criar conta';
    el('login-password').autocomplete = enabled ? 'new-password' : 'current-password';
    setAuthError('');
  }

  async function ensureProfile(user) {
    const { data, error } = await sb
      .from('perfis_usuarios')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const { count } = await sb
      .from('perfis_usuarios')
      .select('id', { count: 'exact', head: true });

    const nome = (user.user_metadata && user.user_metadata.nome) || (user.email || '').split('@')[0];
    const nivel = !count || count === 0 ? 'admin' : 'motorista';

    const { data: created, error: insertError } = await sb
      .from('perfis_usuarios')
      .insert({
        id: user.id,
        nome,
        email: user.email,
        nivel_acesso: nivel,
        ativo: true
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return created;
  }

  async function loadMotorista(profile) {
    if (!profile || !profile.email) return null;
    const { data } = await sb
      .from('motoristas')
      .select('*')
      .ilike('email', profile.email)
      .maybeSingle();
    return data || null;
  }

  async function handleSession(session) {
    if (handling) return;
    if (
      session &&
      session.user &&
      RF.state.profile &&
      RF.state.session &&
      RF.state.session.user &&
      RF.state.session.user.id === session.user.id
    ) {
      RF.state.session = session;
      return;
    }
    handling = true;
    try {
      if (!session || !session.user) {
        RF.state.session = null;
        RF.state.profile = null;
        RF.state.motorista = null;
        if (RF.app && RF.app.onLoggedOut) RF.app.onLoggedOut();
        showAuthScreen();
        return;
      }

      RF.state.session = session;
      let profile;
      try {
        profile = await ensureProfile(session.user);
      } catch (err) {
        await sb.auth.signOut();
        showAuthScreen();
        setAuthError('Não foi possível carregar seu perfil: ' + U.errorMessage(err));
        return;
      }

      if (profile.ativo === false) {
        await sb.auth.signOut();
        showAuthScreen();
        setAuthError('Seu acesso está desativado. Fale com o administrador.');
        return;
      }

      RF.state.profile = profile;
      RF.state.motorista = await loadMotorista(profile);

      showAppScreen();
      if (RF.app && RF.app.onAuthenticated) RF.app.onAuthenticated();
    } finally {
      handling = false;
    }
  }

  auth.init = async function () {
    el('login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      setAuthError('');
      const email = el('login-email').value.trim();
      const password = el('login-password').value;
      const submit = el('login-submit');
      const label = submit.querySelector('.btn-label');
      const original = label.textContent;

      submit.disabled = true;
      label.textContent = signupMode ? 'Criando…' : 'Entrando…';

      try {
        if (signupMode) {
          const nome = el('login-name').value.trim();
          const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: { data: { nome } }
          });
          if (error) throw error;
          if (!data.session) {
            setAuthError('Conta criada. Confirme seu e-mail para entrar.');
            setSignupMode(false);
            el('login-password').value = '';
          }
        } else {
          const { error } = await sb.auth.signInWithPassword({ email, password });
          if (error) throw error;
        }
      } catch (err) {
        setAuthError(U.errorMessage(err));
      } finally {
        submit.disabled = false;
        label.textContent = original;
      }
    });

    el('auth-toggle-signup').addEventListener('click', () => setSignupMode(!signupMode));

    document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = el(btn.getAttribute('data-toggle-password'));
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });

    document.querySelectorAll('[data-year]').forEach((node) => {
      node.textContent = new Date().getFullYear();
    });

    el('logout-btn').addEventListener('click', async () => {
      const ok = await RF.ui.confirm({
        title: 'Sair do sistema',
        message: 'Deseja encerrar sua sessão?',
        confirmLabel: 'Sair'
      });
      if (!ok) return;
      await sb.auth.signOut();
    });

    let initialHandled = false;
    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        initialHandled = true;
        handleSession(session);
      } else if (event === 'SIGNED_OUT') {
        handleSession(null);
      } else if (event === 'TOKEN_REFRESHED') {
        RF.state.session = session;
      } else if (session) {
        handleSession(session);
      }
    });

    const { data } = await sb.auth.getSession();
    if (!initialHandled) await handleSession(data.session);
  };

  auth.logout = function () {
    return sb.auth.signOut();
  };

  auth.canManage = function () {
    const p = RF.state.profile;
    return !!p && (p.nivel_acesso === 'admin' || p.nivel_acesso === 'operador');
  };

  auth.isAdmin = function () {
    const p = RF.state.profile;
    return !!p && p.nivel_acesso === 'admin';
  };

  auth.isMotorista = function () {
    const p = RF.state.profile;
    return !!p && p.nivel_acesso === 'motorista';
  };

  auth.canSeeFinance = function () {
    return auth.canManage();
  };

  RF.auth = auth;
})();
