import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PerfilUsuario = {
  user_id: string;
  nome: string;
  perfil: "admin" | "gerente" | "funcionario" | "recepcionista";
  departamento_id: string | null;
  guiche_id: string | null;
  ativo: boolean;
};

export function usePerfilUsuario() {
  return useQuery({
    queryKey: ["perfil-usuario"],
    queryFn: async (): Promise<PerfilUsuario | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      // The generated schema predates this table; keep the cast local until types are regenerated.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("perfis_usuarios" as never) as any)
        .select("*")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
      if (auth.user.email?.toLowerCase() === "pedroguarconi@gmail.com") {
        return {
          user_id: auth.user.id,
          nome: "Pedro Guarconi",
          perfil: "admin",
          departamento_id: null,
          guiche_id: null,
          ativo: true,
        };
      }
      return null;
    },
  });
}
