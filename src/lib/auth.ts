import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "gerente" | "funcionario" | "recepcionista";

export const roleLabels: Record<UserRole, string> = {
  admin: "Administrador do sistema",
  gerente: "Gerente do departamento",
  funcionario: "Funcionário do departamento",
  recepcionista: "Recepcionista",
};

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function criarUsuario(input: {
  nome: string; email: string; password: string; perfil: UserRole;
  departamento_id?: string | null; guiche_id?: string | null;
}) {
  return supabase.functions.invoke("criar-usuario", { body: input });
}
