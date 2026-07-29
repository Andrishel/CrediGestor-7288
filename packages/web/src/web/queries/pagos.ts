import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function useCuotasPorCobrar(prestamoId: string) {
  return useQuery(
    orpc.pagos.cuotasPorCobrar.queryOptions({
      input: { prestamoId },
      enabled: !!prestamoId,
      staleTime: 0,
    }),
  );
}

export function useRegistrarPago() {
  const qc = useQueryClient();
  return useMutation(
    orpc.pagos.registrar.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.prestamos.key() });
        qc.invalidateQueries({ queryKey: orpc.pagos.key() });
        qc.invalidateQueries({ queryKey: orpc.dashboard.key() });
        qc.invalidateQueries({ queryKey: orpc.clientes.key() });
      },
    }),
  );
}

export function usePagosRecientes() {
  return useQuery(orpc.pagos.recientes.queryOptions());
}
