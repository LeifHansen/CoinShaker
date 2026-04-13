// ─── Contract Addresses ──────────────────────────────────────
// Update these after deploying your contracts
export const CONTRACTS = {
  // Sepolia testnet (update after deploy)
  sepolia: {
    dittoCoin: "0xE85644Ab000b8741837746335819F0AE750e1Fd6" as `0x${string}`,
    dittoStaking: "0x8F293C24E81FeF1f0aE3c381CBd6AD78236b810c" as `0x${string}`,
    dittoPresale: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    dittoVesting: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    dittoVault: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  },
  // Mainnet (update after deploy)
  mainnet: {
    dittoCoin: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    dittoStaking: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    dittoPresale: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    dittoVesting: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    dittoVault: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  },
} as const;

// Uniswap V2 Router (mainnet)
export const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" as `0x${string}`;

// Token metadata
export const TOKEN = {
  name: "DittoCoin",
  symbol: "DITTO",
  decimals: 18,
  initialSupply: "420000000000", // 420 billion
} as const;

// Presale rounds
export const PRESALE_ROUNDS = [
  { id: 0, name: "Seed", discount: "60%", tgePercent: 25, vestingDays: 90, whitelisted: true },
  { id: 1, name: "Early Bird", discount: "40%", tgePercent: 50, vestingDays: 60, whitelisted: false },
  { id: 2, name: "Public", discount: "20%", tgePercent: 100, vestingDays: 0, whitelisted: false },
] as const;

// Vault supported assets (addresses updated after deploy)
export const VAULT_ASSETS = [
  { symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18, icon: "⟠" },
  { symbol: "USDC", address: "0x0000000000000000000000000000000000000000", decimals: 6, icon: "💵" },
  { symbol: "USDT", address: "0x0000000000000000000000000000000000000000", decimals: 6, icon: "💲" },
  { symbol: "DAI", address: "0x0000000000000000000000000000000000000000", decimals: 18, icon: "◈" },
] as const;

// Staking tiers
export const STAKING_TIERS = [
  { id: 0, name: "Paper Hands", emoji: "\u{1F9FB}", lock: "7 days", lockSeconds: 604800, mult: "1x", apr: 10, color: "from-gray-400 to-gray-500" },
  { id: 1, name: "Hodler", emoji: "\u{1F48E}", lock: "30 days", lockSeconds: 2592000, mult: "2x", apr: 20, color: "from-ditto-teal to-emerald-400" },
  { id: 2, name: "Diamond Hands", emoji: "\u{1F64C}", lock: "90 days", lockSeconds: 7776000, mult: "4x", apr: 40, color: "from-ditto-purple-600 to-purple-400" },
  { id: 3, name: "Whale", emoji: "\u{1F40B}", lock: "365 days", lockSeconds: 31536000, mult: "8x", apr: 80, color: "from-ditto-amber to-yellow-300" },
] as const;
