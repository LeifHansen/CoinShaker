# DittoCoin — Where things stand

**Last updated:** 2026-04-10

## TL;DR

Local repo is clean and fully committed. **Push it from your Mac** (double-click `push-to-github.command`) — that's the only thing blocking a complete GitHub state. Once pushed, everything else is ready.

Live marketing landing: https://leifhansen.github.io/DittoCoin/ ✅

## What's in the local repo (ready to ship)

- **Contracts** (`contracts/`): DittoCoin.sol (ERC20 + halving burn + 1% treasury fee + 1%/0.5% anti-whale), DittoPresale.sol, DittoStaking.sol (4 tiers up to 80% APR), DittoVesting.sol, DittoVault.sol, mocks/MockPriceFeed.sol. All on Solidity 0.8.20, OpenZeppelin v5 (Ownable2Step, Pausable, ReentrancyGuard, SafeERC20).
- **Tests** (`test/`): 5 Hardhat test files, one per contract.
- **Scripts** (`scripts/`): deploy.js, deploy-presale.js, deploy-vault.js, verify.js.
- **Frontend** (`frontend/`): Next.js 14 App Router app with wagmi + RainbowKit + WalletConnect. Pages: /, /buy, /stake, /presale, /vault, /vesting, /dashboard. Hardened with CSP, ErrorBoundary, SEO metadata.
- **Docs**: README.md, BRAND-GUIDE.md, LAUNCH-CHECKLIST.md, DITTO-EARNING-ECOSYSTEM.md, CRYPTOSHAKER-MERGE-PLAN.md.
- **Config**: LICENSE (MIT), `.gitignore`, `.env.example`, `frontend/.env.local.example`, hardhat.config.js.

## What you need to do next

See `TODO-LATER.md` for the full list. The critical path:

1. **Push from Mac** — double-click `push-to-github.command`. Creates a GitHub PAT (classic, `repo` scope) the first time.
2. **Delete `TestFile.sol`** from GitHub (web UI — I can't delete files per Claude safety policy). Link: https://github.com/LeifHansen/DittoCoin/blob/main/TestFile.sol
3. **Get API keys** — Alchemy, Etherscan, WalletConnect. Put them in `.env` and `frontend/.env.local`.
4. **Fund a dedicated deployer wallet** with Sepolia ETH.
5. **Run `npm install && npm test`** on your Mac — I couldn't verify compilation here (sandbox can't reach the Solidity compiler CDN).
6. **Deploy to Sepolia testnet** — `npx hardhat run scripts/deploy.js --network sepolia`.
7. **Deploy the Next.js dApp** — Vercel is zero-config, DigitalOcean App Platform works too. `frontend/` is the root directory. Instructions in `TODO-LATER.md`.
8. **Before mainnet**: professional audit, Gnosis Safe multisig, Timelock, locked liquidity, legal review. Details in `LAUNCH-CHECKLIST.md`.

## Frontend hardening notes (committed in `1686b6f`)

- **ErrorBoundary** wraps `<main>` — any page render crash degrades to a fallback UI instead of blanking the whole tree.
- **CSP header** in `frontend/next.config.js` — tuned for wagmi/RainbowKit/WalletConnect. Allows `https:` and `wss:` in `connect-src` (for Ethereum RPCs and WC relays), `data:`/`blob:` in `img-src` (for wallet icons), `frame-src` for `verify.walletconnect.*`.
- Full security header suite alongside CSP: HSTS (2-year preload), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy denying camera/mic/geo, `poweredByHeader: false`.
- **Next 14 metadata schema fixes** in `layout.tsx` — `canonical` under `alternates`, `max-snippet`/`max-image-preview`/`max-video-preview` under `robots.googleBot` (were silently ignored before).
- **Stake page tx error handling** — wagmi errors from both `writeContract` and `waitForTransactionReceipt` (approve + stake paths) now bubble into a red error banner with `shortMessage` text. Button shows "Try again" on failure and re-enables. No more stuck spinners.

## Files you might want to know about

- `STATUS.md` (this file) — current state at a glance
- `TODO-LATER.md` — step-by-step instructions, deploy options, full context
- `LAUNCH-CHECKLIST.md` — pre-Sepolia and pre-mainnet checklists
- `push-to-github.command` — double-click to push from your Mac
- `BRAND-GUIDE.md` — voice, visual identity, copy patterns
- `DITTO-EARNING-ECOSYSTEM.md` — tokenomics deep-dive
