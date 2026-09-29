import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AppNav } from "@/components/AppNav";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDepartamentos, useSenhasDeHoje } from "@/hooks/use-senhas";
import { rotuloChamada, type Senha } from "@/lib/senhas";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios do dia — Senhas e Recepção" },
      {
        name: "description",
        content:
          "Atendimentos por departamento e guichê, tempo médio de espera e fila restante do dia.",
      },
      { property: "og:title", content: "Relatórios do dia — Senhas e Recepção" },
      {
        property: "og:description",
        content: "Acompanhe o volume de atendimentos por departamento e o tempo médio de espera.",
      },
    ],
  }),
  component: Relatorios,
});

function minutosEntre(inicio: string, fim: string) {
  return (new Date(fim).getTime() - new Date(inicio).getTime()) / 60000;
}

function media(valores: number[]) {
  if (valores.length === 0) return 0;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

function formatarMinutos(min: number) {
  if (min <= 0) return "—";
  const m = Math.floor(min);
  const s = Math.round((min - m) * 60);
  return `${m}min ${String(s).padStart(2, "0")}s`;
}

function porGuiche(senhas: Senha[]) {
  const mapa = new Map<string, number>();
  for (const s of senhas) {
    if (s.status !== "atendida" || !s.guiche) continue;
    mapa.set(s.guiche, (mapa.get(s.guiche) ?? 0) + 1);
  }
  return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
}

function Relatorios() {
  const { data: todas = [] } = useSenhasDeHoje(10000);
  const { data: departamentos = [] } = useDepartamentos();
  const [filtro, setFiltro] = useState("todos");

  const dep = departamentos.find((d) => d.id === filtro);
  const senhas = filtro === "todos" ? todas : todas.filter((s) => s.departamento_id === filtro);

  const emitidas = senhas.length;
  const atendidas = senhas.filter((s) => s.status === "atendida").length;
  const aguardando = senhas.filter((s) => s.status === "aguardando").length;

  const esperas = senhas
    .filter((s) => s.called_at)
    .map((s) => minutosEntre(s.created_at, s.called_at!));
  const atendimentos = senhas
    .filter((s) => s.called_at && s.finished_at)
    .map((s) => minutosEntre(s.called_at!, s.finished_at!));

  const ultima = [...senhas].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];

  const cards = [
    { label: "Senhas emitidas hoje", valor: String(emitidas) },
    { label: "Atendimentos concluídos", valor: String(atendidas) },
    { label: "Ainda na fila", valor: String(aguardando) },
    { label: "Tempo médio de espera", valor: formatarMinutos(media(esperas)) },
    { label: "Tempo médio de atendimento", valor: formatarMinutos(media(atendimentos)) },
    {
      label: "Última emissão",
      valor: ultima
        ? rotuloChamada(ultima, departamentos.find((d) => d.id === ultima.departamento_id))
        : "—",
    },
  ];

  const guiches = porGuiche(senhas);

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Relatórios do dia</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Números atualizados automaticamente com base nas senhas de hoje.
            </p>
          </div>
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
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="mt-2 font-display text-3xl font-bold">{c.valor}</p>
            </div>
          ))}
        </div>

        {filtro === "todos" && (
          <section className="mt-8 rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-bold">Atendimentos por departamento</h2>
            <ul className="mt-4 space-y-2">
              {departamentos.map((d) => {
                const doDep = todas.filter((s) => s.departamento_id === d.id);
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded-md bg-secondary px-4 py-3 text-sm"
                  >
                    <span className="font-medium">{d.nome}</span>
                    <span className="text-muted-foreground">
                      {doDep.filter((s) => s.status === "atendida").length} atendido(s) ·{" "}
                      {doDep.length} emitido(s)
                    </span>
                  </li>
                );
              })}
              {departamentos.length === 0 && (
                <li className="text-sm text-muted-foreground">Nenhum departamento cadastrado.</li>
              )}
            </ul>
          </section>
        )}

        <section className="mt-8 rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-bold">
            Atendimentos por guichê{dep ? ` — ${dep.nome}` : ""}
          </h2>
          <ul className="mt-4 space-y-2">
            {guiches.length === 0 && (
              <li className="text-sm text-muted-foreground">Nenhum atendimento concluído ainda.</li>
            )}
            {guiches.map(([guiche, total]) => (
              <li
                key={guiche}
                className="flex items-center justify-between rounded-md bg-secondary px-4 py-3 text-sm"
              >
                <span className="font-medium">Guichê {guiche}</span>
                <span className="text-muted-foreground">{total} atendimento(s)</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
