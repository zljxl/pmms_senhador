import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  listarDepartamentos,
  listarGuiches,
  listarSenhasDeHoje,
  obterPainelConfig,
} from "@/lib/senhas";

export function useSenhasDeHoje(refetchMs = 3000) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["senhas", "hoje"],
    queryFn: listarSenhasDeHoje,
    refetchInterval: refetchMs,
  });

  useEffect(() => {
    const channel = supabase
      .channel("senhas-hoje")
      .on("postgres_changes", { event: "*", schema: "public", table: "senhas" }, () => {
        queryClient.invalidateQueries({ queryKey: ["senhas", "hoje"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useDepartamentos() {
  return useQuery({
    queryKey: ["departamentos"],
    queryFn: listarDepartamentos,
    refetchInterval: 30000,
  });
}

export function useGuiches() {
  return useQuery({
    queryKey: ["guiches"],
    queryFn: listarGuiches,
    refetchInterval: 30000,
  });
}

export function usePainelConfig() {
  return useQuery({
    queryKey: ["painel-config"],
    queryFn: obterPainelConfig,
    refetchInterval: 30000,
  });
}
