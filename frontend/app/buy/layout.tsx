import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buy $DITTO — Swap ETH for DittoCoin | Deflationary Memecoin",
  description:
    "Buy DittoCoin ($DITTO) by swapping ETH through Uniswap. Deflationary ERC20 memecoin with halving burn on every transaction. Join the community today.",
  keywords: [
    "buy DittoCoin",
    "DITTO token",
    "swap ETH",
    "ERC20",
    "memecoin",
    "Uniswap",
    "DEX trading",
  ],
  openGraph: {
    title: "Buy $DITTO — Swap ETH for DittoCoin",
    description:
      "Swap ETH for DITTO through our built-in DEX integration. Halving burn per transaction makes every buy deflationary.",
    type: "website",
    images: [
      {
        url: "https://dittocoin.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Buy DittoCoin",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Buy $DITTO — Swap ETH for DittoCoin",
    description:
      "Swap ETH for DITTO through our built-in DEX integration. Halving burn per transaction.",
  },
};

export default function BuyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
