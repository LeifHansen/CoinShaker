"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACTS } from "@/lib/contracts";
import DittoCoinABI from "@/abi/DittoCoin.json";

export default function BuyPage() {
  const { address, isConnected, chain } = useAccount();
  const { data: ethBalance } = useBalance({ address });
  const [ethAmount, setEthAmount] = useState("");
  const [slippage, setSlippage] = useState("1");

  const network = chain?.id === 1 ? "mainnet" : "sepolia";
  const tokenAddress = CONTRACTS[network]?.dittoCoin;
  const isDeployed = tokenAddress !== "0x0000000000000000000000000000000000000000";

  // Read current burn rate from contract
  const { data: currentBurnBps } = useReadContract({
    address: tokenAddress,
    abi: DittoCoinABI,
    functionName: "currentBurnBps",
    query: { enabled: isDeployed },
  });

  const burnBps = currentBurnBps !== undefined ? Number(currentBurnBps) : 200;
  const treasuryBps = 100; // 1% treasury
  const totalTaxBps = burnBps + treasuryBps;
  const totalTaxPct = totalTaxBps / 100;
  const burnPct = burnBps / 100;
  const afterTaxMultiplier = 1 - totalTaxBps / 10_000;

  // Simulated price (in production, fetch from Uniswap SDK or DEX aggregator)
  const pricePerToken = 0.0000000001; // placeholder
  const ethNum = parseFloat(ethAmount) || 0;
  const estimatedDitto = ethNum / pricePerToken;

  // Truncate address for display
  const shortAddress = isDeployed
    ? `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`
    : "Not deployed yet";

  function formatDitto(n: number) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
    return n.toFixed(0);
  }

  const uniswapLink = isDeployed
    ? `https://app.uniswap.org/#/swap?outputCurrency=${tokenAddress}`
    : "#";
  const dextoolsLink = isDeployed
    ? `https://www.dextools.io/app/en/ether/pair-explorer/${tokenAddress}`
    : "#";
  const etherscanLink = isDeployed
    ? `https://etherscan.io/token/${tokenAddress}`
    : "#";

  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="font-display text-4xl font-bold mb-3">
            Buy <span className="text-ditto-teal">$DITTO</span>
          </h1>
          <p className="text-white/50">
            Swap ETH for DITTO via Uniswap
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-6"
        >
          {/* From: ETH */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/50">You Pay</span>
              <span className="text-xs text-white/30">
                Balance:{" "}
                {isConnected && ethBalance
                  ? parseFloat(ethBalance.formatted).toFixed(4) + " ETH"
                  : "\u2014"}
              </span>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={ethAmount}
                  onChange={(e) => setEthAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-ditto-purple-900/60 border border-white/10 rounded-xl px-4 py-4 text-white text-xl font-mono focus:outline-none focus:border-ditto-teal/40 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2 px-4 py-3 bg-ditto-purple-900/60 rounded-xl border border-white/10">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
                  E
                </div>
                <span className="font-semibold text-white">ETH</span>
              </div>
            </div>
          </div>

          {/* Swap arrow */}
          <div className="flex justify-center py-2">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
              {"\u2193"}
            </div>
          </div>

          {/* To: DITTO */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/50">You Receive (estimated)</span>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <div className="w-full bg-ditto-purple-900/60 border border-white/10 rounded-xl px-4 py-4 text-xl font-mono text-ditto-teal">
                  {ethNum > 0 ? formatDitto(estimatedDitto) : "0.0"}
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-3 bg-ditto-purple-900/60 rounded-xl border border-white/10">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-ditto-teal to-ditto-pink flex items-center justify-center text-xs font-bold text-white">
                  D
                </div>
                <span className="font-semibold text-white">DITTO</span>
              </div>
            </div>
          </div>

          {/* Swap details */}
          {ethNum > 0 && (
            <div className="bg-ditto-purple-900/40 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Rate</span>
                <span className="text-white/70">1 ETH = {formatDitto(1 / pricePerToken)} DITTO</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Slippage</span>
                <span className="text-white/70">{slippage}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Buy tax</span>
                <span className="text-ditto-pink">
                  {totalTaxPct}% ({burnPct}% burn + 1% treasury)
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-white/5 pt-2">
                <span className="text-white/40">You receive after tax</span>
                <span className="text-ditto-teal font-semibold">
                  {formatDitto(estimatedDitto * afterTaxMultiplier)} DITTO
                </span>
              </div>
            </div>
          )}

          {/* Slippage selector */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-white/40">Slippage:</span>
            {["0.5", "1", "2", "5"].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  slippage === s
                    ? "bg-ditto-teal/15 text-ditto-teal border border-ditto-teal/30"
                    : "bg-white/5 text-white/40 border border-white/5 hover:text-white/60"
                }`}
              >
                {s}%
              </button>
            ))}
          </div>

          {/* Action button */}
          {isConnected ? (
            <a
              href={uniswapLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`block w-full py-4 rounded-xl font-bold text-lg text-center transition-all btn-shine ${
                isDeployed
                  ? "bg-gradient-to-r from-ditto-teal to-emerald-400 text-ditto-purple-900 hover:shadow-lg hover:shadow-ditto-teal/20"
                  : "bg-white/5 text-white/30 cursor-not-allowed pointer-events-none"
              }`}
            >
              {isDeployed ? "Trade on Uniswap" : "Contract not yet deployed"}
            </a>
          ) : (
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          )}
        </motion.div>

        {/* Quick links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center space-y-3"
        >
          <p className="text-sm text-white/30">
            Or trade directly on{" "}
            <a
              href={uniswapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ditto-teal hover:underline"
            >
              Uniswap
            </a>{" "}
            /{" "}
            <a
              href={dextoolsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ditto-teal hover:underline"
            >
              DEXTools
            </a>{" "}
            /{" "}
            <a
              href={etherscanLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ditto-teal hover:underline"
            >
              Etherscan
            </a>
          </p>
          <p className="text-xs text-white/20">
            Contract: {shortAddress}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
