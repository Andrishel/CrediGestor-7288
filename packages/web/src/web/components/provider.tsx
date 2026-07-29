import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "./ui/toast";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

interface ProviderProps {
  children: React.ReactNode;
}

// App-level providers — QueryClientProvider must stay (all API calls run through TanStack Query).
export function Provider({ children }: ProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
