import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vault | DittoCoin",
  description:
    "Deposit ETH, USDC, USDT, or DAI into the DittoCoin Vault and earn DITTO rewards with tiered APR multipliers.",
  openGraph: {
    title: "DittoCoin Vault — Multi-Asset Staking",
    description: "Stake any major asset. Earn DITTO rewards.",
    images: ["/og-image.png"],
  },
};

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
