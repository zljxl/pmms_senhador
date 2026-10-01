"use client";

import { useEffect, useState } from "react";
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
import {
  atualizarDepartamento,
  atualizarGuiche,
  criarDepartamento,
  criarGuiche,
  salvarPainelConfig,
} from "@/lib/senhas";
import { criarUsuario, excluirUsuario, roleLabels, type UserRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export default function AdminPage() {
  const client = useQueryClient();
  const { data: departamentos = [] } = useDepartamentos();
  const { data: guiches = [] } = useGuiches();
  const { data: config } = usePainelConfig();
  const [nome, setNome] = useState("");
  const [prefixo, setPrefixo] = useState("A");
  const [modo, setModo] = useState("senha");
  const [depId, setDepId] = useState("");
  const [guiche, setGuiche] = useState("");
  const [titulo, setTitulo] = useState("");
  const [brasao, setBrasao] = useState("");
  const [fundo, setFundo] = useState("");
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [emailUsuario, setEmailUsuario] = useState("");
  const [senhaUsuario, setSenhaUsuario] = useState("");
  const [perfilUsuario, setPerfilUsuario] = useState<UserRole>("funcionario");
  const [departamentoUsuario, setDepartamentoUsuario] = useState("");
  const [guicheUsuario, setGuicheUsuario] = useState("");
  const [editando, setEditando] = useState<{
    tipo: "departamento" | "guiche";
    id: string;
    nome: string;
  } | null>(null);
  useEffect(() => {
    if (config) {
      setTitulo(config.titulo);
      setBrasao(config.brasao_url ?? "");
      setFundo(config.fundo_url ?? "");
    }
  }, [config]);
  const invalidar = () => client.invalidateQueries();
  const {
    data: usuarios = [],
    isLoading: carregandoUsuarios,
    error: erroUsuarios,
  } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Sessão expirada. Faça login novamente.");

      // A tabela ainda não está incluída nos tipos gerados do Supabase.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("perfis_usuarios" as never) as any)
        .select("user_id, nome, perfil, departamento_id, guiche_id, ativo")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data as Array<{
        user_id: string;
        nome: string;
        perfil: UserRole;
        departamento_id: string | null;
        guiche_id: string | null;
        ativo: boolean;
      }>;
    },
  });
  const novoDep = useMutation({
    mutationFn: () => criarDepartamento({ nome, prefixo, modo }),
    onSuccess: () => {
      toast.success("Departamento criado");
      setNome("");
      invalidar();
    },
    onError: () => toast.error("Não foi possível criar"),
  });
  const novoGuiche = useMutation({
    mutationFn: () => criarGuiche({ departamento_id: depId, nome: guiche }),
    onSuccess: () => {
      toast.success("Guichê criado");
      setGuiche("");
      invalidar();
    },
    onError: () => toast.error("Não foi possível criar"),
  });
  const novoUsuario = useMutation({
    mutationFn: async () => {
      const { error } = await criarUsuario({
        nome: nomeUsuario.trim(),
        email: emailUsuario.trim(),
        password: senhaUsuario,
        perfil: perfilUsuario,
        departamento_id: departamentoUsuario || null,
        guiche_id: guicheUsuario || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário criado");
      setNomeUsuario("");
      setEmailUsuario("");
      setSenhaUsuario("");
      setPerfilUsuario("funcionario");
      setDepartamentoUsuario("");
      setGuicheUsuario("");
      invalidar();
    },
    onError: () => toast.error("Não foi possível criar o usuário"),
  });
  const apagarUsuario = useMutation({
    mutationFn: (userId: string) => excluirUsuario(userId),
    onSuccess: ({ error }) => {
      if (error) {
        toast.error("Não foi possível apagar o usuário");
        return;
      }
      toast.success("Usuário apagado");
      client.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: () => toast.error("Não foi possível apagar o usuário"),
  });
  const salvar = useMutation({
    mutationFn: () =>
      salvarPainelConfig(config?.id, {
        titulo: titulo.trim() || "Painel de Chamada",
        brasao_url: brasao || null,
        fundo_url: fundo || null,
      }),
    onSuccess: () => {
      toast.success("Configuração salva");
      invalidar();
    },
  });
  const salvarNome = async () => {
    if (!editando?.nome.trim()) return;
    try {
      if (editando.tipo === "departamento")
        await atualizarDepartamento(editando.id, { nome: editando.nome.trim() });
      else await atualizarGuiche(editando.id, { nome: editando.nome.trim() });
      setEditando(null);
      toast.success("Nome atualizado");
      invalidar();
    } catch {
      toast.error("Não foi possível atualizar o nome");
    }
  };
  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold">Departamentos e guichês</h1>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-bold">Novo departamento</h2>
            <div className="mt-4 grid gap-3">
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do departamento"
              />
              <Input
                value={prefixo}
                onChange={(e) => setPrefixo(e.target.value)}
                maxLength={4}
                placeholder="Prefixo"
              />
              <Select value={modo} onValueChange={setModo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="senha">Chamada por senha</SelectItem>
                  <SelectItem value="lista">Chamada por lista de nomes</SelectItem>
                </SelectContent>
              </Select>
              <Button disabled={!nome.trim() || novoDep.isPending} onClick={() => novoDep.mutate()}>
                Criar departamento
              </Button>
            </div>
          </section>
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-bold">Novo guichê</h2>
            <div className="mt-4 grid gap-3">
              <Select value={depId} onValueChange={setDepId}>
                <SelectTrigger>
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departamentos.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={guiche}
                onChange={(e) => setGuiche(e.target.value)}
                placeholder="Nome ou número do guichê"
              />
              <Button
                disabled={!depId || !guiche.trim() || novoGuiche.isPending}
                onClick={() => novoGuiche.mutate()}
              >
                Criar guichê
              </Button>
            </div>
          </section>
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-bold">Criar usuário</h2>
            <div className="mt-4 grid gap-3">
              <Input
                value={nomeUsuario}
                onChange={(e) => setNomeUsuario(e.target.value)}
                placeholder="Nome completo"
              />
              <Input
                type="email"
                value={emailUsuario}
                onChange={(e) => setEmailUsuario(e.target.value)}
                placeholder="E-mail"
              />
              <Input
                type="password"
                value={senhaUsuario}
                onChange={(e) => setSenhaUsuario(e.target.value)}
                placeholder="Senha de acesso"
              />
              <Select
                value={perfilUsuario}
                onValueChange={(value) => setPerfilUsuario(value as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(roleLabels) as UserRole[]).map((perfil) => (
                    <SelectItem key={perfil} value={perfil}>
                      {roleLabels[perfil]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={departamentoUsuario}
                onValueChange={(value) => {
                  setDepartamentoUsuario(value);
                  setGuicheUsuario("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Departamento (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {departamentos.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={guicheUsuario}
                onValueChange={setGuicheUsuario}
                disabled={!departamentoUsuario}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Guichê (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {guiches
                    .filter((g) => g.departamento_id === departamentoUsuario)
                    .map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                disabled={
                  !nomeUsuario.trim() ||
                  !emailUsuario.trim() ||
                  senhaUsuario.length < 6 ||
                  novoUsuario.isPending
                }
                onClick={() => novoUsuario.mutate()}
              >
                Criar usuário
              </Button>
            </div>
          </section>
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-bold">Usuários cadastrados</h2>
            <ul className="mt-4 space-y-2">
              {carregandoUsuarios && (
                <li className="text-sm text-muted-foreground">Carregando usuarios...</li>
              )}
              {erroUsuarios && (
                <li className="text-sm text-destructive">
                  Nao foi possivel carregar os usuarios. Verifique sua sessao e tente novamente.
                </li>
              )}
              {!carregandoUsuarios && !erroUsuarios && usuarios.length === 0 && (
                <li className="text-sm text-muted-foreground">Nenhum usuario cadastrado.</li>
              )}
              {usuarios.map((usuario) => {
                const departamento = departamentos.find((d) => d.id === usuario.departamento_id);
                const guicheDoUsuario = guiches.find((g) => g.id === usuario.guiche_id);
                return (
                  <li
                    key={usuario.user_id}
                    className="flex items-center justify-between gap-3 rounded-md bg-secondary px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{usuario.nome || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">
                        {roleLabels[usuario.perfil]} ·{" "}
                        {departamento?.nome ?? "Todos os departamentos"}
                        {guicheDoUsuario ? ` · Guichê ${guicheDoUsuario.nome}` : ""}
                        {!usuario.ativo ? " · Inativo" : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={apagarUsuario.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Apagar o usuário ${usuario.nome || "sem nome"}? Essa ação não pode ser desfeita.`,
                          )
                        ) {
                          apagarUsuario.mutate(usuario.user_id);
                        }
                      }}
                    >
                      Apagar
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
            <h2 className="font-bold">Aparência do painel</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título"
              />
              <Input
                value={brasao}
                onChange={(e) => setBrasao(e.target.value)}
                placeholder="URL do brasão"
              />
              <Input
                value={fundo}
                onChange={(e) => setFundo(e.target.value)}
                placeholder="URL do fundo"
              />
            </div>
            <Button className="mt-3" onClick={() => salvar.mutate()}>
              Salvar aparência
            </Button>
          </section>
        </div>
        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <h2 className="font-bold">Cadastrados</h2>
          <div className="mt-4 space-y-3">
            {departamentos.map((d) => (
              <div key={d.id} className="rounded-lg bg-secondary p-4">
                <div className="flex justify-between">
                  <Input
                    className="h-8 max-w-xs font-semibold"
                    defaultValue={d.nome}
                    aria-label="Nome do departamento"
                    onBlur={async (event) => {
                      const nomeAtualizado = event.target.value.trim();
                      if (nomeAtualizado && nomeAtualizado !== d.nome) {
                        await atualizarDepartamento(d.id, { nome: nomeAtualizado });
                        invalidar();
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                  <b className="hidden">
                    {d.nome} · {d.modo === "lista" ? "lista" : `senha ${d.prefixo}`}
                  </b>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="hidden"
                    onClick={async () => {
                      const novoNome = window.prompt("Novo nome do departamento", d.nome)?.trim();
                      if (novoNome && novoNome !== d.nome)
                        await atualizarDepartamento(d.id, { nome: novoNome }).then(invalidar);
                    }}
                  >
                    Editar nome
                  </Button>
                  <span className="flex items-center gap-2 text-sm">
                    Ativo{" "}
                    <Switch
                      checked={d.ativo}
                      onCheckedChange={(ativo) =>
                        atualizarDepartamento(d.id, { ativo }).then(invalidar)
                      }
                    />
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {guiches
                    .filter((g) => g.departamento_id === d.id)
                    .map((g) => (
                      <span key={g.id} className="rounded bg-card px-2 py-1 text-xs">
                        <button
                          className="mr-1 text-primary"
                          onClick={async () => {
                            const novoNome = window.prompt("Novo nome do guichê", g.nome)?.trim();
                            if (novoNome && novoNome !== g.nome)
                              await atualizarGuiche(g.id, { nome: novoNome }).then(invalidar);
                          }}
                        >
                          editar
                        </button>{" "}
                        Guichê {g.nome}{" "}
                        <button
                          className="ml-1 text-destructive"
                          onClick={() => atualizarGuiche(g.id, { ativo: !g.ativo }).then(invalidar)}
                        >
                          {g.ativo ? "desativar" : "ativar"}
                        </button>
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
