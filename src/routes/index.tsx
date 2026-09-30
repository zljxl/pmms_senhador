import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { chamarProxima, emitirSenha, finalizar, rechamar, removerDaFila, rotuloChamada } from "@/lib/senhas";
import { supabase } from "@/integrations/supabase/client";
import { usePerfilUsuario } from "@/hooks/use-perfil";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Atendimento — Sistema de Senhas e Recepção" },
      {
        name: "description",
        content:
          "Escolha o departamento e o guichê, emita senhas ou chame pessoas da lista de nomes.",
      },
      { property: "og:title", content: "Atendimento — Sistema de Senhas e Recepção" },
      {
        property: "og:description",
        content: "Gestão da fila de atendimento presencial por departamento, em tempo real.",
      },
    ],
  }),
  component: Atendimento,
});

function Atendimento() {
  const [departamentoId, setDepartamentoId] = useState("");
  const [guiche, setGuiche] = useState("");
  const [nomePessoa, setNomePessoa] = useState("");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: departamentos = [] } = useDepartamentos();
  const { data: guiches = [] } = useGuiches();
  const { data: senhas = [], isLoading } = useSenhasDeHoje();
  const { data: perfil, isLoading: carregandoPerfil } = usePerfilUsuario();
  const podeRemover = !!perfil?.ativo && ["admin", "gerente", "funcionario", "recepcionista"].includes(perfil.perfil);

  const ativos = useMemo(() => departamentos.filter((d) => d.ativo), [departamentos]);
  const dep = ativos.find((d) => d.id === departamentoId);
  const modoLista = dep?.modo === "lista";
  const guichesDoDep = guiches.filter((g) => g.ativo && g.departamento_id === departamentoId);

  const guichesPermitidos = perfil?.guiche_id
    ? guichesDoDep.filter((g) => g.id === perfil.guiche_id)
    : guichesDoDep;

  useEffect(() => {
    const salvoDep = window.localStorage.getItem("departamento_id") ?? "";
    const salvoGuiche = window.localStorage.getItem("guiche") ?? "";
    if (salvoDep) setDepartamentoId(salvoDep);
    if (salvoGuiche) setGuiche(salvoGuiche);
  }, []);

  useEffect(() => {
    if (!departamentoId && ativos.length > 0) setDepartamentoId(ativos[0]!.id);
  }, [ativos, departamentoId]);

  useEffect(() => {
    if (perfil?.departamento_id) setDepartamentoId(perfil.departamento_id);
  }, [perfil?.departamento_id]);

  useEffect(() => {
    if (perfil?.guiche_id) {
      const guicheDoPerfil = guiches.find((g) => g.id === perfil.guiche_id);
      if (guicheDoPerfil) setGuiche(guicheDoPerfil.nome);
    }
  }, [perfil?.guiche_id, guiches]);

  useEffect(() => {
    if (departamentoId) window.localStorage.setItem("departamento_id", departamentoId);
  }, [departamentoId]);

  useEffect(() => {
    if (guiche) window.localStorage.setItem("guiche", guiche);
  }, [guiche]);

  useEffect(() => {
    if (guiche && !guichesDoDep.some((g) => g.nome === guiche)) setGuiche("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departamentoId, guiches.length]);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["senhas", "hoje"] });

  const emitir = useMutation({
    mutationFn: () => emitirSenha(departamentoId, nomePessoa),
    onSuccess: (senha) => {
      toast.success(`${rotuloChamada(senha, dep)} adicionado(a) à fila`);
      setNomePessoa("");
      invalidar();
    },
    onError: () => toast.error("Não foi possível emitir a senha"),
  });

  const chamar = useMutation({
    mutationFn: (id?: string) => chamarProxima(departamentoId, guiche, id),
    onSuccess: (senha) => {
      if (!senha) toast.info("Não há ninguém na fila deste departamento");
      else toast.success(`Chamando ${rotuloChamada(senha, dep)} no guichê ${senha.guiche}`);
      invalidar();
    },
    onError: () => toast.error("Não foi possível chamar"),
  });

  const acaoRechamar = useMutation({
    mutationFn: rechamar,
    onSuccess: () => {
      toast.success("Chamada repetida no painel");
      invalidar();
    },
  });

  const acaoFinalizar = useMutation({
    mutationFn: ({ id, ausente }: { id: string; ausente: boolean }) => finalizar(id, ausente),
    onSuccess: (_data, { ausente }) => {
      toast.success(ausente ? "Pessoa marcada como ausente" : "Atendimento finalizado");
      invalidar();
    },
  });

  const acaoRemover = useMutation({
    mutationFn: removerDaFila,
    onSuccess: () => {
      toast.success("Item removido da fila");
      invalidar();
    },
    onError: () => toast.error("Não foi possível remover da fila"),
  });

  const doDep = senhas.filter((s) => s.departamento_id === departamentoId);
  const aguardando = doDep.filter((s) => s.status === "aguardando");
  const filaOrdenada = [...aguardando].sort((a, b) => a.numero - b.numero);
  const minhaSenha = doDep.find((s) => s.status === "chamada" && s.guiche === guiche);
  const outrosGuiches = doDep.filter((s) => s.status === "chamada" && s.guiche !== guiche);
  const semGuiche = guiche.trim().length === 0 || !departamentoId;

  async function reordenar(id: string) {
    if (!arrastando || arrastando === id) return;
    const ids = filaOrdenada.map((s) => s.id);
    const de = ids.indexOf(arrastando); const para = ids.indexOf(id);
    ids.splice(de, 1); ids.splice(para, 0, arrastando);
    await Promise.all(ids.map((senhaId, ordem) => supabase.from("senhas").update({ ordem }).eq("id", senhaId)));
    setArrastando(null); invalidar();
  }

  if (carregandoPerfil) return <div className="grid min-h-screen place-items-center">Carregando seu guichê...</div>;

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold">Atendimento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o departamento e o seu guichê para chamar as pessoas da fila.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <section className="rounded-xl border border-border bg-card p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Departamento</Label>
                <Select value={departamentoId} onValueChange={setDepartamentoId} disabled={!!perfil?.departamento_id}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ativos.filter((d) => !perfil?.departamento_id || d.id === perfil.departamento_id).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Meu guichê</Label>
                <Select value={guiche} onValueChange={setGuiche} disabled={!!perfil?.guiche_id}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {guichesPermitidos.map((g) => (
                      <SelectItem key={g.id} value={g.nome}>
                        {g.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {guichesPermitidos.length === 0 && departamentoId && (
                  <p className="mt-2 text-xs text-accent">
                    Nenhum guichê cadastrado neste departamento.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-lg bg-panel p-6 text-panel-foreground">
              <p className="text-xs uppercase tracking-widest text-panel-foreground/60">
                Em atendimento no seu guichê
              </p>
              <p className="mt-2 font-display text-5xl font-bold">
                {minhaSenha ? rotuloChamada(minhaSenha, dep) : "—"}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  onClick={() => chamar.mutate(undefined)}
                  disabled={semGuiche || chamar.isPending}
                  size="lg"
                >
                  Chamar próximo
                </Button>
                <Button
                  variant="secondary"
                  disabled={!minhaSenha || acaoRechamar.isPending}
                  onClick={() => minhaSenha && acaoRechamar.mutate(minhaSenha.id)}
                >
                  Rechamar
                </Button>
                <Button
                  variant="secondary"
                  disabled={!minhaSenha || acaoFinalizar.isPending}
                  onClick={() => {
                    if (!minhaSenha) return;
                    const ausente = window.confirm(
                      "A pessoa estava ausente?\n\nOK: marcar como ausente\nCancelar: finalizar como atendida.",
                    );
                    acaoFinalizar.mutate({ id: minhaSenha.id, ausente });
                  }}
                >
                  Finalizar
                </Button>
              </div>
              {semGuiche && (
                <p className="mt-3 text-xs text-accent">Escolha departamento e guichê.</p>
              )}
            </div>

            <div className="mt-6 rounded-lg border border-dashed border-border p-4">
              <p className="text-sm font-medium">
                {modoLista ? "Adicionar pessoa à lista" : "Emitir senha na recepção"}
              </p>
              <p className="text-xs text-muted-foreground">
                {modoLista
                  ? "Informe o nome de quem será chamado."
                  : "Gera o próximo número da fila deste departamento."}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {modoLista && (
                  <Input
                    value={nomePessoa}
                    onChange={(e) => setNomePessoa(e.target.value)}
                    placeholder="Nome da pessoa"
                    className="max-w-xs"
                  />
                )}
                <Button
                  variant="outline"
                  onClick={() => emitir.mutate()}
                  disabled={
                    !departamentoId ||
                    emitir.isPending ||
                    (modoLista && nomePessoa.trim().length === 0)
                  }
                >
                  {modoLista ? "Adicionar" : "Nova senha"}
                </Button>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-bold">Fila de espera</h2>
                <span className="text-sm text-muted-foreground">
                  {aguardando.length} aguardando
                </span>
              </div>
              <ul className="mt-4 space-y-2">
                {isLoading && <li className="text-sm text-muted-foreground">Carregando…</li>}
                {!isLoading && aguardando.length === 0 && (
                  <li className="text-sm text-muted-foreground">Ninguém aguardando.</li>
                )}
                {filaOrdenada.map((s, i) => (
                  <li
                    key={s.id}
                    draggable
                    onDragStart={() => setArrastando(s.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => void reordenar(s.id)}
                    className={`flex cursor-grab items-center justify-between rounded-md px-3 py-2 text-sm ${
                      i === 0
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    <span className="font-display font-bold">{rotuloChamada(s, dep)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={semGuiche || chamar.isPending}
                      onClick={() => chamar.mutate(s.id)}
                    >
                      Chamar
                    </Button>
                    {podeRemover && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={acaoRemover.isPending}
                        onClick={() => {
                          if (window.confirm(`Remover ${rotuloChamada(s, dep)} da fila?`)) {
                            acaoRemover.mutate(s.id);
                          }
                        }}
                      >
                        Remover
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-base font-bold">Em atendimento nos outros guichês</h2>
              <ul className="mt-4 space-y-2">
                {outrosGuiches.length === 0 && (
                  <li className="text-sm text-muted-foreground">Nenhum outro guichê atendendo.</li>
                )}
                {outrosGuiches.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-sm"
                  >
                    <span className="font-display font-bold">{rotuloChamada(s, dep)}</span>
                    <span className="text-muted-foreground">Guichê {s.guiche}</span>
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
