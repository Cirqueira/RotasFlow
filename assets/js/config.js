/* RotasFlow — configuração de conexão com o Supabase */
window.RF = window.RF || {};

RF.config = {
  SUPABASE_URL: 'https://rfexfqcdhujhykaynzrp.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_RM1yXIBt1T48Y2w6POOs7Q_9qR0Is9P',
  BUCKET_NAME: 'rotasflow-files',
  APP_NAME: 'RotasFlow'
};

RF.state = { session: null, profile: null, motorista: null };
RF.pages = {};
