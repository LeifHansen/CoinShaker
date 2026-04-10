"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from "wagmi";
import { parseEther, parseUnits, formatEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACTS, STAKING_TIERS, VAULT_ASSETS } from "@/lib/contracts";
import DittoVaultABI from "@/abi/DittoVault.json";
import DittoCoinABI from "@/abi/DittoCoin.json";

const TIER_NAMES = ["Paper Hands", "Hodler", "Diamond Hands", "Whale"];
const TIER_EMOJIS = ["\u{1F9FB}", "\u{1F48E}", "\u{1F64C}", "\u{1F40B}"];
const TIER_LOCKS = ["7 days", "30 days", "90 days", "365 days"];
const TIER_APRS = [5, 10, 20, 40]; // base 5% × multiplier

type DepositData = {
  asset: string;
  amount: bigint;
  usdValue: bigint;
  startTime: bigint;
  lockEnd: bigint;
  tier: number;
  withdrawn: boolean;
};

export default function VaultPage() {
  const { address, isConnected, chain } = useAccount();
  const [selectedAsset, setSelectedAsset] = useState(0); // ETH
  const [selectedTier, setSelectedTier] = useState(1);    // Hodler
  const [depositAmount, setDepositAmount] = useState("");
  const [txState, setTxState] = useState<"idle" | "approving" | "depositing" | "done">("idle");
  const [activeTab, setActiveTab] = useState<"deposit" | "positions">("deposit");

  const network = chain?.id === 1 ? "mainnet" : "sepolia";
  const vaultAddress = CONTRACTS[network]?.dittoVault;
  const asset = VAULT_ASSETS[selectedAsset];
  const amount = parseFloat(depositAmount) || 0;
  const isETH = asset.symbol === "ETH";

  // ETH balance
  const { data: ethBalance } = useBalance({ address });

  // Vault stats
  const { data: rewardPool } = useReadContract({
    address: vaultAddress,
    abi: DittoVaultABI,
    functionName: "rewardPool",
  });

  const { data: tvl } = useReadContract({
    address: vaultAddress,
    abi: DittoVaultABI,
    functionName: "totalValueLocked",
  });

  // User deposits array
  const { data: userDeposits } = useReadContract({
    address: vaultAddress,
    abi: DittoVaultABI,
    functionName: "getDeposits",
    args: address ? [address] : undefined,
  });

  const activeDeposits = useMemo(() => {
    if (!userDeposits) return [];
    return (userDeposits as DepositData[])
      .map((d, i) => ({ ...d, index: i }))
      .filter((d) => !d.withdrawn);
  }, [userDeposits]);

  // Write contracts
  const {
    writeContract: approveWrite,
    data: approveHash,
    reset: resetApprove,
  } = useWriteContract();

  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });

  const {
    writeContract: depositWrite,
    data: depositHash,
    reset: resetDeposit,
  } = useWriteContract();

  const { isSuccess: depositConfirmed } = useWaitForTransactionReceipt({ hash: depositHash });

  const {
    writeContract: withdrawWrite,
    data: withdrawHash,
  } = useWriteContract();

  const { isSuccess: withdrawConfirmed } = useWaitForTransactionReceipt({ hash: withdrawHash });

  // When approval confirms → deposit
  useEffect(() => {
    if (approveConfirmed && txState === "approving") {
      setTxState("depositing");
      const parsedAmount = parseUnits(depositAmount || "0", asset.decimals);
      depositWrite({
        address: vaultAddress,
        abi: DittoVaultABI,
        functionName: "depositToken",
        args: [asset.address, parsedAmount, selectedTier],
      });
    }
  }, [approveConfirmed, txState]);

  // When deposit confirms → done
  useEffect(() => {
    if (depositConfirmed && (txState === "depositing" || txState === "approving")) {
      setTxState("done");
    }
  }, [depositConfirmed, txState]);

  function formatNum(n: number) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toFixed(2);
  }

  function handleDeposit() {
    if (!address || amount <= 0) return;
    resetApprove();
    resetDeposit();

    if (isETH) {
      setTxState("depositing");
      depositWrite({
        address: vaultAddress,
        abi: DittoVaultABI,
        functionName: "depositETH",
        args: [selectedTier],
        value: parseEther(depositAmount),
      });
    } else {
      setTxState("approving");
      const parsedAmount = parseUnits(depositAmount, asset.decimals);
      approveWrite({
        address: asset.address as `0x${string}`,
        abi: DittoCoinABI,
        functionName: "approve",
        args: [vaultAddress, parsedAmount],
      });
    }
  }

  function handleWithdraw(depositIndex: number) {
    withdrawWrite({
      address: vaultAddress,
      abi: DittoVaultABI,
      functionName: "withdraw",
      args: [depositIndex],
    });
  }

  function handleEmergencyWithdraw(depositIndex: number) {
    withdrawWrite({
      address: vaultAddress,
      abi: DittoVaultABI,
      functionName: "emergencyWithdraw",
      args: [depositIndex],
    });
  }

  const effectiveApr = TIER_APRS[selectedTier];
  const estimatedDaily = amount > 0 ? (amount * (effectiveApr / 100)) / 365 : 0;

  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="font-display text-4xl font-bold mb-3">
            Multi-Asset <span className="text-ditto-teal">Vault</span>
          </h1>
          <p className="text-white/50">
            Deposit ETH, USDC, USDT, or DAI &mdash; earn DITTO rewards
          </p>
        </motion.div>

        {/* Vault Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8"
        >
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-xs text-white/40 mb-1">Reward Pool</div>
            <div className="text-lg font-bold text-ditto-teal">
              {rewardPool ? formatNum(parseFloat(formatEther(rewardPool as bigint))) : "—"} DITTO
            </div>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-xs text-white/40 mb-1">Total Value Locked</div>
            <div className="text-lg font-bold text-white">
              ${tvl ? formatNum(parseFloat(formatEther(tvl as bigint))) : "0"}
            </div>
          </div>
          <div className="glass-card rounded-xl p-4 text-center col-span-2 md:col-span-1">
            <div className="text-xs text-white/40 mb-1">Your Positions</div>
            <div className="text-lg font-bold text-ditto-amber">
              {activeDeposits.length}
            </div>
          </div>
        </motion.div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("deposit")}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "deposit"
                ? "bg-ditto-teal/15 text-ditto-teal"
                : "text-white/40 hover:text-white/60 bg-white/5"
            }`}
          >
            Deposit
          </button>
          <button
            onClick={() => setActiveTab("positions")}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "positions"
                ? "bg-ditto-teal/15 text-ditto-teal"
                : "text-white/40 hover:text-white/60 bg-white/5"
            }`}
          >
            My Positions
          </button>
        </div>

        {activeTab === "deposit" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Asset Selection */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {VAULT_ASSETS.map((a, i) => (
                <button
                  key={a.symbol}
                  onClick={() => {
                    setSelectedAsset(i);
                    setDepositAmount("");
                    setTxState("idle");
                  }}
                  className={`text-center rounded-xl p-4 transition-all ${
                    selectedAsset === i
                      ? "glass-card glow-teal scale-[1.03]"
                      : "glass-card opacity-60 hover:opacity-80"
                  }`}
                >
                  <div className="text-2xl mb-1">{a.icon}</div>
                  <div className="font-display font-bold text-white text-sm">{a.symbol}</div>
                </button>
              ))}
            </div>

            {/* Tier Selection */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {STAKING_TIERS.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTier(t.id);
                    setTxState("idle");
                  }}
                  className={`text-left rounded-xl p-4 transition-all ${
                    selectedTier === t.id
                      ? "glass-card glow-teal scale-[1.02]"
                      : "glass-card opacity-60 hover:opacity-80"
                  }`}
                >
                  <div className="text-2xl mb-1">{t.emoji}</div>
                  <div className="font-display font-bold text-white text-sm">{t.name}</div>
                  <div className="text-white/40 text-xs mt-1">Lock: {t.lock}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${t.color} text-white`}>
                      {t.mult}
                    </span>
                    <span className="text-ditto-teal font-bold text-xs">
                      {TIER_APRS[i]}% APR
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Deposit Form */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-white/50 font-medium">
                  Deposit {asset.symbol}
                </span>
                <span className="text-xs text-white/30">
                  Balance: {isConnected && ethBalance && isETH
                    ? parseFloat(ethBalance.formatted).toFixed(4) + " ETH"
                    : isConnected ? "—" : "—"}
                </span>
              </div>

              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => {
                      setDepositAmount(e.target.value);
                      setTxState("idle");
                    }}
                    placeholder="0.00"
                    className="w-full bg-ditto-purple-900/60 border border-white/10 rounded-xl px-4 py-4 text-white text-xl font-mono focus:outline-none focus:border-ditto-teal/40 transition-colors"
                  />
                </div>
                {isETH && ethBalance && (
                  <button
                    onClick={() => {
                      const maxEth = Math.max(0, parseFloat(ethBalance.formatted) - 0.01);
                      setDepositAmount(maxEth.toFixed(6));
                      setTxState("idle");
                    }}
                    className="px-5 py-4 bg-white/5 text-white/50 rounded-xl text-sm font-medium hover:bg-white/10 hover:text-white/70 transition-colors border border-white/5"
                  >
                    MAX
                  </button>
                )}
              </div>

              {/* Estimate */}
              {amount > 0 && (
                <div className="bg-ditto-purple-900/40 rounded-xl p-4 mb-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Asset</span>
                    <span className="text-white">{asset.icon} {asset.symbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Tier</span>
                    <span className="text-white">{TIER_EMOJIS[selectedTier]} {TIER_NAMES[selectedTier]}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Lock Period</span>
                    <span className="text-white">{TIER_LOCKS[selectedTier]}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Effective APR</span>
                    <span className="text-ditto-teal font-semibold">{effectiveApr}%</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-white/5 pt-2">
                    <span className="text-white/40">Est. Daily DITTO</span>
                    <span className="text-ditto-amber font-semibold">
                      {formatNum(estimatedDaily)} DITTO
                    </span>
                  </div>
                </div>
              )}

              {/* Action */}
              {isConnected ? (
                <button
                  onClick={handleDeposit}
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
                    ? "\u2713 Deposited Successfully!"
                    : txState === "approving"
                    ? "Approving..."
                    : txState === "depositing"
                    ? "Depositing..."
                    : amount <= 0
                    ? "Enter an amount"
                    : `Deposit ${amount} ${asset.symbol}`}
                </button>
              ) : (
                <div className="flex justify-center">
                  <ConnectButton />
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "positions" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {!isConnected ? (
              <div className="glass-card rounded-2xl p-12 text-center">
                <p className="text-white/40 mb-4">Connect your wallet to view positions</p>
                <ConnectButton />
              </div>
            ) : activeDeposits.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center">
                <div className="text-4xl mb-4">{"\u{1F4AD}"}</div>
                <p className="text-white/40">No active deposits yet</p>
                <p className="text-white/30 text-sm mt-2">
                  Switch to the Deposit tab to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeDeposits.map((d) => (
                  <PositionCard
                    key={d.index}
                    deposit={d}
                    depositIndex={d.index}
                    vaultAddress={vaultAddress}
                    userAddress={address!}
                    onWithdraw={handleWithdraw}
                    onEmergencyWithdraw={handleEmergencyWithdraw}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 glass-card rounded-2xl p-8"
        >
          <h2 className="font-display text-xl font-bold text-white mb-4">How the Vault Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Choose Asset", desc: "Select ETH, USDC, USDT, or DAI" },
              { step: "2", title: "Pick Tier", desc: "Longer lock = higher multiplier" },
              { step: "3", title: "Deposit", desc: "USD value calculated via Chainlink" },
              { step: "4", title: "Earn DITTO", desc: "Claim rewards when lock ends" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-8 h-8 rounded-full bg-ditto-teal/20 text-ditto-teal font-bold text-sm flex items-center justify-center mx-auto mb-3">
                  {item.step}
                </div>
                <div className="font-display font-bold text-white text-sm">{item.title}</div>
                <div className="text-white/40 text-xs mt-1">{item.desc}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ── Position Card Component ─────────────────────────────────────

function PositionCard({
  deposit,
  depositIndex,
  vaultAddress,
  userAddress,
  onWithdraw,
  onEmergencyWithdraw,
}: {
  deposit: DepositData & { index: number };
  depositIndex: number;
  vaultAddress: `0x${string}`;
  userAddress: `0x${string}`;
  onWithdraw: (id: number) => void;
  onEmergencyWithdraw: (id: number) => void;
}) {
  const { data: pendingReward } = useReadContract({
    address: vaultAddress,
    abi: DittoVaultABI,
    functionName: "calculateReward",
    args: [userAddress, depositIndex],
  });

  const now = Math.floor(Date.now() / 1000);
  const lockExpired = now >= Number(deposit.lockEnd);
  const lockRemaining = Math.max(0, Number(deposit.lockEnd) - now);
  const daysRemaining = Math.ceil(lockRemaining / 86400);
  const totalLockTime = Number(deposit.lockEnd) - Number(deposit.startTime);
  const elapsed = now - Number(deposit.startTime);
  const progress = totalLockTime > 0 ? Math.min(100, (elapsed / totalLockTime) * 100) : 100;

  const isEth = deposit.asset === "0x0000000000000000000000000000000000000000";
  const assetName = isEth
    ? "ETH"
    : VAULT_ASSETS.find((a) => a.address.toLowerCase() === deposit.asset.toLowerCase())?.symbol || "Token";

  function formatNum(n: number) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toFixed(2);
  }

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{TIER_EMOJIS[deposit.tier]}</span>
          <div>
            <div className="font-display font-bold text-white">
              {parseFloat(formatEther(deposit.amount)).toFixed(4)} {assetName}
            </div>
            <div className="text-xs text-white/40">
              ${parseFloat(formatEther(deposit.usdValue)).toFixed(2)} USD &middot; {TIER_NAMES[deposit.tier]}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-ditto-amber">
            +{pendingReward ? formatNum(parseFloat(formatEther(pendingReward as bigint))) : "0"} DITTO
          </div>
          <div className="text-xs text-white/40">
            {lockExpired ? "Unlocked" : `${daysRemaining}d remaining`}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-white/5 rounded-full mb-4">
        <div
          className={`h-full rounded-full transition-all ${lockExpired ? "bg-emerald-400" : "bg-ditto-teal"}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex gap-3">
        {lockExpired ? (
          <button
            onClick={() => onWithdraw(depositIndex)}
            className="flex-1 py-2 rounded-lg bg-gradient-to-r from-ditto-teal to-emerald-400 text-ditto-purple-900 font-bold text-sm hover:shadow-lg transition-all"
          >
            Withdraw + Claim Rewards
          </button>
        ) : (
          <button
            onClick={() => onEmergencyWithdraw(depositIndex)}
            className="flex-1 py-2 rounded-lg bg-white/5 text-white/40 text-sm hover:bg-white/10 hover:text-white/60 transition-all border border-white/5"
          >
            Emergency Withdraw (no rewards)
          </button>
        )}
      </div>
    </div>
  );
}
