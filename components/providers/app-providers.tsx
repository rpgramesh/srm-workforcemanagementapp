"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            classNames: {
              toast:
                "border border-white/10 bg-slate-950/90 text-white shadow-2xl shadow-black/40",
              title: "text-sm font-semibold",
              description: "text-xs text-slate-300",
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
