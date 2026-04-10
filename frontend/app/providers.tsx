"use client";

import { useState } from "react";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";

import "@rainbow-me/rainbowkit/styles.css";

const dittoTheme = darkTheme({
  accentColor: "#1ac8b0",
  accentColorForeground: "#1a0a2e",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

// Override deeper colors to match our purple palette
dittoTheme.colors.connectButtonBackground = "#2d1052";
dittoTheme.colors.connectButtonInnerBackground = "#1a0a2e";
dittoTheme.colors.modalBackground = "#1a0a2e";
dittoTheme.colors.modalBorder = "#2d1052";

export function Providers({ children }: { children: React.ReactNode }) {
  // Create QueryClient inside the component to avoid SSR hydration issues
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={dittoTheme}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
