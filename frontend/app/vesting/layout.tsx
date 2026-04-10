import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vesting | DittoCoin",
  description:
    "Track your DittoCoin vesting schedule from the presale. See locked, claimable, and claimed DITTO tokens.",
  openGraph: {
    title: "DittoCoin Vesting Dashboard",
    description: "Track and claim your presale DITTO tokens.",
    images: ["/og-image.png"],
  },
};

export default function VestingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
