"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDepartamentos, useGuiches, useSenhasDeHoje } from "@/hooks/use-senhas";
import {
  chamarProxima,
  emitirSenha,
  finalizar,
  rechamar,
  removerDaFila,
  rotuloChamada,
} from "@/lib/senhas";

export default function AtendimentoPage() {
  const client = useQueryClient();
  const [departamentoId, setDepartamentoId] = useState("");
  const [guiche, setGuiche] = useState("");
  const [nome, setNome] = useState("");
  const senhasConhecidas = useRef(new Set<string>());
  const { data: departamentos = [] } = useDepartamentos();
  const { data: guiches = [] } = useGuiches();
  const { data: senhas = [] } = useSenhasDeHoje();
  const ativos = useMemo(() => departamentos.filter((d) => d.ativo), [departamentos]);
  const dep = ativos.find((d) => d.id === departamentoId);
  const guichesDoDep = guiches.filter((g) => g.ativo && g.departamento_id === departamentoId);
  const doDep = senhas.filter((s) => s.departamento_id === departamentoId);
  const fila = doDep
    .filter((s) => s.status === "aguardando")
    .sort((a, b) => (a.ordem ?? 999999) - (b.ordem ?? 999999) || a.numero - b.numero);
  const atual = doDep.find((s) => s.status === "chamada" && s.guiche === guiche);
  const outros = doDep.filter((s) => s.status === "chamada" && s.guiche !== guiche);
  const chamadasAnteriores = doDep
    .filter((s) => s.called_at && s.id !== atual?.id)
    .sort((a, b) => +new Date(b.called_at ?? 0) - +new Date(a.called_at ?? 0))
    .slice(0, 12);
  const invalidar = () => client.invalidateQueries({ queryKey: ["senhas", "hoje"] });
  const semGuiche = !departamentoId || !guiche;

  useEffect(() => {
    const d = localStorage.getItem("departamento_id");
    const g = localStorage.getItem("guiche");
    if (d) setDepartamentoId(d);
    if (g) setGuiche(g);
  }, []);
  useEffect(() => {
    if (!departamentoId && ativos[0]) setDepartamentoId(ativos[0].id);
  }, [ativos, departamentoId]);
  useEffect(() => {
    if (departamentoId) localStorage.setItem("departamento_id", departamentoId);
  }, [departamentoId]);
  useEffect(() => {
    if (guiche) localStorage.setItem("guiche", guiche);
  }, [guiche]);
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "default") return;
    void Notification.requestPermission();
  }, []);
  useEffect(() => {
    const novas = fila.filter((senha) => !senhasConhecidas.current.has(senha.id));
    const primeiraCarga = senhasConhecidas.current.size === 0;
    fila.forEach((senha) => senhasConhecidas.current.add(senha.id));
    if (
      primeiraCarga ||
      !dep ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;
    novas.forEach((senha) => {
      new Notification(`Nova senha · ${dep.nome}`, {
        body: `${rotuloChamada(senha, dep)} entrou na fila.`,
        icon: "/municipal-crest.png",
        tag: `senha-${senha.id}`,
      });
    });
  }, [fila, dep]);

  const chamar = useMutation({
    mutationFn: (id?: string) => chamarProxima(departamentoId, guiche, id),
    onSuccess: (s) => {
      if (s) toast.success(`Chamando ${rotuloChamada(s, dep)}`);
      else toast.info("Ninguém aguardando");
      invalidar();
    },
    onError: () => toast.error("Não foi possível chamar"),
  });
  const repetir = useMutation({
    mutationFn: rechamar,
    onSuccess: () => {
      toast.success("Chamada enviada ao painel");
      invalidar();
    },
    onError: () => toast.error("Não foi possível rechamar"),
  });
  const adicionar = useMutation({
    mutationFn: () => emitirSenha(departamentoId, nome),
    onSuccess: () => {
      setNome("");
      toast.success("Pessoa adicionada à fila");
      invalidar();
    },
  });
  const chamarAgora = useMutation({
    mutationFn: async () => {
      const s = await emitirSenha(departamentoId, nome);
      return chamarProxima(departamentoId, guiche, s.id);
    },
    onSuccess: () => {
      setNome("");
      toast.success("Pessoa chamada agora");
      invalidar();
    },
  });
  const concluir = useMutation({
    mutationFn: (ausente: boolean) => (atual ? finalizar(atual.id, ausente) : Promise.resolve()),
    onSuccess: invalidar,
  });
  const remover = useMutation({ mutationFn: removerDaFila, onSuccess: invalidar });

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-2xl font-bold">Atendimento</h1>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Departamento</Label>
                  <Select value={departamentoId} onValueChange={setDepartamentoId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ativos.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Guichê</Label>
                  <Select value={guiche} onValueChange={setGuiche}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {guichesDoDep.map((g) => (
                        <SelectItem key={g.id} value={g.nome}>
                          {g.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-6 rounded-lg bg-panel p-6 text-panel-foreground">
                <p className="text-xs uppercase opacity-60">Em atendimento</p>
                <p className="mt-2 text-5xl font-bold">{atual ? rotuloChamada(atual, dep) : "—"}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button disabled={semGuiche} onClick={() => chamar.mutate()}>
                    Chamar próximo
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!atual}
                    onClick={() => atual && repetir.mutate(atual.id)}
                  >
                    Rechamar
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!atual}
                    onClick={() => concluir.mutate(window.confirm("Marcar como ausente?"))}
                  >
                    Finalizar
                  </Button>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-bold">Chamar uma pessoa agora</h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  className="min-w-0 flex-1"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome da pessoa"
                />
                <Button
                  className="w-full whitespace-nowrap sm:w-auto"
                  disabled={semGuiche || !nome.trim()}
                  onClick={() => chamarAgora.mutate()}
                >
                  Chamar agora
                </Button>
                <Button
                  className="w-full whitespace-nowrap sm:w-auto"
                  variant="outline"
                  disabled={!departamentoId || !nome.trim()}
                  onClick={() => adicionar.mutate()}
                >
                  Adicionar à fila
                </Button>
              </div>
            </div>
          </section>
          <section className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-bold">Fila de espera</h2>
              <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                {fila.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-col gap-2 rounded-md bg-secondary px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <b className="min-w-0 truncate">{rotuloChamada(s, dep)}</b>
                    <span className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={semGuiche}
                        onClick={() => chamar.mutate(s.id)}
                      >
                        Chamar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remover.mutate(s.id)}>
                        Remover
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-bold">Outros guichês</h2>
              <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto pr-1">
                {outros.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-col gap-1 rounded-md bg-secondary px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <b className="min-w-0 truncate">{rotuloChamada(s, dep)}</b>
                    <span>Guichê {s.guiche}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-bold">Pessoas já chamadas</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Escolha uma pessoa para anunciar novamente no painel.
              </p>
              <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                {chamadasAnteriores.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    Nenhuma pessoa chamada neste departamento.
                  </li>
                )}
                {chamadasAnteriores.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-col gap-2 rounded-md bg-secondary px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0">
                      <b>{rotuloChamada(s, dep)}</b>
                      <span className="ml-2 text-sm text-muted-foreground">Guichê {s.guiche}</span>
                    </span>
                    <Button
                      className="w-full shrink-0 sm:w-auto"
                      size="sm"
                      variant="outline"
                      disabled={repetir.isPending}
                      onClick={() => repetir.mutate(s.id)}
                    >
                      Chamar novamente
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
