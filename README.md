# DittoCoin (DITTO)

A community-driven ERC20 memecoin on Ethereum with built-in tokenomics and gamified staking.

## What Makes DITTO Different

Most memecoins are a bare ERC20 with nothing under the hood. DittoCoin ships with real mechanics baked into the contract:

**Halving burn** — Starts at 2% burn per transfer and halves every 180 days, inspired by Bitcoin's halving. Era 0: 2% → Era 1: 1% → Era 2: 0.5% → ... down to a 0.01% floor. The burn never stops — DITTO gets scarcer forever.

**Community treasury** — 1% of every transfer goes to a community treasury wallet. This funds marketing, listings, partnerships — whatever the community needs to grow.

**Anti-whale protection** — No single wallet can hold more than 1% of supply, and no single transaction can move more than 0.5%. This keeps the playing field fair and prevents launch-day dumps.

**Gamified staking** — Lock your DITTO to earn rewards. The longer you commit, the higher your multiplier:

| Tier           | Lock Period | APR Multiplier |
|---------------|-------------|----------------|
| Paper Hands   | 7 days      | 1x (base)      |
| Hodler        | 30 days     | 2x             |
| Diamond Hands | 90 days     | 4x             |
| Whale         | 365 days    | 8x             |

Base APR starts at 10%. A Paper Hands staker earns 10% annualized; a Whale staker earns 80%.

## Token Details

| Property       | Value                  |
|---------------|------------------------|
| Name          | DittoCoin              |
| Symbol        | DITTO                  |
| Decimals      | 18                     |
| Initial Supply| 420,000,000,000 (420B) |
| Burn Fee      | 2% initial, halves every 180 days (0.01% floor) |
| Treasury Fee  | 1% per transfer        |
| Max Wallet    | 1% of supply           |
| Max Tx        | 0.5% of supply         |
| Solidity      | ^0.8.20                |
| Framework     | OpenZeppelin v5        |

## Quick Start

### On Replit
1. Import this project into Replit
2. Open the **Shell** tab and run:
   ```
   npm install
   npm run compile
   npm test
   ```
3. Hit the **Run** button (runs tests by default)

### Locally
```bash
git clone <your-repo-url>
cd dittocoin
npm install
npm run compile
npm test
```

## Available Commands

| Command                  | What it does                                      |
|--------------------------|---------------------------------------------------|
| `npm run compile`        | Compile both Solidity contracts                    |
| `npm test`               | Run the full test suite (~25 tests)                |
| `npm run deploy:local`   | Deploy both contracts to a local Hardhat node      |
| `npm run deploy:sepolia` | Deploy to Sepolia testnet                          |
| `npm run deploy:mainnet` | Deploy to Ethereum mainnet                         |
| `npm run clean`          | Clear compiled artifacts and cache                 |

## Deploying to a Real Network

### 1. Get your keys
- **Alchemy**: Free RPC endpoint at [alchemy.com](https://www.alchemy.com/)
- **Etherscan**: API key at [etherscan.io/myapikey](https://etherscan.io/myapikey)
- **Wallet**: Export your private key from MetaMask

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your keys
```
On Replit, use the **Secrets** tab instead — add `ALCHEMY_API_KEY`, `DEPLOYER_PRIVATE_KEY`, and `ETHERSCAN_API_KEY`.

### 3. Deploy to Sepolia (testnet)
Get free Sepolia ETH from [sepoliafaucet.com](https://sepoliafaucet.com), then:
```bash
npm run deploy:sepolia
```

### 4. Verify on Etherscan
Update the addresses in `scripts/verify.js`, then:
```bash
npx hardhat run scripts/verify.js --network sepolia
```

### 5. Deploy to Mainnet
```bash
npm run deploy:mainnet
```

## Project Structure

```
dittocoin/
├── contracts/
│   ├── DittoCoin.sol          # ERC20 token with burn, treasury, anti-whale
│   └── DittoStaking.sol       # Gamified staking with 4 tiers
├── scripts/
│   ├── deploy.js              # Deploys both contracts + configures
│   └── verify.js              # Etherscan verification for both
├── test/
│   ├── DittoCoin.test.js      # Token tests: fees, limits, admin
│   └── DittoStaking.test.js   # Staking tests: tiers, rewards, emergency
├── .env.example               # Environment variable template
├── .gitignore
├── .replit                    # Replit run config
├── replit.nix                 # Replit Nix deps
├── hardhat.config.js          # Hardhat config with network + Etherscan
├── package.json
└── README.md
```

## Contract Design

### DittoCoin.sol
- All 420B tokens minted to deployer at construction — no `mint()` function
- `_update()` override applies burn + treasury fee on every non-exempt transfer
- Anti-whale checks enforce max wallet and max tx limits
- Burn rate halves every 180 days (era-based), flooring at 0.01% — not manually adjustable
- Owner can adjust treasury fee (capped at 5%), limits, treasury address
- `removeLimits()` and `removeTreasuryFee()` for post-launch flexibility
- `renounceOwnership()` makes the contract fully immutable

### DittoStaking.sol
- Users approve + stake DITTO into one of four tiers
- Each tier has a lock duration and reward multiplier
- Rewards accrue linearly based on `amount × APR × multiplier × time`
- Rewards are paid from a pre-funded reward pool (not minted)
- Emergency unstake returns principal only (no rewards, no penalty)
- Owner can adjust base APR (capped at 50%)
- Anyone can fund the reward pool

## Post-Deployment Checklist

1. **Verify both contracts** on Etherscan for transparency
2. **Set up a multisig** (e.g., Gnosis Safe) and call `setTreasury()` to point fees there
3. **Add liquidity** on Uniswap V2/V3 — exempt the LP pair from fees if needed via `setExempt()`
4. **Fund the staking reward pool** — the deploy script seeds it with 5B DITTO
5. **Consider renouncing ownership** once everything is stable to prove trustlessness

## Security Notes

- Never commit your `.env` file — it contains your private key
- On Replit, use **Secrets** instead of `.env`
- Test on Sepolia before mainnet
- Total fees are hard-capped at 10% in the contract
- Anti-whale minimums prevent the owner from setting unreasonably low limits
- The staking contract uses OpenZeppelin's `ReentrancyGuard` and `SafeERC20`
- Consider a professional audit before a large-scale launch

## License

MIT
