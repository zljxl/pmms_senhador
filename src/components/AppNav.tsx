import { usePainelConfig } from "@/hooks/use-senhas";
import { Link } from "@tanstack/react-router";
import { config } from "process";

const itens = [
  { to: "/", label: "Atendimento" },
  { to: "/recepcao", label: "Recepção" },
  { to: "/painel", label: "Painel" },
  { to: "/relatorios", label: "Relatórios" },
  { to: "/admin", label: "Departamentos" },
] as const;

export function AppNav() {
  const { data: config } = usePainelConfig();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          {config?.brasao_url && (
            <img
              className="grid size-9 place-items-center rounded-md font-display text-sm font-bold text-primary-foreground"
              src={config.brasao_url}
              alt="Brasão"
            />
          )}
          <div>
            <p className="font-display text-base font-bold leading-tight">Senhas & Recepção</p>
            <p className="text-xs text-muted-foreground">Fila única · atendimento presencial</p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {itens.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
