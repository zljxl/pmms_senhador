"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDepartamentos, useGuiches, usePainelConfig, useSenhasDeHoje } from "@/hooks/use-senhas";
import { rotuloChamada, type Departamento, type Guiche, type Senha } from "@/lib/senhas";
import { announce } from "@/services/tts";

function horaDe(s: Senha) {
  return s.called_at
    ? new Date(s.called_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "";
}

export function PainelClient() {
  const { data: senhas = [] } = useSenhasDeHoje(2000);
  const { data: departamentos = [] } = useDepartamentos();
  const { data: guiches = [] } = useGuiches();
  const { data: config } = usePainelConfig();
  const [dateTime, setDateTime] = useState("");
  const [audioLiberado, setAudioLiberado] = useState(false);
  const ultimaChamadaAnunciada = useRef<string | null>(null);
  useEffect(() => {
    const atualizar = () =>
      setDateTime(
        new Date().toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "America/Sao_Paulo",
        }),
      );
    atualizar();
    const id = setInterval(atualizar, 1000);
    return () => clearInterval(id);
  }, []);
  const ativos = departamentos.filter((d) => d.ativo);
  const chamadas = useMemo(
    () =>
      senhas
        .filter((s) => s.called_at)
        .sort((a, b) => +new Date(b.called_at ?? 0) - +new Date(a.called_at ?? 0)),
    [senhas],
  );
  const atual = chamadas.find((s) => s.status === "chamada");
  const depAtual = ativos.find((d) => d.id === atual?.departamento_id);
  const ultimas = chamadas.filter((s) => s.id !== atual?.id).slice(0, 12);
  const depDe = (s: Senha): Departamento | undefined =>
    ativos.find((d) => d.id === s.departamento_id);
  const itens = ativos.flatMap<{ d: Departamento; g: Guiche | null }>((d) => {
    const gs = guiches.filter((g) => g.departamento_id === d.id && g.ativo);
    return gs.length ? gs.map((g) => ({ d, g })) : [{ d, g: null }];
  });
  const veu = Math.min(Math.max(Number(config?.escurecimento ?? 0.72), 0), 1);
  useEffect(() => {
    if (!audioLiberado || !atual) return;
    const chave = `${atual.id}:${atual.called_at}`;
    if (ultimaChamadaAnunciada.current === chave) return;
    ultimaChamadaAnunciada.current = chave;
    const destino = atual.guiche
      ? `ao guichê ${atual.guiche}`
      : `ao setor de ${depAtual?.nome ?? "atendimento"}`;
    void announce(`${rotuloChamada(atual, depAtual)}, compareça ${destino}.`);
  }, [audioLiberado, atual?.id, atual?.called_at, atual?.guiche, depAtual?.nome]);

  return (
    <div className="relative h-screen overflow-hidden bg-panel text-panel-foreground">
      <img
        src="/bg.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-panel" style={{ opacity: veu }} />
      <div className="relative flex h-full flex-col">
        <header className="flex items-center gap-5 border-b border-panel-foreground/15 px-10 py-5">
          <img
            src="/municipal-crest.png"
            alt="Brasão municipal"
            className="h-16 w-16 shrink-0 object-contain drop-shadow"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-bold uppercase tracking-[0.25em]">
              {config?.titulo ?? "Painel de Chamada"}
            </h1>
            <p className="text-xs uppercase tracking-[0.3em] text-panel-foreground/60">
              Atendimento ao público
            </p>
          </div>
          <div className="text-right">
            {!audioLiberado && (
              <button
                type="button"
                className="mb-2 rounded-full border border-panel-foreground/30 px-3 py-1 text-[10px] uppercase tracking-wider text-panel-foreground/80"
                onClick={() => setAudioLiberado(true)}
              >
                Ativar áudio
              </button>
            )}
            <p className="font-display text-2xl font-bold tabular-nums">{dateTime}</p>
            <p className="text-xs uppercase tracking-[0.25em] text-panel-foreground/60">
              {senhas.filter((s) => s.status === "aguardando").length} na fila
            </p>
          </div>
        </header>
        <div className="grid min-h-0 flex-1 gap-6 overflow-hidden p-8 lg:grid-cols-12">
          <section className="col-span-8 grid min-h-0 grid-rows-[minmax(0,1fr)_auto_auto] gap-4 overflow-hidden">
            <div className="flex min-h-0 flex-col items-center justify-center rounded-3xl border border-panel-foreground/10 bg-panel-muted/45 px-10 py-8 text-center shadow-2xl backdrop-blur-md">
              <p className="text-sm uppercase tracking-[0.45em] text-panel-foreground/60">
                {depAtual?.nome ?? "Chamada"}
              </p>
              <p className="mt-6 break-words font-display text-[5.5rem] font-bold uppercase leading-[0.95] text-accent lg:text-[7.5rem]">
                {atual ? rotuloChamada(atual, depAtual) : "—"}
              </p>
              <div className="mt-8 rounded-full border border-panel-foreground/20 px-8 py-3 text-2xl font-semibold uppercase tracking-[0.2em]">
                {atual ? `Guichê ${atual.guiche}` : "Aguardando chamada"}
              </div>
            </div>
            <div className="flex items-center gap-4 px-2 text-panel-foreground/60">
              <div className="h-px flex-1 bg-panel-foreground/20" />
              <span className="text-xs font-semibold uppercase tracking-[0.35em]">
                Departamentos
              </span>
              <div className="h-px flex-1 bg-panel-foreground/20" />
            </div>
            <ul className="grid w-full grid-cols-12 gap-2">
              {itens.map(({ d, g }) => {
                const ultima = chamadas.find(
                  (s) => s.departamento_id === d.id && (!g || s.guiche === g.nome),
                );
                const fila = senhas.filter(
                  (s) => s.departamento_id === d.id && s.status === "aguardando",
                ).length;
                return (
                  <li
                    key={g?.id ?? d.id}
                    className="col-span-6 rounded-xl border border-panel-foreground/10 bg-panel/70 px-3 py-2 text-left backdrop-blur xl:col-span-6"
                  >
                    <div className="flex justify-between text-[11px] uppercase tracking-[0.2em] text-panel-foreground/60">
                      <span>
                        {d.nome}
                        {g ? ` · Guichê ${g.nome}` : ""}
                      </span>
                      <span>{fila} na fila</span>
                    </div>
                    <div className="mt-1 flex justify-between gap-2">
                      <b className="truncate font-display uppercase">
                        {ultima ? rotuloChamada(ultima, d) : "—"}
                      </b>
                      <span className="text-xs text-panel-foreground/60">
                        {ultima ? `Guichê ${ultima.guiche}` : ""}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          <aside className="col-span-4 flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-panel-foreground/10 bg-panel-muted/45 p-6 backdrop-blur-md">
            <h2 className="text-xs uppercase tracking-[0.4em] text-panel-foreground/60">
              Últimas chamadas
            </h2>
            <ul className="mt-4 min-h-0 flex-1 space-y-3 overflow-hidden pr-1">
              {ultimas.length === 0 && (
                <li className="text-sm text-panel-foreground/60">Sem chamadas anteriores.</li>
              )}
              {ultimas.map((s) => (
                <li
                  key={s.id}
                  className="rounded-2xl border border-panel-foreground/10 bg-panel/45 px-5 py-4"
                >
                  <p className="truncate font-display text-2xl font-bold uppercase">
                    {rotuloChamada(s, depDe(s))}
                  </p>
                  <p className="mt-1 flex justify-between text-xs uppercase tracking-wider text-panel-foreground/60">
                    <span>
                      {depDe(s)?.nome} · Guichê {s.guiche}
                    </span>
                    <span>{horaDe(s)}</span>
                  </p>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
