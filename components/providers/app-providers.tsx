"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          classNames: {
            toast:
              "border border-slate-200 bg-slate-50/90 text-slate-900 shadow-2xl shadow-black/40",
            title: "text-sm font-semibold",
            description: "text-xs text-slate-700",
          },
        }}
      />
    </QueryClientProvider>
  );
}