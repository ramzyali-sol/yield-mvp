# Yield — Automated DeFi on Solana

Deposit once. Earn everywhere. Auto-routed yield across Solana's top 17 protocols.

---

## Deploy to Vercel in 5 minutes

### 1. Push to GitHub

```bash
# Create a new repo at github.com, then:
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/yield-mvp.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Framework is auto-detected as **Next.js** — no changes needed
4. Click **Deploy**

That's it. Vercel gives you a live URL in ~60 seconds.

---

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

---

## Before going to production: swap the RPC endpoint

In `components/WalletProvider.tsx`, replace the default endpoint with Helius:

```ts
// Replace this:
const endpoint = useMemo(() => clusterApiUrl(network), [network]);

// With this:
const endpoint = "https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY";
```

Get a free key at [helius.dev](https://helius.dev). The default Solana public RPC is rate-limited and will fail in production with real traffic.

---

## What's real vs mock

| Feature | Status |
|---|---|
| Wallet connect (Phantom, Backpack, Solflare, Coinbase, Trust) | ✅ Real |
| SOL balance read from chain | ✅ Real |
| SPL token balances (USDC, USDT, JitoSOL, mSOL, PYUSD) | ✅ Real |
| APY rates | 🟡 Mock — wire to Kamino/MarginFi/Drift APIs |
| Deposit transactions | 🟡 Mock — wire to protocol SDKs |
| Portfolio positions | 🟡 Mock — wire to protocol account reads |
| Borrow transactions | 🟡 Mock — wire to protocol SDKs |

---

## To wire real APYs (next step)

Create `app/api/rates/route.ts`:

```ts
export async function GET() {
  // Fetch Kamino market rates
  const kamino = await fetch("https://api.kamino.finance/kamino-market/...");
  // Fetch MarginFi rates via SDK
  // Fetch Drift vault APYs
  // Return combined rates object
  return Response.json({ rates: { ... } });
}
```

Then call this from `YieldApp.jsx` with `useEffect` on mount and every 60s.

---

## Stack

- **Next.js 14** (App Router)
- **@solana/wallet-adapter** (Phantom, Backpack, Solflare, Coinbase, Trust)
- **@solana/web3.js** (RPC reads)
- **Vercel** (hosting + serverless)
