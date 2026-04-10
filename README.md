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

```bash
git clone https://github.com/LeifHansen/DittoCoin.git
cd DittoCoin
npm install
npm run compile
npm test
```

## Available Commands

| Command                  | What it does                                      |
|--------------------------|---------------------------------------------------|
| `npm run compile`        | Compile Solidity contracts                         |
| `npm test`               | Run the full test suite                            |
| `npm run deploy:local`   | Deploy to a local Hardhat node                     |
| `npm run deploy:sepolia` | Deploy to Sepolia testnet                          |
| `npm run deploy:mainnet` | Deploy to Ethereum mainnet                         |
| `npm run clean`          | Clear compiled artifacts and cache                 |

## Deploying

1. Copy `.env.example` to `.env` and fill in your keys.
2. Get free Sepolia ETH from https://sepoliafaucet.com
3. Deploy to Sepolia: `npm run deploy:sepolia`
4. Verify on Etherscan: `npx hardhat run scripts/verify.js --network sepolia`
5. Deploy to mainnet: `npm run deploy:mainnet`

## Project Structure

```
DittoCoin/
├── contracts/          Solidity contracts (token, staking, presale, vault, vesting)
├── scripts/            Deploy & verify scripts
├── test/               Hardhat test suite
├── frontend/           Next.js 14 web app
├── index.html          Landing page (served via GitHub Pages)
├── hardhat.config.js   Hardhat config
├── package.json
├── LAUNCH-CHECKLIST.md  Full launch playbook
└── README.md
```

## Contract Design

### DittoCoin.sol
- All 420B tokens minted to deployer at construction — no mint function
- `_update()` override applies burn + treasury fee on every non-exempt transfer
- Anti-whale checks enforce max wallet and max tx limits
- Burn rate halves every 180 days (era-based), flooring at 0.01% — not manually adjustable
- Owner can adjust treasury fee (capped at 5%), limits, treasury address
- `removeLimits()` and `removeTreasuryFee()` for post-launch flexibility
- `renounceOwnership()` makes the contract fully immutable

### DittoStaking.sol
- Users approve + stake DITTO into one of four tiers
- Each tier has a lock duration and reward multiplier
- Rewards accrue linearly based on amount × APR × multiplier × time
- Rewards paid from a pre-funded reward pool (not minted)
- Emergency unstake returns principal only (no rewards)
- Owner can adjust base APR (capped at 50%)

## Security Notes

- Never commit your `.env` file — it contains your private key
- Test on Sepolia before mainnet
- Total fees are hard-capped at 10% in the contract
- Uses OpenZeppelin `ReentrancyGuard` and `SafeERC20`
- Consider a professional audit before a large-scale launch

## License

MIT
