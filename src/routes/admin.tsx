import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDepartamentos, useGuiches, usePainelConfig } from "@/hooks/use-senhas";
import { supabase } from "@/integrations/supabase/client";
import { criarUsuario, type UserRole } from "@/lib/auth";
import {
  atualizarDepartamento,
  atualizarGuiche,
  criarDepartamento,
  criarGuiche,
  salvarPainelConfig,
} from "@/lib/senhas";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Departamentos e Guichês — Senhas e Recepção" },
      {
        name: "description",
        content:
          "Cadastre departamentos, defina chamada por senha ou lista de nomes e registre os guichês.",
      },
      { property: "og:title", content: "Departamentos e Guichês — Senhas e Recepção" },
      {
        property: "og:description",
        content: "Administração dos departamentos e guichês do atendimento.",
      },
    ],
  }),
  component: Admin,
});

function Admin() {
  const queryClient = useQueryClient();
  const { data: departamentos = [] } = useDepartamentos();
  const { data: guiches = [] } = useGuiches();
  const usuarios = useQuery({ queryKey: ["perfis-usuarios"], queryFn: async () => {
    const { data, error } = await (supabase.from("perfis_usuarios" as never) as any).select("*").order("nome");
    if (error) throw error;
    return data ?? [];
  }});

  const [nome, setNome] = useState("");
  const [prefixo, setPrefixo] = useState("A");
  const [modo, setModo] = useState("senha");
  const [novoUsuario, setNovoUsuario] = useState({ nome: "", email: "", password: "", perfil: "funcionario" as UserRole, departamento_id: "", guiche_id: "" });

  const [guicheDep, setGuicheDep] = useState("");
  const [guicheNome, setGuicheNome] = useState("");

  const { data: config } = usePainelConfig();
  const [cfgTitulo, setCfgTitulo] = useState<string | null>(null);
  const [cfgBrasaoRaw, setCfgBrasao] = useState<string | null>(null);
  const [cfgFundoRaw, setCfgFundo] = useState<string | null>(null);
  const [cfgEscuroRaw, setCfgEscuro] = useState<string | null>(null);

  const cfgBrasao = cfgBrasaoRaw ?? config?.brasao_url ?? "";
  const cfgFundo = cfgFundoRaw ?? config?.fundo_url ?? "";
  const cfgEscuro = cfgEscuroRaw ?? String(config?.escurecimento ?? 0.72);

  const salvarCfg = useMutation({
    mutationFn: () =>
      salvarPainelConfig(config?.id, {
        titulo: (cfgTitulo ?? config?.titulo ?? "Painel de Chamada").trim() || "Painel de Chamada",
        brasao_url: cfgBrasao.trim() || null,
        fundo_url: cfgFundo.trim() || null,
        escurecimento: Math.min(Math.max(Number(cfgEscuro) || 0, 0), 1),
      }),
    onSuccess: () => {
      toast.success("Aparência do painel salva");
      queryClient.invalidateQueries({ queryKey: ["painel-config"] });
    },
    onError: () => toast.error("Não foi possível salvar a aparência"),
  });

  const recarregar = () => {
    queryClient.invalidateQueries({ queryKey: ["departamentos"] });
    queryClient.invalidateQueries({ queryKey: ["guiches"] });
  };

  const novoDep = useMutation({
    mutationFn: () => criarDepartamento({ nome, prefixo, modo }),
    onSuccess: () => {
      toast.success("Departamento criado");
      setNome("");
      setPrefixo("A");
      setModo("senha");
      recarregar();
    },
    onError: () => toast.error("Não foi possível criar o departamento"),
  });

  const editarDep = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      atualizarDepartamento(id, patch),
    onSuccess: recarregar,
  });

  const novoGuiche = useMutation({
    mutationFn: () => criarGuiche({ departamento_id: guicheDep, nome: guicheNome }),
    onSuccess: () => {
      toast.success("Guichê cadastrado");
      setGuicheNome("");
      recarregar();
    },
    onError: () => toast.error("Não foi possível cadastrar o guichê"),
  });

  const editarGuiche = useMutation({
    mutationFn: ({ id, ativo, nome }: { id: string; ativo?: boolean; nome?: string }) => atualizarGuiche(id, { ativo, nome }),
    onSuccess: recarregar,
  });
  const editarUsuario = useMutation({
    mutationFn: ({ user_id, patch }: { user_id: string; patch: Record<string, unknown> }) => (supabase.from("perfis_usuarios" as never) as any).update(patch).eq("user_id", user_id),
    onSuccess: () => usuarios.refetch(),
  });
  const criarNovoUsuario = useMutation({
    mutationFn: () => criarUsuario({ ...novoUsuario, departamento_id: novoUsuario.departamento_id || null, guiche_id: novoUsuario.guiche_id || null }),
    onSuccess: ({ error }) => { if (error) { toast.error(error.message); return; } toast.success("Usuário criado"); setNovoUsuario({ nome: "", email: "", password: "", perfil: "funcionario", departamento_id: "", guiche_id: "" }); usuarios.refetch(); },
    onError: () => toast.error("Não foi possível criar o usuário"),
  });

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold">Departamentos e guichês</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada departamento tem sua própria fila e pode chamar por senha ou por lista de nomes.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-bold">Novo departamento</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="dep-nome">Nome</Label>
                <Input
                  id="dep-nome"
                  className="mt-2"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Recepção"
                />
              </div>
              <div>
                <Label htmlFor="dep-prefixo">Prefixo da senha</Label>
                <Input
                  id="dep-prefixo"
                  className="mt-2"
                  maxLength={3}
                  value={prefixo}
                  onChange={(e) => setPrefixo(e.target.value.toUpperCase())}
                  placeholder="A"
                />
              </div>
              <div>
                <Label>Forma de chamada</Label>
                <Select value={modo} onValueChange={setModo}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="senha">Por senha</SelectItem>
                    <SelectItem value="lista">Por lista de nomes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="mt-5"
              onClick={() => novoDep.mutate()}
              disabled={nome.trim().length === 0 || novoDep.isPending}
            >
              Criar departamento
            </Button>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-bold">Novo guichê</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Departamento</Label>
                <Select value={guicheDep} onValueChange={setGuicheDep}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {departamentos.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="guiche-nome">Identificação</Label>
                <Input
                  id="guiche-nome"
                  className="mt-2"
                  value={guicheNome}
                  onChange={(e) => setGuicheNome(e.target.value)}
                  placeholder="Ex.: 01"
                />
              </div>
            </div>
            <Button
              className="mt-5"
              onClick={() => novoGuiche.mutate()}
              disabled={!guicheDep || guicheNome.trim().length === 0 || novoGuiche.isPending}
            >
              Cadastrar guichê
            </Button>
          </section>
        </div>

        <section className="mt-8 rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-bold">Aparência do painel de chamada</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Endereço do brasão, imagem de fundo e título exibidos na tela de chamada.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="cfg-titulo">Título</Label>
              <Input
                id="cfg-titulo"
                className="mt-2"
                value={cfgTitulo ?? config?.titulo ?? ""}
                onChange={(e) => setCfgTitulo(e.target.value)}
                placeholder="Painel de Chamada"
              />
            </div>
            <div>
              <Label htmlFor="cfg-brasao">Endereço do brasão</Label>
              <Input
                id="cfg-brasao"
                className="mt-2"
                value={cfgBrasao}
                onChange={(e) => setCfgBrasao(e.target.value)}
                placeholder="https://.../brasao.png"
              />
            </div>
            <div>
              <Label htmlFor="cfg-fundo">Endereço da imagem de fundo</Label>
              <Input
                id="cfg-fundo"
                className="mt-2"
                value={cfgFundo}
                onChange={(e) => setCfgFundo(e.target.value)}
                placeholder="https://.../fundo.png"
              />
            </div>
            <div>
              <Label htmlFor="cfg-escuro">Escurecimento do fundo (0 a 1)</Label>
              <Input
                id="cfg-escuro"
                type="number"
                min={0}
                max={1}
                step={0.05}
                className="mt-2"
                value={cfgEscuro}
                onChange={(e) => setCfgEscuro(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-4">
            <Button onClick={() => salvarCfg.mutate()} disabled={salvarCfg.isPending}>
              Salvar aparência
            </Button>
            {cfgBrasao && (
              <img src={cfgBrasao} alt="Prévia do brasão" className="h-12 w-12 object-contain" />
            )}
          </div>
        </section>

        <section className="mt-8 space-y-4">
          <h2 className="text-base font-bold">Cadastrados</h2>
          {departamentos.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum departamento ainda.</p>
          )}
          {departamentos.map((d) => (
            <div key={d.id} className="rounded-xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <Input
                    className="h-9 max-w-sm font-display text-lg font-bold"
                    defaultValue={d.nome}
                    onBlur={(e) => {
                      const nome = e.target.value.trim();
                      if (nome && nome !== d.nome) editarDep.mutate({ id: d.id, patch: { nome } });
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Prefixo {d.prefixo} ·{" "}
                    {d.modo === "lista" ? "chamada por lista de nomes" : "chamada por senha"}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={d.ativo}
                    onCheckedChange={(v) => editarDep.mutate({ id: d.id, patch: { ativo: v } })}
                  />
                  Ativo
                </label>
              </div>

              <ul className="mt-4 flex flex-wrap gap-2">
                {guiches
                  .filter((g) => g.departamento_id === d.id)
                  .map((g) => (
                    <li
                      key={g.id}
                      className="flex items-center gap-3 rounded-md bg-secondary px-3 py-2 text-sm"
                    >
                      <Input className="h-8 w-32" defaultValue={g.nome} onBlur={(e) => {
                        const nome = e.target.value.trim();
                        if (nome && nome !== g.nome) editarGuiche.mutate({ id: g.id, nome });
                      }} />
                      {/*
                        Guichê {g.nome}
                      </span> */}
                      <Switch
                        checked={g.ativo}
                        onCheckedChange={(v) => editarGuiche.mutate({ id: g.id, ativo: v })}
                      />
                    </li>
                  ))}
                {guiches.filter((g) => g.departamento_id === d.id).length === 0 && (
                  <li className="text-sm text-muted-foreground">Sem guichês cadastrados.</li>
                )}
              </ul>
            </div>
          ))}
        </section>
        <section className="mt-8 rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-bold">Usuários e permissões</h2>
          <div className="mt-4 grid gap-3 rounded-lg border border-dashed p-4 md:grid-cols-2">
            <Input placeholder="Nome" value={novoUsuario.nome} onChange={(e) => setNovoUsuario({ ...novoUsuario, nome: e.target.value })} />
            <Input type="email" placeholder="E-mail" value={novoUsuario.email} onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })} />
            <Input type="password" placeholder="Senha inicial" value={novoUsuario.password} onChange={(e) => setNovoUsuario({ ...novoUsuario, password: e.target.value })} />
            <Select value={novoUsuario.perfil} onValueChange={(perfil: UserRole) => setNovoUsuario({ ...novoUsuario, perfil })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Administrador</SelectItem><SelectItem value="gerente">Gerente</SelectItem><SelectItem value="funcionario">Funcionário</SelectItem><SelectItem value="recepcionista">Recepcionista</SelectItem></SelectContent></Select>
            <Select value={novoUsuario.departamento_id || "none"} onValueChange={(departamento_id) => setNovoUsuario({ ...novoUsuario, departamento_id: departamento_id === "none" ? "" : departamento_id, guiche_id: "" })}><SelectTrigger><SelectValue placeholder="Departamento" /></SelectTrigger><SelectContent><SelectItem value="none">Sem departamento</SelectItem>{departamentos.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent></Select>
            <Select value={novoUsuario.guiche_id || "none"} onValueChange={(guiche_id) => setNovoUsuario({ ...novoUsuario, guiche_id: guiche_id === "none" ? "" : guiche_id })}><SelectTrigger><SelectValue placeholder="Guichê" /></SelectTrigger><SelectContent><SelectItem value="none">Sem guichê</SelectItem>{guiches.filter((g) => !novoUsuario.departamento_id || g.departamento_id === novoUsuario.departamento_id).map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent></Select>
            <Button className="md:col-span-2" onClick={() => criarNovoUsuario.mutate()} disabled={!novoUsuario.email || novoUsuario.password.length < 6 || criarNovoUsuario.isPending}>Criar usuário</Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Vincule usuários existentes a perfil, departamento e guichê.</p>
          <div className="mt-4 space-y-3">
            {(usuarios.data ?? []).map((u: any) => (
              <div key={u.user_id} className="grid gap-3 rounded-lg bg-secondary p-4 md:grid-cols-[1.2fr_1fr_1fr_1fr] md:items-end">
                <div><p className="text-sm font-medium">{u.nome || u.user_id}</p><p className="text-xs text-muted-foreground">{u.user_id}</p></div>
                <Select value={u.perfil} onValueChange={(perfil) => editarUsuario.mutate({ user_id: u.user_id, patch: { perfil } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Administrador</SelectItem><SelectItem value="gerente">Gerente</SelectItem><SelectItem value="funcionario">Funcionário</SelectItem><SelectItem value="recepcionista">Recepcionista</SelectItem></SelectContent></Select>
                <Select value={u.departamento_id ?? "none"} onValueChange={(departamento_id) => editarUsuario.mutate({ user_id: u.user_id, patch: { departamento_id: departamento_id === "none" ? null : departamento_id, guiche_id: null } })}><SelectTrigger><SelectValue placeholder="Departamento" /></SelectTrigger><SelectContent><SelectItem value="none">Sem departamento</SelectItem>{departamentos.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent></Select>
                <Select value={u.guiche_id ?? "none"} onValueChange={(guiche_id) => editarUsuario.mutate({ user_id: u.user_id, patch: { guiche_id: guiche_id === "none" ? null : guiche_id } })}><SelectTrigger><SelectValue placeholder="Guichê" /></SelectTrigger><SelectContent><SelectItem value="none">Sem guichê</SelectItem>{guiches.filter((g) => !u.departamento_id || g.departamento_id === u.departamento_id).map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent></Select>
              </div>
            ))}
            {usuarios.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum perfil criado ainda.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
