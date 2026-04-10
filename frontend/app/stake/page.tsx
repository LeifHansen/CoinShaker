"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACTS, STAKING_TIERS } from "@/lib/contracts";
import DittoCoinABI from "@/abi/DittoCoin.json";
import DittoStakingABI from "@/abi/DittoStaking.json";

export default function StakePage() {
  const { address, isConnected, chain } = useAccount();
  const [selectedTier, setSelectedTier] = useState(1); // default: Hodler
  const [stakeAmount, setStakeAmount] = useState("");
  const [txState, setTxState] = useState<"idle" | "approving" | "staking" | "done">("idle");

  const tier = STAKING_TIERS[selectedTier];
  const amount = parseFloat(stakeAmount) || 0;
  const dailyReward = (amount * (tier.apr / 100)) / 365;

  // Read DITTO balance
  const network = chain?.id === 1 ? "mainnet" : "sepolia";
  const tokenAddress = CONTRACTS[network]?.dittoCoin;
  const stakingAddress = CONTRACTS[network]?.dittoStaking;

  const { data: balance } = useReadContract({
    address: tokenAddress,
    abi: DittoCoinABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const formattedBalance = balance ? parseFloat(formatEther(balance as bigint)) : 0;

  // Two-step flow: approve, wait for receipt, then stake
  const {
    writeContract: approveContract,
    data: approveHash,
    isPending: isApproving,
    reset: resetApprove,
  } = useWriteContract();

  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const {
    writeContract: stakeContract,
    data: stakeHash,
    isPending: isStaking,
    reset: resetStake,
  } = useWriteContract();

  const { isSuccess: stakeConfirmed } = useWaitForTransactionReceipt({
    hash: stakeHash,
  });

  // When approval confirms, fire the stake tx
  useEffect(() => {
    if (approveConfirmed && txState === "approving") {
      setTxState("staking");
      stakeContract({
        address: stakingAddress,
        abi: DittoStakingABI,
        functionName: "stake",
        args: [parseEther(stakeAmount || "0"), selectedTier],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveConfirmed, txState, stakingAddress, stakeAmount, selectedTier]);

  // When stake confirms, mark done
  useEffect(() => {
    if (stakeConfirmed && txState === "staking") {
      setTxState("done");
    }
  }, [stakeConfirmed, txState, stakeContract]);

  function formatNum(n: number) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toFixed(2);
  }

  function handleStake() {
    if (!address || amount <= 0) return;
    const parsedAmount = parseEther(stakeAmount);

    resetApprove();
    resetStake();
    setTxState("approving");

    approveContract({
      address: tokenAddress,
      abi: DittoCoinABI,
      functionName: "approve",
      args: [stakingAddress, parsedAmount],
    });
  }

  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="font-display text-4xl font-bold mb-3">
            Stake Your <span className="text-ditto-teal">DITTO</span>
          </h1>
          <p className="text-white/50">
            Pick a tier, lock your tokens, earn rewards
          </p>
        </motion.div>

        {/* Tier Selection */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {STAKING_TIERS.map((t, i) => (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedTier(t.id)}
              className={`text-left rounded-xl p-5 transition-all ${
                selectedTier === t.id
                  ? "glass-card glow-teal scale-[1.03]"
                  : "glass-card opacity-60 hover:opacity-80"
              }`}
            >
              <div className="text-3xl mb-2">{t.emoji}</div>
              <div className="font-display font-bold text-white">{t.name}</div>
              <div className="text-white/40 text-sm mt-1">Lock: {t.lock}</div>
              <div className="flex items-center gap-2 mt-3">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${t.color} text-white`}
                >
                  {t.mult}
                </span>
                <span className="text-ditto-teal font-bold text-sm">
                  {t.apr}% APR
                </span>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Staking Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-white/50 font-medium">
              Amount to Stake
            </span>
            <span className="text-xs text-white/30">
              Balance:{" "}
              {isConnected ? formatNum(formattedBalance) + " DITTO" : "—"}
            </span>
          </div>

          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => {
                  setStakeAmount(e.target.value);
                  setTxState("idle");
                }}
                placeholder="0.00"
                className="w-full bg-ditto-purple-900/60 border border-white/10 rounded-xl px-4 py-4 text-white text-xl font-mono focus:outline-none focus:border-ditto-teal/40 transition-colors"
              />
            </div>
            <button
              onClick={() => {
                setStakeAmount(formattedBalance.toString());
                setTxState("idle");
              }}
              className="px-5 py-4 bg-white/5 text-white/50 rounded-xl text-sm font-medium hover:bg-white/10 hover:text-white/70 transition-colors border border-white/5"
            >
              MAX
            </button>
          </div>

          {/* Reward estimate */}
          {amount > 0 && (
            <div className="bg-ditto-purple-900/40 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Tier</span>
                <span className="text-white">
                  {tier.emoji} {tier.name}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Lock Period</span>
                <span className="text-white">{tier.lock}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">APR</span>
                <span className="text-ditto-teal font-semibold">
                  {tier.apr}%
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-white/5 pt-2">
                <span className="text-white/40">Est. Daily Reward</span>
                <span className="text-ditto-amber font-semibold">
                  {formatNum(dailyReward)} DITTO
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Est. Total Reward</span>
                <span className="text-ditto-amber font-semibold">
                  {formatNum(dailyReward * (tier.lockSeconds / 86400))} DITTO
                </span>
              </div>
            </div>
          )}

          {/* Action */}
          {isConnected ? (
            <button
              onClick={handleStake}
              disabled={amount <= 0 || txState === "done"}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all btn-shine ${
                txState === "done"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : txState !== "idle"
                  ? "bg-ditto-teal/20 text-ditto-teal animate-pulse"
                  : amount > 0
                  ? "bg-gradient-to-r from-ditto-teal to-emerald-400 text-ditto-purple-900 hover:shadow-lg hover:shadow-ditto-teal/20"
                  : "bg-white/5 text-white/30 cursor-not-allowed"
              }`}
            >
              {txState === "done"
                ? "\u2713 Staked Successfully!"
                : txState === "approving"
                ? "Approving DITTO..."
                : txState === "staking"
                ? "Staking..."
                : amount <= 0
                ? "Enter an amount"
                : `Stake ${formatNum(amount)} DITTO`}
            </button>
          ) : (
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
