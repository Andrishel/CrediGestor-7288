import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function usePrestamos() {
  return useQuery(orpc.prestamos.list.queryOptions());
}

export function usePrestamo(id: string) {
  return useQuery(orpc.prestamos.get.queryOptions({ input: { id }, enabled: !!id }));
}

export function useCreatePrestamo() {
  const qc = useQueryClient();
  return useMutation(
    orpc.prestamos.create.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.prestamos.key() });
        qc.invalidateQueries({ queryKey: orpc.clientes.key() });
        qc.invalidateQueries({ queryKey: orpc.dashboard.key() });
      },
    }),
  );
}

export function useSimularPrestamo() {
  return useMutation(orpc.prestamos.simular.mutationOptions());
}
