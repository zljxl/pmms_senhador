"use client";

import { useState } from "react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDepartamentos, useSenhasDeHoje } from "@/hooks/use-senhas";
import { rotuloChamada, type Senha } from "@/lib/senhas";

const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const minutos = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;
const tempo = (v: number) =>
  v > 0 ? `${Math.floor(v)}min ${String(Math.round((v % 1) * 60)).padStart(2, "0")}s` : "—";
function porGuiche(senhas: Senha[]) {
  const mapa = new Map<string, number>();
  senhas
    .filter((s) => s.status === "atendida" && s.guiche)
    .forEach((s) => mapa.set(s.guiche!, (mapa.get(s.guiche!) ?? 0) + 1));
  return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
}

export default function RelatoriosPage() {
  const { data: todas = [] } = useSenhasDeHoje(10000);
  const { data: departamentos = [] } = useDepartamentos();
  const [filtro, setFiltro] = useState("todos");
  const senhas = filtro === "todos" ? todas : todas.filter((s) => s.departamento_id === filtro);
  const dep = departamentos.find((d) => d.id === filtro);
  const esperas = senhas.filter((s) => s.called_at).map((s) => minutos(s.created_at, s.called_at!));
  const atendimentos = senhas
    .filter((s) => s.called_at && s.finished_at)
    .map((s) => minutos(s.called_at!, s.finished_at!));
  const ultima = [...senhas].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];
  const cards = [
    ["Senhas emitidas hoje", senhas.length],
    ["Atendimentos concluídos", senhas.filter((s) => s.status === "atendida").length],
    ["Ainda na fila", senhas.filter((s) => s.status === "aguardando").length],
    ["Tempo médio de espera", tempo(media(esperas))],
    ["Tempo médio de atendimento", tempo(media(atendimentos))],
    [
      "Última emissão",
      ultima
        ? rotuloChamada(
            ultima,
            departamentos.find((d) => d.id === ultima.departamento_id),
          )
        : "—",
    ],
  ];
  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Relatórios do dia</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Indicadores atualizados com as senhas de hoje.
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={filtro} onValueChange={setFiltro}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os departamentos</SelectItem>
                {departamentos.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => window.print()}>Imprimir</Button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(([label, valor]) => (
            <div key={String(label)} className="rounded-xl border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 font-display text-3xl font-bold">{valor}</p>
            </div>
          ))}
        </div>
        <section className="mt-8 rounded-xl border border-border bg-card p-6">
          <h2 className="font-bold">Atendimentos por guichê{dep ? ` — ${dep.nome}` : ""}</h2>
          <ul className="mt-4 space-y-2">
            {porGuiche(senhas).map(([g, total]) => (
              <li key={g} className="flex justify-between rounded-md bg-secondary px-4 py-3">
                <b>Guichê {g}</b>
                <span>{total} atendimento(s)</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
