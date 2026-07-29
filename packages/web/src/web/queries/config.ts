import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function useConfigGeneral() {
  return useQuery(orpc.config.getGeneral.queryOptions({ staleTime: 60_000 }));
}

export function useUpdateConfigGeneral() {
  const qc = useQueryClient();
  return useMutation(
    orpc.config.updateGeneral.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.config.getGeneral.key() }),
    }),
  );
}

export function useConfigCobro() {
  return useQuery(orpc.config.getCobro.queryOptions({ staleTime: 30_000 }));
}

export function useUpdateConfigCobro() {
  const qc = useQueryClient();
  return useMutation(
    orpc.config.updateCobro.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.config.getCobro.key() }),
    }),
  );
}

/** Moneda actual con fallback. */
export function useMoneda() {
  const cfg = useConfigGeneral();
  return cfg.data?.moneda ?? "S/";
}
