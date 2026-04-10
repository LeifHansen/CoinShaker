"use client";

import { useAccount } from "wagmi";
import { CONTRACTS, TOKEN } from "@/lib/contracts";

export function AddToWallet() {
  const { chain } = useAccount();
  const network = chain?.id === 1 ? "mainnet" : "sepolia";
  const tokenAddress = CONTRACTS[network]?.dittoCoin;
  const isDeployed = tokenAddress !== "0x0000000000000000000000000000000000000000";

  async function addToken() {
    if (!isDeployed || !window.ethereum) return;
    try {
      await (window.ethereum as any).request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: tokenAddress,
            symbol: TOKEN.symbol,
            decimals: TOKEN.decimals,
            image: "https://dittocoin.com/logo.png",
          },
        },
      });
    } catch (err) {
      console.error("Failed to add token:", err);
    }
  }

  if (!isDeployed) return null;

  return (
    <button
      onClick={addToken}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-sm hover:text-white/70 hover:bg-white/10 transition-colors"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60">
        <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      Add DITTO to MetaMask
    </button>
  );
}
