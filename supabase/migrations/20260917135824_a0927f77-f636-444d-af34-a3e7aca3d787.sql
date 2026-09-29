ALTER TABLE public.senhas DROP CONSTRAINT IF EXISTS senhas_dia_numero_key;
CREATE UNIQUE INDEX IF NOT EXISTS senhas_dep_dia_numero_key ON public.senhas (departamento_id, dia, numero);