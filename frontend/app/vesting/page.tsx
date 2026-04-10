"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACTS, PRESALE_ROUNDS } from "@/lib/contracts";
import DittoVestingABI from "@/abi/DittoVesting.json";

export default function VestingPage() {
  const { address, isConnected, chain } = useAccount();
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  const network = chain?.id === 1 ? "mainnet" : "sepolia";
  const vestingAddress = CONTRACTS[network]?.dittoVesting;

  // Refresh timer every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30000);
    return () => clearInterval(interval);
  }, []);

  // Read TGE timestamp
  const { data: tgeTimestamp } = useReadContract({
    address: vestingAddress,
    abi: DittoVestingABI,
    functionName: "tgeTimestamp",
  });

  // Read user's vesting schedule
  const { data: schedule } = useReadContract({
    address: vestingAddress,
    abi: DittoVestingABI,
    functionName: "getSchedule",
    args: address ? [address] : undefined,
  });

  // Read claimable amount
  const { data: claimableRaw } = useReadContract({
    address: vestingAddress,
    abi: DittoVestingABI,
    functionName: "claimable",
    args: address ? [address] : undefined,
  });

  // Claim function
  const {
    writeContract: claimWrite,
    data: claimHash,
    isPending: isClaiming,
  } = useWriteContract();

  const { isSuccess: claimConfirmed } = useWaitForTransactionReceipt({ hash: claimHash });

  function handleClaim() {
    claimWrite({
      address: vestingAddress,
      abi: DittoVestingABI,
      functionName: "claim",
    });
  }

  // Parse schedule data
  const scheduleData = useMemo(() => {
    if (!schedule) return null;
    const s = schedule as [bigint, bigint, bigint, bigint];
    return {
      totalAmount: s[0],
      tgePercent: Number(s[1]),
      vestingDuration: Number(s[2]),
      claimed: s[3],
    };
  }, [schedule]);

  const tge = tgeTimestamp ? Number(tgeTimestamp as bigint) : 0;
  const tgeSet = tge > 0;
  const tgeLive = tgeSet && now >= tge;

  const claimable = claimableRaw ? (claimableRaw as bigint) : 0n;
  const hasSchedule = scheduleData && scheduleData.totalAmount > 0n;

  // Calculate vesting progress
  const vestingProgress = useMemo(() => {
    if (!scheduleData || !tgeSet || scheduleData.totalAmount === 0n) return 0;
    const claimed = parseFloat(formatEther(scheduleData.claimed));
    const total = parseFloat(formatEther(scheduleData.totalAmount));
    if (total === 0) return 0;

    if (!tgeLive) return 0;

    const tgeAmount = (total * scheduleData.tgePercent) / 100;
    const vestingAmount = total - tgeAmount;

    if (scheduleData.vestingDuration === 0) return 100;

    const elapsed = now - tge;
    const vestedFromLinear = vestingAmount * Math.min(1, elapsed / scheduleData.vestingDuration);
    const totalVested = tgeAmount + vestedFromLinear;

    return Math.min(100, (totalVested / total) * 100);
  }, [scheduleData, tge, tgeSet, tgeLive, now]);

  function formatNum(n: number) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toFixed(2);
  }

  function formatDate(ts: number) {
    if (ts === 0) return "TBD";
    return new Date(ts * 1000).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  // Determine which presale round this schedule likely belongs to
  const roundInfo = useMemo(() => {
    if (!scheduleData) return null;
    const pct = scheduleData.tgePercent;
    if (pct === 25) return PRESALE_ROUNDS[0]; // Seed
    if (pct === 50) return PRESALE_ROUNDS[1]; // EarlyBird
    return PRESALE_ROUNDS[2]; // Public
  }, [scheduleData]);

  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="font-display text-4xl font-bold mb-3">
            Vesting <span className="text-ditto-teal">Dashboard</span>
          </h1>
          <p className="text-white/50">
            Track and claim your presale DITTO tokens
          </p>
        </motion.div>

        {/* TGE Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card rounded-xl p-5 mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${tgeLive ? "bg-emerald-400 animate-pulse" : tgeSet ? "bg-ditto-amber" : "bg-white/20"}`} />
              <div>
                <div className="text-sm font-medium text-white">
                  Token Generation Event (TGE)
                </div>
                <div className="text-xs text-white/40">
                  {tgeLive
                    ? "Live since " + formatDate(tge)
                    : tgeSet
                    ? "Scheduled for " + formatDate(tge)
                    : "Not yet scheduled"}
                </div>
              </div>
            </div>
            <div className={`text-xs font-bold px-3 py-1 rounded-full ${
              tgeLive
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-white/5 text-white/40"
            }`}>
              {tgeLive ? "LIVE" : "PENDING"}
            </div>
          </div>
        </motion.div>

        {!isConnected ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-2xl p-12 text-center"
          >
            <div className="text-4xl mb-4">{"\u{1F512}"}</div>
            <p className="text-white/40 mb-4">Connect your wallet to view your vesting schedule</p>
            <ConnectButton />
          </motion.div>
        ) : !hasSchedule ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-2xl p-12 text-center"
          >
            <div className="text-4xl mb-4">{"\u{1F4AD}"}</div>
            <p className="text-white/40">No vesting schedule found for this wallet</p>
            <p className="text-white/30 text-sm mt-2">
              Participate in the presale to receive a vesting allocation
            </p>
          </motion.div>
        ) : (
          <>
            {/* Stats Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
            >
              <div className="glass-card rounded-xl p-4 text-center">
                <div className="text-xs text-white/40 mb-1">Total Allocation</div>
                <div className="text-lg font-bold text-white">
                  {formatNum(parseFloat(formatEther(scheduleData!.totalAmount)))}
                </div>
                <div className="text-xs text-white/30">DITTO</div>
              </div>
              <div className="glass-card rounded-xl p-4 text-center">
                <div className="text-xs text-white/40 mb-1">Claimed</div>
                <div className="text-lg font-bold text-ditto-teal">
                  {formatNum(parseFloat(formatEther(scheduleData!.claimed)))}
                </div>
                <div className="text-xs text-white/30">DITTO</div>
              </div>
              <div className="glass-card rounded-xl p-4 text-center">
                <div className="text-xs text-white/40 mb-1">Claimable Now</div>
                <div className="text-lg font-bold text-ditto-amber">
                  {formatNum(parseFloat(formatEther(claimable)))}
                </div>
                <div className="text-xs text-white/30">DITTO</div>
              </div>
              <div className="glass-card rounded-xl p-4 text-center">
                <div className="text-xs text-white/40 mb-1">Vested</div>
                <div className="text-lg font-bold text-white">
                  {vestingProgress.toFixed(1)}%
                </div>
                <div className="text-xs text-white/30">progress</div>
              </div>
            </motion.div>

            {/* Vesting Progress Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card rounded-2xl p-6 mb-6"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">Vesting Progress</span>
                <span className="text-sm text-ditto-teal font-bold">{vestingProgress.toFixed(1)}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-4 bg-ditto-purple-900/60 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-ditto-teal to-emerald-400 transition-all duration-1000"
                  style={{ width: `${vestingProgress}%` }}
                />
              </div>

              {/* Schedule details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-white/40">Round</span>
                  <div className="text-white font-medium">{roundInfo?.name || "—"}</div>
                </div>
                <div>
                  <span className="text-white/40">TGE Release</span>
                  <div className="text-white font-medium">{scheduleData!.tgePercent}%</div>
                </div>
                <div>
                  <span className="text-white/40">Vesting Period</span>
                  <div className="text-white font-medium">
                    {scheduleData!.vestingDuration === 0
                      ? "Instant (100% at TGE)"
                      : `${scheduleData!.vestingDuration / 86400} days linear`}
                  </div>
                </div>
                <div>
                  <span className="text-white/40">Vesting Ends</span>
                  <div className="text-white font-medium">
                    {tgeSet && scheduleData!.vestingDuration > 0
                      ? formatDate(tge + scheduleData!.vestingDuration)
                      : tgeSet
                      ? formatDate(tge)
                      : "TBD"}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Claim Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm text-white/50">Available to Claim</div>
                  <div className="text-2xl font-bold text-ditto-amber">
                    {formatNum(parseFloat(formatEther(claimable)))} DITTO
                  </div>
                </div>
              </div>

              <button
                onClick={handleClaim}
                disabled={claimable === 0n || isClaiming || claimConfirmed}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all btn-shine ${
                  claimConfirmed
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : isClaiming
                    ? "bg-ditto-teal/20 text-ditto-teal animate-pulse"
                    : claimable > 0n
                    ? "bg-gradient-to-r from-ditto-amber to-yellow-400 text-ditto-purple-900 hover:shadow-lg hover:shadow-ditto-amber/20"
                    : "bg-white/5 text-white/30 cursor-not-allowed"
                }`}
              >
                {claimConfirmed
                  ? "\u2713 Claimed Successfully!"
                  : isClaiming
                  ? "Claiming..."
                  : claimable > 0n
                  ? `Claim ${formatNum(parseFloat(formatEther(claimable)))} DITTO`
                  : "Nothing to claim yet"}
              </button>

              {!tgeLive && hasSchedule && (
                <p className="text-center text-xs text-white/30 mt-3">
                  Tokens will become claimable after TGE goes live
                </p>
              )}
            </motion.div>
          </>
        )}

        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 glass-card rounded-2xl p-8"
        >
          <h2 className="font-display text-xl font-bold text-white mb-6">Vesting Timeline</h2>
          <div className="space-y-6">
            {[
              {
                title: "Presale Purchase",
                desc: "Buy DITTO at a discount during presale rounds",
                status: hasSchedule ? "complete" : "active",
              },
              {
                title: "Token Generation Event",
                desc: "TGE percentage released immediately when liquidity launches",
                status: tgeLive ? "complete" : tgeSet ? "active" : "pending",
              },
              {
                title: "Linear Vesting",
                desc: "Remaining tokens vest linearly over your vesting period",
                status: tgeLive && vestingProgress > (scheduleData?.tgePercent || 0) ? "active" : "pending",
              },
              {
                title: "Fully Vested",
                desc: "All tokens unlocked and claimable",
                status: vestingProgress >= 100 ? "complete" : "pending",
              },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.status === "complete"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : step.status === "active"
                    ? "bg-ditto-teal/20 text-ditto-teal animate-pulse"
                    : "bg-white/5 text-white/20"
                }`}>
                  {step.status === "complete" ? "\u2713" : i + 1}
                </div>
                <div>
                  <div className={`font-medium ${step.status === "pending" ? "text-white/40" : "text-white"}`}>
                    {step.title}
                  </div>
                  <div className="text-xs text-white/30 mt-0.5">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
