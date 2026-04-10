import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — DittoCoin Portfolio & Staking Rewards Tracker",
  description:
    "Track your DittoCoin ($DITTO) wallet balance, active staking positions, pending rewards, and total tokens burned. Your complete crypto portfolio dashboard.",
  keywords: [
    "dashboard",
    "portfolio tracker",
    "staking rewards",
    "DITTO",
    "wallet balance",
    "crypto tracking",
    "DeFi dashboard",
  ],
  openGraph: {
    title: "DittoCoin Dashboard — Portfolio & Staking Tracker",
    description:
      "Monitor your DITTO balance, staking positions, and earned rewards in real-time.",
    type: "website",
    images: [
      {
        url: "https://dittocoin.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "DittoCoin Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DittoCoin Dashboard — Portfolio & Staking Tracker",
    description:
      "Monitor your DITTO balance, staking positions, and earned rewards in real-time.",
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
