import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function useClientes() {
  return useQuery(orpc.clientes.list.queryOptions());
}

export function useCliente(id: string) {
  return useQuery(orpc.clientes.get.queryOptions({ input: { id }, enabled: !!id }));
}

export function useCreateCliente() {
  const qc = useQueryClient();
  return useMutation(
    orpc.clientes.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.clientes.key() }),
    }),
  );
}

export function useUpdateCliente() {
  const qc = useQueryClient();
  return useMutation(
    orpc.clientes.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.clientes.key() }),
    }),
  );
}
