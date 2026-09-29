CREATE TABLE public.departamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  prefixo text NOT NULL DEFAULT 'A',
  modo text NOT NULL DEFAULT 'senha',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.departamentos TO anon, authenticated;
GRANT ALL ON public.departamentos TO service_role;
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departamentos_public_all" ON public.departamentos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.guiches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departamento_id uuid NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (departamento_id, nome)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guiches TO anon, authenticated;
GRANT ALL ON public.guiches TO service_role;
ALTER TABLE public.guiches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guiches_public_all" ON public.guiches FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_departamentos_updated_at BEFORE UPDATE ON public.departamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_guiches_updated_at BEFORE UPDATE ON public.guiches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.senhas
  ADD COLUMN departamento_id uuid REFERENCES public.departamentos(id) ON DELETE CASCADE,
  ADD COLUMN nome text;

INSERT INTO public.departamentos (nome, prefixo, modo) VALUES ('Recepção', 'A', 'senha');
INSERT INTO public.guiches (departamento_id, nome)
  SELECT id, '01' FROM public.departamentos WHERE nome = 'Recepção';
UPDATE public.senhas SET departamento_id = (SELECT id FROM public.departamentos WHERE nome = 'Recepção')
  WHERE departamento_id IS NULL;

CREATE INDEX IF NOT EXISTS senhas_dep_dia_idx ON public.senhas (departamento_id, dia, status, numero);

DROP FUNCTION IF EXISTS public.emitir_senha();
DROP FUNCTION IF EXISTS public.chamar_proxima(text);

CREATE OR REPLACE FUNCTION public.emitir_senha(p_departamento uuid, p_nome text DEFAULT NULL)
RETURNS public.senhas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  proximo integer;
  nova public.senhas;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('senhas_' || p_departamento::text || '_' || hoje::text));
  SELECT COALESCE(MAX(numero), 0) + 1 INTO proximo
    FROM public.senhas WHERE dia = hoje AND departamento_id = p_departamento;
  INSERT INTO public.senhas (numero, dia, departamento_id, nome)
    VALUES (proximo, hoje, p_departamento, NULLIF(btrim(coalesce(p_nome, '')), ''))
    RETURNING * INTO nova;
  RETURN nova;
END;
$$;

CREATE OR REPLACE FUNCTION public.chamar_proxima(p_departamento uuid, p_guiche text, p_id uuid DEFAULT NULL)
RETURNS public.senhas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  alvo public.senhas;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('chamada_' || p_departamento::text || '_' || hoje::text));

  UPDATE public.senhas
     SET status = 'atendida', finished_at = now()
   WHERE dia = hoje AND departamento_id = p_departamento
     AND status = 'chamada' AND guiche = p_guiche;

  IF p_id IS NOT NULL THEN
    SELECT * INTO alvo FROM public.senhas
     WHERE id = p_id AND status = 'aguardando';
  ELSE
    SELECT * INTO alvo FROM public.senhas
     WHERE dia = hoje AND departamento_id = p_departamento AND status = 'aguardando'
     ORDER BY numero LIMIT 1;
  END IF;

  IF alvo.id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.senhas
     SET status = 'chamada', guiche = p_guiche, called_at = now()
   WHERE id = alvo.id
   RETURNING * INTO alvo;

  RETURN alvo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.emitir_senha(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chamar_proxima(uuid, text, uuid) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.departamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guiches;