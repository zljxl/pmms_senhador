CREATE TABLE public.senhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL,
  dia date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  status text NOT NULL DEFAULT 'aguardando',
  guiche text,
  created_at timestamptz NOT NULL DEFAULT now(),
  called_at timestamptz,
  finished_at timestamptz,
  UNIQUE (dia, numero)
);

CREATE INDEX senhas_dia_status_idx ON public.senhas (dia, status, numero);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.senhas TO anon, authenticated;
GRANT ALL ON public.senhas TO service_role;

ALTER TABLE public.senhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "senhas_public_select" ON public.senhas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "senhas_public_insert" ON public.senhas FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "senhas_public_update" ON public.senhas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.emitir_senha()
RETURNS public.senhas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  proximo integer;
  nova public.senhas;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('senhas_' || hoje::text));
  SELECT COALESCE(MAX(numero), 0) + 1 INTO proximo FROM public.senhas WHERE dia = hoje;
  INSERT INTO public.senhas (numero, dia) VALUES (proximo, hoje) RETURNING * INTO nova;
  RETURN nova;
END;
$$;

CREATE OR REPLACE FUNCTION public.chamar_proxima(p_guiche text)
RETURNS public.senhas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  alvo public.senhas;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('chamada_' || hoje::text));

  UPDATE public.senhas
     SET status = 'atendida', finished_at = now()
   WHERE dia = hoje AND status = 'chamada' AND guiche = p_guiche;

  SELECT * INTO alvo
    FROM public.senhas
   WHERE dia = hoje AND status = 'aguardando'
   ORDER BY numero
   LIMIT 1;

  IF alvo.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.senhas
     SET status = 'chamada', guiche = p_guiche, called_at = now()
   WHERE id = alvo.id
   RETURNING * INTO alvo;

  RETURN alvo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.emitir_senha() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chamar_proxima(text) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.senhas;