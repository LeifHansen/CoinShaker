import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stake $DITTO — Earn Up to 80% APR | DittoCoin DeFi Staking",
  description:
    "Stake your DittoCoin ($DITTO) and earn up to 80% APR with gamified staking tiers. Choose from Paper Hands, Hodler, Diamond Hands, or Whale tier.",
  keywords: [
    "staking",
    "DeFi",
    "yield farming",
    "APR",
    "DITTO token",
    "crypto rewards",
    "gamified staking",
    "ERC20",
  ],
  openGraph: {
    title: "Stake $DITTO — Earn Up to 80% APR",
    description:
      "Lock your DITTO tokens in gamified staking tiers and earn up to 80% APR. The longer you stake, the more you earn.",
    type: "website",
    images: [
      {
        url: "https://dittocoin.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Stake DittoCoin",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stake $DITTO — Earn Up to 80% APR",
    description:
      "Lock your DITTO tokens in gamified staking tiers and earn up to 80% APR.",
  },
};

export default function StakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
