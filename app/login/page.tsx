"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth";
import { usePainelConfig } from "@/hooks/use-senhas";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { data: config } = usePainelConfig();
  const escurecimento = Math.min(Math.max(Number(config?.escurecimento ?? 0.72), 0), 1);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (!error) router.push("/atendimento");
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4">
      <img
        src="/bg.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-background"
        style={{ opacity: escurecimento }}
      />
      <form
        onSubmit={submit}
        className="relative w-full max-w-md space-y-5 rounded-2xl border border-border bg-card/95 p-8 shadow-xl backdrop-blur"
      >
        <div className="text-center">
          <img
            src="/municipal-crest.png"
            alt="Brasão municipal"
            className="mx-auto mb-5 h-20 w-20 object-contain"
          />
          <h1 className="text-2xl font-bold">{config?.titulo ?? "Acesso ao sistema"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Entre para acessar o atendimento.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button className="w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
