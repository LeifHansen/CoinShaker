# DittoCoin Earning Ecosystem — Master Plan

A complete system for earning, buying, and staking DITTO across the DittoCoin and DittoMixer platforms.

---

## 1. Multi-Asset Staking Vault (DittoVault)

**What**: Users deposit ETH, USDC, USDT, or DAI into a vault contract. The vault tracks each deposit and pays out DITTO rewards proportional to the USD value staked and the time held. This is the bridge between the mixer's user base and the DittoCoin token economy.

**How it works**:
- User deposits a supported asset (ETH, USDC, USDT, DAI) into DittoVault.sol
- Vault reads asset prices via Chainlink price feeds to normalize deposits to a USD value
- Rewards accrue in DITTO at a configurable base rate (e.g., 5% APR in DITTO equivalent)
- The existing tier system (Paper Hands → Whale) applies as a multiplier on top of the base rate
- Owner funds the vault's DITTO reward pool from the treasury allocation
- Users claim accumulated DITTO rewards at any time; principal can be withdrawn after the lock period

**Why this is powerful**: Mixer users who hold ETH or stablecoins now have a reason to park assets in the DittoCoin ecosystem instead of Aave or Lido. The DITTO rewards create buying pressure without requiring users to purchase DITTO first.

### Smart Contract: DittoVault.sol

Key design decisions:
- Uses Chainlink AggregatorV3Interface for ETH/USD, USDC/USD, etc.
- Deposits tracked per-user per-asset with timestamp and tier selection
- Reward calculation: `usdValue × baseRateBps × tierMultiplier × elapsed / (365 days × 10000 × 100)`
- Owner can add/remove supported assets and update price feed addresses
- ReentrancyGuard + Pausable + Ownable2Step (consistent with existing contracts)
- Emergency withdraw returns principal only (no rewards), same pattern as DittoStaking

### Tasks

- [ ] Write DittoVault.sol contract with multi-asset deposit, Chainlink price feeds, tier multipliers
- [ ] Write comprehensive test suite (deposit, withdraw, reward calc, emergency exit, price feed edge cases)
- [ ] Add supported asset management (addAsset, removeAsset, updatePriceFeed)
- [ ] Deploy Chainlink price feed mocks for Hardhat/Sepolia testing
- [ ] Build frontend Vault page: asset selector, deposit form, live reward counter, claim button
- [ ] Add vault stats to Dashboard: total vault TVL, user's vault positions, pending DITTO rewards
- [ ] Integrate vault contract addresses into frontend/lib/contracts.ts
- [ ] Audit vault contract (critical — handles multiple external assets)

---

## 2. Presale Launch (DittoPresale)

**What**: A time-limited token sale before the Uniswap listing. Buyers send ETH and receive DITTO at a discounted price. Multiple rounds with increasing prices reward early supporters.

**Structure — 3 rounds**:

| Round | Price Discount | Allocation | Vesting |
|-------|---------------|------------|---------|
| Seed | 60% off listing price | 5% of supply (21B DITTO) | 25% at TGE, 75% linear over 90 days |
| Early Bird | 40% off listing price | 10% of supply (42B DITTO) | 50% at TGE, 50% linear over 60 days |
| Public | 20% off listing price | 10% of supply (42B DITTO) | 100% at TGE |

**Token Generation Event (TGE)** = the moment liquidity goes live on Uniswap.

**Key features**:
- Hardcap per round (configurable ETH amount)
- Softcap — if not reached, all ETH is refundable
- Per-wallet max contribution (anti-whale for presale too)
- Whitelist for Seed round (early community, mixer power users)
- Referral bonus: 5% extra DITTO for both referrer and referee
- Vesting contract holds locked tokens — claimable on schedule after TGE
- Unsold tokens from any round burn automatically (deflationary signal)

### Smart Contracts

**DittoPresale.sol** — Handles deposits, round management, refunds
**DittoVesting.sol** — Holds purchased tokens, releases on schedule after TGE

### Tasks

- [ ] Write DittoPresale.sol: round management, whitelist, hardcap/softcap, refund logic, referral tracking
- [ ] Write DittoVesting.sol: linear vesting with cliff, claimable after TGE timestamp set by owner
- [ ] Write test suite for presale (buy, refund, round transitions, whitelist, referral bonus, vesting claims)
- [ ] Build presale frontend page: countdown timer, round progress bar, buy form, referral link generator
- [ ] Build vesting dashboard: show locked vs. claimable vs. claimed DITTO with timeline visualization
- [ ] Design presale landing page for marketing (can be a standalone page at dittocoin.com/presale)
- [ ] Decide final tokenomics allocation (see section 7 below)
- [ ] Set listing price, round discounts, and caps based on target raise
- [ ] Prepare presale announcement content (Twitter threads, Medium post, Telegram)
- [ ] Set up whitelist application form (Google Form or custom)

---

## 3. Direct Purchase (Post-Presale)

**What**: After presale ends and Uniswap liquidity is live, users buy DITTO directly through the dApp or on Uniswap.

### Tasks

- [ ] Create Uniswap V2 DITTO/ETH liquidity pool at TGE
- [ ] Lock initial liquidity via Unicrypt or Team Finance (proves no rug)
- [ ] Integrate Uniswap SDK into buy page for real-time pricing (replace placeholder 0.0000000001)
- [ ] Add price impact warnings for large trades
- [ ] Add 1inch / Paraswap aggregator as alternative swap route
- [ ] Submit token to DEXTools, DEXScreener, CoinGecko, CoinMarketCap

---

## 4. Mixer Usage Rewards (DittoMixerRewards)

**What**: Users who use the DittoMixer earn DITTO proportional to their mixing volume. This directly ties the mixer's utility to DittoCoin demand.

**How it works**:
- The mixer backend tracks completed mix transactions per wallet
- A MerkleDistributor contract on Ethereum holds claimable DITTO rewards
- Every week (or epoch), the backend generates a Merkle tree of eligible wallets + reward amounts
- Users claim their rewards on-chain by providing a Merkle proof
- Reward rate: e.g., 0.1% of mix volume paid in DITTO (at current market price)

**Why Merkle distribution**: The mixer runs off-chain (Express + PostgreSQL). We can't have the mixer directly call an on-chain contract for every mix. Instead, batch rewards weekly via Merkle proofs — gas efficient, provably fair, and the standard approach (same pattern Uniswap used for UNI airdrop).

### Tasks

- [ ] Write DittoMerkleDistributor.sol (claim with Merkle proof, one claim per epoch per user)
- [ ] Build Merkle tree generator script (reads mixer DB, computes rewards, generates tree + proofs)
- [ ] Add API endpoint to mixer backend: GET /api/rewards/:address (returns proof + claimable amount)
- [ ] Build rewards claim page on dittocoin.com (or link from mixer)
- [ ] Set reward rate and weekly DITTO budget from treasury
- [ ] Test full flow: mix → backend tracks → Merkle tree → claim on-chain

---

## 5. Referral Program (On-Chain)

**What**: Every user gets a unique referral link. When someone they refer stakes, buys in presale, or uses the vault, both parties earn bonus DITTO.

**Tiers**:
- **Bronze** (1-5 referrals): 3% bonus on referee's staking rewards
- **Silver** (6-20 referrals): 5% bonus + early access to new features
- **Gold** (21+ referrals): 8% bonus + "Ambassador" badge + governance weight boost

**Implementation**: Referral tracking can be on-chain (mapping in the presale/vault contracts) for presale bonuses, and off-chain (backend DB) for mixer referrals with Merkle-claimed rewards.

### Tasks

- [ ] Add referral tracking to DittoPresale.sol (referrer address stored with each purchase)
- [ ] Add referral bonus to DittoVault.sol (bonus multiplier on rewards based on referral count)
- [ ] Build referral dashboard: unique link, referral count, tier, total earned from referrals
- [ ] Generate shareable referral links (dittocoin.com/?ref=0xABC...)
- [ ] Track referral conversions in mixer backend
- [ ] Design referral leaderboard page

---

## 6. Creative Earning Mechanisms

### 6a. Liquidity Mining (DittoLPFarm)

Users who provide DITTO/ETH liquidity on Uniswap can stake their LP tokens to earn additional DITTO. This incentivizes deep liquidity and tighter spreads.

- [ ] Write DittoLPFarm.sol: stake Uniswap V2 LP tokens, earn DITTO rewards
- [ ] Set reward emission schedule (e.g., 2B DITTO over 6 months, decaying)
- [ ] Build LP staking page: deposit LP tokens, view APR, claim rewards
- [ ] Add LP position value display (show underlying ETH + DITTO amounts)

### 6b. Burn-to-Boost

Users voluntarily burn DITTO to get a temporary multiplier on their staking/vault rewards. Creates additional deflationary pressure.

- **Burn 1,000 DITTO** → 1.1x boost for 7 days
- **Burn 10,000 DITTO** → 1.25x boost for 30 days
- **Burn 100,000 DITTO** → 1.5x boost for 90 days

- [ ] Add burnForBoost() function to DittoStaking.sol and DittoVault.sol
- [ ] Track active boosts per user (struct with expiry timestamp and multiplier)
- [ ] Build boost UI: burn amount selector, active boost display, countdown to expiry

### 6c. Quest & Achievement System

Off-chain quest tracking with on-chain reward claims. Users complete actions to earn "DittoPoints" that convert to claimable DITTO.

**Quest examples**:
- "First Mix" — Complete your first mixer transaction (500 points)
- "Diamond Hands" — Stake for 90+ days without emergency exit (2,000 points)
- "Social Butterfly" — Follow @DittoCoin on X + join Telegram (200 points)
- "Whale Watcher" — Hold 1M+ DITTO for 30 days (1,000 points)
- "Burn Baby Burn" — Use Burn-to-Boost 3 times (750 points)
- "Liquidity Legend" — Provide LP for 60+ days (3,000 points)
- "Refer a Friend" — Get 3 referrals who each stake (1,500 points)
- "Era Survivor" — Hold through a halving event (1,000 points)

**Daily missions** (reset every 24h):
- "Daily Check-in" — Connect wallet to dApp (10 points, streak bonus: 7-day streak = 2x)
- "Daily Mix" — Complete 1 mixer transaction (50 points)
- "Daily Swap" — Buy any amount of DITTO (25 points)

**Implementation**: Backend tracks quest completion, periodically publishes Merkle roots for point-to-DITTO conversion claims.

- [ ] Design quest/achievement data model in mixer backend (user_quests table)
- [ ] Build quest tracking API: POST /api/quests/complete, GET /api/quests/:address
- [ ] Write DittoQuestRewards.sol (Merkle-based claim, similar to mixer rewards)
- [ ] Build quests page: quest list with progress bars, claimable rewards, streak counter
- [ ] Design achievement badges (SVG or small PNGs for each quest)
- [ ] Set point-to-DITTO conversion rate and weekly quest reward budget

### 6d. Airdrop Campaigns

Snapshot-based airdrops to reward early adopters and create buzz.

**Planned airdrops**:
- **Genesis Airdrop** — Presale participants who hold through TGE + 30 days get 10% bonus airdrop
- **Mixer Loyalty Airdrop** — Top 500 mixer users by volume (pre-DITTO launch) get DITTO proportional to historical volume
- **Community Airdrop** — Discord/Telegram members who complete verification tasks

- [ ] Write airdrop snapshot script (query on-chain balances + mixer DB at a specific block/date)
- [ ] Write DittoAirdrop.sol (Merkle distributor with expiry — unclaimed tokens return to treasury after 90 days)
- [ ] Plan airdrop timeline and announce criteria in advance (drives engagement)

### 6e. Governance Voting Rewards

Once governance is live, users who vote on treasury proposals earn a small DITTO reward. This combats voter apathy and ensures community participation.

- [ ] Design lightweight governance: Snapshot.org for off-chain voting (free, gas-free)
- [ ] Reward voters via Merkle claim after each proposal closes
- [ ] Set voting reward: flat amount per vote (e.g., 100 DITTO) + bonus for voting streak

---

## 7. Revised Tokenomics Allocation

With the earning ecosystem, the 420B supply needs clear allocation:

| Category | % | Amount | Purpose |
|----------|---|--------|---------|
| Uniswap Liquidity | 25% | 105B | Initial DEX liquidity (locked) |
| Presale (all rounds) | 25% | 105B | Seed + Early Bird + Public sale |
| Staking & Vault Rewards | 20% | 84B | Fund DittoStaking + DittoVault reward pools |
| Mixer & Quest Rewards | 10% | 42B | Mixer usage rewards, quests, achievements |
| LP Mining Rewards | 5% | 21B | Incentivize Uniswap LP providers |
| Airdrops | 5% | 21B | Genesis, loyalty, community airdrops |
| Treasury | 5% | 21B | Community-governed fund for growth |
| Team | 5% | 21B | 12-month cliff, 24-month linear vest |

---

## 8. Priority Task List (Build Order)

### Phase A: Core Contracts (Weeks 1-3)

1. [ ] Write DittoPresale.sol + DittoVesting.sol
2. [ ] Write DittoVault.sol (multi-asset staking with Chainlink feeds)
3. [ ] Write DittoLPFarm.sol (LP token staking)
4. [ ] Write test suites for all new contracts
5. [ ] Deploy all contracts to Sepolia testnet
6. [ ] End-to-end testing on Sepolia

### Phase B: Presale Launch (Weeks 3-5)

7. [ ] Build presale page (countdown, progress, buy form, referral links)
8. [ ] Build vesting dashboard (locked/claimable/claimed timeline)
9. [ ] Open whitelist applications for Seed round
10. [ ] Launch Seed round
11. [ ] Launch Early Bird round
12. [ ] Launch Public round
13. [ ] Prepare Uniswap listing (liquidity, pricing)

### Phase C: TGE & Liquidity (Week 5-6)

14. [ ] Deploy all contracts to Ethereum mainnet
15. [ ] Create Uniswap V2 DITTO/ETH pool
16. [ ] Lock liquidity (Unicrypt/Team Finance)
17. [ ] Enable vesting claims (set TGE timestamp)
18. [ ] Fund staking + vault reward pools
19. [ ] Update frontend with mainnet contract addresses
20. [ ] Deploy frontend to Vercel + connect dittocoin.com

### Phase D: Earning Ecosystem (Weeks 6-10)

21. [ ] Launch DittoVault (multi-asset staking page)
22. [ ] Launch DittoLPFarm (LP mining page)
23. [ ] Write DittoMerkleDistributor.sol for mixer rewards
24. [ ] Build Merkle tree generator + mixer backend integration
25. [ ] Launch mixer usage rewards
26. [ ] Build quest/achievement system backend
27. [ ] Launch quests page with initial quest set
28. [ ] Implement Burn-to-Boost feature
29. [ ] Launch referral program with dashboard

### Phase E: Community & Growth (Ongoing)

30. [ ] Genesis Airdrop for presale holders
31. [ ] Mixer Loyalty Airdrop for early users
32. [ ] Weekly quest refreshes and seasonal events
33. [ ] Governance setup (Snapshot.org) + voting rewards
34. [ ] Referral leaderboard competitions
35. [ ] Content marketing around each halving era milestone
36. [ ] CoinGecko / CoinMarketCap listings

---

## 9. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    dittocoin.com                      │
│  Next.js Frontend (Buy, Stake, Vault, Presale,       │
│  Quests, Dashboard, Referrals, LP Farm)               │
└────────────────────────┬────────────────────────────┘
                         │ wagmi / viem
    ┌────────────────────┼────────────────────┐
    ▼                    ▼                    ▼
┌─────────┐    ┌──────────────┐    ┌──────────────┐
│DittoCoin │    │ DittoStaking │    │  DittoVault  │
│ (ERC20)  │    │ (DITTO only) │    │ (ETH/USDC/.. │
│          │    │              │    │ → earn DITTO) │
└─────────┘    └──────────────┘    └──────────────┘
    │                                      │
    ▼                                      ▼
┌─────────┐    ┌──────────────┐    ┌──────────────┐
│ Presale  │    │  LP Farm     │    │   Chainlink  │
│+ Vesting │    │ (Uni LP →    │    │ Price Feeds  │
│          │    │  earn DITTO) │    │              │
└─────────┘    └──────────────┘    └──────────────┘

┌─────────────────────────────────────────────────────┐
│              mixer.dittocoin.com                      │
│  DittoMixer (React + Express + PostgreSQL)            │
│  Tracks mix volume per wallet                         │
└────────────────────────┬────────────────────────────┘
                         │ weekly Merkle tree
                         ▼
              ┌──────────────────┐
              │ MerkleDistributor│ ← also used for
              │ (claim DITTO     │   quests, airdrops,
              │  with proof)     │   voting rewards
              └──────────────────┘
```

---

## 10. Revenue Model

DittoCoin generates sustainable revenue through:

1. **1% Treasury Fee** — Every DITTO transfer sends 1% to the community treasury
2. **Mixer Fees** — DittoMixer charges a fee per mix; portion funds DITTO buybacks
3. **Presale Proceeds** — ETH raised funds liquidity + development
4. **LP Trading Fees** — 0.3% Uniswap fee on every trade (accrues to LP holders, including project-owned liquidity)

The treasury is self-funding via the on-chain 1% fee. As DITTO trading volume grows, the treasury grows automatically.
