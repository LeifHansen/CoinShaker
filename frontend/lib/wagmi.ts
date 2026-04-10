import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, sepolia } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "DittoCoin",
  // Get a free project ID at https://cloud.walletconnect.com
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_WALLETCONNECT_PROJECT_ID",
  chains: [mainnet, sepolia],
  ssr: true,
});
