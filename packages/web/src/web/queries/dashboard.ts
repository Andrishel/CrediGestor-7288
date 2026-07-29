import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function useDashboard() {
  return useQuery(orpc.dashboard.resumen.queryOptions({ staleTime: 10_000 }));
}
