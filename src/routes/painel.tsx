import { createFileRoute } from "@tanstack/react-router";

import { useDepartamentos, usePainelConfig, useSenhasDeHoje } from "@/hooks/use-senhas";
import { rotuloChamada, type Departamento, type Senha } from "@/lib/senhas";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [
      { title: "Painel de Chamada — Senhas e Recepção" },
      {
        name: "description",
        content:
          "Painel público multi-departamentos com a chamada atual, o guichê e as últimas chamadas.",
      },
      { property: "og:title", content: "Painel de Chamada — Senhas e Recepção" },
      {
        property: "og:description",
        content: "Chamada atual, guichê e histórico recente por departamento.",
      },
    ],
  }),
  component: Painel,
});

function ordenarPorChamada(a: Senha, b: Senha) {
  return new Date(b.called_at ?? 0).getTime() - new Date(a.called_at ?? 0).getTime();
}

function horaDe(s: Senha) {
  if (!s.called_at) return "";
  return new Date(s.called_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}


function Painel() {
  const { data: senhas = [] } = useSenhasDeHoje(2000);
  const { data: departamentos = [] } = useDepartamentos();
  const { data: config } = usePainelConfig();

  const [time, setTime] = useState<any>(null)

  useEffect(() => {
    setInterval(() => {
      setTime(new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "America/Sao_Paulo",
      }))
    }, 1000)
  }, [])

  const ativos = departamentos.filter((d) => d.ativo);
  const chamadas = senhas.filter((s) => s.called_at).sort(ordenarPorChamada);
  const atual = chamadas[0];
  const depAtual = ativos.find((d) => d.id === atual?.departamento_id);
  const ultimas = chamadas.slice(1, 13);

  const depDe = (s: Senha): Departamento | undefined =>
    ativos.find((d) => d.id === s.departamento_id);

  const falarNome = (nome: string) => {
    if (!("speechSynthesis" in window)) {
      alert("Este navegador não suporta síntese de voz.");
      return;
    }

    const campainha = new Audio("/freesound_community-ding-47489.mp3");

    campainha.play();

    campainha.onended = () => {
      const voices = speechSynthesis.getVoices();

      const vozFeminina =
        voices.find(v => v.lang === "pt-BR" && v.name.includes("Francisca")) ||
        voices.find(v => v.lang === "pt-BR" && v.name.includes("Maria")) ||
        voices.find(v => v.lang === "pt-BR");

      const voz =
        voices.find(v => v.lang === "pt-BR") ||
        voices.find(v => v.lang.startsWith("pt")) ||
        voices[0];

      const msg = new SpeechSynthesisUtterance(
        nome
      );

      msg.lang = "pt-BR";
      msg.voice = vozFeminina || voz;
      msg.volume = 1;
      msg.rate = 0.9;
      msg.pitch = 1;

      console.log("Voz selecionada:", voz);

      window.speechSynthesis.speak(msg);
    }

    window.speechSynthesis.cancel();
  }
  useEffect(() => {
    if (!atual) return;
    console.log("Falando: ", rotuloChamada(atual, depAtual));
    falarNome(rotuloChamada(atual, depAtual) + " compareça ao atendimento no guichê " + atual.guiche + " no setor " + depAtual?.nome);
  }, [atual])

  const veu = Math.min(Math.max(Number(config?.escurecimento ?? 0.72), 0), 1);

  return (
    <div className="relative h-screen overflow-hidden bg-panel text-panel-foreground">
      {config?.fundo_url && (
        <img
          src={config.fundo_url}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-panel"
        style={{ opacity: config?.fundo_url ? veu : 1 }}
      />

      <div className="relative flex h-full flex-col">
        <header className="flex items-center gap-5 border-b border-panel-foreground/15 px-10 py-5">
          {config?.brasao_url && (
            <img
              src={config.brasao_url}
              alt="Brasão"
              className="h-16 w-16 shrink-0 object-contain drop-shadow"
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-bold uppercase tracking-[0.25em]">
              {config?.titulo ?? "Painel de Chamada"}
            </h1>
            <p className="text-xs uppercase tracking-[0.3em] text-panel-foreground/60">
              Atendimento ao público
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-bold tabular-nums">
              {new Date().toLocaleDateString("pt-BR")} {time}
            </p>
            <p className="text-xs uppercase tracking-[0.25em] text-panel-foreground/60">
              {senhas.filter((s) => s.status === "aguardando").length} na fila
            </p>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-6 p-8 lg:grid-cols-[2.2fr_1fr]">
          <section className="flex min-h-0 flex-col gap-6">
            <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-panel-foreground/10 bg-panel-muted/80 px-10 py-10 text-center shadow-2xl backdrop-blur">
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

            <ul className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {ativos.map((d) => {
                const ultima = chamadas.find((s) => s.departamento_id === d.id);
                const fila = senhas.filter(
                  (s) => s.departamento_id === d.id && s.status === "aguardando",
                ).length;
                return (
                  <li
                    key={d.id}
                    className="rounded-2xl border border-panel-foreground/10 bg-panel/70 px-4 py-3 text-left backdrop-blur"
                  >
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-panel-foreground/60">
                      <span className="truncate">{d.nome}</span>
                      <span>{fila} na fila</span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="truncate font-display text-lg font-bold uppercase">
                        {ultima ? rotuloChamada(ultima, d) : "—"}
                      </span>
                      <span className="shrink-0 text-xs text-panel-foreground/60">
                        {ultima ? `Guichê ${ultima.guiche}` : ""}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="flex min-h-0 flex-col rounded-3xl border border-panel-foreground/10 bg-panel-muted/80 p-6 backdrop-blur">
            <h2 className="text-xs uppercase tracking-[0.4em] text-panel-foreground/60">
              Últimas chamadas
            </h2>
            <ul className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 overflow-y-hidden">
              {ultimas.length === 0 && (
                <li className="text-sm text-panel-foreground/60">Sem chamadas anteriores.</li>
              )}
              {ultimas.map((s) => (
                <li
                  key={s.id}
                  className="rounded-2xl border border-panel-foreground/10 bg-panel/80 px-5 py-4"
                >
                  <p className="truncate font-display text-2xl font-bold uppercase">
                    {rotuloChamada(s, depDe(s))}
                  </p>
                  <p className="mt-1 flex items-center justify-between gap-2 text-xs uppercase tracking-wider text-panel-foreground/60">
                    <span className="truncate">
                      {depDe(s)?.nome} · Guichê {s.guiche}
                    </span>
                    <span className="shrink-0 tabular-nums">{horaDe(s)}</span>
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
