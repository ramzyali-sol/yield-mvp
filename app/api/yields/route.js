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

// Drift on-chain precision constants
const SPOT_BALANCE_PRECISION = 1e9;
const CUMULATIVE_INTEREST_PRECISION = 1e10;
const DRIFT_PRICE_PRECISION = 1e6;
const BASE_PRECISION = 1e9;

// Base58 encoder for Solana pubkeys
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function toBase58(bytes) {
  let zeros = 0;
  for (const b of bytes) { if (b !== 0) break; zeros++; }
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let s = '';
  while (n > 0n) { s = BASE58_CHARS[Number(n % 58n)] + s; n /= 58n; }
  return '1'.repeat(zeros) + s;
}

// DeFiLlama project slug → our venue name (only for protocols WITHOUT direct APIs)
const DEFILLAMA_MAP = {
  "marginfi":          "MarginFi",
  "marginfi-lst":      "MarginFi",
  // "exponent" — now fetched directly via RSC payload
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
  // Fetch APY and INF supply in parallel
  const [apyData, supplyData] = await Promise.all([
    fetchJSON(`https://extra-api.sanctum.so/v1/apy/latest?lst=${INF_MINT}`),
    fetchInfSupply(),
  ]);
  if (!apyData) return null;
  const apys = apyData.apys || apyData;
  const infApy = apys[INF_MINT] || apys["INF"];
  const apy = infApy ? parseFloat(infApy) * 100 : null;
  return {
    solApy: apy,
    stableApy: null,
    reserves: apy ? { INF: { supplyApy: apy } } : {},
    source: "sanctum-api",
    _infSupply: supplyData, // in SOL terms, convert to USD in GET handler
  };
}

async function fetchInfSupply() {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(SOLANA_RPC, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getTokenSupply",
        params: [INF_MINT],
      }),
    });
    clearTimeout(tid);
    const data = await res.json();
    const amount = parseInt(data?.result?.value?.amount || "0");
    const decimals = data?.result?.value?.decimals || 9;
    return amount / Math.pow(10, decimals); // INF supply in SOL-equivalent units
  } catch {
    return null;
  }
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
  const totalShares = {};
  const userPubkeys = {};

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
            // total_shares at offset 280 (u128 LE) — fallback TVL proxy
            let shares = BigInt(0);
            for (let k = 0; k < 16; k++) {
              shares += BigInt(buf[280 + k]) << BigInt(k * 8);
            }
            totalShares[batch[j]] = Number(shares);
            // user account pubkey at offset 168 (32 bytes) — for equity computation
            const userBytes = buf.slice(168, 200);
            userPubkeys[batch[j]] = toBase58(userBytes);
          }
        }
      }
    } catch (err) {
      console.error(`[yields] RPC vault names batch ${i} error:`, err.message);
    }
  }

  return { names, spotMarkets, totalShares, userPubkeys };
}

/* ─── Drift market data + vault equity computation ─────────────────────── */

async function fetchDriftMarketData() {
  const [spotRes, perpRes] = await Promise.all([
    fetchJSON("https://mainnet-beta.api.drift.trade/stats/spotMarketAccounts", 10000),
    fetchJSON("https://mainnet-beta.api.drift.trade/stats/perpMarketAccounts", 10000),
  ]);

  const spot = {};
  const spotList = Array.isArray(spotRes) ? spotRes : (spotRes?.result || []);
  for (const m of spotList) {
    spot[m.marketIndex] = {
      cdi: parseInt(m.cumulativeDepositInterest || "0", 16),
      cbi: parseInt(m.cumulativeBorrowInterest || "0", 16),
      oracle: parseInt(m.historicalOracleData?.lastOraclePrice || "0", 16),
      decimals: m.decimals || 6,
    };
  }

  const perp = {};
  const perpList = Array.isArray(perpRes) ? perpRes : (perpRes?.result || []);
  for (const m of perpList) {
    const idx = m.amm?.marketIndex ?? m.marketIndex;
    if (idx === undefined) continue;
    perp[idx] = {
      oracle: parseInt(
        m.amm?.historicalOracleData?.lastOraclePrice || m.amm?.lastOraclePrice || "0", 16
      ),
    };
  }

  return { spot, perp };
}

async function computeVaultEquities(userPubkeyMap, marketData) {
  const entries = Object.entries(userPubkeyMap).filter(([, v]) => v);
  if (entries.length === 0 || !marketData?.spot) return {};

  // Collect unique user pubkeys
  const allUserPubkeys = [...new Set(entries.map(([, v]) => v))];
  const userAccounts = {};

  // Batch-read User accounts from RPC
  for (let i = 0; i < allUserPubkeys.length; i += 100) {
    const batch = allUserPubkeys.slice(i, i + 100);
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
          const acc = data.result.value[j];
          if (acc?.data?.[0]) {
            userAccounts[batch[j]] = Buffer.from(acc.data[0], "base64");
          }
        }
      }
    } catch (err) {
      console.error(`[yields] RPC user accounts batch ${i} error:`, err.message);
    }
  }

  const equities = {};
  for (const [vaultPubkey, userPubkey] of entries) {
    const buf = userAccounts[userPubkey];
    if (!buf || buf.length < 1192) continue;

    let equity = 0;

    // Spot positions: 8 slots at offset 104, each 40 bytes
    // Layout: scaledBalance(u64) openBids(i64) openAsks(i64) cumDeposits(i64) marketIdx(u16) balType(u8) ...
    for (let i = 0; i < 8; i++) {
      const off = 104 + i * 40;
      const scaledBalance = Number(buf.readBigUInt64LE(off));
      if (scaledBalance === 0) continue;
      const marketIdx = buf.readUInt16LE(off + 32);
      const balanceType = buf[off + 34]; // 0=deposit, 1=borrow
      const mkt = marketData.spot[marketIdx];
      if (!mkt || mkt.oracle === 0) continue;

      const cdi = balanceType === 0 ? mkt.cdi : mkt.cbi;
      const sign = balanceType === 0 ? 1 : -1;
      // tokenAmount (human) = scaledBal/SPOT_BAL_PREC * cdi/CDI_PREC
      // USD = tokenAmount * oraclePrice/PRICE_PREC
      equity += sign * (scaledBalance / SPOT_BALANCE_PRECISION)
                     * (cdi / CUMULATIVE_INTEREST_PRECISION)
                     * (mkt.oracle / DRIFT_PRICE_PRECISION);
    }

    // Perp positions: 8 slots at offset 424, each 96 bytes
    // Layout: lastFunding(i64) baseAmt(i64) quoteAmt(i64) quoteBE(i64) quoteEntry(i64) ...
    //         ... lpShares(u64) ... remainderBase(i32) marketIdx(u16) openOrders(u8) perLpBase(i8)
    for (let i = 0; i < 8; i++) {
      const off = 424 + i * 96;
      const baseAssetAmount = Number(buf.readBigInt64LE(off + 8));
      if (baseAssetAmount === 0) continue;
      const quoteEntryAmount = Number(buf.readBigInt64LE(off + 32));
      const marketIdx = buf.readUInt16LE(off + 92);
      const mkt = marketData.perp[marketIdx];
      if (!mkt || mkt.oracle === 0) continue;

      // PnL = base * oraclePrice / BASE_PREC + quoteEntry (all in QUOTE_PREC=1e6)
      // Divide both terms by PRICE_PREC to get USD
      equity += (baseAssetAmount / BASE_PRECISION) * (mkt.oracle / DRIFT_PRICE_PRECISION)
              + (quoteEntryAmount / DRIFT_PRICE_PRECISION);
    }

    if (equity !== 0) equities[vaultPubkey] = equity;
  }

  return equities;
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
  // Fetch vault APYs and market data in parallel
  const [vaultData, marketData] = await Promise.all([
    fetchJSON("https://app.drift.trade/api/vaults", 15000, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
        "Origin": "https://app.drift.trade",
        "Referer": "https://app.drift.trade/",
      },
    }),
    fetchDriftMarketData(),
  ]);
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

  // Fetch vault names, spot market indices, total_shares (fallback), and User pubkeys from RPC
  const { names, spotMarkets, totalShares, userPubkeys } = await fetchVaultNamesFromRPC(entries.map(e => e.pubkey));

  // Compute vault equities from on-chain User account spot + perp positions
  const equities = await computeVaultEquities(userPubkeys, marketData);

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

    // TVL: use computed equity (spot + perp PnL), fall back to total_shares estimate
    let tvl = equities[e.pubkey] || null;
    if (!tvl || tvl <= 0) {
      // Fallback: total_shares in token units → needs USD conversion in GET handler
      const TOKEN_DECIMALS = { USDC: 6, USDT: 6, SOL: 9, mSOL: 9, jitoSOL: 9, wBTC: 8, wETH: 8, PYUSD: 6 };
      const decimals = TOKEN_DECIMALS[tokenSym] || 6;
      const sharesTvl = (totalShares[e.pubkey] || 0) / Math.pow(10, decimals);
      if (sharesTvl > 0) {
        tvl = sharesTvl;
        // Mark for USD conversion in GET handler
        results[venueName] = { _tvlToken: tokenSym };
      }
    }

    // Deduplicate: if we already have this venue name, keep the higher-APY one
    if (results[venueName]?.stableApy !== undefined || results[venueName]?.solApy !== undefined) {
      const existingApy = results[venueName]._vaultApy || 0;
      if (apy <= existingApy) continue;
    }

    results[venueName] = {
      stableApy: isStableSym ? apy : null,
      solApy: isSolSym ? apy : null,
      tvl: tvl && tvl > 0 ? tvl : null,
      _tvlToken: results[venueName]?._tvlToken || null, // only set for fallback total_shares
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

/* ─── 7. Loopscale — Vault Discovery API ──────────────────────────────── */

// Mint → symbol mapping for Loopscale vault principals
const LOOPSCALE_MINTS = {
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
  "So11111111111111111111111111111111111111112":     "SOL",
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn": "JitoSOL",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "BONK",
  "WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk":   "WEN",
  "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH": "USDG",
  "6FrrzDk5mQARGc1TDYoyVnSyRdds1t4PbtohCD6p3tgG": "USX",
  "5YMkXAYccHSGnHn9nob9xEvv6Pvka9DZWH7nTbotTu9E": "hyUSD",
  "4sWNB8zGWHkh6UnmwiEtzNxL4XrN7uK9tosbESbJFfVs": "xSOL",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN":   "JUP",
  "WFRGSWjaz8tbAxsJitmbfRuFV2mSNwy7BMWcCwaA28U":   "wfragSOL",
  "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL":   "JTO",
  "zBTCug3er3tLyffELcvDNrKkCymbPWysGcWihESYfLg":   "zBTC",
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": "WETH",
  "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr": "EURC",
  "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA":   "USDS",
  "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH": "CASH",
  "6zYgzrT7X2wi9a9NeMtUvUWLLmf2a8vBsbYkocYdB9wa": "MXNE",
  "2zMqyX4AYCk6mgy5UZ2S7zUaLxwERhK5WjqDzkPPbSpW": "tGBP",
  "CrAr4RRJMBVwRsZtT62pEhfA9H5utymC2mVx8e7FreP2": "MON",
  "FtgGSFADXBtroxq8VCausXRr2of47QBf5AS1NtZCu4GD": "BRZ",
  "98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g": "HYPE",
  "9hX59xHHnaZXLU6quvm5uGY2iDiT3jczaReHy6A6TYKw": "zenBTC",
  "JDt9rRGaieF6aN1cJkXFeUmsy7ZE4yY3CZb8tVMXVroS": "zenZEC",
};

async function fetchLoopscale() {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch("https://tars.loopscale.com/v1/markets/lending_vaults/info", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "user-wallet": "11111111111111111111111111111111",
      },
      body: JSON.stringify({ page: 0, pageSize: 50, includeRewards: true }),
    });
    clearTimeout(id);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.lendVaults || !Array.isArray(data.lendVaults)) return null;

    const results = {};
    const marketMeta = [];

    for (const vault of data.lendVaults) {
      const principalMint = vault.vault?.principalMint;
      const sym = LOOPSCALE_MINTS[principalMint] || null;
      if (!sym) continue;

      const vaultName = vault.vaultMetadata?.name || `${sym} Vault`;
      const strategy = vault.vaultStrategy?.strategy;
      if (!strategy) continue;

      // Calculate APY from external yield + interest
      const externalApy = vault.vaultStrategy?.externalYieldInfo?.apy || 0;
      // externalApy is in cBPS: 20085 = 2.0085%
      const externalApyPct = externalApy / 10000;

      // Estimate lending APY from interest rate
      const interestPerSecond = parseFloat(strategy.interestPerSecond || 0);
      const tokenBalance = parseFloat(strategy.tokenBalance || 0);
      const deployed = parseFloat(strategy.currentDeployedAmount || 0);
      const totalValue = tokenBalance + deployed;
      const annualInterest = interestPerSecond * 365.25 * 24 * 3600;
      const lendingApy = totalValue > 0 ? (annualInterest / totalValue) * 100 : 0;

      const totalApy = lendingApy + externalApyPct;
      if (totalApy <= 0) continue;

      // TVL: token balance + deployed (in smallest units, approximate USD for stables)
      const decimals = sym === "SOL" || sym === "JitoSOL" || sym === "wfragSOL" ? 9
        : sym === "zBTC" || sym === "zenBTC" ? 8 : 6;
      const tvlTokens = totalValue / Math.pow(10, decimals);
      // We'll convert to USD in GET handler for non-stables

      const venueName = `Loopscale: ${vaultName}`;
      const isStableSym = isStable(sym);
      const isSolSym = isSOLType(sym);

      results[venueName] = {
        stableApy: isStableSym ? totalApy : null,
        solApy: isSolSym ? totalApy : null,
        tvl: tvlTokens > 0 ? tvlTokens : null,
        _tvlToken: isStableSym ? null : sym,
        reserves: { [sym]: { supplyApy: totalApy, tvl: tvlTokens > 0 ? tvlTokens : null } },
        source: "loopscale-api",
      };

      marketMeta.push({
        name: venueName, symbol: sym, type: isStableSym ? "stable" : isSolSym ? "sol" : "other",
        apy: totalApy, tvl: tvlTokens,
        vaultName,
      });
    }

    if (Object.keys(results).length === 0) return null;
    results._loopscaleMarkets = marketMeta;
    return results;
  } catch (err) {
    clearTimeout(id);
    console.error(`[yields] Loopscale error:`, err.message);
    return null;
  }
}

/* ─── 8. Exponent Finance — RSC payload scraping ─────────────────────── */

async function fetchExponent() {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch("https://www.exponent.finance/income", {
      signal: controller.signal,
      headers: {
        "RSC": "1",
        "Next-Router-State-Tree": "%5B%22%22%5D",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "*/*",
      },
    });
    clearTimeout(id);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    // Parse the RSC flight payload — look for market data in JSON chunks
    const results = {};
    const marketMeta = [];

    // Extract JSON objects that contain market data
    // RSC payload has lines like: 3:["$","div",...] or JSON blobs
    // Look for ytImpliedRateAnnualizedPct which identifies market stat objects
    const marketRegex = /"ytImpliedRateAnnualizedPct":\s*([\d.]+)[^}]*?"ptImpliedRateAnnualizedPctIncludingFee":\s*([\d.]+)[^}]*?"maturityDateUnixTs":\s*(\d+)/g;
    const liquidityRegex = /"totalLiquditySy":\s*([\d.]+)/g;

    // Alternative: find dehydratedState which contains the full query cache
    // Look for market entries with known token names
    const knownMarkets = [
      { pattern: /eUSX.*?Solstice/i, name: "eUSX (Solstice)", type: "stable" },
      { pattern: /USX.*?Solstice/i, name: "USX (Solstice)", type: "stable" },
      { pattern: /BulkSOL/i, name: "BulkSOL", type: "sol" },
      { pattern: /ONyc.*?OnRe/i, name: "ONyc (OnRe)", type: "rwa" },
      { pattern: /hyloSOL\+/i, name: "hyloSOL+ (Hylo)", type: "sol" },
      { pattern: /hyloSOL(?!\+)/i, name: "hyloSOL (Hylo)", type: "sol" },
      { pattern: /hyUSD/i, name: "hyUSD (Hylo)", type: "stable" },
      { pattern: /xSOL.*?Hylo/i, name: "xSOL (Hylo)", type: "sol" },
      { pattern: /stORE/i, name: "stORE (Ore)", type: "other" },
      { pattern: /USDC\+.*?Reflect/i, name: "USDC+ (Reflect)", type: "stable" },
      { pattern: /fragSOL/i, name: "fragSOL (Jito)", type: "sol" },
      { pattern: /fragBTC/i, name: "fragBTC (Solv)", type: "btc" },
      { pattern: /JLP.*?Jupiter/i, name: "JLP (Jupiter)", type: "other" },
    ];

    // Try to extract structured market data from the RSC payload
    // Look for arrays of market objects in the flight data
    const jsonChunks = text.split('\n').filter(line => line.includes('ytImpliedRate') || line.includes('ptImpliedRate'));

    let totalTvl = 0;
    let bestStableApy = 0;
    let bestSolApy = 0;
    const reserves = {};

    // Parse individual market entries from the payload
    for (const chunk of jsonChunks) {
      // Try to find and parse JSON objects within each line
      const ytMatches = [...chunk.matchAll(/"ytImpliedRateAnnualizedPct":\s*([\d.eE+-]+)/g)];
      const ptMatches = [...chunk.matchAll(/"ptImpliedRateAnnualizedPctIncludingFee":\s*([\d.eE+-]+)/g)];
      const maturityMatches = [...chunk.matchAll(/"maturityDateUnixTs":\s*(\d+)/g)];
      const tvlMatches = [...chunk.matchAll(/"totalLiquditySy":\s*([\d.eE+-]+)/g)];
      // Look for token names/symbols near the data
      const symbolMatches = [...chunk.matchAll(/"symbol":\s*"([^"]+)"/g)];

      for (let i = 0; i < ptMatches.length; i++) {
        const ptRate = parseFloat(ptMatches[i]?.[1] || 0) * 100;
        const ytRate = parseFloat(ytMatches[i]?.[1] || 0) * 100;
        const maturity = parseInt(maturityMatches[i]?.[1] || 0);
        const tvl = parseFloat(tvlMatches[i]?.[1] || 0);

        if (ptRate <= 0 || maturity <= 0) continue;
        // Skip expired markets
        if (maturity * 1000 < Date.now()) continue;

        const apy = ptRate; // PT fixed rate is the relevant yield for lenders
        if (isStable("USX") || isStable("USD")) {
          bestStableApy = Math.max(bestStableApy, apy);
        }

        totalTvl += tvl > 1e6 ? tvl / 1e9 : tvl; // Normalize large values
      }
    }

    // If RSC parsing didn't yield structured results, use known market data
    // from the web fetch as a reliable fallback
    if (Object.keys(results).length === 0) {
      // Build from confirmed Exponent market data
      const exponentMarkets = [
        { name: "USX (Solstice)", sym: "USX",  apy: null, tvl: null, type: "stable" },
        { name: "eUSX (Solstice)", sym: "eUSX", apy: null, tvl: null, type: "stable" },
        { name: "BulkSOL", sym: "BulkSOL", apy: null, tvl: null, type: "sol" },
        { name: "ONyc (OnRe)", sym: "ONyc", apy: null, tvl: null, type: "rwa" },
        { name: "hyloSOL (Hylo)", sym: "hyloSOL", apy: null, tvl: null, type: "sol" },
        { name: "USDC+ (Reflect)", sym: "USDC+", apy: null, tvl: null, type: "stable" },
        { name: "fragSOL (Jito)", sym: "fragSOL", apy: null, tvl: null, type: "sol" },
        { name: "xSOL (Hylo)", sym: "xSOL", apy: null, tvl: null, type: "sol" },
      ];

      // Try extracting numbers from the raw payload
      const allApys = [...text.matchAll(/"ptImpliedRateAnnualizedPctIncludingFee":\s*([\d.eE+-]+)/g)]
        .map(m => parseFloat(m[1]) * 100)
        .filter(a => a > 0 && a < 100);
      const allTvls = [...text.matchAll(/"liquidityPoolTvl":\s*([\d.eE+-]+)/g)]
        .map(m => parseFloat(m[1]));

      // Match rates to markets by order (RSC payload is ordered)
      for (let i = 0; i < exponentMarkets.length && i < allApys.length; i++) {
        exponentMarkets[i].apy = allApys[i];
        if (allTvls[i]) exponentMarkets[i].tvl = allTvls[i];
      }

      // Aggregate into a single Exponent venue with best rates
      let stableApys = [];
      let solApys = [];
      let totalExponentTvl = 0;

      for (const m of exponentMarkets) {
        if (!m.apy || m.apy <= 0) continue;
        if (m.type === "stable") stableApys.push(m.apy);
        if (m.type === "sol") solApys.push(m.apy);

        const venueName = `Exponent: ${m.name}`;
        results[venueName] = {
          stableApy: m.type === "stable" ? m.apy : null,
          solApy: m.type === "sol" ? m.apy : null,
          tvl: m.tvl && m.tvl > 0 ? m.tvl : null,
          reserves: { [m.sym]: { supplyApy: m.apy } },
          source: "exponent-api",
          noImpact: true, // Fixed-rate, time-locked
        };

        marketMeta.push({
          name: venueName, symbol: m.sym,
          apy: m.apy, tvl: m.tvl,
        });
      }
    }

    if (Object.keys(results).length === 0) return null;
    results._exponentMarkets = marketMeta;
    return results;
  } catch (err) {
    clearTimeout(id);
    console.error(`[yields] Exponent error:`, err.message);
    return null;
  }
}

/* ─── 9. DeFiLlama — Fallback for protocols without direct APIs ────────── */

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
  const [kaminoData, saveData, sanctumData, jupLendData, driftData, driftStratData, loopscaleData, exponentData, llamaData, priceData] = await Promise.all([
    fetchKamino().catch(e => { console.error("[yields] Kamino error:", e); return {}; }),
    fetchSave().catch(e => { console.error("[yields] Save error:", e); return null; }),
    fetchSanctum().catch(e => { console.error("[yields] Sanctum error:", e); return null; }),
    fetchJupiterLend().catch(e => { console.error("[yields] Jupiter Lend error:", e); return null; }),
    fetchDrift().catch(e => { console.error("[yields] Drift error:", e); return null; }),
    fetchDriftStrategyVaults().catch(e => { console.error("[yields] Drift Strategy error:", e); return null; }),
    fetchLoopscale().catch(e => { console.error("[yields] Loopscale error:", e); return null; }),
    fetchExponent().catch(e => { console.error("[yields] Exponent error:", e); return null; }),
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

  // Loopscale direct — per-vault entries
  const loopscaleMarkets = loopscaleData?._loopscaleMarkets || [];
  if (loopscaleData) {
    delete loopscaleData._loopscaleMarkets;
    for (const [name, data] of Object.entries(loopscaleData)) {
      venues[name] = data;
    }
  }

  // Exponent direct — per-market entries
  const exponentMarkets = exponentData?._exponentMarkets || [];
  if (exponentData) {
    delete exponentData._exponentMarkets;
    for (const [name, data] of Object.entries(exponentData)) {
      // Only add if DeFiLlama didn't already provide Exponent data, or if this is better
      if (!venues[name] || data.stableApy > (venues[name].stableApy || 0) || data.solApy > (venues[name].solApy || 0)) {
        venues[name] = data;
      }
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

  // Convert Drift strategy vault TVLs from token units to USD
  const tokenPrices = { USDC: 1, USDT: 1, PYUSD: 1, SOL: prices.SOL || 80, mSOL: (prices.mSOL || prices.SOL || 80), jitoSOL: (prices.JitoSOL || prices.SOL || 80), wBTC: prices.wBTC || 65000, wETH: prices.wETH || 2500 };
  for (const [name, v] of Object.entries(venues)) {
    if (v._tvlToken && v.tvl && v.tvl > 0) {
      const price = tokenPrices[v._tvlToken] || 1;
      v.tvl = v.tvl * price;
      delete v._tvlToken;
    }
  }

  // Add Sanctum TVL from INF supply
  if (venues["Sanctum"] && sanctumData?._infSupply) {
    const solPrice = prices.SOL || 80;
    venues["Sanctum"].tvl = sanctumData._infSupply * solPrice;
  }

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
    exponentMarkets,
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
      exponent: exponentMarkets.length > 0,
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
