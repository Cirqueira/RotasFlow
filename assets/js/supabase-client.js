/* RotasFlow — cliente Supabase */
(function () {
  const cfg = RF.config;
  RF.supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'rotasflow-auth'
    }
  });
})();
