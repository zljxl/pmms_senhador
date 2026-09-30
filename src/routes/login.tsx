import { FormEvent, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth";
import { usePainelConfig } from "@/hooks/use-senhas";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { data: config } = usePainelConfig();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error("E-mail ou senha inválidos.");
      return;
    }
    toast.success("Login realizado com sucesso.");
    navigate({ to: "/" });
  }

  const escurecimento = Math.min(Math.max(Number(config?.escurecimento ?? 0.72), 0), 1);

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4">
      {config?.fundo_url && <img src={config.fundo_url} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover" />}
      <div className="pointer-events-none absolute inset-0 bg-background" style={{ opacity: config?.fundo_url ? escurecimento : 1 }} />
      <form onSubmit={submit} className="relative w-full max-w-md space-y-5 rounded-2xl border border-border/70 bg-card/95 p-8 shadow-2xl backdrop-blur">
        <div className="text-center">
          {config?.brasao_url && <img src={config.brasao_url} alt="Brasão" className="mx-auto mb-5 h-20 w-20 object-contain" />}
          <h1 className="text-2xl font-bold">{config?.titulo ?? "Acesso ao sistema"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Entre para acessar o atendimento e a administração.</p>
        </div>
        <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <Button className="w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
      </form>
    </main>
  );
}
