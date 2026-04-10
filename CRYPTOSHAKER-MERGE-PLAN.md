# CryptoShaker Integration Plan

Merge the CryptoShaker mixer (thekiefthief/cryptoshaker) into the DittoCoin monorepo so that:
- **dittocoin.com** → the coin site (current `frontend/`)
- **mixer.dittocoin.com** → the mixer app (CryptoShaker)

---

## What We Know About CryptoShaker

From previous sessions: React + Vite frontend, Express backend, PostgreSQL database with Drizzle ORM. It's a crypto mixer/tumbler service.

## Target Repo Structure

```
dittocoin-platform/          (LeifHansen/dittocoin-platform on GitHub)
├── contracts/               # Solidity (shared — DittoCoin + DittoStaking)
│   ├── DittoCoin.sol
│   └── DittoStaking.sol
├── test/                    # Hardhat tests
├── scripts/                 # Deploy + verify scripts
├── coin/                    # ← renamed from current frontend/
│   ├── app/                 # Next.js App Router (dittocoin.com)
│   ├── components/
│   ├── lib/
│   ├── abi/
│   ├── public/
│   ├── next.config.js
│   ├── package.json
│   └── ...
├── mixer/                   # ← CryptoShaker code goes here
│   ├── client/              # React + Vite frontend (mixer.dittocoin.com)
│   ├── server/              # Express API
│   ├── db/                  # Drizzle ORM schema + migrations
│   ├── package.json
│   └── ...
├── hardhat.config.js
├── package.json             # Root — workspaces config
├── LAUNCH-CHECKLIST.md
└── README.md
```

## Step-by-Step Merge Process

### Step 1: Clone Both Repos Locally

```bash
# Clone the new platform repo
git clone https://github.com/LeifHansen/dittocoin-platform.git
cd dittocoin-platform

# Add CryptoShaker as a remote
git remote add shaker https://github.com/thekiefthief/cryptoshaker.git
git fetch shaker
```

### Step 2: Move Current DittoCoin Code In

```bash
# Copy all current dittocoin code into the platform repo
# (contracts, test, scripts, hardhat.config.js, package.json at root)
cp -r ~/dittocoi/contracts ./contracts
cp -r ~/dittocoi/test ./test
cp -r ~/dittocoi/scripts ./scripts
cp ~/dittocoi/hardhat.config.js ./
cp ~/dittocoi/package.json ./
cp ~/dittocoi/.env.example ./
cp ~/dittocoi/.gitignore ./

# Rename frontend → coin
cp -r ~/dittocoi/frontend ./coin
```

### Step 3: Bring CryptoShaker In as `mixer/`

```bash
# Create a subtree merge from the shaker remote
git subtree add --prefix=mixer shaker main --squash

# Or manually:
# 1. Clone cryptoshaker separately
# 2. Copy its contents into mixer/
# 3. Commit
```

### Step 4: Set Up npm Workspaces (Root package.json)

```json
{
  "name": "dittocoin-platform",
  "private": true,
  "workspaces": ["coin", "mixer"],
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "dev:coin": "npm run dev --workspace=coin",
    "dev:mixer": "npm run dev --workspace=mixer",
    "build:coin": "npm run build --workspace=coin",
    "build:mixer": "npm run build --workspace=mixer"
  }
}
```

### Step 5: Update Import Paths in `coin/`

Since `frontend/` is now `coin/`, update:
- `coin/next.config.js` — no changes needed (paths are relative)
- `coin/tsconfig.json` — ensure `@/` alias still points to `coin/`
- Any hardcoded `frontend/` references in CI/deploy configs

### Step 6: DNS & Hosting Configuration

DNS is already configured (from GoDaddy):
- `dittocoin.com` → A/CNAME to coin deployment
- `mixer.dittocoin.com` → A/CNAME to mixer deployment

**Option A: Vercel (Recommended for coin site)**
- Import repo, set root directory to `coin/`
- Custom domain: dittocoin.com

**Option B: Digital Ocean App Platform**
- Create two apps from the same repo
- App 1: source dir `coin/`, domain: dittocoin.com
- App 2: source dir `mixer/`, domain: mixer.dittocoin.com

**Option C: VPS (single server)**
- Nginx reverse proxy:
  - `dittocoin.com` → localhost:3000 (Next.js)
  - `mixer.dittocoin.com` → localhost:3001 (Vite) + localhost:4000 (Express API)

### Step 7: Shared Branding

Consider sharing:
- Color palette / Tailwind theme between coin and mixer
- Logo assets in a shared `assets/` folder
- A common footer linking between the two sites

### Step 8: Environment Variables

The mixer will need its own env vars:
```
# mixer/.env
DATABASE_URL=postgresql://...
SESSION_SECRET=...
PORT=4000
```

These are separate from the coin site's env vars.

---

## What You Need To Do (Can't Be Done From This Sandbox)

1. **Clone both repos on your local machine** (or use GitHub Desktop)
2. **Run the git commands above** to merge the code
3. **Push to LeifHansen/dittocoin-platform**
4. **Set up hosting** with the correct source directories

I can write all the code changes (workspace config, updated paths, shared components) once the files are in place. The git merge itself needs to happen on your machine since I can't access GitHub from here.

---

## Estimated Effort

| Task | Time |
|------|------|
| Git merge + restructure | 30 min |
| Update import paths | 15 min |
| Workspace config | 10 min |
| Shared branding | 30 min |
| Hosting setup (Vercel or DO) | 30 min |
| DNS verification | 10 min |
| **Total** | **~2 hours** |
