-- =====================================================================
-- RotasFlow — configuração complementar do Supabase
-- Execute este script UMA VEZ no SQL Editor do Supabase.
-- Ele NÃO recria as tabelas: apenas adiciona coluna ausente, trigger de
-- perfil, índices, RLS (políticas de acesso) e o bucket de arquivos.
-- =====================================================================

-- 1) Coluna "ativo" em veículos (presente na especificação, ausente em
--    alguns scripts de criação). Seguro para executar mais de uma vez.
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;

-- 2) Índices de desempenho
CREATE INDEX IF NOT EXISTS idx_os_data_hora       ON public.ordens_servico (data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_os_motorista       ON public.ordens_servico (motorista_id);
CREATE INDEX IF NOT EXISTS idx_os_cliente         ON public.ordens_servico (cliente_id);
CREATE INDEX IF NOT EXISTS idx_os_status          ON public.ordens_servico (status);
CREATE INDEX IF NOT EXISTS idx_anexos_os          ON public.anexos_ordem_servico (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_gastos_os          ON public.gastos_servico (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_comprovantes_gasto ON public.comprovantes_gasto (gasto_servico_id);
CREATE INDEX IF NOT EXISTS idx_motoristas_email   ON public.motoristas (lower(email));

-- =====================================================================
-- 3) Funções auxiliares de autorização
-- =====================================================================

CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT nivel_acesso FROM public.perfis_usuarios WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(public.current_role_name() IN ('admin', 'operador'), FALSE)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(public.current_role_name() = 'admin', FALSE)
$$;

CREATE OR REPLACE FUNCTION public.perfil_count()
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*) FROM public.perfis_usuarios
$$;

-- Motorista vinculado ao e-mail do usuário logado
CREATE OR REPLACE FUNCTION public.current_motorista_id()
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id
  FROM public.motoristas
  WHERE lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  LIMIT 1
$$;

-- Verifica se a OS pertence ao motorista logado
CREATE OR REPLACE FUNCTION public.owns_os(p_os_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ordens_servico o
    WHERE o.id = p_os_id
      AND o.motorista_id = public.current_motorista_id()
  )
$$;

-- Verifica se o gasto pertence a uma OS do motorista logado
CREATE OR REPLACE FUNCTION public.owns_gasto(p_gasto_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.gastos_servico g
    JOIN public.ordens_servico o ON o.id = g.ordem_servico_id
    WHERE g.id = p_gasto_id
      AND o.motorista_id = public.current_motorista_id()
  )
$$;

-- =====================================================================
-- 4) Criação automática de perfil ao cadastrar usuário no Auth
--    O primeiro usuário vira admin; os demais entram como motorista.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nivel TEXT;
BEGIN
  SELECT CASE WHEN COUNT(*) = 0 THEN 'admin' ELSE 'motorista' END
    INTO v_nivel
    FROM public.perfis_usuarios;

  INSERT INTO public.perfis_usuarios (id, nome, email, nivel_acesso, ativo)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'nome', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    v_nivel,
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- 5) Proteção de campos financeiros e de atribuição da OS
--    Motoristas só podem alterar status, KM, horários e observações.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.protect_os_fields()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Service role / SQL editor (sem usuário autenticado) e staff podem tudo
  IF auth.uid() IS NULL OR public.is_staff() THEN
    RETURN NEW;
  END IF;

  IF NEW.cliente_id        IS DISTINCT FROM OLD.cliente_id
     OR NEW.motorista_id   IS DISTINCT FROM OLD.motorista_id
     OR NEW.veiculo_id     IS DISTINCT FROM OLD.veiculo_id
     OR NEW.tipo_servico_id IS DISTINCT FROM OLD.tipo_servico_id
     OR NEW.data_hora      IS DISTINCT FROM OLD.data_hora
     OR NEW.origem         IS DISTINCT FROM OLD.origem
     OR NEW.destino        IS DISTINCT FROM OLD.destino
     OR NEW.passageiro_carga IS DISTINCT FROM OLD.passageiro_carga
     OR NEW.valor_cliente  IS DISTINCT FROM OLD.valor_cliente
     OR NEW.valor_repasse  IS DISTINCT FROM OLD.valor_repasse
  THEN
    RAISE EXCEPTION 'Motorista não tem permissão para alterar estes campos da ordem de serviço.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_os_fields ON public.ordens_servico;
CREATE TRIGGER trg_protect_os_fields
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.protect_os_fields();

-- =====================================================================
-- 6) Row Level Security (RLS)
-- =====================================================================
ALTER TABLE public.perfis_usuarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motoristas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_servico         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anexos_ordem_servico  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos_servico        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprovantes_gasto    ENABLE ROW LEVEL SECURITY;

-- ---------- perfis_usuarios ----------
DROP POLICY IF EXISTS perfis_select ON public.perfis_usuarios;
CREATE POLICY perfis_select ON public.perfis_usuarios
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS perfis_insert ON public.perfis_usuarios;
CREATE POLICY perfis_insert ON public.perfis_usuarios
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      id = auth.uid()
      AND (nivel_acesso = 'motorista' OR public.perfil_count() = 0)
    )
  );

DROP POLICY IF EXISTS perfis_update ON public.perfis_usuarios;
CREATE POLICY perfis_update ON public.perfis_usuarios
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS perfis_delete ON public.perfis_usuarios;
CREATE POLICY perfis_delete ON public.perfis_usuarios
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------- cadastros (leitura livre para autenticados) ----------
DROP POLICY IF EXISTS clientes_select ON public.clientes;
CREATE POLICY clientes_select ON public.clientes FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS clientes_write ON public.clientes;
CREATE POLICY clientes_write ON public.clientes FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS motoristas_select ON public.motoristas;
CREATE POLICY motoristas_select ON public.motoristas FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS motoristas_write ON public.motoristas;
CREATE POLICY motoristas_write ON public.motoristas FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS veiculos_select ON public.veiculos;
CREATE POLICY veiculos_select ON public.veiculos FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS veiculos_write ON public.veiculos;
CREATE POLICY veiculos_write ON public.veiculos FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS tipos_select ON public.tipos_servico;
CREATE POLICY tipos_select ON public.tipos_servico FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS tipos_write ON public.tipos_servico;
CREATE POLICY tipos_write ON public.tipos_servico FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- ordens_servico ----------
DROP POLICY IF EXISTS os_select ON public.ordens_servico;
CREATE POLICY os_select ON public.ordens_servico
  FOR SELECT TO authenticated
  USING (public.is_staff() OR motorista_id = public.current_motorista_id());

DROP POLICY IF EXISTS os_insert ON public.ordens_servico;
CREATE POLICY os_insert ON public.ordens_servico
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS os_update ON public.ordens_servico;
CREATE POLICY os_update ON public.ordens_servico
  FOR UPDATE TO authenticated
  USING (public.is_staff() OR motorista_id = public.current_motorista_id())
  WITH CHECK (public.is_staff() OR motorista_id = public.current_motorista_id());

DROP POLICY IF EXISTS os_delete ON public.ordens_servico;
CREATE POLICY os_delete ON public.ordens_servico
  FOR DELETE TO authenticated
  USING (public.is_staff());

-- ---------- anexos_ordem_servico ----------
DROP POLICY IF EXISTS anexos_select ON public.anexos_ordem_servico;
CREATE POLICY anexos_select ON public.anexos_ordem_servico
  FOR SELECT TO authenticated
  USING (public.is_staff() OR public.owns_os(ordem_servico_id));

DROP POLICY IF EXISTS anexos_insert ON public.anexos_ordem_servico;
CREATE POLICY anexos_insert ON public.anexos_ordem_servico
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() OR public.owns_os(ordem_servico_id));

DROP POLICY IF EXISTS anexos_delete ON public.anexos_ordem_servico;
CREATE POLICY anexos_delete ON public.anexos_ordem_servico
  FOR DELETE TO authenticated
  USING (public.is_staff() OR public.owns_os(ordem_servico_id));

-- ---------- gastos_servico ----------
DROP POLICY IF EXISTS gastos_select ON public.gastos_servico;
CREATE POLICY gastos_select ON public.gastos_servico
  FOR SELECT TO authenticated
  USING (public.is_staff() OR public.owns_os(ordem_servico_id));

DROP POLICY IF EXISTS gastos_insert ON public.gastos_servico;
CREATE POLICY gastos_insert ON public.gastos_servico
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() OR public.owns_os(ordem_servico_id));

DROP POLICY IF EXISTS gastos_update ON public.gastos_servico;
CREATE POLICY gastos_update ON public.gastos_servico
  FOR UPDATE TO authenticated
  USING (public.is_staff() OR public.owns_os(ordem_servico_id))
  WITH CHECK (public.is_staff() OR public.owns_os(ordem_servico_id));

DROP POLICY IF EXISTS gastos_delete ON public.gastos_servico;
CREATE POLICY gastos_delete ON public.gastos_servico
  FOR DELETE TO authenticated
  USING (public.is_staff() OR public.owns_os(ordem_servico_id));

-- ---------- comprovantes_gasto ----------
DROP POLICY IF EXISTS comprovantes_select ON public.comprovantes_gasto;
CREATE POLICY comprovantes_select ON public.comprovantes_gasto
  FOR SELECT TO authenticated
  USING (public.is_staff() OR public.owns_gasto(gasto_servico_id));

DROP POLICY IF EXISTS comprovantes_insert ON public.comprovantes_gasto;
CREATE POLICY comprovantes_insert ON public.comprovantes_gasto
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() OR public.owns_gasto(gasto_servico_id));

DROP POLICY IF EXISTS comprovantes_delete ON public.comprovantes_gasto;
CREATE POLICY comprovantes_delete ON public.comprovantes_gasto
  FOR DELETE TO authenticated
  USING (public.is_staff() OR public.owns_gasto(gasto_servico_id));

-- =====================================================================
-- 7) Storage — bucket público para fotos e comprovantes
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('rotasflow-files', 'rotasflow-files', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS rotasflow_files_select ON storage.objects;
CREATE POLICY rotasflow_files_select ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'rotasflow-files');

DROP POLICY IF EXISTS rotasflow_files_insert ON storage.objects;
CREATE POLICY rotasflow_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rotasflow-files');

DROP POLICY IF EXISTS rotasflow_files_update ON storage.objects;
CREATE POLICY rotasflow_files_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'rotasflow-files' AND (public.is_staff() OR owner = auth.uid()))
  WITH CHECK (bucket_id = 'rotasflow-files' AND (public.is_staff() OR owner = auth.uid()));

DROP POLICY IF EXISTS rotasflow_files_delete ON storage.objects;
CREATE POLICY rotasflow_files_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'rotasflow-files' AND (public.is_staff() OR owner = auth.uid()));

-- =====================================================================
-- 8) Ajuste manual do administrador
--    Se o primeiro usuário já existia antes deste script, ele pode ter
--    ficado como motorista. Promova-o executando (troque o e-mail):
--
--    UPDATE public.perfis_usuarios
--       SET nivel_acesso = 'admin', ativo = TRUE
--     WHERE email = 'seu-email@empresa.com';
-- =====================================================================
