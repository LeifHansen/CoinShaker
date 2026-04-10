"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACTS, PRESALE_ROUNDS } from "@/lib/contracts";
import DittoPresaleABI from "@/abi/DittoPresale.json";

function formatNum(n: number) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toFixed(2);
}

function formatETH(n: number) {
  if (n >= 1000) return n.toFixed(0);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

type RoundStatus = {
  state: number;
  totalRaised: bigint;
  tokensSold: bigint;
  hardcapETH: bigint;
  softcapETH: bigint;
  tokenAllocation: bigint;
};

export default function PresalePage() {
  const { address, isConnected, chain } = useAccount();
  const [selectedRound, setSelectedRound] = useState(0);
  const [ethAmount, setEthAmount] = useState("");
  const [referrerAddress, setReferrerAddress] = useState("");

  const network = chain?.id === 1 ? "mainnet" : "sepolia";
  const presaleAddress = CONTRACTS[network]?.dittoPresale;
  const isDeployed =
    presaleAddress !== "0x0000000000000000000000000000000000000000";

  // Read referrer from URL params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref && ref.startsWith("0x") && ref.length === 42) {
        setReferrerAddress(ref);
      }
    }
  }, []);

  // Read round status
  const { data: roundStatus } = useReadContract({
    address: presaleAddress,
    abi: DittoPresaleABI,
    functionName: "getRoundStatus",
    args: [selectedRound],
    query: { enabled: isDeployed, refetchInterval: 10_000 },
  });

  // Read user purchase
  const { data: userPurchase } = useReadContract({
    address: presaleAddress,
    abi: DittoPresaleABI,
    functionName: "getPurchase",
    args: address ? [address, selectedRound] : undefined,
    query: { enabled: isDeployed && !!address, refetchInterval: 10_000 },
  });

  // Read whitelist status
  const { data: isWhitelisted } = useReadContract({
    address: presaleAddress,
    abi: DittoPresaleABI,
    functionName: "whitelisted",
    args: address ? [address] : undefined,
    query: { enabled: isDeployed && !!address },
  });

  // Read referral info
  const { data: referralCount } = useReadContract({
    address: presaleAddress,
    abi: DittoPresaleABI,
    functionName: "referralCount",
    args: address ? [address] : undefined,
    query: { enabled: isDeployed && !!address },
  });

  const { data: referralTier } = useReadContract({
    address: presaleAddress,
    abi: DittoPresaleABI,
    functionName: "getReferralTier",
    args: address ? [address] : undefined,
    query: { enabled: isDeployed && !!address },
  });

  // Buy transaction
  const {
    writeContract: buyContract,
    data: buyHash,
    isPending: isBuying,
  } = useWriteContract();

  const { isSuccess: buyConfirmed } = useWaitForTransactionReceipt({
    hash: buyHash,
  });

  // Parse round data
  const rs = roundStatus as RoundStatus | undefined;
  const roundState = rs ? Number(rs.state) : 0;
  const totalRaised = rs ? parseFloat(formatEther(rs.totalRaised)) : 0;
  const hardcap = rs ? parseFloat(formatEther(rs.hardcapETH)) : 0;
  const softcap = rs ? parseFloat(formatEther(rs.softcapETH)) : 0;
  const tokensSold = rs
    ? parseFloat(formatEther(rs.tokensSold))
    : 0;
  const tokenAllocation = rs
    ? parseFloat(formatEther(rs.tokenAllocation))
    : 0;
  const progressPct = hardcap > 0 ? (totalRaised / hardcap) * 100 : 0;

  const stateLabels = ["Inactive", "Active", "Finalized", "Refunding"];
  const stateColors = [
    "text-white/40",
    "text-emerald-400",
    "text-ditto-teal",
    "text-red-400",
  ];

  // User's purchase info
  const up = userPurchase as
    | { ethSpent: bigint; tokensOwed: bigint; referralBonus: bigint; refunded: boolean }
    | undefined;
  const userEthSpent = up ? parseFloat(formatEther(up.ethSpent)) : 0;
  const userTokensOwed = up ? parseFloat(formatEther(up.tokensOwed)) : 0;
  const userReferralBonus = up
    ? parseFloat(formatEther(up.referralBonus))
    : 0;

  const ethNum = parseFloat(ethAmount) || 0;
  const round = PRESALE_ROUNDS[selectedRound];

  function handleBuy() {
    if (!address || ethNum <= 0 || !isDeployed) return;
    const ref = referrerAddress || "0x0000000000000000000000000000000000000000";
    buyContract({
      address: presaleAddress,
      abi: DittoPresaleABI,
      functionName: "buy",
      args: [selectedRound, ref],
      value: parseEther(ethAmount),
    });
  }

  // Referral link
  const myRefLink = address
    ? `${typeof window !== "undefined" ? window.location.origin : "https://dittocoin.com"}/presale?ref=${address}`
    : "";

  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">
            <span className="text-ditto-teal">$DITTO</span> Presale
          </h1>
          <p className="text-white/50 max-w-xl mx-auto">
            Get DittoCoin at up to 60% off the listing price. Three rounds,
            increasing prices. Early supporters earn the most.
          </p>
        </motion.div>

        {/* Round Selector */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {PRESALE_ROUNDS.map((r, i) => (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedRound(r.id)}
              className={`text-left rounded-xl p-5 transition-all ${
                selectedRound === r.id
                  ? "glass-card glow-teal scale-[1.02]"
                  : "glass-card opacity-60 hover:opacity-80"
              }`}
            >
              <div className="font-display font-bold text-white text-lg mb-1">
                {r.name}
              </div>
              <div className="text-ditto-teal font-bold text-2xl mb-2">
                {r.discount} OFF
              </div>
              <div className="text-white/40 text-xs space-y-1">
                <div>TGE: {r.tgePercent}% unlock</div>
                <div>
                  Vesting:{" "}
                  {r.vestingDays > 0
                    ? `${r.vestingDays} day linear`
                    : "None — 100% at TGE"}
                </div>
                {r.whitelisted && (
                  <div className="text-ditto-amber font-medium">
                    Whitelist required
                  </div>
                )}
              </div>
            </motion.button>
          ))}
        </div>

        {/* Round Status + Buy Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Status Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-white text-lg">
                {round.name} Round
              </h2>
              <span
                className={`text-sm font-semibold ${stateColors[roundState]}`}
              >
                {isDeployed ? stateLabels[roundState] : "Not Deployed"}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-white/40 mb-1">
                <span>
                  {formatETH(totalRaised)} ETH raised
                </span>
                <span>{formatETH(hardcap)} ETH hardcap</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-ditto-teal to-emerald-400 transition-all duration-1000"
                  style={{ width: `${Math.min(progressPct, 100)}%` }}
                />
              </div>
              {softcap > 0 && (
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-white/30">
                    Softcap: {formatETH(softcap)} ETH
                  </span>
                  <span
                    className={
                      totalRaised >= softcap
                        ? "text-emerald-400"
                        : "text-ditto-amber"
                    }
                  >
                    {totalRaised >= softcap ? "Reached!" : "Not yet reached"}
                  </span>
                </div>
              )}
            </div>

            {/* Token stats */}
            <div className="space-y-2 border-t border-white/5 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Tokens Sold</span>
                <span className="text-white">
                  {formatNum(tokensSold)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Allocation</span>
                <span className="text-white">
                  {formatNum(tokenAllocation)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Discount</span>
                <span className="text-ditto-teal font-semibold">
                  {round.discount}
                </span>
              </div>
            </div>

            {/* User's position */}
            {userEthSpent > 0 && (
              <div className="mt-4 border-t border-white/5 pt-4">
                <div className="text-xs text-white/30 font-medium uppercase tracking-wider mb-2">
                  Your Position
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">ETH Spent</span>
                    <span className="text-white">
                      {formatETH(userEthSpent)} ETH
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Tokens Owed</span>
                    <span className="text-ditto-teal font-semibold">
                      {formatNum(userTokensOwed)} DITTO
                    </span>
                  </div>
                  {userReferralBonus > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">Referral Bonus</span>
                      <span className="text-ditto-amber font-semibold">
                        +{formatNum(userReferralBonus)} DITTO
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>

          {/* Buy Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-2xl p-6"
          >
            <h2 className="font-display font-bold text-white text-lg mb-4">
              Buy $DITTO
            </h2>

            {/* Whitelist warning for Seed */}
            {round.whitelisted && isConnected && !isWhitelisted && (
              <div className="bg-ditto-amber/10 border border-ditto-amber/30 rounded-xl p-3 mb-4 text-sm text-ditto-amber">
                This round requires whitelist access. Apply for whitelist
                through our community channels.
              </div>
            )}

            {/* ETH input */}
            <div className="mb-4">
              <label className="text-sm text-white/50 mb-2 block">
                Amount (ETH)
              </label>
              <input
                type="number"
                value={ethAmount}
                onChange={(e) => setEthAmount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-ditto-purple-900/60 border border-white/10 rounded-xl px-4 py-4 text-white text-xl font-mono focus:outline-none focus:border-ditto-teal/40 transition-colors"
              />
            </div>

            {/* Referral input */}
            <div className="mb-6">
              <label className="text-sm text-white/50 mb-2 block">
                Referral Address (optional)
              </label>
              <input
                type="text"
                value={referrerAddress}
                onChange={(e) => setReferrerAddress(e.target.value)}
                placeholder="0x..."
                className="w-full bg-ditto-purple-900/60 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-ditto-teal/40 transition-colors"
              />
              {referrerAddress && (
                <div className="text-xs text-ditto-teal mt-1">
                  5% bonus for you and the referrer
                </div>
              )}
            </div>

            {/* Buy button */}
            {isConnected ? (
              <button
                onClick={handleBuy}
                disabled={
                  ethNum <= 0 ||
                  !isDeployed ||
                  roundState !== 1 ||
                  isBuying ||
                  buyConfirmed
                }
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all btn-shine ${
                  buyConfirmed
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : isBuying
                    ? "bg-ditto-teal/20 text-ditto-teal animate-pulse"
                    : ethNum > 0 && roundState === 1
                    ? "bg-gradient-to-r from-ditto-teal to-emerald-400 text-ditto-purple-900 hover:shadow-lg hover:shadow-ditto-teal/20"
                    : "bg-white/5 text-white/30 cursor-not-allowed"
                }`}
              >
                {buyConfirmed
                  ? "\u2713 Purchase Complete!"
                  : isBuying
                  ? "Confirming..."
                  : roundState !== 1
                  ? "Round Not Active"
                  : ethNum <= 0
                  ? "Enter ETH Amount"
                  : `Buy DITTO with ${formatETH(ethNum)} ETH`}
              </button>
            ) : (
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            )}
          </motion.div>
        </div>

        {/* Referral Section */}
        {isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card rounded-2xl p-6 mb-8"
          >
            <h2 className="font-display font-bold text-white text-lg mb-4">
              Referral Program
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-ditto-purple-900/40 rounded-xl p-4 text-center">
                <div className="text-white/40 text-sm mb-1">Your Referrals</div>
                <div className="font-display text-2xl font-bold text-white">
                  {referralCount !== undefined ? Number(referralCount) : 0}
                </div>
              </div>
              <div className="bg-ditto-purple-900/40 rounded-xl p-4 text-center">
                <div className="text-white/40 text-sm mb-1">Tier</div>
                <div className="font-display text-2xl font-bold text-ditto-teal">
                  {(referralTier as string) || "None"}
                </div>
              </div>
              <div className="bg-ditto-purple-900/40 rounded-xl p-4 text-center">
                <div className="text-white/40 text-sm mb-1">Bonus Rate</div>
                <div className="font-display text-2xl font-bold text-ditto-amber">
                  5%
                </div>
              </div>
            </div>

            {/* Referral link */}
            <div>
              <label className="text-sm text-white/50 mb-2 block">
                Your Referral Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={myRefLink}
                  readOnly
                  className="flex-1 bg-ditto-purple-900/60 border border-white/10 rounded-xl px-4 py-3 text-white/60 text-sm font-mono"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(myRefLink)}
                  className="px-5 py-3 bg-white/5 text-white/50 rounded-xl text-sm font-medium hover:bg-white/10 hover:text-white/70 transition-colors border border-white/5"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-white/30 mt-2">
                Share this link. Both you and the buyer get 5% bonus DITTO on
                every purchase.
              </p>
            </div>
          </motion.div>
        )}

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <h2 className="font-display text-2xl font-bold text-center mb-8">
            How the Presale <span className="text-ditto-teal">Works</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {
                step: "01",
                title: "Connect Wallet",
                desc: "Link your wallet and ensure you have ETH for the purchase.",
                icon: "\u{1F517}",
              },
              {
                step: "02",
                title: "Choose Round",
                desc: "Seed has the biggest discount but requires whitelist. Public is open to all.",
                icon: "\u{1F3AF}",
              },
              {
                step: "03",
                title: "Buy $DITTO",
                desc: "Send ETH to the presale contract. Tokens are held in vesting until TGE.",
                icon: "\u{1F4B0}",
              },
              {
                step: "04",
                title: "Claim at TGE",
                desc: "When liquidity goes live, claim your tokens based on the vesting schedule.",
                icon: "\u{1F680}",
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className="glass-card rounded-xl p-5 relative overflow-hidden"
              >
                <div className="absolute top-2 right-3 text-4xl font-black text-white/[0.03] font-display">
                  {item.step}
                </div>
                <div className="text-2xl mb-3">{item.icon}</div>
                <h3 className="font-display font-bold text-white mb-1">
                  {item.title}
                </h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
