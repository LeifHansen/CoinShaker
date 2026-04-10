"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { STAKING_TIERS } from "@/lib/contracts";
import { BurnTracker } from "@/components/BurnTracker";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const TOKENOMICS = [
  { label: "Initial Supply", value: "420B", sub: "420 Billion DITTO", icon: "\u{1FA99}" },
  { label: "Burn per Tx", value: "2%\u2193", sub: "Halves every 180 days", icon: "\u{1F525}" },
  { label: "Treasury Fee", value: "1%", sub: "Community-funded growth", icon: "\u{1F3E6}" },
  { label: "Max Wallet", value: "1%", sub: "Anti-whale protection", icon: "\u{1F6E1}\uFE0F" },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Connect Wallet", desc: "Link your MetaMask, WalletConnect, or any EVM wallet in one click.", icon: "\u{1F517}" },
  { step: "02", title: "Buy $DITTO", desc: "Swap ETH for DITTO directly through our built-in Uniswap integration.", icon: "\u{1F4B0}" },
  { step: "03", title: "Stake & Earn", desc: "Lock your tokens in a staking tier to earn up to 80% APR.", icon: "\u{1F4C8}" },
  { step: "04", title: "HODL & Burn", desc: "Every transaction burns tokens. The burn rate halves every 180 days \u2014 just like Bitcoin.", icon: "\u{1F48E}" },
];

function fadeUp(delay: number = 0) {
  return {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6, delay },
  };
}

export default function HomePage() {
  return (
    <div>
      {/* ── Hero with Video Background ────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-20 pb-28 min-h-[90vh] flex items-center">
        {/* Video background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/ditto-hero.mp4" type="video/mp4" />
        </video>
        {/* Dark overlay so text is readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-ditto-purple-900/70 via-ditto-purple-900/60 to-ditto-purple-900/90" />

        <div className="mx-auto max-w-5xl text-center relative z-10">
          <motion.div {...fadeUp()} className="mb-8">
            <div className="relative mx-auto h-32 w-32 animate-float">
              <Image
                src="/logo.png"
                alt="DittoCoin mascot"
                fill
                className="object-contain drop-shadow-[0_0_30px_rgba(26,200,176,0.3)]"
                priority
              />
            </div>
          </motion.div>

          <motion.h1
            {...fadeUp(0.1)}
            className="font-display text-5xl md:text-7xl font-black tracking-tight mb-6"
          >
            The Memecoin That{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-ditto-teal to-ditto-pink">
              Burns Brighter
            </span>
          </motion.h1>

          <motion.p
            {...fadeUp(0.2)}
            className="mx-auto max-w-2xl text-lg text-white/60 mb-10 leading-relaxed"
          >
            Deflationary by design. Community-funded. Whale-proof.
            Stake your DITTO and earn up to 80% APR while the supply shrinks with every transaction.
          </motion.p>

          <motion.div {...fadeUp(0.3)} className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/buy"
              className="btn-shine px-8 py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-ditto-teal to-emerald-400 text-ditto-purple-900 hover:shadow-lg hover:shadow-ditto-teal/20 transition-all"
            >
              Buy $DITTO
            </Link>
            <Link
              href="/stake"
              className="btn-shine px-8 py-4 rounded-xl font-bold text-lg bg-white/5 text-white border border-white/10 hover:border-ditto-teal/30 hover:bg-white/10 transition-all"
            >
              Start Staking
            </Link>
          </motion.div>
        </div>
      </section>

      {/* SEO Content - Visually Hidden */}
      <p className="sr-only">
        DittoCoin (DITTO) is a deflationary ERC20 memecoin on the Ethereum blockchain with Bitcoin-style halving burn, 1% community treasury fee, anti-whale protection, and gamified DeFi staking rewards up to 80% APR.
      </p>

      {/* ── Burn Tracker ─────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-3xl">
          <ErrorBoundary>
            <BurnTracker />
          </ErrorBoundary>
        </div>
      </section>

      {/* ── Tokenomics ───────────────────────────────────── */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <motion.h2
            {...fadeUp()}
            className="font-display text-3xl md:text-4xl font-bold text-center mb-4"
          >
            Token<span className="text-ditto-teal">omics</span>
          </motion.h2>
          <motion.p {...fadeUp(0.1)} className="text-center text-white/40 mb-12">
            Simple, transparent, on-chain
          </motion.p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TOKENOMICS.map((t, i) => (
              <motion.div
                key={t.label}
                {...fadeUp(i * 0.1)}
                className="glass-card rounded-xl p-6 text-center hover:glow-teal transition-all"
              >
                <div className="text-3xl mb-3">{t.icon}</div>
                <div className="text-white/50 text-sm mb-1">{t.label}</div>
                <div className="font-display text-2xl font-bold text-white">
                  {t.value}
                </div>
                <div className="text-ditto-teal/60 text-xs mt-1">{t.sub}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────── */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <motion.h2
            {...fadeUp()}
            className="font-display text-3xl md:text-4xl font-bold text-center mb-12"
          >
            How It <span className="text-ditto-pink">Works</span>
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((item, i) => (
              <motion.div
                key={item.step}
                {...fadeUp(i * 0.1)}
                className="glass-card rounded-xl p-6 relative overflow-hidden group"
              >
                <div className="absolute top-3 right-3 text-5xl font-black text-white/[0.03] font-display">
                  {item.step}
                </div>
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="font-display text-lg font-bold text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Staking Tiers Preview ────────────────────────── */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <motion.h2
            {...fadeUp()}
            className="font-display text-3xl md:text-4xl font-bold text-center mb-4"
          >
            Staking <span className="text-ditto-purple-600">Tiers</span>
          </motion.h2>
          <motion.p {...fadeUp(0.1)} className="text-center text-white/40 mb-12">
            The longer you lock, the more you earn
          </motion.p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STAKING_TIERS.map((tier, i) => (
              <motion.div
                key={tier.id}
                {...fadeUp(i * 0.1)}
                className="glass-card rounded-xl p-6 text-center hover:scale-105 transition-all cursor-pointer group"
              >
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
                  {tier.emoji}
                </div>
                <h3 className="font-display font-bold text-white text-lg mb-1">
                  {tier.name}
                </h3>
                <p className="text-white/40 text-sm mb-3">Lock {tier.lock}</p>
                <div className="flex items-center justify-center gap-2">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${tier.color} text-white`}
                  >
                    {tier.mult}
                  </span>
                  <span className="text-ditto-teal font-bold">
                    {tier.apr}% APR
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp(0.4)} className="text-center mt-8">
            <Link
              href="/stake"
              className="inline-block px-8 py-3 rounded-xl font-semibold bg-ditto-purple-600/20 text-ditto-purple-600 border border-ditto-purple-600/30 hover:bg-ditto-purple-600/30 transition-all"
            >
              Start Staking Now &rarr;
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="px-6 pb-24">
        <motion.div
          {...fadeUp()}
          className="mx-auto max-w-3xl gradient-border"
        >
          <div className="rounded-2xl bg-ditto-purple-900/80 p-10 text-center">
            <h2 className="font-display text-3xl font-bold mb-4">
              Ready to Join the{" "}
              <span className="text-ditto-teal">Movement</span>?
            </h2>
            <p className="text-white/50 mb-8 max-w-lg mx-auto">
              420 billion tokens. Deflationary. Community-first.
              Get your DITTO before the next burn cycle.
            </p>
            <Link
              href="/buy"
              className="btn-shine inline-block px-10 py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-ditto-teal to-ditto-pink text-white hover:shadow-lg hover:shadow-ditto-teal/20 transition-all"
            >
              Buy $DITTO Now
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
