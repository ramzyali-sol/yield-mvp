/* ─── /api/yields — Live market data aggregator ─────────────────────────── */

// Kamino markets are discovered dynamically from their v2 API
// This is the fallback if the discovery endpoint fails
const KAMINO_FALLBACK_MARKETS = {
  "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF": "Main Market",
};

// Token mint → symbol mapping for Kamino reserves
const KNOWN_MINTS = {
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
  "So11111111111111111111111111111111111111112":     "SOL",
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn": "JitoSOL",
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So":  "mSOL",
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo": "PYUSD",
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh": "wBTC",
  "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4": "JLP",
  "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v":  "jupSOL",
  "he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A":  "hSOL",
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1":  "bSOL",
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": "stSOL",
  "LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp":  "LST",
  "inf5RhGWmyg9mnJGp4ybHW1k1ioESJsxfBx1CNWVYfD":  "INF",
};

// CoinGecko ID → our symbol mapping
const COINGECKO_MAP = {
  "solana":          "SOL",
  "usd-coin":        "USDC",
  "jito-staked-sol": "JitoSOL",
  "msol":            "mSOL",
  "paypal-usd":      "PYUSD",
  "tether":          "USDT",
  "bitcoin":         "wBTC",
};

// DeFiLlama project slug → our venue name (only for protocols without direct APIs)
const DEFILLAMA_MAP = {
  "marginfi":         "MarginFi",
  "marginfi-lst":     "MarginFi",
  "exponent":         "Exponent",
  "ratex":            "RateX",
  "solstice":         "Solstice",
  "perena":           "Perena",
  "onre":             "OnRe",
  "hylo-lsts":        "Hylo",
  "hylo":             "Hylo",
  "carrot-liquidity":  "DeFi Carrot",
  "defi-carrot":       "DeFi Carrot",
  "neutral-trade":     "Neutral Trade",
  "lulo":              "Lulo",
};

// Symbol classification helpers
function isStable(sym) {
  return ["USDC", "USDT", "PYUSD", "USX", "USD*", "USDe"].some(s => sym.includes(s));
}

function isSOLType(sym) {
  return ["SOL", "JitoSOL", "mSOL", "bSOL", "stSOL", "hSOL", "jupSOL", "INF", "LST", "dSOL"].some(s => sym.includes(s));
}

/* ─── Fetch helpers ──────────────────────────────────────────────────────── */

async function fetchJSON(url, timeout = 10000, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 30 },
      ...opts,
    });
    clearTimeout(id);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(id);
    console.error(`[yields] Failed to fetch ${url}: ${err.message}`);
    return null;
  }
}

/* ─── 1. Kamino — Direct API (dynamic market discovery) ────────────────── */

async function discoverKaminoMarkets() {
  const data = await fetchJSON("https://api.kamino.finance/v2/kamino-market", 10000);
  if (!data || !Array.isArray(data) || data.length === 0) {
    // Fallback to hardcoded primary market
    return Object.entries(KAMINO_FALLBACK_MARKETS).map(([pk, name]) => ({
      lendingMarket: pk, name,
    }));
  }
  return data;
}

async function fetchKaminoMarketReserves(pubkey) {
  const url = `https://api.kamino.finance/kamino-market/${pubkey}/reserves/metrics`;
  return fetchJSON(url, 15000);
}

async function fetchKamino() {
  // Step 1: Discover all markets
  const markets = await discoverKaminoMarkets();

  // Step 2: Fetch reserves for all markets in parallel
  const reservePromises = markets.map(m =>
    fetchKaminoMarketReserves(m.lendingMarket)
      .then(data => ({ market: m, data }))
      .catch(() => ({ market: m, data: null }))
  );
  const reserveResults = await Promise.all(reservePromises);

  // Step 3: Process each market
  const results = {};
  const marketMeta = []; // Metadata for dynamic venue creation on the client

  for (const { market, data } of reserveResults) {
    if (!data) continue;

    const marketName = market.name || "Unknown Market";
    const venueName = `Kamino: ${marketName}`;
    const items = Array.isArray(data) ? data : (data.reserves || []);
    if (items.length === 0) continue;

    const stableApys = [];
    const solApys = [];
    let totalTvl = 0;
    const reserves = {};

    for (const item of items) {
      const mint = item.liquidityTokenMint || "";
      const symbol = KNOWN_MINTS[mint] || item.liquidityToken || "UNKNOWN";
      // API returns supplyApy/borrowApy as decimal strings (e.g., "0.0128" = 1.28%)
      const supplyApy = parseFloat(item.supplyApy || 0) * 100;
      const borrowApy = parseFloat(item.borrowApy || 0) * 100;
      const tvl = parseFloat(item.totalSupplyUsd || 0);

      totalTvl += tvl;
      reserves[symbol] = { supplyApy, borrowApy, tvl };

      if (isStable(symbol) && supplyApy > 0) stableApys.push(supplyApy);
      if (isSOLType(symbol) && supplyApy > 0) solApys.push(supplyApy);
    }

    const bestStable = stableApys.length > 0 ? Math.max(...stableApys) : null;
    const bestSol = solApys.length > 0 ? Math.max(...solApys) : null;

    results[venueName] = {
      stableApy: bestStable,
      solApy: bestSol,
      tvl: totalTvl,
      reserves,
      source: "kamino-api",
    };

    marketMeta.push({
      name: venueName,
      marketName,
      pubkey: market.lendingMarket,
      isPrimary: !!market.isPrimary,
      isCurated: !!market.isCurated,
      description: market.description || "",
      tvl: totalTvl,
    });
  }

  // Attach market metadata to results for client-side venue creation
  results._kaminoMarkets = marketMeta;

  return results;
}

/* ─── 2. Save (Solend) — Direct API ─────────────────────────────────────── */

// Main market reserve addresses
const SAVE_RESERVES = [
  "BgxfHJDzm44T7XG68MYKx7YisTjZu73tVovyZSjJMpmw", // USDC
  "8PbodeaosQP19SjYFx855UMqWxH2HynZLdBXmsrbac36", // SOL
  "8K9WC8xoh2rtQNY7iEGXtPvfbDCi563SdWhCAhuMP2xE", // USDT
].join(",");

async function fetchSave() {
  let data = await fetchJSON(`https://api.save.finance/v1/reserves?ids=${SAVE_RESERVES}`, 10000);
  if (!data?.results) {
    data = await fetchJSON(`https://api.solend.fi/v1/reserves?ids=${SAVE_RESERVES}`, 10000);
  }
  if (!data?.results) return null;

  let bestStable = 0;
  let bestSol = 0;
  let totalTvl = 0;
  const reserves = {};

  for (const r of data.results) {
    // Each result has { reserve: {...}, rates: { supplyInterest, borrowInterest }, cTokenExchangeRate }
    const reserveData = r.reserve || {};
    const rates = r.rates || {};
    const mint = reserveData.liquidity?.mintPubkey || "";
    const symbol = KNOWN_MINTS[mint] || "UNKNOWN";

    // rates.supplyInterest and rates.borrowInterest are percentage strings (e.g., "2.35" = 2.35%)
    const supplyApy = parseFloat(rates.supplyInterest || 0);
    const borrowApy = parseFloat(rates.borrowInterest || 0);

    // TVL: available + borrowed, in token units
    const decimals = reserveData.liquidity?.mintDecimals || 6;
    const available = parseFloat(reserveData.liquidity?.availableAmount || 0) / (10 ** decimals);
    // borrowedAmountWads is scaled by 1e18 AND by token decimals
    const borrowedWads = parseFloat(reserveData.liquidity?.borrowedAmountWads || 0);
    const borrowed = borrowedWads / 1e18 / (10 ** decimals);
    const totalTokens = available + borrowed;

    // marketPrice is in wads (18 decimals) — price per whole token in USD
    const rawPrice = parseFloat(reserveData.liquidity?.marketPrice || 0);
    const priceUsd = rawPrice / 1e18;
    const tvl = totalTokens * priceUsd;
    totalTvl += tvl;

    reserves[symbol] = { supplyApy, borrowApy, tvl };

    if (isStable(symbol) && supplyApy > 0) bestStable = Math.max(bestStable, supplyApy);
    if (isSOLType(symbol) && supplyApy > 0) bestSol = Math.max(bestSol, supplyApy);
  }

  return {
    stableApy: bestStable > 0 ? bestStable : null,
    solApy: bestSol > 0 ? bestSol : null,
    tvl: totalTvl,
    reserves,
    source: "save-api",
  };
}

/* ─── 3. Sanctum — Direct API ───────────────────────────────────────────── */

const INF_MINT = "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm";

async function fetchSanctum() {
  // Try the INF LST APY
  const data = await fetchJSON(`https://extra-api.sanctum.so/v1/apy/latest?lst=${INF_MINT}`);
  if (!data) return null;

  // Response is { apys: { [mint]: number } } — APY as decimal
  const apys = data.apys || data;
  const infApy = apys[INF_MINT] || apys["INF"];
  const apy = infApy ? parseFloat(infApy) * 100 : null;

  return {
    solApy: apy,
    stableApy: null,
    source: "sanctum-api",
  };
}

/* ─── 4. Jupiter Lend — Direct API ──────────────────────────────────────── */

const JUP_API_KEY = process.env.JUP_API_KEY || "e2bf0ab4-575e-4291-9b13-54a61e92e706";

async function fetchJupiterLend() {
  if (!JUP_API_KEY) return null;

  const data = await fetchJSON("https://api.jup.ag/lend/v1/earn/tokens", 10000, {
    headers: { "x-api-key": JUP_API_KEY },
  });
  if (!data || !Array.isArray(data)) return null;

  const stableApys = [];
  const solApys = [];
  let totalTvl = 0;
  const reserves = {};

  for (const token of data) {
    const sym = token.asset?.uiSymbol || token.asset?.symbol || token.symbol || "";
    const decimals = token.asset?.decimals || token.decimals || 6;
    const price = parseFloat(token.asset?.price || 0);
    // totalRate is in basis points (390 = 3.90%)
    const totalRate = parseFloat(token.totalRate || 0);
    const apy = totalRate / 100;
    const totalAssets = parseFloat(token.totalAssets || 0) / (10 ** decimals);
    const tvl = totalAssets * price;

    totalTvl += tvl;
    reserves[sym] = { supplyApy: apy, tvl };

    if (isStable(sym) && apy > 0) stableApys.push(apy);
    if (isSOLType(sym) && apy > 0) solApys.push(apy);
  }

  return {
    stableApy: stableApys.length > 0 ? Math.max(...stableApys) : null,
    solApy: solApys.length > 0 ? Math.max(...solApys) : null,
    tvl: totalTvl,
    reserves,
    source: "jup-lend-api",
  };
}

/* ─── 5. Drift — Direct API ─────────────────────────────────────────────── */

// Only use major tokens for Drift headline APYs (not niche IF vaults like ZEUS, JTO, INF)
const DRIFT_HEADLINE_STABLES = ["USDC", "USDT", "PYUSD", "USDS"];
const DRIFT_HEADLINE_SOL = ["SOL", "JitoSOL", "jitoSOL", "mSOL", "bSOL"];

async function fetchDrift() {
  // Insurance fund has per-market APYs
  const ifData = await fetchJSON("https://data.api.drift.trade/stats/insuranceFund", 10000);

  // Also get latest deposit rates for USDC and SOL
  const [usdcRate, solRate] = await Promise.all([
    fetchJSON("https://data.api.drift.trade/stats/USDC/rateHistory/deposit", 10000),
    fetchJSON("https://data.api.drift.trade/stats/SOL/rateHistory/deposit", 10000),
  ]);

  if (!ifData?.data?.marketSharePriceData) return null;

  const markets = ifData.data.marketSharePriceData;
  let bestStable = 0;
  let bestSol = 0;
  const reserves = {};

  for (const m of markets) {
    const sym = m.symbol;
    const apy = parseFloat(m.apy || 0);
    if (!sym || apy <= 0) continue;

    reserves[sym] = { supplyApy: apy };

    // Only use major tokens for headline rates (avoids niche IF vaults inflating numbers)
    if (DRIFT_HEADLINE_STABLES.includes(sym)) bestStable = Math.max(bestStable, apy);
    if (DRIFT_HEADLINE_SOL.includes(sym)) bestSol = Math.max(bestSol, apy);
  }

  // Override with latest deposit rates if available (more current than IF APY)
  const latestUsdcRate = usdcRate?.rates?.length > 0
    ? parseFloat(usdcRate.rates[usdcRate.rates.length - 1][1]) * 100
    : null;
  const latestSolRate = solRate?.rates?.length > 0
    ? parseFloat(solRate.rates[solRate.rates.length - 1][1]) * 100
    : null;

  if (latestUsdcRate && latestUsdcRate > bestStable) bestStable = latestUsdcRate;
  if (latestSolRate && latestSolRate > bestSol) bestSol = latestSolRate;

  return {
    stableApy: bestStable > 0 ? bestStable : null,
    solApy: bestSol > 0 ? bestSol : null,
    reserves,
    source: "drift-api",
  };
}

/* ─── 6. Loopscale — Direct API ─────────────────────────────────────────── */

const LOOPSCALE_PRINCIPALS = [
  { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", sym: "USDC", type: "stable" },
  { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", sym: "USDT", type: "stable" },
  { mint: "So11111111111111111111111111111111111111112",     sym: "SOL",  type: "sol" },
];

async function fetchLoopscale() {
  const stableApys = [];
  const solApys = [];
  const reserves = {};

  for (const { mint, sym, type } of LOOPSCALE_PRINCIPALS) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch("https://tars.loopscale.com/v1/markets/quote", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "user-wallet": "11111111111111111111111111111111",
        },
        body: JSON.stringify({
          durationType: 2,  // months
          duration: 1,      // 1 month — closest to spot rate
          principal: mint,
          collateral: [],
          limit: 5,
          offset: 0,
        }),
      });
      clearTimeout(id);
      if (!res.ok) continue;

      const quotes = await res.json();
      if (!Array.isArray(quotes) || quotes.length === 0) continue;

      // APY is in cBPS: 100000 = 10%, so divide by 10000 to get %
      const bestQuote = quotes.reduce((best, q) => {
        const apy = (q.apy || 0) / 10000;
        return apy > best ? apy : best;
      }, 0);

      if (bestQuote > 0) {
        reserves[sym] = { supplyApy: bestQuote };
        if (type === "stable") stableApys.push(bestQuote);
        if (type === "sol") solApys.push(bestQuote);
      }
    } catch (err) {
      clearTimeout(id);
      console.error(`[yields] Loopscale ${sym} error:`, err.message);
    }
  }

  if (stableApys.length === 0 && solApys.length === 0) return null;

  return {
    stableApy: stableApys.length > 0 ? Math.max(...stableApys) : null,
    solApy: solApys.length > 0 ? Math.max(...solApys) : null,
    reserves,
    source: "loopscale-api",
  };
}

/* ─── 7. DeFiLlama — Fallback for remaining protocols ───────────────────── */

async function fetchDeFiLlama() {
  const data = await fetchJSON("https://yields.llama.fi/pools", 20000);
  if (!data?.data) return {};

  // Filter to Solana pools
  const solanaPools = data.data.filter(p => p.chain === "Solana");

  // Group by our venue names
  const venueData = {};

  for (const pool of solanaPools) {
    const project = pool.project;
    const venueName = DEFILLAMA_MAP[project];
    if (!venueName) continue;

    const apy = parseFloat(pool.apy || 0);
    const tvl = parseFloat(pool.tvlUsd || 0);
    const symbol = pool.symbol || "";

    if (!venueData[venueName]) {
      venueData[venueName] = { stableApys: [], solApys: [], totalTvl: 0, pools: [] };
    }

    venueData[venueName].totalTvl += tvl;
    venueData[venueName].pools.push({ symbol, apy, tvl });

    if (isStable(symbol) && apy > 0) venueData[venueName].stableApys.push(apy);
    if (isSOLType(symbol) && apy > 0) venueData[venueName].solApys.push(apy);
  }

  // Convert to our format
  const results = {};
  for (const [name, d] of Object.entries(venueData)) {
    results[name] = {
      stableApy: d.stableApys.length > 0 ? Math.max(...d.stableApys) : null,
      solApy: d.solApys.length > 0 ? Math.max(...d.solApys) : null,
      tvl: d.totalTvl || null,
      source: "defillama",
    };
  }

  return results;
}

/* ─── 7. CoinGecko Price API ─────────────────────────────────────────────── */

async function fetchPrices() {
  const geckoIds = Object.keys(COINGECKO_MAP).join(",");
  const data = await fetchJSON(
    `https://api.coingecko.com/api/v3/simple/price?ids=${geckoIds}&vs_currencies=usd`,
    10000
  );
  if (!data) return null;

  const prices = {};
  for (const [geckoId, symbol] of Object.entries(COINGECKO_MAP)) {
    if (data[geckoId]?.usd) {
      prices[symbol] = data[geckoId].usd;
    }
  }

  return prices;
}

/* ─── 8. Kamino borrow rates (for collateral assets) ────────────────────── */

const OUR_ASSETS = ["SOL", "USDC", "JitoSOL", "mSOL", "PYUSD", "USDT", "wBTC", "ONYC", "syrupUSDC", "xStocks"];

function extractBorrowRates(kaminoData) {
  // Pull borrow rates from the Kamino Main Market, filtered to our assets only
  const main = kaminoData["Kamino: Main Market"];
  if (!main?.reserves) return {};

  const rates = {};
  for (const [sym, r] of Object.entries(main.reserves)) {
    if (OUR_ASSETS.includes(sym) && r.borrowApy > 0) {
      rates[sym] = r.borrowApy;
    }
  }
  return rates;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE HANDLER
═══════════════════════════════════════════════════════════════════════════ */

export async function GET() {
  const startTime = Date.now();

  // Fetch all sources in parallel
  const [kaminoData, saveData, sanctumData, jupLendData, driftData, loopscaleData, llamaData, priceData] = await Promise.all([
    fetchKamino().catch(e => { console.error("[yields] Kamino error:", e); return {}; }),
    fetchSave().catch(e => { console.error("[yields] Save error:", e); return null; }),
    fetchSanctum().catch(e => { console.error("[yields] Sanctum error:", e); return null; }),
    fetchJupiterLend().catch(e => { console.error("[yields] Jupiter Lend error:", e); return null; }),
    fetchDrift().catch(e => { console.error("[yields] Drift error:", e); return null; }),
    fetchLoopscale().catch(e => { console.error("[yields] Loopscale error:", e); return null; }),
    fetchDeFiLlama().catch(e => { console.error("[yields] DeFiLlama error:", e); return {}; }),
    fetchPrices().catch(e => { console.error("[yields] Prices error:", e); return null; }),
  ]);

  // Merge all venue data — protocol-direct APIs take priority over DeFiLlama
  const venues = {};

  // Extract Kamino market metadata before merging venues
  const kaminoMarkets = kaminoData._kaminoMarkets || [];
  delete kaminoData._kaminoMarkets;

  // DeFiLlama first (lowest priority)
  for (const [name, data] of Object.entries(llamaData)) {
    venues[name] = data;
  }

  // Kamino direct (overwrites DeFiLlama for Kamino venues)
  for (const [name, data] of Object.entries(kaminoData)) {
    venues[name] = data;
  }

  // Save (Solend) direct
  if (saveData) {
    venues["Save (Solend)"] = saveData;
  }

  // Sanctum direct
  if (sanctumData && sanctumData.solApy) {
    venues["Sanctum"] = { ...venues["Sanctum"], ...sanctumData };
  }

  // Jupiter Lend direct
  if (jupLendData) {
    venues["Jupiter Lend"] = jupLendData;
  }

  // Drift direct
  if (driftData) {
    venues["Drift Vaults"] = driftData;
  }

  // Loopscale direct
  if (loopscaleData) {
    venues["Loopscale"] = loopscaleData;
  }

  // Extract borrow rates from Kamino main market
  const borrowRates = extractBorrowRates(kaminoData);

  // Build asset earn APYs from the best available venue data
  const assetEarnApys = {};
  const allVenueEntries = Object.values(venues);

  // Find best earn APY across all venues for each asset type
  for (const v of allVenueEntries) {
    if (v.stableApy) {
      assetEarnApys.USDC = Math.max(assetEarnApys.USDC || 0, v.stableApy);
      assetEarnApys.USDT = Math.max(assetEarnApys.USDT || 0, v.stableApy);
      assetEarnApys.PYUSD = Math.max(assetEarnApys.PYUSD || 0, v.stableApy);
    }
    if (v.solApy) {
      assetEarnApys.SOL = Math.max(assetEarnApys.SOL || 0, v.solApy);
    }
  }

  // Also pull supply APYs from individual venue reserves for specific assets
  for (const venueData of Object.values(venues)) {
    if (!venueData.reserves) continue;
    for (const [sym, r] of Object.entries(venueData.reserves)) {
      if (r.supplyApy > 0.01) { // Skip near-zero rates
        if (["JitoSOL", "mSOL", "wBTC"].includes(sym)) {
          assetEarnApys[sym] = Math.max(assetEarnApys[sym] || 0, r.supplyApy);
        }
      }
    }
  }

  // For SOL-type LSTs, use the best SOL APY across all venues as the earn APY
  const bestSolApy = Math.max(...Object.values(venues).map(v => v.solApy || 0), 0);
  if (bestSolApy > 0) {
    if (!assetEarnApys.JitoSOL || assetEarnApys.JitoSOL < bestSolApy) {
      assetEarnApys.JitoSOL = bestSolApy;
    }
    if (!assetEarnApys.mSOL || assetEarnApys.mSOL < bestSolApy) {
      assetEarnApys.mSOL = bestSolApy;
    }
  }

  // Add default prices for new collateral assets that don't have CoinGecko feeds
  const prices = priceData || {};
  if (!prices.ONYC)      prices.ONYC = 1.0;       // RWA token pegged ~$1
  if (!prices.syrupUSDC) prices.syrupUSDC = 1.0;   // Yield-bearing USDC wrapper
  if (!prices.xStocks)   prices.xStocks = 10.0;    // Synthetic equities basket

  // Default earn APYs and borrow rates for new assets
  if (!assetEarnApys.ONYC)      assetEarnApys.ONYC = 12.0;      // OnRe reinsurance yield
  if (!assetEarnApys.syrupUSDC) assetEarnApys.syrupUSDC = 8.5;   // Maple/Syrup yield
  if (!assetEarnApys.xStocks)   assetEarnApys.xStocks = 0;       // No direct earn
  if (!borrowRates.ONYC)        borrowRates.ONYC = 5.0;
  if (!borrowRates.syrupUSDC)   borrowRates.syrupUSDC = 4.0;
  if (!borrowRates.xStocks)     borrowRates.xStocks = 8.0;

  const elapsed = Date.now() - startTime;

  const result = {
    venues,
    kaminoMarkets,
    prices,
    borrowRates,
    assetEarnApys,
    sources: {
      kamino: Object.keys(kaminoData).length > 0,
      save: !!saveData,
      sanctum: !!sanctumData?.solApy,
      jupiter: !!jupLendData,
      drift: !!driftData,
      loopscale: !!loopscaleData,
      defillama: Object.keys(llamaData).length > 0,
      prices: !!priceData,
    },
    fetchedAt: new Date().toISOString(),
    elapsed,
  };

  return Response.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
