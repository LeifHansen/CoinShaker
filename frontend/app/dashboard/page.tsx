"use client";

import { motion } from "framer-motion";
import {
  useAccount,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { formatEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACTS, STAKING_TIERS } from "@/lib/contracts";
import DittoCoinABI from "@/abi/DittoCoin.json";
import DittoStakingABI from "@/abi/DittoStaking.json";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AddToWallet } from "@/components/AddToWallet";

function formatNum(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(2);
}

// A single staking position card
function PositionCard({
  stake,
  index,
  stakingAddress,
  userAddress,
}: {
  stake: {
    amount: bigint;
    startTime: bigint;
    lockEnd: bigint;
    tier: number;
    withdrawn: boolean;
  };
  index: number;
  stakingAddress: `0x${string}`;
  userAddress: `0x${string}`;
}) {
  const tier = STAKING_TIERS[stake.tier] || STAKING_TIERS[0];
  const now = Math.floor(Date.now() / 1000);
  const lockEnd = Number(stake.lockEnd);
  const startTime = Number(stake.startTime);
  const totalDuration = lockEnd - startTime;
  const elapsed = Math.min(now - startTime, totalDuration);
  const progress = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;
  const isUnlocked = now >= lockEnd;
  const amount = parseFloat(formatEther(stake.amount));

  const daysLeft = Math.max(0, Math.ceil((lockEnd - now) / 86400));

  // Read pending reward
  const { data: reward } = useReadContract({
    address: stakingAddress,
    abi: DittoStakingABI,
    functionName: "calculateReward",
    args: [userAddress, BigInt(index)],
  });

  const rewardNum = reward ? parseFloat(formatEther(reward as bigint)) : 0;

  const { writeContract: unstakeContract } = useWriteContract();
  const { writeContract: emergencyUnstakeContract } = useWriteContract();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{tier.emoji}</span>
          <div>
            <div className="font-display font-bold text-white">{tier.name}</div>
            <div className="text-white/40 text-xs">
              Staked {new Date(startTime * 1000).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display font-bold text-white">
            {formatNum(amount)} DITTO
          </div>
          <div className="text-ditto-teal text-xs font-semibold">
            +{formatNum(rewardNum)} earned
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/5 rounded-full mb-2 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${tier.color} transition-all duration-1000`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-white/40 mb-4">
        <span>
          {isUnlocked ? "Unlocked!" : `${daysLeft} days remaining`}
        </span>
        <span>{progress.toFixed(0)}% complete</span>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() =>
            emergencyUnstakeContract({
              address: stakingAddress,
              abi: DittoStakingABI,
              functionName: "emergencyUnstake",
              args: [BigInt(index)],
            })
          }
          className="flex-1 py-2.5 bg-white/5 text-white/50 rounded-lg text-sm font-medium hover:bg-white/10 hover:text-white/70 transition-colors border border-white/5"
        >
          Emergency Exit
        </button>
        {isUnlocked && (
          <button
            onClick={() =>
              unstakeContract({
                address: stakingAddress,
                abi: DittoStakingABI,
                functionName: "unstake",
                args: [BigInt(index)],
              })
            }
            className="flex-1 py-2.5 bg-gradient-to-r from-ditto-teal to-emerald-400 text-ditto-purple-900 rounded-lg text-sm font-bold btn-shine"
          >
            Claim & Unstake
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { address, isConnected, chain } = useAccount();

  const network = chain?.id === 1 ? "mainnet" : "sepolia";
  const tokenAddress = CONTRACTS[network]?.dittoCoin;
  const stakingAddress = CONTRACTS[network]?.dittoStaking;

  // Read balance
  const { data: balance } = useReadContract({
    address: tokenAddress,
    abi: DittoCoinABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // Read stakes
  const { data: stakes } = useReadContract({
    address: stakingAddress,
    abi: DittoStakingABI,
    functionName: "getStakes",
    args: address ? [address] : undefined,
  });

  // Read total staked globally
  const { data: totalStaked } = useReadContract({
    address: stakingAddress,
    abi: DittoStakingABI,
    functionName: "totalStaked",
  });

  // Read total burned
  const { data: totalBurned } = useReadContract({
    address: tokenAddress,
    abi: DittoCoinABI,
    functionName: "totalBurned",
  });

  const balanceNum = balance ? parseFloat(formatEther(balance as bigint)) : 0;
  const totalStakedNum = totalStaked
    ? parseFloat(formatEther(totalStaked as bigint))
    : 0;
  const totalBurnedNum = totalBurned
    ? parseFloat(formatEther(totalBurned as bigint))
    : 0;

  // Keep original indices so contract calls use the correct stakeIndex
  const allStakes = (stakes as any[]) || [];
  const activeStakes = allStakes
    .map((s: any, i: number) => ({ ...s, originalIndex: i }))
    .filter((s: any) => !s.withdrawn);
  const userStakedTotal = activeStakes.reduce(
    (acc: number, s: any) => acc + parseFloat(formatEther(s.amount)),
    0
  );

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="text-6xl mb-6 opacity-30">{"\u{1F512}"}</div>
          <h2 className="font-display text-2xl font-bold text-white/60 mb-4">
            Connect your wallet
          </h2>
          <p className="text-white/30 mb-8">
            View your DITTO balance, staking positions, and rewards
          </p>
          <ConnectButton />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-10">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-4xl font-bold"
          >
            Your <span className="text-ditto-teal">Dashboard</span>
          </motion.h1>
          <AddToWallet />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            {
              label: "Wallet Balance",
              value: formatNum(balanceNum),
              unit: "DITTO",
              color: "text-white",
            },
            {
              label: "Your Staked",
              value: formatNum(userStakedTotal),
              unit: "DITTO",
              color: "text-ditto-teal",
            },
            {
              label: "Total Staked (Global)",
              value: formatNum(totalStakedNum),
              unit: "DITTO",
              color: "text-ditto-purple-600",
            },
            {
              label: "Total Burned",
              value: formatNum(totalBurnedNum),
              unit: "DITTO",
              color: "text-ditto-pink",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-xl p-5 text-center"
            >
              <div className="text-white/40 text-sm mb-1">{stat.label}</div>
              <div className={`font-display text-xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-white/20 text-xs">{stat.unit}</div>
            </motion.div>
          ))}
        </div>

        {/* Active Positions */}
        <h2 className="font-display text-xl font-bold text-white mb-4">
          Active Positions
        </h2>

        <ErrorBoundary>
        {activeStakes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card rounded-xl p-10 text-center"
          >
            <div className="text-4xl mb-4 opacity-30">{"\u{1F331}"}</div>
            <p className="text-white/40 mb-2">No active stakes yet</p>
            <a
              href="/stake"
              className="text-ditto-teal text-sm hover:underline"
            >
              Stake your DITTO to start earning &rarr;
            </a>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {activeStakes.map((stake: any) => (
              <PositionCard
                key={stake.originalIndex}
                stake={stake}
                index={stake.originalIndex}
                stakingAddress={stakingAddress}
                userAddress={address!}
              />
            ))}
          </div>
        )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
