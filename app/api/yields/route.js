/* ─── /api/yields — Live market data aggregator ─────────────────────────── */

// Kamino markets are discovered dynamically from their v2 API
const KAMINO_FALLBACK_MARKETS = {
  "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF": "Main Market",
};

// Token mint → symbol mapping
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
  "5Y8NV33Vv7WbnLfq3zBcKSdYPrk7g2KoiQoe7M2tcxp5": "ONYC",
  "AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj": "syrupUSDC",
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

// Drift spot market index → token symbol (from on-chain program)
const DRIFT_SPOT_MARKETS = {
  0: "USDC", 1: "SOL", 2: "mSOL", 3: "wBTC", 4: "wETH",
  5: "USDT", 6: "jitoSOL", 19: "PYUSD",
};

// DeFiLlama project slug → our venue name (only for protocols WITHOUT direct APIs)
const DEFILLAMA_MAP = {
  "marginfi":          "MarginFi",
  "marginfi-lst":      "MarginFi",
  "exponent":          "Exponent",
  "ratex":             "RateX",
  "solstice":          "Solstice",
  "perena":            "Perena",
  "onre":              "OnRe",
  "hylo-lsts":         "Hylo",
  "hylo":              "Hylo",
  "carrot-liquidity":  "DeFi Carrot",
  "defi-carrot":       "DeFi Carrot",
  "neutral-trade":     "Neutral Trade",
  "lulo":              "Lulo",
};

// Symbol classification helpers
function isStable(sym) {
  return ["USDC", "USDT", "PYUSD", "USX", "USD*", "USDe", "syrupUSDC"].some(s => sym.includes(s));
}

function isSOLType(sym) {
  return ["SOL", "JitoSOL", "jitoSOL", "mSOL", "bSOL", "stSOL", "hSOL", "jupSOL", "INF", "LST", "dSOL"].some(s => sym === s || sym.includes(s));
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
    return Object.entries(KAMINO_FALLBACK_MARKETS).map(([pk, name]) => ({
      lendingMarket: pk, name,
    }));
  }
  return data;
}

async function fetchKaminoMarketReserves(pubkey) {
  return fetchJSON(`https://api.kamino.finance/kamino-market/${pubkey}/reserves/metrics`, 15000);
}

async function fetchKamino() {
  const markets = await discoverKaminoMarkets();
  const reservePromises = markets.map(m =>
    fetchKaminoMarketReserves(m.lendingMarket)
      .then(data => ({ market: m, data }))
      .catch(() => ({ market: m, data: null }))
  );
  const reserveResults = await Promise.all(reservePromises);

  const results = {};
  const marketMeta = [];

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
      const supplyApy = parseFloat(item.supplyApy || 0) * 100;
      const borrowApy = parseFloat(item.borrowApy || 0) * 100;
      const tvl = parseFloat(item.totalSupplyUsd || 0);

      totalTvl += tvl;
      reserves[symbol] = { supplyApy, borrowApy, tvl };

      if (isStable(symbol) && supplyApy > 0) stableApys.push(supplyApy);
      if (isSOLType(symbol) && supplyApy > 0) solApys.push(supplyApy);
    }

    results[venueName] = {
      stableApy: stableApys.length > 0 ? Math.max(...stableApys) : null,
      solApy: solApys.length > 0 ? Math.max(...solApys) : null,
      tvl: totalTvl,
      reserves,
      source: "kamino-api",
    };

    marketMeta.push({
      name: venueName, marketName,
      pubkey: market.lendingMarket,
      isPrimary: !!market.isPrimary,
      isCurated: !!market.isCurated,
      description: market.description || "",
      tvl: totalTvl,
    });
  }

  results._kaminoMarkets = marketMeta;
  return results;
}

/* ─── 2. Save (Solend) — Direct API, per-token ────────────────────────── */

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

  const results = {};
  const poolMeta = [];

  for (const r of data.results) {
    const reserveData = r.reserve || {};
    const rates = r.rates || {};
    const mint = reserveData.liquidity?.mintPubkey || "";
    const symbol = KNOWN_MINTS[mint] || "UNKNOWN";
    if (symbol === "UNKNOWN") continue;

    const supplyApy = parseFloat(rates.supplyInterest || 0);
    const borrowApy = parseFloat(rates.borrowInterest || 0);
    const decimals = reserveData.liquidity?.mintDecimals || 6;
    const available = parseFloat(reserveData.liquidity?.availableAmount || 0) / (10 ** decimals);
    const borrowedWads = parseFloat(reserveData.liquidity?.borrowedAmountWads || 0);
    const borrowed = borrowedWads / 1e18 / (10 ** decimals);
    const totalTokens = available + borrowed;
    const rawPrice = parseFloat(reserveData.liquidity?.marketPrice || 0);
    const priceUsd = rawPrice / 1e18;
    const tvl = totalTokens * priceUsd;

    if (supplyApy <= 0) continue;

    const venueName = `Save: ${symbol}`;
    const isStableSym = isStable(symbol);
    const isSolSym = isSOLType(symbol);

    results[venueName] = {
      stableApy: isStableSym ? supplyApy : null,
      solApy: isSolSym ? supplyApy : null,
      tvl,
      reserves: { [symbol]: { supplyApy, borrowApy, tvl } },
      source: "save-api",
    };

    poolMeta.push({
      name: venueName, symbol,
      apy: supplyApy, tvl,
      isStable: isStableSym, isSOL: isSolSym,
    });
  }

  if (Object.keys(results).length === 0) return null;
  results._savePools = poolMeta;
  return results;
}

/* ─── 3. Sanctum — Direct API ───────────────────────────────────────────── */

const INF_MINT = "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm";

async function fetchSanctum() {
  const data = await fetchJSON(`https://extra-api.sanctum.so/v1/apy/latest?lst=${INF_MINT}`);
  if (!data) return null;
  const apys = data.apys || data;
  const infApy = apys[INF_MINT] || apys["INF"];
  const apy = infApy ? parseFloat(infApy) * 100 : null;
  return {
    solApy: apy,
    stableApy: null,
    reserves: apy ? { INF: { supplyApy: apy } } : {},
    source: "sanctum-api",
  };
}

/* ─── 4. Jupiter Lend — Direct API, per-token ─────────────────────────── */

const JUP_API_KEY = process.env.JUP_API_KEY || "e2bf0ab4-575e-4291-9b13-54a61e92e706";

async function fetchJupiterLend() {
  if (!JUP_API_KEY) return null;

  const data = await fetchJSON("https://api.jup.ag/lend/v1/earn/tokens", 10000, {
    headers: { "x-api-key": JUP_API_KEY },
  });
  if (!data || !Array.isArray(data)) return null;

  const results = {};
  const poolMeta = [];

  for (const token of data) {
    const sym = token.asset?.uiSymbol || token.asset?.symbol || token.symbol || "";
    if (!sym) continue;
    const decimals = token.asset?.decimals || token.decimals || 6;
    const price = parseFloat(token.asset?.price || 0);
    const totalRate = parseFloat(token.totalRate || 0);
    const apy = totalRate / 100;
    const totalAssets = parseFloat(token.totalAssets || 0) / (10 ** decimals);
    const tvl = totalAssets * price;

    if (apy <= 0) continue;

    const venueName = `Jupiter Lend: ${sym}`;
    const isStableSym = isStable(sym);
    const isSolSym = isSOLType(sym);

    results[venueName] = {
      stableApy: isStableSym ? apy : null,
      solApy: isSolSym ? apy : null,
      tvl,
      reserves: { [sym]: { supplyApy: apy, tvl } },
      source: "jup-lend-api",
    };

    poolMeta.push({
      name: venueName, symbol: sym,
      apy, tvl,
      isStable: isStableSym, isSOL: isSolSym,
    });
  }

  if (Object.keys(results).length === 0) return null;
  results._jupiterPools = poolMeta;
  return results;
}

/* ─── 5. Drift Insurance Fund — Direct API, per-token ─────────────────── */

const DRIFT_HEADLINE_STABLES = ["USDC", "USDT", "PYUSD", "USDS"];
const DRIFT_HEADLINE_SOL = ["SOL", "JitoSOL", "jitoSOL", "mSOL", "bSOL"];

async function fetchDrift() {
  const ifData = await fetchJSON("https://data.api.drift.trade/stats/insuranceFund", 10000);
  const [usdcRate, solRate] = await Promise.all([
    fetchJSON("https://data.api.drift.trade/stats/USDC/rateHistory/deposit", 10000),
    fetchJSON("https://data.api.drift.trade/stats/SOL/rateHistory/deposit", 10000),
  ]);

  if (!ifData?.data?.marketSharePriceData) return null;

  const markets = ifData.data.marketSharePriceData;
  const results = {};
  const vaultMeta = [];

  const latestUsdcRate = usdcRate?.rates?.length > 0
    ? parseFloat(usdcRate.rates[usdcRate.rates.length - 1][1]) * 100 : null;
  const latestSolRate = solRate?.rates?.length > 0
    ? parseFloat(solRate.rates[solRate.rates.length - 1][1]) * 100 : null;

  for (const m of markets) {
    const sym = m.symbol;
    let apy = parseFloat(m.apy || 0);
    const tvl = parseFloat(m.totalIfShares || 0) * parseFloat(m.sharePrice || 1);
    if (!sym || apy <= 0) continue;

    if (sym === "USDC" && latestUsdcRate && latestUsdcRate > apy) apy = latestUsdcRate;
    if (sym === "SOL" && latestSolRate && latestSolRate > apy) apy = latestSolRate;

    const venueName = `Drift IF: ${sym}`;
    const isStableSym = isStable(sym);
    const isSolSym = isSOLType(sym);

    results[venueName] = {
      stableApy: isStableSym ? apy : null,
      solApy: isSolSym ? apy : null,
      tvl: tvl > 0 ? tvl : null,
      reserves: { [sym]: { supplyApy: apy } },
      source: "drift-api",
    };

    vaultMeta.push({
      name: venueName, symbol: sym, apy,
      tvl: tvl > 0 ? tvl : null,
      isStable: isStableSym, isSOL: isSolSym,
    });
  }

  results._driftVaults = vaultMeta;
  return results;
}

/* ─── 6. Drift Strategy Vaults — Direct API + RPC for names ────────────── */

const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

async function fetchVaultNamesFromRPC(pubkeys) {
  const names = {};
  const spotMarkets = {};

  // Batch in groups of 100 (RPC limit)
  for (let i = 0; i < pubkeys.length; i += 100) {
    const batch = pubkeys.slice(i, i + 100);
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(SOLANA_RPC, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "getMultipleAccounts",
          params: [batch, { encoding: "base64" }],
        }),
      });
      clearTimeout(tid);
      const data = await res.json();

      if (data?.result?.value) {
        for (let j = 0; j < data.result.value.length; j++) {
          const account = data.result.value[j];
          if (!account?.data?.[0]) continue;

          const buf = Buffer.from(account.data[0], "base64");
          // Drift vault account: 8 bytes discriminator + 32 bytes name
          if (buf.length > 470) {
            const nameBytes = buf.slice(8, 40);
            const name = Buffer.from(nameBytes).toString("utf-8").replace(/\0/g, "").trim();
            if (name.length > 0 && name.length < 33) {
              names[batch[j]] = name;
            }
            // spot_market_index at byte offset 468 (u16 LE)
            const spotIdx = buf.readUInt16LE(468);
            if (DRIFT_SPOT_MARKETS[spotIdx] !== undefined) {
              spotMarkets[batch[j]] = DRIFT_SPOT_MARKETS[spotIdx];
            }
          }
        }
      }
    } catch (err) {
      console.error(`[yields] RPC vault names batch ${i} error:`, err.message);
    }
  }

  return { names, spotMarkets };
}

function inferTokenFromName(name) {
  const lower = name.toLowerCase();
  if (lower.includes("usdc") || lower.includes("stable") || lower.includes("usd")) return "USDC";
  if (lower.includes("jitosol") || lower.includes("jito sol")) return "JitoSOL";
  if (lower.includes("msol") || lower.includes("m-sol")) return "mSOL";
  if (lower.includes("sol")) return "SOL";
  if (lower.includes("btc") || lower.includes("bitcoin")) return "wBTC";
  if (lower.includes("eth")) return "wETH";
  return "USDC"; // Most Drift strategy vaults are USDC-denominated
}

async function fetchDriftStrategyVaults() {
  const vaultData = await fetchJSON("https://app.drift.trade/api/vaults", 15000, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "application/json",
      "Origin": "https://app.drift.trade",
      "Referer": "https://app.drift.trade/",
    },
  });
  if (!vaultData || typeof vaultData !== "object") return null;

  // Parse vault entries — use 90d APY (matches Drift's UI display)
  // Require >= 60 snapshots (~2 months) to filter out very new/test vaults
  const entries = Object.entries(vaultData)
    .map(([pubkey, data]) => ({
      pubkey,
      apy7d: data.apys?.["7d"] || 0,
      apy30d: data.apys?.["30d"] || 0,
      apy90d: data.apys?.["90d"] || 0,
      apy180d: data.apys?.["180d"] || 0,
      apy365d: data.apys?.["365d"] || 0,
      maxDrawdown: data.maxDrawdownPct || 0,
      snapshots: data.numOfVaultSnapshots || 0,
    }))
    .filter(v => v.snapshots >= 60);

  if (entries.length === 0) return null;

  // Fetch vault names + spot market from Solana RPC
  const { names, spotMarkets } = await fetchVaultNamesFromRPC(entries.map(e => e.pubkey));

  const results = {};
  const meta = [];

  // Deduplicate: if multiple vaults have the same name, keep the one with highest 90d APY
  const TRUSTED_TOKENS = ["USDC", "SOL", "USDT", "wBTC", "wETH", "mSOL", "jitoSOL"];

  for (const e of entries) {
    const rawName = names[e.pubkey];
    if (!rawName) continue; // Skip vaults without readable on-chain names
    const displayName = rawName;

    // Use 90d APY consistently (matches Drift's UI), cap at 200%
    const MAX_APY = 200;
    const rawApy = e.apy90d !== 0 ? e.apy90d : (e.apy30d !== 0 ? e.apy30d : e.apy7d);
    const apy = rawApy > 0 ? Math.min(rawApy, MAX_APY) : rawApy; // Only cap positive APYs

    // Determine token type from on-chain spot market index, or infer from name
    const rpcToken = spotMarkets[e.pubkey];
    const tokenSym = (rpcToken && TRUSTED_TOKENS.includes(rpcToken)) ? rpcToken : inferTokenFromName(displayName);
    const isStableSym = isStable(tokenSym);
    const isSolSym = isSOLType(tokenSym);

    const venueName = `Drift: ${displayName}`;

    // Deduplicate: if we already have this venue name, keep the higher-APY one
    if (results[venueName]) {
      const existingApy = results[venueName]._vaultApy || 0;
      if (apy <= existingApy) continue;
    }

    results[venueName] = {
      stableApy: isStableSym ? apy : null,
      solApy: isSolSym ? apy : null,
      tvl: null,
      reserves: { [tokenSym]: { supplyApy: apy } },
      source: "drift-vaults-api",
      _vaultApy: apy,
      _apy7d: e.apy7d,
      _apy30d: e.apy30d,
      _apy90d: e.apy90d,
      _apy365d: e.apy365d,
    };

    meta.push({
      name: venueName,
      vaultName: displayName,
      pubkey: e.pubkey,
      token: tokenSym,
      apy,
      apy7d: e.apy7d,
      apy30d: e.apy30d,
    });
  }

  if (meta.length === 0) return null;
  results._driftStrategyVaults = meta;
  return results;
}

/* ─── 7. Loopscale — Direct API, per-token ─────────────────────────────── */

const LOOPSCALE_PRINCIPALS = [
  { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", sym: "USDC", type: "stable" },
  { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", sym: "USDT", type: "stable" },
  { mint: "So11111111111111111111111111111111111111112",     sym: "SOL",  type: "sol" },
];

async function fetchLoopscale() {
  const results = {};
  const marketMeta = [];

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
          durationType: 2, duration: 1,
          principal: mint, collateral: [],
          limit: 5, offset: 0,
        }),
      });
      clearTimeout(id);
      if (!res.ok) continue;

      const quotes = await res.json();
      if (!Array.isArray(quotes) || quotes.length === 0) continue;

      const bestQuote = quotes.reduce((best, q) => {
        const apy = (q.apy || 0) / 10000;
        return apy > best ? apy : best;
      }, 0);

      if (bestQuote > 0) {
        const venueName = `Loopscale: ${sym}`;
        const isStableSym = type === "stable";

        results[venueName] = {
          stableApy: isStableSym ? bestQuote : null,
          solApy: !isStableSym ? bestQuote : null,
          reserves: { [sym]: { supplyApy: bestQuote } },
          source: "loopscale-api",
        };

        marketMeta.push({ name: venueName, symbol: sym, type, apy: bestQuote });
      }
    } catch (err) {
      clearTimeout(id);
      console.error(`[yields] Loopscale ${sym} error:`, err.message);
    }
  }

  if (Object.keys(results).length === 0) return null;
  results._loopscaleMarkets = marketMeta;
  return results;
}

/* ─── 8. DeFiLlama — Fallback for protocols without direct APIs ────────── */

async function fetchDeFiLlama() {
  // Skip Next.js data cache for this large response (>2MB)
  const data = await fetchJSON("https://yields.llama.fi/pools", 20000, { next: { revalidate: 0 } });
  if (!data?.data) return {};

  const solanaPools = data.data.filter(p => p.chain === "Solana");
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

/* ─── 10. CoinGecko Price API ──────────────────────────────────────────── */

async function fetchPrices() {
  const geckoIds = Object.keys(COINGECKO_MAP).join(",");
  const data = await fetchJSON(
    `https://api.coingecko.com/api/v3/simple/price?ids=${geckoIds}&vs_currencies=usd`, 10000
  );
  if (!data) return null;

  const prices = {};
  for (const [geckoId, symbol] of Object.entries(COINGECKO_MAP)) {
    if (data[geckoId]?.usd) prices[symbol] = data[geckoId].usd;
  }
  return prices;
}

/* ─── 11. Kamino borrow rates (for collateral assets) ───────────────────── */

const OUR_ASSETS = ["SOL", "USDC", "JitoSOL", "mSOL", "PYUSD", "USDT", "wBTC", "ONYC", "syrupUSDC", "xStocks"];

function extractBorrowRates(allVenues) {
  // Pull borrow rates from Kamino Main Market reserves
  const main = allVenues["Kamino: Main Market"];
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
  const [kaminoData, saveData, sanctumData, jupLendData, driftData, driftStratData, loopscaleData, llamaData, priceData] = await Promise.all([
    fetchKamino().catch(e => { console.error("[yields] Kamino error:", e); return {}; }),
    fetchSave().catch(e => { console.error("[yields] Save error:", e); return null; }),
    fetchSanctum().catch(e => { console.error("[yields] Sanctum error:", e); return null; }),
    fetchJupiterLend().catch(e => { console.error("[yields] Jupiter Lend error:", e); return null; }),
    fetchDrift().catch(e => { console.error("[yields] Drift error:", e); return null; }),
    fetchDriftStrategyVaults().catch(e => { console.error("[yields] Drift Strategy error:", e); return null; }),
    fetchLoopscale().catch(e => { console.error("[yields] Loopscale error:", e); return null; }),
    fetchDeFiLlama().catch(e => { console.error("[yields] DeFiLlama error:", e); return {}; }),
    fetchPrices().catch(e => { console.error("[yields] Prices error:", e); return null; }),
  ]);

  // Merge all venue data — direct APIs take priority over DeFiLlama
  const venues = {};

  // Extract metadata arrays before merging
  const kaminoMarkets = kaminoData._kaminoMarkets || [];
  delete kaminoData._kaminoMarkets;

  // DeFiLlama first (lowest priority — only for venues without direct APIs)
  for (const [name, data] of Object.entries(llamaData)) {
    venues[name] = data;
  }

  // Kamino direct
  for (const [name, data] of Object.entries(kaminoData)) {
    venues[name] = data;
  }

  // Save direct — per-token entries
  const savePools = saveData?._savePools || [];
  if (saveData) {
    delete saveData._savePools;
    for (const [name, data] of Object.entries(saveData)) {
      venues[name] = data;
    }
  }

  // Sanctum direct
  if (sanctumData && sanctumData.solApy) {
    venues["Sanctum"] = { ...venues["Sanctum"], ...sanctumData };
  }

  // Jupiter Lend direct — per-token entries
  const jupiterPools = jupLendData?._jupiterPools || [];
  if (jupLendData) {
    delete jupLendData._jupiterPools;
    for (const [name, data] of Object.entries(jupLendData)) {
      venues[name] = data;
    }
  }

  // Drift insurance fund — per-token entries
  const driftVaults = driftData?._driftVaults || [];
  if (driftData) {
    delete driftData._driftVaults;
    for (const [name, data] of Object.entries(driftData)) {
      venues[name] = data;
    }
  }

  // Drift strategy vaults — per-vault entries
  const driftStrategyVaults = driftStratData?._driftStrategyVaults || [];
  if (driftStratData) {
    delete driftStratData._driftStrategyVaults;
    for (const [name, data] of Object.entries(driftStratData)) {
      venues[name] = data;
    }
  }

  // Loopscale direct — per-token entries
  const loopscaleMarkets = loopscaleData?._loopscaleMarkets || [];
  if (loopscaleData) {
    delete loopscaleData._loopscaleMarkets;
    for (const [name, data] of Object.entries(loopscaleData)) {
      venues[name] = data;
    }
  }

  // Extract borrow rates from Kamino main market
  const borrowRates = extractBorrowRates(venues);

  // Build asset earn APYs from the best available venue data
  const assetEarnApys = {};
  for (const v of Object.values(venues)) {
    if (v.stableApy) {
      assetEarnApys.USDC = Math.max(assetEarnApys.USDC || 0, v.stableApy);
      assetEarnApys.USDT = Math.max(assetEarnApys.USDT || 0, v.stableApy);
      assetEarnApys.PYUSD = Math.max(assetEarnApys.PYUSD || 0, v.stableApy);
    }
    if (v.solApy) {
      assetEarnApys.SOL = Math.max(assetEarnApys.SOL || 0, v.solApy);
    }
    if (v.reserves) {
      for (const [sym, r] of Object.entries(v.reserves)) {
        if (r.supplyApy > 0.01 && ["JitoSOL", "mSOL", "wBTC", "ONYC", "syrupUSDC"].includes(sym)) {
          assetEarnApys[sym] = Math.max(assetEarnApys[sym] || 0, r.supplyApy);
        }
      }
    }
  }

  const bestSolApy = Math.max(...Object.values(venues).map(v => v.solApy || 0), 0);
  if (bestSolApy > 0) {
    if (!assetEarnApys.JitoSOL || assetEarnApys.JitoSOL < bestSolApy) assetEarnApys.JitoSOL = bestSolApy;
    if (!assetEarnApys.mSOL || assetEarnApys.mSOL < bestSolApy) assetEarnApys.mSOL = bestSolApy;
  }

  // Prices
  const prices = priceData || {};
  if (!prices.ONYC) prices.ONYC = 1.0;
  if (!prices.syrupUSDC) prices.syrupUSDC = 1.0;
  if (!prices.xStocks) prices.xStocks = 10.0;

  // Default earn APYs and borrow rates for new assets
  if (!assetEarnApys.ONYC) assetEarnApys.ONYC = 12.0;
  if (!assetEarnApys.syrupUSDC) assetEarnApys.syrupUSDC = 8.5;
  if (!assetEarnApys.xStocks) assetEarnApys.xStocks = 0;
  if (!borrowRates.ONYC) borrowRates.ONYC = 5.0;
  if (!borrowRates.syrupUSDC) borrowRates.syrupUSDC = 4.0;
  if (!borrowRates.xStocks) borrowRates.xStocks = 8.0;

  const elapsed = Date.now() - startTime;

  const result = {
    venues,
    kaminoMarkets,
    driftVaults,
    driftStrategyVaults,
    loopscaleMarkets,
    jupiterPools,
    savePools,
    prices,
    borrowRates,
    assetEarnApys,
    sources: {
      kamino: Object.keys(kaminoData).length > 0,
      save: savePools.length > 0,
      sanctum: !!sanctumData?.solApy,
      jupiter: jupiterPools.length > 0,
      drift: driftVaults.length > 0,
      driftStrategy: driftStrategyVaults.length > 0,
      loopscale: loopscaleMarkets.length > 0,
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
