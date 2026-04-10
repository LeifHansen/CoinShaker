# DittoCoin Launch Checklist

Everything needed to take DITTO from code to commercially viable product.

---

## Phase 1: Foundation (Do First)

### Smart Contract

- [ ] Run full test suite locally — `npm test` (confirm all ~40 tests pass after recent changes)
- [ ] Deploy DittoCoin + DittoStaking to Sepolia testnet
- [ ] Update contract addresses in `frontend/lib/contracts.ts` with deployed Sepolia addresses
- [ ] Verify both contracts on Etherscan (`npx hardhat run scripts/verify.js --network sepolia`)
- [ ] Test every function on Sepolia: transfers, staking, unstaking, emergency unstake, fee exemptions, halving era transitions
- [ ] Fund staking reward pool on testnet and confirm reward calculations are accurate
- [ ] Get a professional smart contract audit (Certik, OpenZeppelin, Sherlock, or similar) — this is non-negotiable for a real launch

### Accounts & Keys

- [ ] Get an Alchemy API key (free tier is fine to start) — https://www.alchemy.com
- [ ] Get an Etherscan API key — https://etherscan.io/myapikey
- [ ] Get a WalletConnect Project ID — https://cloud.walletconnect.com
- [ ] Set up a dedicated deployer wallet (NOT your personal wallet) — fund with ETH for gas
- [ ] Set up `.env` and `frontend/.env.local` with real keys (never commit these)

### Branding & Assets

- [ ] Create DittoCoin logo (PNG, SVG) — save to `frontend/public/logo.png`
- [ ] Create Open Graph image (1200x630) — save to `frontend/public/og-image.png`
- [ ] Create favicon set (16x16, 32x32, apple-touch-icon)
- [ ] Design token icon for CoinGecko/CoinMarketCap submission (256x256 PNG, transparent bg)

---

## Phase 2: Frontend Polish

### Critical Fixes

- [ ] Replace placeholder contract address on buy page (`frontend/app/buy/page.tsx` line 191)
- [ ] Connect BurnTracker component to real contract data (currently shows simulated numbers)
- [ ] Add proper error boundaries around all contract-reading components
- [ ] Add loading states for all blockchain reads (balance, stakes, rewards)
- [ ] Add wallet disconnection handling (what happens when user disconnects mid-stake?)

### UX Improvements

- [ ] Add transaction success/failure toast notifications
- [ ] Add "Add DITTO to MetaMask" button (one-click token import)
- [ ] Show gas estimates before confirming transactions
- [ ] Add transaction history on dashboard
- [ ] Mobile responsive testing across iPhone, Android, tablet
- [ ] Handle network switching (prompt user to switch to correct chain)
- [ ] Dark/light mode toggle (optional but nice)

### Buy Page

- [ ] Integrate real Uniswap V2 pricing (currently shows simulated 0.0000000001 ETH)
- [ ] Add slippage tolerance selector
- [ ] Add price impact warning for large trades
- [ ] Link to Uniswap/DEX directly as alternative

---

## Phase 3: Security & Legal

### Contract Security

- [ ] Set up a Gnosis Safe multisig for treasury address (don't use a single-signer EOA)
- [ ] Set up a Gnosis Safe for contract ownership (prevents single point of failure)
- [ ] Transfer contract ownership to the multisig via `transferOwnership()` (two-step process with Ownable2Step)
- [ ] Consider adding a Timelock controller before the multisig for pause/unpause (prevents instant rug)
- [ ] Document all admin keys and who holds them

### Frontend Security

- [ ] Security headers are in place (already done in next.config.js)
- [ ] CSP (Content Security Policy) header — add if not already present
- [ ] Rate limiting on any API routes
- [ ] No exposed API keys in client-side code (check with `grep -r "0x" frontend/` for leaked private keys)

### Legal

- [ ] Consult a crypto-specialized lawyer about token classification in your jurisdiction
- [ ] Prepare Terms of Service for dittocoin.com
- [ ] Prepare Privacy Policy
- [ ] Prepare disclaimer: "not financial advice, not a security, use at your own risk"
- [ ] Check if you need to register as a money services business (MSB) — especially for the mixer
- [ ] Understand KYC/AML requirements for your jurisdiction

---

## Phase 4: Deployment & Infrastructure

### Mainnet Deploy

- [ ] Deploy DittoCoin to Ethereum mainnet
- [ ] Deploy DittoStaking to Ethereum mainnet
- [ ] Verify both contracts on Etherscan
- [ ] Update `frontend/lib/contracts.ts` with mainnet addresses
- [ ] Fund staking reward pool with initial allocation
- [ ] Exempt Uniswap LP pair address from fees (`setExempt()`)

### Liquidity

- [ ] Create Uniswap V2 liquidity pool (DITTO/ETH pair)
- [ ] Lock initial liquidity (use a locker like Unicrypt or Team Finance — proves you won't pull liquidity)
- [ ] Decide on initial price point and liquidity depth

### Hosting

- [ ] Push final code to GitHub (`LeifHansen/DittoCoin`)
- [ ] Deploy frontend to Vercel (easiest for Next.js) or Digital Ocean
- [ ] Connect dittocoin.com domain via GoDaddy DNS
- [ ] Set up SSL certificate (auto with Vercel)
- [ ] Set up mixer.dittocoin.com for CryptoShaker (separate deployment)
- [ ] Configure DNS records: A/CNAME for both domains

### Monitoring

- [ ] Set up Etherscan token tracker alerts
- [ ] Monitor contract events (transfers, burns, stakes)
- [ ] Set up uptime monitoring for frontend (UptimeRobot, free tier)

---

## Phase 5: Community & Marketing

### Social Presence

- [ ] Create Twitter/X account for DittoCoin
- [ ] Create Telegram group
- [ ] Create Discord server
- [ ] Set up a simple landing page with links to all socials

### Token Listings

- [ ] Submit to CoinGecko (free, takes 1-2 weeks after launch)
- [ ] Submit to CoinMarketCap (free, takes 2-4 weeks)
- [ ] Submit to DEXTools and DEXScreener (auto-detected usually)
- [ ] List on token aggregators (1inch, Matcha, Paraswap)

### Content

- [ ] Write a Medium article explaining DittoCoin's tokenomics (halving burn is a great story)
- [ ] Create a tokenomics infographic
- [ ] Create "How to Buy DITTO" guide for newcomers
- [ ] Prepare launch announcement threads

---

## Phase 6: Post-Launch

- [ ] Monitor first 24-48 hours of trading closely
- [ ] Be ready to pause contract if critical bug is found
- [ ] Engage community, answer questions
- [ ] Consider removing anti-whale limits once trading is established (`removeLimits()`)
- [ ] Track halving eras and create content around each milestone
- [ ] Plan governance structure for treasury spending (community votes?)
- [ ] Consider L2 deployment (Base, Arbitrum) for lower gas fees

---

## Bugs Fixed in This Session

1. **Test file broken** — Owner functions tests referenced removed `setFees()`, `burnFeeBps()`, and `removeFees()`. Updated to use `setTreasuryFee()`, `removeTreasuryFee()`, and added `setLimits()` tests.
2. **README outdated** — Still mentioned flat 2% burn and `removeFees()`. Updated to document halving burn mechanism and correct function names.
3. **useEffect missing dependencies** — Stake page had incomplete dependency arrays that could cause stale closures.
4. **Gas optimization** — Extracted reward calculation denominator to a named constant in DittoStaking.sol.
5. **Legacy file** — Removed unused `dittocoin-dapp.jsx` that duplicated the modern Next.js frontend.
