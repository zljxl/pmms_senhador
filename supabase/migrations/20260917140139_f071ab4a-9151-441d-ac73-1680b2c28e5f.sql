CREATE TABLE public.painel_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brasao_url text,
  fundo_url text,
  escurecimento numeric NOT NULL DEFAULT 0.72,
  titulo text NOT NULL DEFAULT 'Painel de Chamada',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.painel_config TO anon, authenticated;
GRANT ALL ON public.painel_config TO service_role;

ALTER TABLE public.painel_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "painel_config publico" ON public.painel_config FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.painel_config (brasao_url, fundo_url)
VALUES ('http://86.48.16.178:5000/branding/municipal-crest.png', 'http://86.48.16.178:5000/branding/login-background.png');