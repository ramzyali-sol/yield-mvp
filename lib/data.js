/* ─── VENUE DATA (static metadata — yields populated from live API) ──────── */
/* Kamino markets are created dynamically in enrichVenues() from live API data */
export const VENUES = [
  { name:"Jupiter Lend",        logo:"JL", color:"#C8A84B", category:"lending",    type:"Lending Market",         stableApy:null, solApy:null, tvl:null, audits:["OtterSec","Sec3"],           oss:true,  risk:"LOW",    note:"High LTV, Jupiter DEX integration.", url:"https://jup.ag/lend" },
  { name:"MarginFi",            logo:"M",  color:"#7B8CDE", category:"lending",    type:"Isolated Lending",       stableApy:null, solApy:null, tvl:null, audits:["OtterSec"],                  oss:true,  risk:"LOW",    note:"Conservative isolated pools. Foundation for Project 0 prime broker.", url:"https://app.marginfi.com" },
  { name:"Save (Solend)",       logo:"Sv", color:"#00C8FF", category:"lending",    type:"Lending Market",         stableApy:null, solApy:null, tvl:null, audits:["Kudelski","OtterSec"],       oss:true,  risk:"LOW",    note:"OG Solana lending since 2021. Longest battle-tested track record.", url:"https://save.finance" },
  { name:"Loopscale",           logo:"L",  color:"#A78BFA", category:"lending",    type:"Fixed-Rate Order Book",  stableApy:null, solApy:null, tvl:null, audits:["Halborn"],                   oss:false, risk:"MEDIUM", note:"Fixed-rate fixed-term order book. No rate volatility. Oracle hack Apr 2025 — funds recovered.", flag:"⚠ Prior exploit — model upgraded post-incident", url:"https://loopscale.com" },
  { name:"Drift Vaults",        logo:"D",  color:"#FF6B35", category:"vault",      type:"Earn Vault",             stableApy:null, solApy:null, tvl:null, audits:["OtterSec","Trail of Bits"],  oss:true,  risk:"LOW",    note:"Passive vault earning from Drift insurance fund + lending. Stable rate profile.", url:"https://app.drift.trade/earn" },
  { name:"Lulo",                logo:"Lu", color:"#F472B6", category:"aggregator", type:"Yield Aggregator",       stableApy:null, solApy:null, tvl:null, audits:["OtterSec"],                  oss:true,  risk:"LOW",    note:"Auto-routes stablecoins to best rates across Kamino, MarginFi, Drift, Save.", url:"https://lulo.fi" },
  { name:"Exponent",            logo:"Ex", color:"#FB923C", category:"fixed",      type:"Fixed Yield (PT Tokens)",stableApy:null, solApy:null, tvl:null, audits:["OtterSec","Sec3"],           oss:true,  risk:"MEDIUM", note:"Pendle-style yield stripping. Lock fixed APY via Principal Tokens. Time-locked to maturity.", flag:"⏱ Time-locked — cannot withdraw before maturity", url:"https://exponent.finance" },
  { name:"RateX",               logo:"Rx", color:"#E879F9", category:"fixed",      type:"Leveraged Yield Trading",stableApy:null, solApy:null, tvl:null, audits:["Sec3"],                      oss:false, risk:"MEDIUM", note:"Leveraged yield trading up to 10x on synthetic yield tokens. Fixed side is clean; YT side is speculative.", flag:"⚠ Smaller TVL — not suitable for large size", url:"https://ratex.fi" },
  { name:"Solstice",            logo:"Sx", color:"#38BDF8", category:"vault",      type:"Delta-Neutral YieldVault",stableApy:null,solApy:null, tvl:null, audits:["OtterSec"],                  oss:false, risk:"LOW",    note:"USX stablecoin. Delta-neutral institutional strategies. 21.5% in 2024. Deus X Capital backed.", url:"https://solstice.finance" },
  { name:"Perena",              logo:"Pe", color:"#34D399", category:"rwa",        type:"Yield-Bearing Stablecoin",stableApy:null,solApy:null, tvl:null, audits:["OtterSec"],                  oss:false, risk:"LOW",    note:"USD* collateralized by delta-neutral positions + lending markets. Uncorrelated yield.", url:"https://perena.org" },
  { name:"OnRe",                logo:"Or", color:"#F59E0B", category:"rwa",        type:"Reinsurance RWA",        stableApy:null, solApy:null, tvl:null, audits:["OtterSec"],                  oss:false, risk:"LOW",    note:"ONyc backed by Bermuda-licensed reinsurance. 9–15% base APY uncorrelated to crypto. Dual-regulated.", url:"https://onre.fi" },
  { name:"Sanctum",             logo:"Sa", color:"#818CF8", category:"staking",    type:"LST Infrastructure",     stableApy:null, solApy:null, tvl:null, audits:["OtterSec","Neodyme"],        oss:true,  risk:"LOW",    note:"INF: LST-of-LSTs earning staking yield + swap fees. Best-in-class SOL LST efficiency.", url:"https://sanctum.so" },
  { name:"Hylo",                logo:"Hy", color:"#4ADE80", category:"vault",      type:"Leveraged SOL Vault",    stableApy:null, solApy:null, tvl:null, audits:["Sec3"],                      oss:false, risk:"MEDIUM", note:"xSOL: leveraged SOL with auto-managed borrow loops. SOL-denominated only.", flag:"⚠ Leveraged — SOL directional risk applies", url:"https://hylo.so" },
  { name:"DeFi Carrot",         logo:"Ca", color:"#F97316", category:"vault",      type:"Boost Vault",            stableApy:null, solApy:null, tvl:null, audits:[],                            oss:false, risk:"MEDIUM", note:"Boost vaults for ONyc and RWA positions. Points multipliers + base yield.", flag:"⚠ No public audits — use small size only", url:"https://deficarrot.com" },
  { name:"Project 0",           logo:"P0", color:"#94A3B8", category:"infra",      type:"Prime Brokerage Layer",  stableApy:null, solApy:null, tvl:null, audits:["OtterSec"],                  oss:false, risk:"MEDIUM", note:"Cross-margin prime broker unifying Kamino, Drift, Jupiter. Infrastructure — not a yield venue.", url:"https://0.xyz" },
  { name:"Neutral Trade",       logo:"Nt", color:"#64748B", category:"vault",      type:"Delta-Neutral Strategy", stableApy:null, solApy:null, tvl:null, audits:[],                            oss:false, risk:"MEDIUM", note:"Delta-neutral yield strategies. Limited public audit data.", flag:"⚠ No public audits confirmed — DYOR", url:"https://neutral.trade" },
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

/* ─── UNIFIED ASSETS (yields + prices populated from live API) ───────────── */
export const ASSETS = [
  { symbol:"SOL",     icon:"◎", color:"#9945FF", price:null, type:"sol",    earnApy:null, canCollateral:true,  maxLTV:0.75, safeLTV:0.50, liqThreshold:0.80, borrowRate:null },
  { symbol:"USDC",    icon:"◉", color:"#2775CA", price:null, type:"stable", earnApy:null, canCollateral:false },
  { symbol:"JitoSOL", icon:"⬡", color:"#3DFFA0", price:null, type:"sol",    earnApy:null, canCollateral:true,  maxLTV:0.72, safeLTV:0.50, liqThreshold:0.78, borrowRate:null },
  { symbol:"mSOL",    icon:"⬢", color:"#FF7B54", price:null, type:"sol",    earnApy:null, canCollateral:true,  maxLTV:0.70, safeLTV:0.48, liqThreshold:0.76, borrowRate:null },
  { symbol:"PYUSD",   icon:"◈", color:"#0070BA", price:null, type:"stable", earnApy:null, canCollateral:false },
  { symbol:"USDT",    icon:"◇", color:"#26A17B", price:null, type:"stable", earnApy:null, canCollateral:false },
  { symbol:"wBTC",    icon:"₿", color:"#F7931A", price:null, type:"btc",    earnApy:null, canCollateral:true,  maxLTV:0.70, safeLTV:0.50, liqThreshold:0.75, borrowRate:null },
];

export const COLLATERAL_ASSETS = ASSETS.filter(a => a.canCollateral);

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
export function fmt(n) {
  if (n == null) return "—";
  return n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(0)}M` : `$${(n/1e3).toFixed(0)}K`;
}

export function fmtUSD(n) {
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits:0 });
}

/* ─── CARRY TRADE CALCULATOR ─────────────────────────────────────────────── */
export function computeCarryTrade(collateral, amount, ltvPct, venue) {
  const colUSD     = amount * (collateral.price || 0);
  const actualLTV  = (ltvPct / 100) * collateral.safeLTV;
  const borrowUSD  = colUSD * actualLTV;
  const liqPrice   = borrowUSD > 0 ? borrowUSD / (collateral.liqThreshold * amount) : 0;
  const liqDrop    = liqPrice > 0 ? ((collateral.price || 0) - liqPrice) / (collateral.price || 1) * 100 : 0;
  const hf         = borrowUSD > 0 ? (colUSD * collateral.liqThreshold) / borrowUSD : 999;
  const borrowRate = collateral.borrowRate || 0;
  const borrowCost = borrowUSD * (borrowRate / 100);

  const deployApy   = venue.stableApy || 0;
  const grossCarry  = deployApy - borrowRate;
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
export function getVenuesForAsset(asset, venues) {
  const v = venues || VENUES;
  if (!asset) return v;
  if (asset.type === "stable") return v.filter(x => x.stableApy != null);
  if (asset.type === "sol")    return v.filter(x => x.solApy != null);
  if (asset.type === "btc")    return v.filter(x => x.solApy != null);
  return v;
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

/* ─── Enrich static data with live API response ─────────────────────────── */
export function enrichVenues(liveData) {
  if (!liveData?.venues) return VENUES;

  // 1. Build dynamic Kamino venue entries from API market metadata
  const kaminoVenues = [];
  const kaminoMarkets = liveData.kaminoMarkets || [];

  for (const km of kaminoMarkets) {
    const live = liveData.venues[km.name];
    if (!live) continue;
    // Skip markets with no yield data
    if (live.stableApy == null && live.solApy == null) continue;

    const isPrimary = km.isPrimary;
    kaminoVenues.push({
      name: km.name,
      logo: "K",
      color: "#3DFFA0",
      category: "lending",
      type: isPrimary ? "Lending Market" : `Isolated Market`,
      stableApy: live.stableApy,
      solApy: live.solApy,
      tvl: live.tvl,
      audits: ["OtterSec", "Halborn"],
      oss: true,
      risk: isPrimary || (live.tvl || 0) > 50e6 ? "LOW" : "MEDIUM",
      note: isPrimary
        ? "Dominant Solana lending. Deepest liquidity on chain. K-Lend V2."
        : `Kamino isolated market: ${km.description || km.marketName}`,
      url: "https://kamino.finance",
      _source: live.source,
      _kaminoPubkey: km.pubkey,
    });
  }

  // Sort Kamino venues by TVL descending (primary first, then by size)
  kaminoVenues.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));

  // 2. Enrich static (non-Kamino) venues with live data
  const enrichedStatic = VENUES.map(v => {
    const live = liveData.venues[v.name];
    if (!live) return v;
    return {
      ...v,
      stableApy: live.stableApy ?? v.stableApy,
      solApy: live.solApy ?? v.solApy,
      tvl: live.tvl ?? v.tvl,
      _source: live.source,
    };
  }).filter(v => {
    // Keep venues that have at least some data, or are infrastructure
    return v.stableApy != null || v.solApy != null || v.tvl != null || v.category === "infra";
  });

  // 3. Combine: Kamino markets first, then other venues
  return [...kaminoVenues, ...enrichedStatic];
}

export function enrichAssets(liveData) {
  if (!liveData) return ASSETS;

  const prices = liveData.prices || {};
  const earnApys = liveData.assetEarnApys || {};
  const borrowRates = liveData.borrowRates || {};

  return ASSETS.map(a => ({
    ...a,
    price: prices[a.symbol] ?? a.price ?? (a.type === "stable" ? 1 : null),
    earnApy: earnApys[a.symbol] ?? a.earnApy,
    borrowRate: borrowRates[a.symbol] ?? a.borrowRate,
  }));
}

export function enrichPrices(liveData) {
  if (!liveData?.prices) return {};
  return liveData.prices;
}
