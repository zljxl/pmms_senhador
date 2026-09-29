import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDepartamentos, useSenhasDeHoje } from "@/hooks/use-senhas";
import {
  emitirSenha,
  extrairNomes,
  formatarSenha,
  importarNomes,
  rotuloChamada,
} from "@/lib/senhas";

export const Route = createFileRoute("/recepcao")({
  head: () => ({
    meta: [
      { title: "Recepção — Sistema de Senhas e Recepção" },
      {
        name: "description",
        content:
          "Módulo de recepção: emita senhas para qualquer departamento e importe listas de nomes para chamada.",
      },
      { property: "og:title", content: "Recepção — Sistema de Senhas e Recepção" },
      {
        property: "og:description",
        content: "Emissão de senhas e importação de listas de nomes por departamento.",
      },
    ],
  }),
  component: Recepcao,
});

function Recepcao() {
  const queryClient = useQueryClient();
  const { data: departamentos = [] } = useDepartamentos();
  const { data: senhas = [] } = useSenhasDeHoje();

  const ativos = useMemo(() => departamentos.filter((d) => d.ativo), [departamentos]);

  const [departamentoId, setDepartamentoId] = useState("");
  const [nome, setNome] = useState("");
  const [lista, setLista] = useState("");
  const [depImport, setDepImport] = useState("");
  const inputArquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!departamentoId && ativos.length > 0) setDepartamentoId(ativos[0]!.id);
    if (!depImport && ativos.length > 0) setDepImport(ativos[0]!.id);
  }, [ativos, departamentoId, depImport]);

  const dep = ativos.find((d) => d.id === departamentoId);
  const depDaImportacao = ativos.find((d) => d.id === depImport);
  const modoLista = dep?.modo === "lista";

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["senhas", "hoje"] });

  const emitir = useMutation({
    mutationFn: () => emitirSenha(departamentoId, nome),
    onSuccess: (senha) => {
      toast.success(`${rotuloChamada(senha, dep)} registrado(a) em ${dep?.nome ?? ""}`);
      setNome("");
      invalidar();
    },
    onError: () => toast.error("Não foi possível registrar a chegada"),
  });

  const nomesDaLista = extrairNomes(lista);

  const importar = useMutation({
    mutationFn: () => importarNomes(depImport, nomesDaLista),
    onSuccess: ({ criados, erros }) => {
      toast.success(
        `${criados} nome(s) adicionados à fila${erros > 0 ? ` · ${erros} com erro` : ""}`,
      );
      setLista("");
      if (inputArquivo.current) inputArquivo.current.value = "";
      invalidar();
    },
    onError: () => toast.error("Não foi possível importar a lista"),
  });

  async function lerArquivo(file: File) {
    const texto = await file.text();
    setLista((atual) => (atual.trim() ? `${atual.trim()}\n${texto}` : texto));
  }

  const emitidasHoje = senhas
    .filter((s) => !departamentoId || s.departamento_id === departamentoId)
    .slice(-12)
    .reverse();

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold">Recepção</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre a chegada das pessoas e direcione para o departamento certo.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-bold">Registrar chegada</h2>
            <div className="mt-4 space-y-4">
              <div>
                <Label>Departamento de destino</Label>
                <Select value={departamentoId} onValueChange={setDepartamentoId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ativos.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome} · {d.modo === "lista" ? "chamada por nome" : "chamada por senha"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Nome da pessoa {modoLista ? "" : "(opcional)"}</Label>
                <Input
                  className="mt-2"
                  value={nome}
                  maxLength={80}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Maria Souza"
                />
              </div>

              <Button
                size="lg"
                onClick={() => emitir.mutate()}
                disabled={
                  !departamentoId || emitir.isPending || (modoLista && nome.trim().length === 0)
                }
              >
                {modoLista ? "Adicionar à lista" : "Emitir senha"}
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-bold">Importar lista de nomes</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Cole os nomes (um por linha) ou envie um arquivo CSV/TXT. No CSV é usada a primeira
              coluna.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <Label>Departamento</Label>
                <Select value={depImport} onValueChange={setDepImport}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ativos.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {depDaImportacao && depDaImportacao.modo !== "lista" && (
                  <p className="mt-2 text-xs text-accent">
                    Este departamento chama por senha; os nomes entrarão na fila com número.
                  </p>
                )}
              </div>

              <Textarea
                rows={8}
                value={lista}
                onChange={(e) => setLista(e.target.value)}
                placeholder={"Maria Souza\nJoão Lima\nAna Pereira"}
              />

              <div className="flex flex-wrap items-center gap-3">
                <Input
                  ref={inputArquivo}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="max-w-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void lerArquivo(file);
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  {nomesDaLista.length} nome(s) pronto(s)
                </span>
              </div>

              <Button
                onClick={() => importar.mutate()}
                disabled={!depImport || nomesDaLista.length === 0 || importar.isPending}
              >
                {importar.isPending ? "Importando…" : "Importar para a fila"}
              </Button>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-bold">Últimos registros de hoje</h2>
          <ul className="mt-4 space-y-2">
            {emitidasHoje.length === 0 && (
              <li className="text-sm text-muted-foreground">Nenhum registro ainda.</li>
            )}
            {emitidasHoje.map((s) => {
              const d = departamentos.find((x) => x.id === s.departamento_id);
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-secondary px-3 py-2 text-sm"
                >
                  <span className="font-display font-bold">
                    {formatarSenha(s.numero, d?.prefixo ?? "A")}
                    {s.nome ? ` · ${s.nome}` : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {d?.nome ?? "—"} · {s.status}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
