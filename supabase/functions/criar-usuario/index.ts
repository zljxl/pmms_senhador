import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) throw new Error("Não autenticado");
    const caller = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) throw new Error("Não autenticado");
    const { data: admin } = await caller
      .from("perfis_usuarios")
      .select("perfil, ativo")
      .eq("user_id", user.id)
      .maybeSingle();
    if (admin?.perfil !== "admin" || !admin.ativo)
      throw new Error("Apenas administradores podem criar usuários");
    const { nome, email, password, perfil, departamento_id, guiche_id } = await req.json();
    if (!email || !password || !perfil) throw new Error("Preencha os campos obrigatórios");
    const root = createClient(url, service);
    const { data: created, error } = await root.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !created.user) throw error ?? new Error("Não foi possível criar o usuário");
    const { error: profileError } = await root
      .from("perfis_usuarios")
      .insert({
        user_id: created.user.id,
        nome: nome ?? "",
        perfil,
        departamento_id: departamento_id || null,
        guiche_id: guiche_id || null,
        ativo: true,
      });
    if (profileError) {
      await root.auth.admin.deleteUser(created.user.id);
      throw profileError;
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao criar usuário" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
