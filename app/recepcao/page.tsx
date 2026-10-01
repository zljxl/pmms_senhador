"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

export default function RecepcaoPage() {
  const client = useQueryClient();
  const { data: departamentos = [] } = useDepartamentos();
  const { data: senhas = [] } = useSenhasDeHoje();
  const ativos = useMemo(() => departamentos.filter((d) => d.ativo), [departamentos]);
  const [departamentoId, setDepartamentoId] = useState("");
  const [nome, setNome] = useState("");
  const [lista, setLista] = useState("");
  const [depImport, setDepImport] = useState("");
  const inputArquivo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!departamentoId && ativos[0]) setDepartamentoId(ativos[0].id);
    if (!depImport && ativos[0]) setDepImport(ativos[0].id);
  }, [ativos, departamentoId, depImport]);
  const dep = ativos.find((d) => d.id === departamentoId);
  const depImportado = ativos.find((d) => d.id === depImport);
  const nomes = extrairNomes(lista);
  const invalidar = () => client.invalidateQueries({ queryKey: ["senhas", "hoje"] });
  const emitir = useMutation({
    mutationFn: () => emitirSenha(departamentoId, nome),
    onSuccess: (s) => {
      toast.success(`${rotuloChamada(s, dep)} registrado(a)`);
      setNome("");
      invalidar();
    },
    onError: () => toast.error("Não foi possível registrar a chegada"),
  });
  const importar = useMutation({
    mutationFn: () => importarNomes(depImport, nomes),
    onSuccess: ({ criados, erros }) => {
      toast.success(`${criados} nome(s) adicionados${erros ? ` · ${erros} com erro` : ""}`);
      setLista("");
      if (inputArquivo.current) inputArquivo.current.value = "";
      invalidar();
    },
    onError: () => toast.error("Não foi possível importar a lista"),
  });
  const emitidas = senhas
    .filter((s) => !departamentoId || s.departamento_id === departamentoId)
    .slice(-12)
    .reverse();
  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold">Recepção</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre chegadas e importe listas de pessoas.
        </p>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-bold">Registrar chegada</h2>
            <div className="mt-4 space-y-4">
              <div>
                <Label>Departamento</Label>
                <Select value={departamentoId} onValueChange={setDepartamentoId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ativos.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome} · {d.modo === "lista" ? "por nome" : "por senha"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome {dep?.modo === "lista" ? "" : "(opcional)"}</Label>
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
                disabled={
                  !departamentoId || emitir.isPending || (dep?.modo === "lista" && !nome.trim())
                }
                onClick={() => emitir.mutate()}
              >
                {dep?.modo === "lista" ? "Adicionar à lista" : "Emitir senha"}
              </Button>
            </div>
          </section>
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-bold">Importar lista de nomes</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Cole nomes, um por linha, ou envie CSV/TXT.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <Label>Departamento</Label>
                <Select value={depImport} onValueChange={setDepImport}>
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
                {depImportado?.modo !== "lista" && (
                  <p className="mt-2 text-xs text-accent">Este departamento chama por senha.</p>
                )}
              </div>
              <Textarea
                rows={8}
                value={lista}
                onChange={(e) => setLista(e.target.value)}
                placeholder={"Maria Souza\nJoão Lima\nAna Pereira"}
              />
              <div className="flex items-center gap-3">
                <Input
                  ref={inputArquivo}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void f.text().then(setLista);
                  }}
                />
                <span className="text-xs text-muted-foreground">{nomes.length} nome(s)</span>
              </div>
              <Button
                disabled={!depImport || !nomes.length || importar.isPending}
                onClick={() => importar.mutate()}
              >
                {importar.isPending ? "Importando..." : "Importar"}
              </Button>
            </div>
          </section>
        </div>
        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <h2 className="font-bold">Últimos registros</h2>
          <ul className="mt-4 space-y-2">
            {emitidas.map((s) => {
              const d = departamentos.find((x) => x.id === s.departamento_id);
              return (
                <li
                  key={s.id}
                  className="flex justify-between rounded-md bg-secondary px-3 py-2 text-sm"
                >
                  <b>
                    {formatarSenha(s.numero, d?.prefixo ?? "A")}
                    {s.nome ? ` · ${s.nome}` : ""}
                  </b>
                  <span>
                    {d?.nome} · {s.status}
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
