/* RotasFlow — utilitários compartilhados */
(function () {
  const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const numberFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const STATUS = {
    'Solicitada': { badge: 'badge-amber', dot: 'bg-amber-500', text: 'text-amber-700' },
    'Em Andamento': { badge: 'badge-blue', dot: 'bg-blue-500', text: 'text-blue-700' },
    'Concluída': { badge: 'badge-emerald', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    'Cancelada': { badge: 'badge-rose', dot: 'bg-rose-500', text: 'text-rose-700' }
  };

  const ROLES = {
    admin: 'Administrador',
    operador: 'Operador',
    motorista: 'Motorista'
  };

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  const utils = {
    STATUS,
    ROLES,

    currency(v) {
      const n = Number(v || 0);
      return currencyFmt.format(Number.isFinite(n) ? n : 0);
    },

    number(v, digits = 2) {
      const n = Number(v || 0);
      if (digits === 2) return numberFmt.format(Number.isFinite(n) ? n : 0);
      return (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
    },

    int(v) {
      return Number(v || 0).toLocaleString('pt-BR');
    },

    toNumber(v) {
      if (v === null || v === undefined || v === '') return 0;
      if (typeof v === 'number') return v;
      let s = String(v).trim().replace(/\s/g, '');
      if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    },

    sum(arr, fn) {
      return (arr || []).reduce((acc, item) => acc + Number((fn ? fn(item) : item) || 0), 0);
    },

    date(v) {
      if (!v) return '—';
      const d = new Date(v);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-BR');
    },

    dateTime(v) {
      if (!v) return '—';
      const d = new Date(v);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    },

    time(v) {
      if (!v) return '—';
      const d = new Date(v);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    },

    toDateInput(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },

    toDateTimeInput(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    nowDateTimeInput() {
      return utils.toDateTimeInput(new Date());
    },

    startOfMonthISO() {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).toISOString();
    },

    endOfMonthISO() {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
    },

    startOfDayISO(dateStr) {
      if (!dateStr) return null;
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
    },

    endOfDayISO(dateStr) {
      if (!dateStr) return null;
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
    },

    escape(value) {
      return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    initials(name) {
      const parts = String(name || 'RF').trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return 'RF';
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    },

    statusMeta(status) {
      return STATUS[status] || { badge: 'badge-slate', dot: 'bg-slate-400', text: 'text-slate-600' };
    },

    statusBadge(status) {
      const meta = utils.statusMeta(status);
      return `<span class="badge ${meta.badge}">${utils.escape(status || '—')}</span>`;
    },

    roleBadge(role) {
      const map = { admin: 'badge-violet', operador: 'badge-blue', motorista: 'badge-slate' };
      return `<span class="badge ${map[role] || 'badge-slate'}">${utils.escape(ROLES[role] || role || '—')}</span>`;
    },

    debounce(fn, wait = 300) {
      let t;
      return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
      };
    },

    isImage(url) {
      return /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|$)/i.test(String(url || ''));
    },

    fileLabel(url, fallback) {
      if (fallback) return fallback;
      const clean = String(url || '').split('?')[0];
      return decodeURIComponent(clean.split('/').pop() || 'arquivo');
    },

    errorMessage(error) {
      if (!error) return 'Erro desconhecido.';
      if (typeof error === 'string') return error;
      let msg = error.message || error.error_description || error.details || 'Erro desconhecido.';
      if (error.code === '23505' || /duplicate key/i.test(msg)) return 'Já existe um registro com este valor único (CPF, CNPJ, placa ou e-mail).';
      if (error.code === '23503' || /foreign key/i.test(msg)) return 'Este registro está sendo usado por uma ordem de serviço e não pode ser excluído.';
      if (/bucket not found/i.test(msg)) return 'Bucket de arquivos não encontrado. Execute o SQL de configuração do Storage.';
      if (/row-level security/i.test(msg)) return 'Permissão negada pelas políticas de acesso (RLS) do Supabase.';
      if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha inválidos.';
      if (/email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
      return msg;
    },

    applyMask(value, type) {
      let v = String(value || '');
      if (type === 'cpf') {
        v = v.replace(/\D/g, '').slice(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      } else if (type === 'cnpj') {
        v = v.replace(/\D/g, '').slice(0, 14);
        v = v.replace(/^(\d{2})(\d)/, '$1.$2');
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
        v = v.replace(/(\d{4})(\d)/, '$1-$2');
      } else if (type === 'cpfcnpj') {
        const digits = v.replace(/\D/g, '');
        return digits.length <= 11 ? utils.applyMask(digits, 'cpf') : utils.applyMask(digits, 'cnpj');
      } else if (type === 'phone') {
        v = v.replace(/\D/g, '').slice(0, 11);
        if (v.length <= 10) {
          v = v.replace(/^(\d{2})(\d)/, '($1) $2');
          v = v.replace(/(\d{4})(\d)/, '$1-$2');
        } else {
          v = v.replace(/^(\d{2})(\d)/, '($1) $2');
          v = v.replace(/(\d{5})(\d)/, '$1-$2');
        }
      } else if (type === 'plate') {
        v = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
      } else if (type === 'cep') {
        v = v.replace(/\D/g, '').slice(0, 8);
        v = v.replace(/(\d{5})(\d)/, '$1-$2');
      }
      return v;
    },

    downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },

    slugDate() {
      const d = new Date();
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },

    periodLabel(startStr, endStr) {
      if (!startStr && !endStr) return 'Todo o período';
      if (startStr && endStr) {
        return `${utils.date(startStr + 'T00:00:00')} a ${utils.date(endStr + 'T00:00:00')}`;
      }
      return startStr ? `A partir de ${utils.date(startStr + 'T00:00:00')}` : `Até ${utils.date(endStr + 'T00:00:00')}`;
    }
  };

  RF.utils = utils;
})();
