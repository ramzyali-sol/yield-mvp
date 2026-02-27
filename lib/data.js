/* ─── VENUE DATA ─────────────────────────────────────────────────────────── */
export const VENUES = [
  { name:"Kamino Finance",    logo:"K",  color:"#3DFFA0", category:"lending",    type:"Lending Market",         stableApy:13.40, solApy:7.10,  tvl:3000e6, audits:["OtterSec","Halborn"],        oss:true,  risk:"LOW",    note:"Dominant Solana lending. Deepest liquidity on chain. K-Lend V2.", url:"https://kamino.finance" },
  { name:"Jupiter Lend",      logo:"JL", color:"#C8A84B", category:"lending",    type:"Lending Market",         stableApy:12.80, solApy:6.90,  tvl:1650e6, audits:["OtterSec","Sec3"],           oss:true,  risk:"LOW",    note:"$1.65B TVL in 60 days post-launch. High LTV, Jupiter DEX integration.", url:"https://jup.ag/lend" },
  { name:"MarginFi",          logo:"M",  color:"#7B8CDE", category:"lending",    type:"Isolated Lending",       stableApy:12.80, solApy:6.20,  tvl:380e6,  audits:["OtterSec"],                  oss:true,  risk:"LOW",    note:"Conservative isolated pools. Foundation for Project 0 prime broker.", url:"https://app.marginfi.com" },
  { name:"Save (Solend)",     logo:"Sv", color:"#00C8FF", category:"lending",    type:"Lending Market",         stableApy:11.90, solApy:5.80,  tvl:300e6,  audits:["Kudelski","OtterSec"],       oss:true,  risk:"LOW",    note:"OG Solana lending since 2021. Longest battle-tested track record.", url:"https://save.finance" },
  { name:"Loopscale",         logo:"L",  color:"#A78BFA", category:"lending",    type:"Fixed-Rate Order Book",  stableApy:10.50, solApy:9.20,  tvl:75e6,   audits:["Halborn"],                   oss:false, risk:"MEDIUM", note:"Fixed-rate fixed-term order book. No rate volatility. Oracle hack Apr 2025 — funds recovered.", flag:"⚠ Prior exploit — model upgraded post-incident", url:"https://loopscale.com" },
  { name:"Drift Vaults",      logo:"D",  color:"#FF6B35", category:"vault",      type:"Earn Vault",             stableApy:13.10, solApy:9.87,  tvl:198e6,  audits:["OtterSec","Trail of Bits"],  oss:true,  risk:"LOW",    note:"Passive vault earning from Drift insurance fund + lending. Stable rate profile.", url:"https://app.drift.trade/earn" },
  { name:"Lulo",              logo:"Lu", color:"#F472B6", category:"aggregator", type:"Yield Aggregator",       stableApy:11.60, solApy:null,  tvl:100e6,  audits:["OtterSec"],                  oss:true,  risk:"LOW",    note:"Auto-routes stablecoins to best rates across Kamino, MarginFi, Drift, Save.", url:"https://lulo.fi" },
  { name:"Exponent",          logo:"Ex", color:"#FB923C", category:"fixed",      type:"Fixed Yield (PT Tokens)",stableApy:13.00, solApy:8.50,  tvl:99e6,   audits:["OtterSec","Sec3"],           oss:true,  risk:"MEDIUM", note:"Pendle-style yield stripping. Lock fixed APY via Principal Tokens. Time-locked to maturity.", flag:"⏱ Time-locked — cannot withdraw before maturity", url:"https://exponent.finance" },
  { name:"RateX",             logo:"Rx", color:"#E879F9", category:"fixed",      type:"Leveraged Yield Trading",stableApy:12.00, solApy:8.00,  tvl:9e6,    audits:["Sec3"],                      oss:false, risk:"MEDIUM", note:"Leveraged yield trading up to 10x on synthetic yield tokens. Fixed side is clean; YT side is speculative.", flag:"⚠ Smaller TVL — not suitable for large size", url:"https://ratex.fi" },
  { name:"Solstice",          logo:"Sx", color:"#38BDF8", category:"vault",      type:"Delta-Neutral YieldVault",stableApy:14.50,solApy:null,  tvl:330e6,  audits:["OtterSec"],                  oss:false, risk:"LOW",    note:"USX stablecoin. Delta-neutral institutional strategies. 21.5% in 2024. Deus X Capital backed.", url:"https://solstice.finance" },
  { name:"Perena",            logo:"Pe", color:"#34D399", category:"rwa",        type:"Yield-Bearing Stablecoin",stableApy:11.00,solApy:null,  tvl:120e6,  audits:["OtterSec"],                  oss:false, risk:"LOW",    note:"USD* collateralized by delta-neutral positions + lending markets. Uncorrelated yield.", url:"https://perena.org" },
  { name:"OnRe",              logo:"Or", color:"#F59E0B", category:"rwa",        type:"Reinsurance RWA",        stableApy:12.00, solApy:null,  tvl:92e6,   audits:["OtterSec"],                  oss:false, risk:"LOW",    note:"ONyc backed by Bermuda-licensed reinsurance. 9–15% base APY uncorrelated to crypto. Dual-regulated.", url:"https://onre.fi" },
  { name:"Sanctum",           logo:"Sa", color:"#818CF8", category:"staking",    type:"LST Infrastructure",     stableApy:null,  solApy:8.20,  tvl:300e6,  audits:["OtterSec","Neodyme"],        oss:true,  risk:"LOW",    note:"INF: LST-of-LSTs earning staking yield + swap fees. Best-in-class SOL LST efficiency.", url:"https://sanctum.so" },
  { name:"Hylo",              logo:"Hy", color:"#4ADE80", category:"vault",      type:"Leveraged SOL Vault",    stableApy:null,  solApy:14.00, tvl:45e6,   audits:["Sec3"],                      oss:false, risk:"MEDIUM", note:"xSOL: leveraged SOL with auto-managed borrow loops. SOL-denominated only.", flag:"⚠ Leveraged — SOL directional risk applies", url:"https://hylo.so" },
  { name:"DeFi Carrot",       logo:"Ca", color:"#F97316", category:"vault",      type:"Boost Vault",            stableApy:15.00, solApy:null,  tvl:25e6,   audits:[],                            oss:false, risk:"MEDIUM", note:"Boost vaults for ONyc and RWA positions. Points multipliers + base yield.", flag:"⚠ No public audits — use small size only", url:"https://deficarrot.com" },
  { name:"Project 0",         logo:"P0", color:"#94A3B8", category:"infra",      type:"Prime Brokerage Layer",  stableApy:null,  solApy:null,  tvl:null,   audits:["OtterSec"],                  oss:false, risk:"MEDIUM", note:"Cross-margin prime broker unifying Kamino, Drift, Jupiter. Infrastructure — not a yield venue.", url:"https://0.xyz" },
  { name:"Neutral Trade",     logo:"Nt", color:"#64748B", category:"vault",      type:"Delta-Neutral Strategy", stableApy:13.00, solApy:null,  tvl:20e6,   audits:[],                            oss:false, risk:"MEDIUM", note:"Delta-neutral yield strategies. Limited public audit data.", flag:"⚠ No public audits confirmed — DYOR", url:"https://neutral.trade" },
];

export const CATEGORY_META = {
  lending:    { label:"Lending",      color:"#3DFFA0" },
  vault:      { label:"Vault",        color:"#FF6B35" },
  fixed:      { label:"Fixed Yield",  color:"#FB923C" },
  rwa:        { label:"RWA",          color:"#F59E0B" },
  aggregator: { label:"Aggregator",   color:"#F472B6" },
  staking:    { label:"Staking/LST",  color:"#818CF8" },
  infra:      { label:"Infrastructure",color:"#94A3B8"},
};

/* ─── PRICES ────────────────────────────────────────────────────────────── */
export const PRICES = { SOL:181.4, USDC:1, JitoSOL:191.2, mSOL:188.3, PYUSD:1, USDT:1, wBTC:88420 };

/* ─── UNIFIED ASSETS (merged EARN_ASSETS + COLLATERAL) ──────────────────── */
export const ASSETS = [
  { symbol:"SOL",     icon:"◎", color:"#9945FF", price:181.4,  type:"sol",    earnApy:8.42,  canCollateral:true,  maxLTV:0.75, safeLTV:0.50, liqThreshold:0.80, borrowRate:6.2  },
  { symbol:"USDC",    icon:"◉", color:"#2775CA", price:1,      type:"stable", earnApy:13.40, canCollateral:false },
  { symbol:"JitoSOL", icon:"⬡", color:"#3DFFA0", price:191.2,  type:"sol",    earnApy:10.87, canCollateral:true,  maxLTV:0.72, safeLTV:0.50, liqThreshold:0.78, borrowRate:5.8  },
  { symbol:"mSOL",    icon:"⬢", color:"#FF7B54", price:188.3,  type:"sol",    earnApy:9.61,  canCollateral:true,  maxLTV:0.70, safeLTV:0.48, liqThreshold:0.76, borrowRate:6.0  },
  { symbol:"PYUSD",   icon:"◈", color:"#0070BA", price:1,      type:"stable", earnApy:12.80, canCollateral:false },
  { symbol:"USDT",    icon:"◇", color:"#26A17B", price:1,      type:"stable", earnApy:13.44, canCollateral:false },
  { symbol:"wBTC",    icon:"₿", color:"#F7931A", price:88420,  type:"btc",    earnApy:null,  canCollateral:true,  maxLTV:0.70, safeLTV:0.50, liqThreshold:0.75, borrowRate:4.8  },
];

export const COLLATERAL_ASSETS = ASSETS.filter(a => a.canCollateral);

export const STRATEGIES = {
  SOL:     [{ protocol:"Kamino Finance", alloc:60, apy:7.10, color:"#3DFFA0", logo:"K" }, { protocol:"Drift Vaults", alloc:30, apy:9.87, color:"#FF6B35", logo:"D" }, { protocol:"Buffer", alloc:10, apy:0, color:"#333", logo:"·" }],
  USDC:    [{ protocol:"Kamino Finance", alloc:50, apy:14.22,color:"#3DFFA0", logo:"K" }, { protocol:"MarginFi",    alloc:30, apy:12.80,color:"#7B8CDE", logo:"M" }, { protocol:"Drift Vaults", alloc:20, apy:13.10, color:"#FF6B35", logo:"D" }],
  JitoSOL: [{ protocol:"MarginFi",       alloc:55, apy:8.90, color:"#7B8CDE", logo:"M" }, { protocol:"Kamino Finance",alloc:35,apy:11.20,color:"#3DFFA0", logo:"K" }, { protocol:"Buffer", alloc:10, apy:0, color:"#333", logo:"·" }],
  mSOL:    [{ protocol:"MarginFi",       alloc:70, apy:9.20, color:"#7B8CDE", logo:"M" }, { protocol:"Buffer",      alloc:30, apy:0,    color:"#333",    logo:"·" }],
  PYUSD:   [{ protocol:"Kamino Finance", alloc:60, apy:12.80,color:"#3DFFA0", logo:"K" }, { protocol:"MarginFi",    alloc:40, apy:13.10,color:"#7B8CDE", logo:"M" }],
  USDT:    [{ protocol:"Kamino Finance", alloc:50, apy:13.44,color:"#3DFFA0", logo:"K" }, { protocol:"Drift Vaults",alloc:30, apy:14.10,color:"#FF6B35", logo:"D" }, { protocol:"MarginFi", alloc:20, apy:12.60, color:"#7B8CDE", logo:"M" }],
};

export const DEPLOY_VENUES = VENUES.filter(v => v.stableApy && v.category !== "infra");

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
export function fmt(n) {
  if (n == null) return "—";
  return n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : `$${(n/1e6).toFixed(0)}M`;
}

export function fmtUSD(n) {
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits:0 });
}

/* ─── CARRY TRADE CALCULATOR ─────────────────────────────────────────────── */
export function computeCarryTrade(collateral, amount, ltvPct, venue) {
  const colUSD     = amount * collateral.price;
  const actualLTV  = (ltvPct / 100) * collateral.safeLTV;
  const borrowUSD  = colUSD * actualLTV;
  const liqPrice   = borrowUSD > 0 ? borrowUSD / (collateral.liqThreshold * amount) : 0;
  const liqDrop    = liqPrice > 0 ? (collateral.price - liqPrice) / collateral.price * 100 : 0;
  const hf         = borrowUSD > 0 ? (colUSD * collateral.liqThreshold) / borrowUSD : 999;
  const borrowCost = borrowUSD * (collateral.borrowRate / 100);

  const deployApy   = venue.stableApy;
  const grossCarry  = deployApy - collateral.borrowRate;
  const netCarryUSD = borrowUSD * (grossCarry / 100);

  const isSOL      = collateral.type === "sol";
  const stakingApy = isSOL ? 7.2 : 0;
  const colYieldUSD = colUSD * (stakingApy / 100);
  const totalNetUSD = netCarryUSD + colYieldUSD;

  return {
    colUSD,
    actualLTV,
    borrowUSD,
    liqPrice,
    liqDrop,
    hf,
    borrowCost,
    deployApy,
    grossCarry,
    netCarryUSD,
    stakingApy,
    colYieldUSD,
    totalNetUSD,
  };
}

/* ─── ASSET HELPERS ──────────────────────────────────────────────────────── */
export function getVenuesForAsset(asset) {
  if (!asset) return VENUES;
  if (asset.type === "stable") return VENUES.filter(v => v.stableApy != null);
  if (asset.type === "sol")    return VENUES.filter(v => v.solApy != null);
  if (asset.type === "btc")    return VENUES.filter(v => v.solApy != null); // BTC venues overlap with SOL venues
  return VENUES;
}

export function getRelevantApy(venue, asset) {
  if (!asset) return Math.max(venue.stableApy ?? 0, venue.solApy ?? 0);
  if (asset.type === "stable") return venue.stableApy;
  return venue.solApy;
}

export function getApyLabel(asset) {
  if (!asset) return "Best APY";
  if (asset.type === "stable") return "Stable APY";
  return "SOL/LST APY";
}

export function getApyColor(asset) {
  if (!asset) return "#3DFFA0";
  if (asset.type === "stable") return "#3DFFA0";
  return "#9945FF";
}
