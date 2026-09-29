import { supabase } from "@/integrations/supabase/client";

export type Departamento = {
  id: string;
  nome: string;
  prefixo: string;
  modo: string; // 'senha' | 'lista'
  ativo: boolean;
};

export type Guiche = {
  id: string;
  departamento_id: string;
  nome: string;
  ativo: boolean;
};

export type Senha = {
  id: string;
  numero: number;
  dia: string;
  status: string;
  guiche: string | null;
  departamento_id: string | null;
  nome: string | null;
  created_at: string;
  called_at: string | null;
  finished_at: string | null;
};

export function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/* ---------- departamentos ---------- */

export async function listarDepartamentos(): Promise<Departamento[]> {
  const { data, error } = await supabase
    .from("departamentos")
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Departamento[];
}

export async function criarDepartamento(input: {
  nome: string;
  prefixo: string;
  modo: string;
}): Promise<void> {
  const { error } = await supabase.from("departamentos").insert({
    nome: input.nome.trim(),
    prefixo: input.prefixo.trim().toUpperCase() || "A",
    modo: input.modo,
  });
  if (error) throw error;
}

export async function atualizarDepartamento(
  id: string,
  patch: Partial<Pick<Departamento, "nome" | "prefixo" | "modo" | "ativo">>,
): Promise<void> {
  const { error } = await supabase.from("departamentos").update(patch).eq("id", id);
  if (error) throw error;
}

/* ---------- guichês ---------- */

export async function listarGuiches(): Promise<Guiche[]> {
  const { data, error } = await supabase
    .from("guiches")
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Guiche[];
}

export async function criarGuiche(input: {
  departamento_id: string;
  nome: string;
}): Promise<void> {
  const { error } = await supabase.from("guiches").insert({
    departamento_id: input.departamento_id,
    nome: input.nome.trim(),
  });
  if (error) throw error;
}

export async function atualizarGuiche(
  id: string,
  patch: Partial<Pick<Guiche, "nome" | "ativo">>,
): Promise<void> {
  const { error } = await supabase.from("guiches").update(patch).eq("id", id);
  if (error) throw error;
}

/* ---------- senhas ---------- */

export async function listarSenhasDeHoje(): Promise<Senha[]> {
  const { data, error } = await supabase
    .from("senhas")
    .select("*")
    .eq("dia", hojeSP())
    .order("numero", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Senha[];
}

export async function emitirSenha(departamentoId: string, nome?: string): Promise<Senha> {
  const limpo = nome?.trim();
  const { data, error } = await supabase.rpc("emitir_senha", {
    p_departamento: departamentoId,
    ...(limpo ? { p_nome: limpo } : {}),
  });
  if (error) throw error;
  return data as unknown as Senha;
}

export async function chamarProxima(
  departamentoId: string,
  guiche: string,
  id?: string,
): Promise<Senha | null> {
  const { data, error } = await supabase.rpc("chamar_proxima", {
    p_departamento: departamentoId,
    p_guiche: guiche,
    ...(id ? { p_id: id } : {}),
  });
  if (error) throw error;
  return (data as unknown as Senha) ?? null;
}

export async function rechamar(id: string): Promise<void> {
  const { error } = await supabase
    .from("senhas")
    .update({ called_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function finalizar(id: string): Promise<void> {
  const { error } = await supabase
    .from("senhas")
    .update({ status: "atendida", finished_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Extrai nomes de um texto colado ou de um CSV (uma pessoa por linha; usa a 1ª coluna). */
export function extrairNomes(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((linha) => (linha.includes(";") ? linha.split(";")[0]! : linha.split(",")[0]!))
    .map((n) => n.replace(/^"|"$/g, "").trim())
    .filter((n) => n.length > 0 && n.toLowerCase() !== "nome");
}

/** Adiciona vários nomes à fila de um departamento, na ordem informada. */
export async function importarNomes(
  departamentoId: string,
  nomes: string[],
): Promise<{ criados: number; erros: number }> {
  let criados = 0;
  let erros = 0;
  for (const nome of nomes) {
    try {
      await emitirSenha(departamentoId, nome);
      criados += 1;
    } catch {
      erros += 1;
    }
  }
  return { criados, erros };
}

export function formatarSenha(numero: number, prefixo = "A"): string {
  return `${prefixo}${String(numero).padStart(3, "0")}`;
}

/** Rótulo exibido: nome da pessoa, quando informado; senão a senha formatada. */
export function rotuloChamada(senha: Senha, dep?: Departamento): string {
  if (senha.nome) return senha.nome;
  return formatarSenha(senha.numero, dep?.prefixo ?? "A");
}

export type PainelConfig = {
  id: string;
  brasao_url: string | null;
  fundo_url: string | null;
  escurecimento: number;
  titulo: string;
};

export async function obterPainelConfig(): Promise<PainelConfig | null> {
  const { data, error } = await supabase
    .from("painel_config")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as PainelConfig) ?? null;
}

export async function salvarPainelConfig(
  id: string | undefined,
  patch: Partial<Omit<PainelConfig, "id">>,
): Promise<void> {
  if (id) {
    const { error } = await supabase.from("painel_config").update(patch).eq("id", id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("painel_config").insert(patch);
  if (error) throw error;
}
