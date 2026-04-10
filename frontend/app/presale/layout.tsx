import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Presale — Buy $DITTO at a Discount Before Launch | DittoCoin",
  description:
    "Get DittoCoin ($DITTO) tokens at up to 60% off the listing price. Three presale rounds: Seed, Early Bird, and Public. Referral bonuses, vesting schedules, and anti-whale limits.",
  keywords: [
    "presale",
    "token sale",
    "ICO",
    "DittoCoin",
    "DITTO",
    "crypto presale",
    "discount",
    "early access",
  ],
  openGraph: {
    title: "DittoCoin Presale — Up to 60% Off Listing Price",
    description:
      "Join the DittoCoin presale and get $DITTO at a discount. Three rounds with increasing prices. Refer friends for 5% bonus.",
    type: "website",
    images: [
      {
        url: "https://dittocoin.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "DittoCoin Presale",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DittoCoin Presale — Up to 60% Off Listing Price",
    description:
      "Join the DittoCoin presale and get $DITTO at a discount. Refer friends for 5% bonus.",
  },
};

export default function PresaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
