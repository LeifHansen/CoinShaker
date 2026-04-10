"use client";

import { useReadContract, useAccount } from "wagmi";
import { formatEther } from "viem";
import { motion } from "framer-motion";
import { CONTRACTS } from "@/lib/contracts";
import DittoCoinABI from "@/abi/DittoCoin.json";

function formatNumber(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(0);
}

function formatCountdown(seconds: number) {
  if (seconds <= 0) return "Now";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 30) return `${Math.floor(days / 30)}mo ${days % 30}d`;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

const HALVING_SCHEDULE = [
  { era: 0, rate: "2%", bps: 200 },
  { era: 1, rate: "1%", bps: 100 },
  { era: 2, rate: "0.5%", bps: 50 },
  { era: 3, rate: "0.25%", bps: 25 },
  { era: 4, rate: "0.125%", bps: 12 },
  { era: 5, rate: "0.0625%", bps: 6 },
  { era: 6, rate: "0.03%", bps: 3 },
  { era: 7, rate: "0.01%", bps: 1 },
];

export function BurnTracker() {
  const { chain } = useAccount();
  const network = chain?.id === 1 ? "mainnet" : "sepolia";
  const tokenAddress = CONTRACTS[network]?.dittoCoin;

  const isDeployed = tokenAddress !== "0x0000000000000000000000000000000000000000";

  // Read live contract data
  const { data: totalBurned } = useReadContract({
    address: tokenAddress,
    abi: DittoCoinABI,
    functionName: "totalBurned",
    query: { enabled: isDeployed, refetchInterval: 15_000 },
  });

  const { data: currentEraData } = useReadContract({
    address: tokenAddress,
    abi: DittoCoinABI,
    functionName: "currentEra",
    query: { enabled: isDeployed, refetchInterval: 60_000 },
  });

  const { data: currentBurnBps } = useReadContract({
    address: tokenAddress,
    abi: DittoCoinABI,
    functionName: "currentBurnBps",
    query: { enabled: isDeployed, refetchInterval: 60_000 },
  });

  const { data: timeUntilHalving } = useReadContract({
    address: tokenAddress,
    abi: DittoCoinABI,
    functionName: "timeUntilNextHalving",
    query: { enabled: isDeployed, refetchInterval: 60_000 },
  });

  // Parse contract values or fall back to era 0 defaults (pre-deploy preview)
  const era = currentEraData !== undefined ? Number(currentEraData) : 0;
  const burnBps = currentBurnBps !== undefined ? Number(currentBurnBps) : 200;
  const burnedAmount = totalBurned
    ? parseFloat(formatEther(totalBurned as bigint))
    : 0;
  const countdown = timeUntilHalving !== undefined ? Number(timeUntilHalving) : 0;

  const burnRate = (burnBps / 100).toFixed(burnBps < 10 ? 3 : burnBps < 100 ? 2 : 0) + "%";
  const supplyPct = (burnedAmount / 420_000_000_000) * 100;
  const schedule = HALVING_SCHEDULE[Math.min(era, 7)];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass-card rounded-2xl p-8 glow-pink"
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl animate-pulse">{"\u{1F525}"}</span>
        <h3 className="font-display text-xl font-bold text-white">
          Live Burn Tracker
        </h3>
        <span className="ml-auto px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold border border-red-500/20">
          ERA {era}
        </span>
      </div>

      <div className="font-display text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400 mb-2">
        {isDeployed ? formatNumber(burnedAmount) : "—"} DITTO
      </div>

      {/* Current burn rate */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-white/50 text-sm">Burn rate:</span>
        <span className="text-orange-400 font-bold text-sm">{burnRate}</span>
        <span className="text-white/30 text-xs">per transfer</span>
      </div>

      {/* Countdown to next halving */}
      {era < 7 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-white/50 text-sm">Next halving:</span>
          <span className="text-yellow-400 font-bold text-sm">
            {isDeployed && countdown > 0 ? formatCountdown(countdown) : era < 7 ? "~180 days" : "Final era"}
          </span>
        </div>
      )}

      {!isDeployed && (
        <div className="text-xs text-white/30 mb-4 italic">
          Contract not yet deployed — showing preview
        </div>
      )}

      <div className="w-full h-2 bg-white/5 rounded-full mb-3 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(supplyPct * 500, 100)}%` }}
          transition={{ duration: 3, ease: "easeOut" }}
        />
      </div>

      <div className="flex items-center justify-between text-sm mb-5">
        <span className="text-white/40">
          {supplyPct.toFixed(4)}% of total supply burned
        </span>
        <span className="text-white/40">Gone forever</span>
      </div>

      {/* Halving schedule mini-timeline */}
      <div className="border-t border-white/5 pt-4">
        <div className="text-xs text-white/30 mb-3 font-medium uppercase tracking-wider">
          Halving Schedule
        </div>
        <div className="flex gap-1.5">
          {HALVING_SCHEDULE.map((h) => (
            <div
              key={h.era}
              className={`flex-1 rounded-md py-1.5 px-1 text-center text-xs transition-all ${
                h.era === era
                  ? "bg-gradient-to-b from-orange-500/20 to-red-500/20 border border-orange-500/30 text-orange-400 font-bold"
                  : h.era < era
                  ? "bg-white/5 text-white/20 line-through"
                  : "bg-white/5 text-white/40"
              }`}
            >
              <div className="font-mono">{h.rate}</div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
