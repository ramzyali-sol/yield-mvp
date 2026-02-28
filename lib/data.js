/* ─── TOKEN LOGO URLS ──────────────────────────────────────────────────── */
const TOKEN_LOGOS = {
  SOL:     "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  USDC:    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  JitoSOL: "https://storage.googleapis.com/token-metadata/JitoSOL-256.png",
  mSOL:    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png",
  USDT:    "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  wBTC:    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh/logo.png",
  PYUSD:   "https://assets.coingecko.com/coins/images/31212/small/PYUSD_Logo_%282%29.png",
  ONYC:    "https://www.google.com/s2/favicons?domain=onre.finance&sz=64",
  syrupUSDC: "https://www.google.com/s2/favicons?domain=syrup.fi&sz=64",
  xStocks: "https://www.google.com/s2/favicons?domain=kamino.finance&sz=64",
};

/* ─── VENUE LOGO HELPER ────────────────────────────────────────────────── */
function venueFavicon(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

/* ─── TOKEN LOGO HELPER ────────────────────────────────────────────────── */
export function tokenLogo(symbol) {
  return TOKEN_LOGOS[symbol] || null;
}

/* ─── VENUE DATA (static metadata — yields populated from live API) ──────── */
/* Kamino, Jupiter Lend, Save, Drift, Loopscale, MarginFi are all created    */
/* dynamically in enrichVenues() from live API data                           */
export const VENUES = [
  { name:"MarginFi",            logo:"M",  logoUrl:venueFavicon("app.marginfi.com"),   color:"#7B8CDE", category:"lending",    type:"Isolated Lending",       stableApy:null, solApy:null, tvl:null, audits:["OtterSec"],                  oss:true,  risk:"LOW",    note:"Conservative isolated pools. Foundation for Project 0 prime broker.", url:"https://app.marginfi.com" },
  { name:"Lulo",                logo:"Lu", logoUrl:venueFavicon("lulo.fi"),            color:"#F472B6", category:"aggregator", type:"Yield Aggregator",       stableApy:null, solApy:null, tvl:null, audits:["OtterSec"],                  oss:true,  risk:"LOW",    note:"Auto-routes stablecoins to best rates across Kamino, MarginFi, Drift, Save.", url:"https://lulo.fi" },
  { name:"Exponent",            logo:"Ex", logoUrl:venueFavicon("exponent.finance"),   color:"#FB923C", category:"fixed",      type:"Fixed Yield (PT Tokens)",stableApy:null, solApy:null, tvl:null, audits:["OtterSec","Sec3"],           oss:true,  risk:"MEDIUM", note:"Pendle-style yield stripping. Lock fixed APY via Principal Tokens. Time-locked to maturity.", flag:"⏱ Time-locked — cannot withdraw before maturity", url:"https://exponent.finance" },
  { name:"RateX",               logo:"Rx", logoUrl:venueFavicon("ratex.fi"),           color:"#E879F9", category:"fixed",      type:"Leveraged Yield Trading",stableApy:null, solApy:null, tvl:null, audits:["Sec3"],                      oss:false, risk:"MEDIUM", note:"Leveraged yield trading up to 10x on synthetic yield tokens. Fixed side is clean; YT side is speculative.", flag:"⚠ Smaller TVL — not suitable for large size", url:"https://ratex.fi" },
  { name:"Solstice",            logo:"Sx", logoUrl:venueFavicon("solstice.finance"),   color:"#38BDF8", category:"vault",      type:"Delta-Neutral YieldVault",stableApy:null,solApy:null, tvl:null, audits:["OtterSec"],                  oss:false, risk:"LOW",    note:"USX stablecoin. Delta-neutral institutional strategies. 21.5% in 2024. Deus X Capital backed.", url:"https://solstice.finance" },
  { name:"Perena",              logo:"Pe", logoUrl:venueFavicon("perena.org"),         color:"#34D399", category:"rwa",        type:"Yield-Bearing Stablecoin",stableApy:null,solApy:null, tvl:null, audits:["OtterSec"],                  oss:false, risk:"LOW",    note:"USD* collateralized by delta-neutral positions + lending markets. Uncorrelated yield.", url:"https://perena.org" },
  { name:"OnRe",                logo:"Or", logoUrl:venueFavicon("onre.finance"),       color:"#F59E0B", category:"rwa",        type:"Reinsurance RWA",        stableApy:null, solApy:null, tvl:null, audits:["OtterSec"],                  oss:false, risk:"LOW",    note:"ONyc backed by Bermuda-licensed reinsurance. 9–15% base APY uncorrelated to crypto. Dual-regulated.", url:"https://onre.fi" },
  { name:"Sanctum",             logo:"Sa", logoUrl:venueFavicon("sanctum.so"),         color:"#818CF8", category:"staking",    type:"LST Infrastructure",     stableApy:null, solApy:null, tvl:null, audits:["OtterSec","Neodyme"],        oss:true,  risk:"LOW",    note:"INF: LST-of-LSTs earning staking yield + swap fees. Best-in-class SOL LST efficiency.", url:"https://sanctum.so" },
  { name:"Hylo",                logo:"Hy", logoUrl:venueFavicon("hylo.so"),            color:"#4ADE80", category:"vault",      type:"Leveraged SOL Vault",    stableApy:null, solApy:null, tvl:null, audits:["Sec3"],                      oss:false, risk:"MEDIUM", note:"xSOL: leveraged SOL with auto-managed borrow loops. SOL-denominated only.", flag:"⚠ Leveraged — SOL directional risk applies", url:"https://hylo.so" },
  { name:"DeFi Carrot",         logo:"Ca", logoUrl:venueFavicon("deficarrot.com"),     color:"#F97316", category:"vault",      type:"Boost Vault",            stableApy:null, solApy:null, tvl:null, audits:[],                            oss:false, risk:"MEDIUM", note:"Boost vaults for ONyc and RWA positions. Points multipliers + base yield.", flag:"⚠ No public audits — use small size only", url:"https://deficarrot.com" },
  { name:"Project 0",           logo:"P0", logoUrl:venueFavicon("0.xyz"),              color:"#94A3B8", category:"infra",      type:"Prime Brokerage Layer",  stableApy:null, solApy:null, tvl:null, audits:["OtterSec"],                  oss:false, risk:"MEDIUM", note:"Cross-margin prime broker unifying Kamino, Drift, Jupiter. Infrastructure — not a yield venue.", url:"https://0.xyz" },
  { name:"Neutral Trade",       logo:"Nt", logoUrl:venueFavicon("neutral.trade"),      color:"#64748B", category:"vault",      type:"Delta-Neutral Strategy", stableApy:null, solApy:null, tvl:null, audits:[],                            oss:false, risk:"MEDIUM", note:"Delta-neutral yield strategies. Limited public audit data.", flag:"⚠ No public audits confirmed — DYOR", url:"https://neutral.trade" },
];

export const CATEGORY_META = {
  lending:    { label:"Lending",      color:"#14F195" },
  vault:      { label:"Vault",        color:"#FF6B35" },
  fixed:      { label:"Fixed Yield",  color:"#FB923C" },
  rwa:        { label:"RWA",          color:"#F59E0B" },
  aggregator: { label:"Aggregator",   color:"#F472B6" },
  staking:    { label:"Staking/LST",  color:"#818CF8" },
  infra:      { label:"Infrastructure",color:"#94A3B8"},
};

/* ─── UNIFIED ASSETS (yields + prices populated from live API) ───────────── */
export const ASSETS = [
  { symbol:"SOL",       icon:"◎", logoUrl:TOKEN_LOGOS.SOL,       color:"#9945FF", price:null, type:"sol",    earnApy:null, canCollateral:true,  maxLTV:0.75, safeLTV:0.50, liqThreshold:0.80, borrowRate:null },
  { symbol:"USDC",      icon:"◉", logoUrl:TOKEN_LOGOS.USDC,      color:"#2775CA", price:null, type:"stable", earnApy:null, canCollateral:false },
  { symbol:"JitoSOL",   icon:"⬡", logoUrl:TOKEN_LOGOS.JitoSOL,   color:"#14F195", price:null, type:"sol",    earnApy:null, canCollateral:true,  maxLTV:0.72, safeLTV:0.50, liqThreshold:0.78, borrowRate:null },
  { symbol:"mSOL",      icon:"⬢", logoUrl:TOKEN_LOGOS.mSOL,      color:"#FF7B54", price:null, type:"sol",    earnApy:null, canCollateral:true,  maxLTV:0.70, safeLTV:0.48, liqThreshold:0.76, borrowRate:null },
  { symbol:"PYUSD",     icon:"◈", logoUrl:TOKEN_LOGOS.PYUSD,     color:"#0070BA", price:null, type:"stable", earnApy:null, canCollateral:false },
  { symbol:"USDT",      icon:"◇", logoUrl:TOKEN_LOGOS.USDT,      color:"#26A17B", price:null, type:"stable", earnApy:null, canCollateral:false },
  { symbol:"wBTC",      icon:"₿", logoUrl:TOKEN_LOGOS.wBTC,      color:"#F7931A", price:null, type:"btc",    earnApy:null, canCollateral:true,  maxLTV:0.70, safeLTV:0.50, liqThreshold:0.75, borrowRate:null },
  { symbol:"ONYC",      icon:"◆", logoUrl:TOKEN_LOGOS.ONYC,      color:"#F59E0B", price:null, type:"rwa",    earnApy:null, canCollateral:true,  maxLTV:0.65, safeLTV:0.45, liqThreshold:0.70, borrowRate:null },
  { symbol:"syrupUSDC", icon:"◐", logoUrl:TOKEN_LOGOS.syrupUSDC, color:"#8B5CF6", price:null, type:"stable", earnApy:null, canCollateral:true,  maxLTV:0.75, safeLTV:0.55, liqThreshold:0.80, borrowRate:null },
  { symbol:"xStocks",   icon:"◫", logoUrl:TOKEN_LOGOS.xStocks,   color:"#14F195", price:null, type:"synth",  earnApy:null, canCollateral:true,  maxLTV:0.50, safeLTV:0.35, liqThreshold:0.60, borrowRate:null },
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

/* ─── MARKET IMPACT MODEL ────────────────────────────────────────────────── */
export function computeMarketImpact(deployAmount, tvl) {
  if (!tvl || tvl <= 0 || !deployAmount || deployAmount <= 0) return { impactFactor: 0, impactPct: 0 };
  const impactFactor = deployAmount / (tvl + deployAmount);
  return { impactFactor, impactPct: impactFactor * 100 };
}

export function effectiveApy(baseApy, deployAmount, tvl) {
  const { impactFactor } = computeMarketImpact(deployAmount, tvl);
  return baseApy * (1 - impactFactor);
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

  const baseDeployApy = venue.stableApy || 0;

  // Apply market impact if venue has TVL data (skip for fixed-rate/insurance venues)
  const skipImpact = venue.noImpact === true;
  const { impactFactor, impactPct } = skipImpact
    ? { impactFactor: 0, impactPct: 0 }
    : computeMarketImpact(borrowUSD, venue.tvl);
  const deployApy   = baseDeployApy * (1 - impactFactor);
  const grossCarry  = deployApy - borrowRate;
  const netCarryUSD = borrowUSD * (grossCarry / 100);

  const isSOL      = collateral.type === "sol";
  const stakingApy = isSOL ? 7.2 : 0;
  const colYieldUSD = colUSD * (stakingApy / 100);
  const totalNetUSD = netCarryUSD + colYieldUSD;

  return {
    colUSD, actualLTV, borrowUSD,
    liqPrice, liqDrop, hf, borrowCost,
    baseDeployApy, deployApy, impactPct,
    grossCarry, netCarryUSD,
    stakingApy, colYieldUSD, totalNetUSD,
  };
}

/* ─── ASSET HELPERS ──────────────────────────────────────────────────────── */

// Helper classification functions (must match API route)
function isStable(sym) {
  return ["USDC", "USDT", "PYUSD", "USX", "USD*", "USDe", "syrupUSDC"].some(s => sym.includes(s));
}

function isSOLType(sym) {
  return ["SOL", "JitoSOL", "jitoSOL", "mSOL", "bSOL", "stSOL", "hSOL", "jupSOL", "INF", "LST", "dSOL"].some(s => sym === s || sym.includes(s));
}

/**
 * Filter venues to those that support the selected asset.
 * - If a venue has `reserves` data, check for the specific asset symbol
 * - If no reserves, fall back to broad type-based matching
 */
export function getVenuesForAsset(asset, venues) {
  const v = venues || VENUES;
  if (!asset) return v;

  return v.filter(x => {
    // Precise matching using reserves data
    if (x.reserves && Object.keys(x.reserves).length > 0) {
      // Direct symbol match
      if (x.reserves[asset.symbol]) return true;
      // Exception: SOL-type assets can match any SOL-type reserve (JitoSOL ≈ SOL market)
      if (asset.type === "sol") {
        return Object.keys(x.reserves).some(s => isSOLType(s));
      }
      return false;
    }
    // No reserves data (aggregate venues like Lulo, Exponent, etc.)
    // Use broad type-based matching
    if (asset.type === "stable") return x.stableApy != null;
    if (asset.type === "sol")    return x.solApy != null;
    if (asset.type === "btc")    return x.solApy != null;
    // RWA and synth assets: only show venues that explicitly list them in reserves
    // Since they have no reserves match above, only show aggregate venues that handle them
    if (asset.type === "rwa" || asset.type === "synth") {
      // Show venues that are specifically tagged for this asset category
      return x.category === "rwa" || x.category === "aggregator" || x.category === "infra";
    }
    return false;
  });
}

export function getRelevantApy(venue, asset) {
  if (!asset) return Math.max(venue.stableApy ?? 0, venue.solApy ?? 0);
  // If venue has reserve-level data for this specific asset, use it
  if (venue.reserves?.[asset.symbol]?.supplyApy) {
    return venue.reserves[asset.symbol].supplyApy;
  }
  if (asset.type === "stable") return venue.stableApy;
  return venue.solApy;
}

export function getApyLabel(asset) {
  if (!asset) return "Best APY";
  if (asset.type === "stable") return "Stable APY";
  return "SOL/LST APY";
}

export function getApyColor(asset) {
  if (!asset) return "#14F195";
  if (asset.type === "stable") return "#14F195";
  return "#9945FF";
}

/* ─── Enrich static data with live API response ─────────────────────────── */
export function enrichVenues(liveData) {
  if (!liveData?.venues) return VENUES;

  // ── 1. Kamino markets ──
  const kaminoVenues = [];
  for (const km of (liveData.kaminoMarkets || [])) {
    const live = liveData.venues[km.name];
    if (!live) continue;
    if (live.stableApy == null && live.solApy == null) continue;

    kaminoVenues.push({
      name: km.name,
      logo: "K", logoUrl: venueFavicon("kamino.finance"), color: "#14F195",
      category: "lending",
      type: km.isPrimary ? "Lending Market" : "Isolated Market",
      stableApy: live.stableApy, solApy: live.solApy, tvl: live.tvl,
      reserves: live.reserves,
      audits: ["OtterSec", "Halborn"], oss: true,
      risk: km.isPrimary || (live.tvl || 0) > 50e6 ? "LOW" : "MEDIUM",
      note: km.isPrimary
        ? "Dominant Solana lending. Deepest liquidity on chain. K-Lend V2."
        : `Kamino isolated market: ${km.description || km.marketName}`,
      url: "https://kamino.finance",
      _source: live.source,
    });
  }
  kaminoVenues.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));

  // ── 2. Jupiter Lend per-token pools ──
  const jupiterVenues = [];
  for (const jp of (liveData.jupiterPools || [])) {
    const live = liveData.venues[jp.name];
    if (!live) continue;
    if (live.stableApy == null && live.solApy == null) continue;

    jupiterVenues.push({
      name: jp.name,
      logo: "JL", logoUrl: venueFavicon("jup.ag"), color: "#C8A84B",
      category: "lending",
      type: `${jp.symbol} Lending`,
      stableApy: live.stableApy, solApy: live.solApy, tvl: live.tvl,
      reserves: live.reserves,
      audits: ["OtterSec", "Sec3"], oss: true,
      risk: "LOW",
      note: `Jupiter Lend ${jp.symbol} pool. High LTV, Jupiter DEX integration.`,
      url: "https://jup.ag/lend",
      _source: live.source,
    });
  }
  jupiterVenues.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));

  // ── 3. Save (Solend) per-token pools ──
  const saveVenues = [];
  for (const sp of (liveData.savePools || [])) {
    const live = liveData.venues[sp.name];
    if (!live) continue;
    if (live.stableApy == null && live.solApy == null) continue;

    saveVenues.push({
      name: sp.name,
      logo: "Sv", logoUrl: venueFavicon("save.finance"), color: "#00C8FF",
      category: "lending",
      type: `${sp.symbol} Lending`,
      stableApy: live.stableApy, solApy: live.solApy, tvl: live.tvl,
      reserves: live.reserves,
      audits: ["Kudelski", "OtterSec"], oss: true,
      risk: "LOW",
      note: `Save (Solend) ${sp.symbol} reserve. OG Solana lending since 2021.`,
      url: "https://save.finance",
      _source: live.source,
    });
  }
  saveVenues.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));

  // ── 4. Drift insurance fund vaults ──
  const driftIFVenues = [];
  for (const dv of (liveData.driftVaults || [])) {
    const live = liveData.venues[dv.name];
    if (!live) continue;
    if (live.stableApy == null && live.solApy == null) continue;

    driftIFVenues.push({
      name: dv.name,
      logo: "D", logoUrl: venueFavicon("app.drift.trade"), color: "#FF6B35",
      category: "vault",
      type: `${dv.symbol} Insurance Fund`,
      stableApy: live.stableApy, solApy: live.solApy, tvl: live.tvl,
      reserves: live.reserves,
      audits: ["OtterSec", "Trail of Bits"], oss: true,
      risk: "LOW",
      noImpact: true,
      note: `Drift insurance fund vault for ${dv.symbol}. Passive yield from liquidations + lending.`,
      url: "https://app.drift.trade/earn",
      _source: live.source,
    });
  }
  driftIFVenues.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));

  // ── 5. Drift strategy vaults ──
  const driftStratVenues = [];
  for (const sv of (liveData.driftStrategyVaults || [])) {
    const live = liveData.venues[sv.name];
    if (!live) continue;
    const apy = live._vaultApy ?? live.stableApy ?? live.solApy ?? 0;

    driftStratVenues.push({
      name: sv.name,
      logo: "D", logoUrl: venueFavicon("app.drift.trade"), color: "#FF6B35",
      category: "vault",
      type: `Strategy Vault · ${sv.token || "USDC"}`,
      stableApy: live.stableApy, solApy: live.solApy, tvl: live.tvl,
      reserves: live.reserves,
      audits: ["OtterSec"], oss: false,
      risk: apy < 0 ? "HIGH" : "MEDIUM",
      noImpact: true,
      note: `Drift strategy vault: ${sv.vaultName}. Actively managed.${apy < 0 ? " ⚠ Negative 90d return." : ""}`,
      flag: apy < 0 ? "⚠ Negative 90d performance" : undefined,
      url: "https://app.drift.trade/vaults/strategy-vaults",
      _source: live.source,
      _apy7d: live._apy7d,
      _apy30d: live._apy30d,
    });
  }
  // Sort strategy vaults by 90d APY descending
  driftStratVenues.sort((a, b) => {
    const aApy = a.stableApy ?? a.solApy ?? 0;
    const bApy = b.stableApy ?? b.solApy ?? 0;
    return bApy - aApy;
  });

  // ── 6. Loopscale markets ──
  const loopscaleVenues = [];
  for (const lm of (liveData.loopscaleMarkets || [])) {
    const live = liveData.venues[lm.name];
    if (!live) continue;
    if (live.stableApy == null && live.solApy == null) continue;

    loopscaleVenues.push({
      name: lm.name,
      logo: "L", logoUrl: venueFavicon("loopscale.com"), color: "#A78BFA",
      category: "lending",
      type: `Fixed-Rate ${lm.symbol}`,
      stableApy: live.stableApy, solApy: live.solApy, tvl: live.tvl,
      reserves: live.reserves,
      audits: ["Halborn"], oss: false,
      risk: "MEDIUM",
      noImpact: true,
      note: `Loopscale fixed-rate order book for ${lm.symbol}. Rate locked at origination.`,
      flag: "⚠ Prior exploit — model upgraded post-incident",
      url: "https://loopscale.com",
      _source: live.source,
    });
  }

  // ── 7. Enrich static (non-dynamic) venues with live data ──
  const enrichedStatic = VENUES.map(v => {
    const live = liveData.venues[v.name];
    if (!live) return v;
    return {
      ...v,
      stableApy: live.stableApy ?? v.stableApy,
      solApy: live.solApy ?? v.solApy,
      tvl: live.tvl ?? v.tvl,
      reserves: live.reserves || v.reserves,
      _source: live.source,
    };
  }).filter(v => {
    return v.stableApy != null || v.solApy != null || v.tvl != null || v.category === "infra";
  });

  // ── 8. Combine all venues ──
  return [
    ...kaminoVenues,
    ...jupiterVenues,
    ...saveVenues,
    ...driftIFVenues,
    ...driftStratVenues,
    ...loopscaleVenues,
    ...enrichedStatic,
  ];
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
