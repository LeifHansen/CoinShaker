"use client";

import Image from "next/image";
import { useAccount } from "wagmi";
import { CONTRACTS } from "@/lib/contracts";

export function Footer() {
  const { chain } = useAccount();
  const network = chain?.id === 1 ? "mainnet" : "sepolia";
  const tokenAddress = CONTRACTS[network]?.dittoCoin;
  const isDeployed = tokenAddress !== "0x0000000000000000000000000000000000000000";

  const etherscanBase = chain?.id === 1 ? "https://etherscan.io" : "https://sepolia.etherscan.io";

  const LINKS = {
    Community: [
      { label: "Telegram", href: "https://t.me/dittocoin" },
      { label: "Twitter / X", href: "https://twitter.com/dittocoin" },
      { label: "Discord", href: "https://discord.gg/dittocoin" },
    ],
    Resources: [
      { label: "Etherscan", href: isDeployed ? `${etherscanBase}/token/${tokenAddress}` : "#" },
      { label: "CoinGecko", href: "https://www.coingecko.com" },
      { label: "CoinMarketCap", href: "https://coinmarketcap.com" },
    ],
    Trade: [
      { label: "Uniswap", href: isDeployed ? `https://app.uniswap.org/#/swap?outputCurrency=${tokenAddress}` : "#" },
      { label: "DEXTools", href: isDeployed ? `https://www.dextools.io/app/en/ether/pair-explorer/${tokenAddress}` : "#" },
    ],
  };

  return (
    <footer className="border-t border-white/5 bg-ditto-purple-900/50">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative h-8 w-8 overflow-hidden rounded-full">
                <Image src="/logo.png" alt="DittoCoin" fill className="object-cover" />
              </div>
              <span className="font-display text-lg font-bold text-white">
                Ditto<span className="text-ditto-teal">Coin</span>
              </span>
            </div>
            <p className="text-sm text-white/40 leading-relaxed">
              The memecoin that burns brighter. Deflationary, community-funded,
              and whale-proof by design.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
                {title}
              </h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-white/40 hover:text-ditto-teal transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            &copy; 2026 DittoCoin. Not financial advice. DYOR.
          </p>
          {isDeployed && (
            <a
              href={`${etherscanBase}/token/${tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/20 hover:text-ditto-teal transition-colors"
            >
              Contract verified on Etherscan
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
