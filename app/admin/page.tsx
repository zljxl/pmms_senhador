"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  useEffect(() => {
    if (config) {
      setTitulo(config.titulo);
      setBrasao(config.brasao_url ?? "");
      setFundo(config.fundo_url ?? "");
    }
  }, [config]);
  const invalidar = () => client.invalidateQueries();
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
                  <b>
                    {d.nome} · {d.modo === "lista" ? "lista" : `senha ${d.prefixo}`}
                  </b>
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
