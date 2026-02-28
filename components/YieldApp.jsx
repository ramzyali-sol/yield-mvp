"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  VENUES, CATEGORY_META, ASSETS, COLLATERAL_ASSETS,
  fmt, fmtUSD, computeCarryTrade, computeMarketImpact,
  getVenuesForAsset, getRelevantApy, getApyLabel, getApyColor,
  enrichVenues, enrichAssets, enrichPrices,
} from "../lib/data";
import {
  NavTab, RiskBadge, PaperBadge, Toggle, MetricBox,
  FilterChip, VenueLogo, AssetButton, AmountInput, SuccessScreen,
  LoadingSkeleton, LastUpdated,
} from "./ui";

/* ─── HOOKS ──────────────────────────────────────────────────────────────── */
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const handler = () => setW(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return w;
}

/* ─── LIVE MARKET DATA HOOK ──────────────────────────────────────────────── */
function useMarketData() {
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastGood = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/yields");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLiveData(data);
      lastGood.current = data;
      setError(null);
    } catch (err) {
      console.error("[useMarketData] Fetch failed:", err);
      setError(err.message);
      // Keep showing last good data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const data = liveData || lastGood.current;

  const venues = useMemo(() => enrichVenues(data), [data]);
  const assets = useMemo(() => enrichAssets(data), [data]);
  const prices = useMemo(() => enrichPrices(data), [data]);

  return {
    venues,
    assets,
    prices,
    loading: loading && !data,
    error,
    fetchedAt: data?.fetchedAt || null,
    sources: data?.sources || null,
  };
}

function usePaperPortfolio(prices) {
  const [positions, setPositions] = useState([]);
  const [history, setHistory]     = useState([]);

  const addEarn = useCallback(({ asset, amount, venue, apy }) => {
    const id = Date.now();
    const usdVal = amount * (prices[asset.symbol] ?? asset.price ?? 1);
    setPositions(prev => [...prev, { id, type:"earn", asset, amount, venue, apy, usdVal, openedAt: new Date() }]);
    setHistory(prev => [...prev, { id, action:"OPEN EARN", desc:`${amount} ${asset.symbol} → ${venue}`, apy, usdVal, at: new Date() }]);
  }, [prices]);

  const addBorrow = useCallback(({ collateral, colAmount, borrowUSD, dest, deployApy, borrowRate, netCarryUSD }) => {
    const id = Date.now();
    setPositions(prev => [...prev, { id, type:"borrow", collateral, colAmount, borrowUSD, dest, deployApy, borrowRate, netCarryUSD, openedAt: new Date() }]);
    setHistory(prev => [...prev, { id, action:"OPEN BORROW", desc:`${colAmount} ${collateral.symbol} → borrow ${fmtUSD(borrowUSD)} → ${dest.name}`, netCarryUSD, at: new Date() }]);
  }, []);

  const closePosition = useCallback((id) => {
    setPositions(prev => {
      const pos = prev.find(p => p.id === id);
      if (pos) {
        setHistory(h => [...h, { id, action:"CLOSE", desc: pos.type === "earn" ? `${pos.amount} ${pos.asset.symbol}` : `${fmtUSD(pos.borrowUSD)} borrow`, at: new Date() }]);
      }
      return prev.filter(pos => pos.id !== id);
    });
  }, []);

  const totalEarnUSD = positions.filter(p => p.type === "earn").reduce((s, p) => s + p.usdVal, 0);
  const totalNetCarryUSD = positions.filter(p => p.type === "borrow").reduce((s, p) => s + p.netCarryUSD, 0);

  return { positions, history, addEarn, addBorrow, closePosition, totalEarnUSD, totalNetCarryUSD };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [tab, setTab] = useState("search");
  const market = useMarketData();
  const paper = usePaperPortfolio(market.prices);
  const w = useWindowWidth();
  const isMobile = w < 768;

  return (
    <div style={{ minHeight:"100vh", fontFamily:"var(--sans)", color:"#F0EDE8" }}>
      {/* NAV */}
      <nav style={{
        position:"sticky", top:0, zIndex:100,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding: isMobile ? "0 16px" : "0 32px",
        height:"58px",
        background:"rgba(10,10,15,0.85)",
        backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(153,69,255,0.15)",
        gap:"8px",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", flexShrink:0 }}>
          <div style={{ width:"26px", height:"26px", background:"linear-gradient(135deg,#9945FF,#14F195)", borderRadius:"6px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", boxShadow:"0 0 12px rgba(153,69,255,0.3)" }}>⌬</div>
          {!isMobile && <span className="gradient-text-static" style={{ fontFamily:"var(--mono)", fontSize:"13px", fontWeight:700, letterSpacing:"0.1em" }}>YIELD</span>}
        </div>
        <div style={{
          display:"flex", gap:"4px",
          overflowX: isMobile ? "auto" : "visible",
          WebkitOverflowScrolling:"touch",
        }}>
          {[
            ["search","Search"],
            ["structured","Structured Product"],
            ["portfolio","Portfolio"],
          ].map(([t,l]) =>
            <NavTab key={t} label={l} active={tab===t} onClick={()=>setTab(t)}
              badge={t === "portfolio" ? paper.positions.length : undefined} />
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
          {!isMobile && (
            <LastUpdated fetchedAt={market.fetchedAt} error={market.error} sources={market.sources} />
          )}
          {!isMobile && paper.positions.length > 0 && (
            <div style={{ padding:"5px 12px", background:"rgba(153,69,255,0.1)", border:"1px solid rgba(153,69,255,0.25)", borderRadius:"6px", fontSize:"11px", fontFamily:"var(--mono)", color:"#DC1FFF" }}>
              {paper.positions.length} position{paper.positions.length !== 1 ? "s" : ""}
            </div>
          )}
          <div style={{ padding:"5px 12px", background:"rgba(15,12,28,0.6)", border:"1px solid rgba(153,69,255,0.15)", borderRadius:"6px", fontSize:"11px", fontFamily:"var(--mono)", color:"#666", whiteSpace:"nowrap", backdropFilter:"blur(8px)" }}>
            {isMobile ? "Paper" : "Paper Trading Mode"}
          </div>
        </div>
      </nav>

      {tab === "search"     && <SearchTab paper={paper} isMobile={isMobile} width={w} market={market} />}
      {tab === "structured" && <StructuredProductTab paper={paper} isMobile={isMobile} width={w} market={market} />}
      {tab === "portfolio"  && <PortfolioTab paper={paper} isMobile={isMobile} width={w} market={market} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEARCH TAB — Asset-First
═══════════════════════════════════════════════════════════════════════════ */
function SearchTab({ paper, isMobile, width, market }) {
  const { venues, assets, prices, loading, error, fetchedAt, sources } = market;

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [query, setQuery]       = useState("");
  const [catFilter, setCat]     = useState("all");
  const [riskFilter, setRisk]   = useState("all");
  const [sortBy, setSort]       = useState("apy");
  const [expanded, setExpanded] = useState(null);

  // Inline paper earn state
  const [earnVenue, setEarnVenue]     = useState(null);
  const [earnAmount, setEarnAmount]   = useState("");
  const [earnSuccess, setEarnSuccess] = useState(null);

  // Protocol-grouped view state
  const [viewMode, setViewMode]           = useState("grouped");  // "grouped" | "flat"
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const earnAssets = assets.filter(a => a.earnApy != null);

  const filtered = useMemo(() => {
    let v = selectedAsset ? getVenuesForAsset(selectedAsset, venues) : [...venues];
    if (query) {
      const q = query.toLowerCase();
      v = v.filter(x => (x.name||"").toLowerCase().includes(q) || (x.type||"").toLowerCase().includes(q) || (x.note||"").toLowerCase().includes(q));
    }
    if (catFilter !== "all") v = v.filter(x => x.category === catFilter);
    if (riskFilter !== "all") v = v.filter(x => x.risk === riskFilter.toUpperCase());
    v.sort((a, b) => {
      if (sortBy === "apy") {
        const aApy = selectedAsset ? (getRelevantApy(a, selectedAsset) ?? 0) : Math.max(a.stableApy ?? 0, a.solApy ?? 0);
        const bApy = selectedAsset ? (getRelevantApy(b, selectedAsset) ?? 0) : Math.max(b.stableApy ?? 0, b.solApy ?? 0);
        return bApy - aApy;
      }
      if (sortBy === "tvl") return (b.tvl ?? 0) - (a.tvl ?? 0);
      if (sortBy === "risk") return (a.risk === "LOW" ? 0:1) - (b.risk === "LOW" ? 0:1);
      return 0;
    });
    return v;
  }, [selectedAsset, query, catFilter, riskFilter, sortBy, venues]);

  /* ─── Protocol grouping ───────────────────────────────────────────────── */
  const PROTOCOL_MAP = {
    "kamino-api":        { key: "kamino",         label: "Kamino",                   color: "#14F195" },
    "jup-lend-api":      { key: "jupiter",        label: "Jupiter Lend",             color: "#C7F284" },
    "save-api":          { key: "save",           label: "Save",                     color: "#3B82F6" },
    "drift-api":         { key: "drift-if",       label: "Drift Insurance",          color: "#E879F9" },
    "drift-vaults-api":  { key: "drift-strategy", label: "Drift Strategy Vaults",    color: "#A78BFA" },
    "loopscale-api":     { key: "loopscale",      label: "Loopscale",                color: "#6EE7B7" },
    "sanctum-api":       { key: "sanctum",        label: "Sanctum",                  color: "#818CF8" },
    "defillama":         { key: "other",          label: "Other Protocols",          color: "#94A3B8" },
  };

  function protocolKey(v) {
    return PROTOCOL_MAP[v._source]?.key || "other";
  }

  const PREVIEW_COUNT = 3;

  const grouped = useMemo(() => {
    const map = {};
    for (const v of filtered) {
      const pk = protocolKey(v);
      if (!map[pk]) {
        const meta = Object.values(PROTOCOL_MAP).find(m => m.key === pk) || { key: pk, label: "Other Protocols", color: "#94A3B8" };
        // Use first venue's logo for the group
        map[pk] = { key: pk, label: meta.label, color: meta.color, logoUrl: v.logoUrl, logo: v.logo, venues: [] };
      }
      map[pk].venues.push(v);
    }
    // Sort groups by best APY descending
    return Object.values(map).sort((a, b) => {
      const bestA = Math.max(...a.venues.map(v => selectedAsset ? (getRelevantApy(v, selectedAsset) ?? 0) : Math.max(v.stableApy ?? 0, v.solApy ?? 0)));
      const bestB = Math.max(...b.venues.map(v => selectedAsset ? (getRelevantApy(v, selectedAsset) ?? 0) : Math.max(v.stableApy ?? 0, v.solApy ?? 0)));
      return bestB - bestA;
    });
  }, [filtered, selectedAsset]);

  /* ─── Smart view-mode behaviors ───────────────────────────────────────── */
  // Reset expanded groups when filters change
  useEffect(() => {
    setExpandedGroups(new Set());
  }, [selectedAsset, catFilter, riskFilter, query]);

  // Auto-switch to flat mode when text search query is non-empty
  useEffect(() => {
    if (query) setViewMode("flat");
  }, [query]);

  // Auto-switch back to grouped when query is cleared
  useEffect(() => {
    if (!query) setViewMode("grouped");
  }, [query]);

  function handlePaperEarn(venue) {
    const num = parseFloat(earnAmount) || 0;
    if (num <= 0 || !selectedAsset) return;
    const apy = getRelevantApy(venue, selectedAsset) ?? 0;
    paper.addEarn({ asset: selectedAsset, amount: num, venue: venue.name, apy });
    setEarnSuccess({ asset: selectedAsset, amount: num, venue: venue.name, apy });
    setEarnVenue(null);
    setEarnAmount("");
    setTimeout(() => setEarnSuccess(null), 3000);
  }

  const apyLabel = getApyLabel(selectedAsset);
  const apyColor = getApyColor(selectedAsset);

  /* ─── Extracted venue card renderer (shared by grouped + flat modes) ──── */
  function renderVenueCard(v, i) {
    const cm = CATEGORY_META[v.category] || { label: v.category || "Other", color: "#666" };
    const isOpen = expanded === v.name;
    const relevantApy = getRelevantApy(v, selectedAsset);
    const isEarning = earnVenue === v.name;

    return (
      <div
        key={v.name}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.005)"; e.currentTarget.style.boxShadow = `0 0 20px ${v.color}15`; e.currentTarget.style.borderColor = "rgba(153,69,255,0.2)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = isOpen ? "rgba(153,69,255,0.2)" : "rgba(153,69,255,0.08)"; }}
        style={{
          background: isOpen ? "rgba(15,12,28,0.7)" : "rgba(15,12,28,0.4)",
          backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
          border:`1px solid ${isOpen ? "rgba(153,69,255,0.2)" : "rgba(153,69,255,0.08)"}`,
          borderLeft:`3px solid ${v.color}`,
          borderRadius:"12px",
          transition:"all 0.2s ease",
          animation:`cardEnter 0.4s ease ${Math.min(i*0.03, 0.8)}s both`,
        }}
      >
        {/* Row */}
        <div
          onClick={() => setExpanded(isOpen ? null : v.name)}
          style={{
            display:"grid",
            gridTemplateColumns: isMobile
              ? "34px 1fr 80px 20px"
              : width < 1024
                ? "36px 180px 80px 100px 1fr 80px 20px"
                : "36px 220px 100px 120px 1fr 80px 20px",
            alignItems:"center", gap: isMobile ? "10px" : "16px",
            padding:"14px 20px", cursor:"pointer",
          }}
        >
          <VenueLogo logo={v.logo} logoUrl={v.logoUrl} color={v.color} />

          <div>
            <div style={{ fontWeight:700, fontSize:"13px", color:"#D0CCC5", marginBottom:"2px" }}>{v.name}</div>
            <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
              <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:cm.color }} />
              <span style={{ fontSize:"10px", color:cm.color, fontFamily:"var(--mono)" }}>{cm.label}</span>
              {v._source && <span style={{ fontSize:"8px", color:"#333", fontFamily:"var(--mono)" }}>({v._source})</span>}
            </div>
          </div>

          {/* Relevant APY — prominent */}
          <div>
            <div style={{ fontSize:"20px", fontFamily:"var(--serif)", color: relevantApy ? apyColor : "#333", lineHeight:1 }}>
              {relevantApy != null ? `${relevantApy.toFixed(1)}%` : "—"}
            </div>
            <div style={{ fontSize:"10px", color:"#444", fontFamily:"var(--mono)" }}>{apyLabel}</div>
          </div>

          {!isMobile && (
            <div>
              <div style={{ fontSize:"13px", fontWeight:600, color:"#C0BBA8" }}>{v.tvl ? fmt(v.tvl) : "—"}</div>
              <div style={{ fontSize:"10px", color:"#444", fontFamily:"var(--mono)" }}>TVL</div>
            </div>
          )}

          {!isMobile && (
            <div style={{ fontSize:"11px", color:"#555", lineHeight:"1.5" }}>
              {v.note}
              {v.flag && <div style={{ fontSize:"10px", color:"#FF8C5A", marginTop:"2px", fontFamily:"var(--mono)" }}>{v.flag}</div>}
            </div>
          )}

          <div><RiskBadge risk={v.risk} /></div>
          <div style={{ color:"#444", fontSize:"12px", textAlign:"right" }}>{isOpen ? "▲" : "▼"}</div>
        </div>

        {/* Expanded detail */}
        {isOpen && (
          <div style={{ padding:"0 20px 20px", borderTop:"1px solid rgba(255,255,255,0.06)" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ height:"12px" }} />

            {/* Metrics */}
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap:"10px", marginBottom:"16px" }}>
              {v.stableApy && <MetricBox label="Stable APY" value={`${v.stableApy.toFixed(2)}%`} sub="USDC / USDT lending rate" valueColor="#14F195" />}
              {v.solApy    && <MetricBox label="SOL/LST APY" value={`${v.solApy.toFixed(2)}%`} sub="SOL-denominated yield" valueColor="#9945FF" />}
              {v.tvl       && <MetricBox label="TVL" value={fmt(v.tvl)} sub="Total value locked" valueColor="#C0BBA8" />}
            </div>

            {isMobile && (
              <div style={{ fontSize:"11px", color:"#555", lineHeight:"1.5", marginBottom:"16px" }}>
                {v.note}
                {v.flag && <div style={{ fontSize:"10px", color:"#FF8C5A", marginTop:"2px", fontFamily:"var(--mono)" }}>{v.flag}</div>}
              </div>
            )}

            {/* Audits + OSS */}
            <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap", marginBottom:"16px" }}>
              {v.audits?.length > 0
                ? v.audits.map(a => <span key={a} style={{ fontSize:"10px", padding:"3px 8px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"4px", color:"#777", fontFamily:"var(--mono)" }}>{a}</span>)
                : <span style={{ fontSize:"11px", color:"#FF4B4B", fontFamily:"var(--mono)" }}>No public audit</span>
              }
              {v.oss && <span style={{ fontSize:"10px", padding:"3px 8px", background:"rgba(20,241,149,0.06)", border:"1px solid rgba(20,241,149,0.2)", borderRadius:"4px", color:"#14F195", fontFamily:"var(--mono)" }}>Open Source</span>}
            </div>

            {/* Inline paper earn form */}
            {selectedAsset && relevantApy != null && (
              <div style={{
                background:"rgba(153,69,255,0.06)", border:"1px solid rgba(153,69,255,0.15)",
                borderRadius:"10px", padding:"14px 18px", marginBottom:"16px",
                backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)",
              }}>
                {isEarning ? (
                  <div style={{ display:"flex", gap:"10px", alignItems:"center", flexWrap:"wrap" }}>
                    <AmountInput
                      icon={selectedAsset.icon}
                      iconColor={selectedAsset.color}
                      value={earnAmount}
                      onChange={setEarnAmount}
                      placeholder={`Amount of ${selectedAsset.symbol}`}
                      borderColor={selectedAsset.color+"66"}
                    />
                    <button
                      onClick={() => handlePaperEarn(v)}
                      disabled={!(parseFloat(earnAmount) > 0)}
                      style={{
                        padding:"12px 20px", border:"none", borderRadius:"8px", cursor: parseFloat(earnAmount) > 0 ? "pointer" : "not-allowed",
                        background: parseFloat(earnAmount) > 0 ? "linear-gradient(135deg,#9945FF,#14F195)" : "rgba(255,255,255,0.04)",
                        color: parseFloat(earnAmount) > 0 ? "#fff" : "#444",
                        fontSize:"12px", fontWeight:800, fontFamily:"var(--mono)", whiteSpace:"nowrap",
                      }}
                    >
                      OPEN POSITION →
                    </button>
                    <button onClick={() => { setEarnVenue(null); setEarnAmount(""); }} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:"12px", fontFamily:"var(--mono)" }}>Cancel</button>
                    {parseFloat(earnAmount) > 0 && (
                      <span style={{ fontSize:"11px", color:"#14F195", fontFamily:"var(--mono)" }}>
                        +{fmtUSD((parseFloat(earnAmount) * (prices[selectedAsset.symbol] ?? selectedAsset.price ?? 1)) * relevantApy / 100)}/yr
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:"12px", color:"#888" }}>Paper trade {selectedAsset.symbol} at {relevantApy.toFixed(2)}% APY</span>
                    <button
                      onClick={() => setEarnVenue(v.name)}
                      style={{ padding:"8px 16px", background:"rgba(153,69,255,0.1)", border:"1px solid rgba(153,69,255,0.3)", borderRadius:"8px", color:"#DC1FFF", fontSize:"11px", fontWeight:700, fontFamily:"var(--mono)", cursor:"pointer" }}
                    >
                      PAPER EARN →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
              <a href={v.url} target="_blank" rel="noopener noreferrer" style={{ padding:"9px 18px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"8px", color:"#C0BBA8", fontSize:"12px", fontWeight:700, fontFamily:"var(--mono)", textDecoration:"none", cursor:"pointer" }}>
                VISIT PROTOCOL ↗
              </a>
              {v.stableApy && v.category !== "infra" && selectedAsset?.canCollateral && (
                <button
                  onClick={() => {/* Navigate handled by parent — user can go to Structured Product tab */}}
                  style={{ padding:"9px 18px", background:"rgba(255,140,90,0.08)", border:"1px solid rgba(255,140,90,0.25)", borderRadius:"8px", color:"#FF8C5A", fontSize:"12px", fontWeight:700, fontFamily:"var(--mono)", cursor:"pointer" }}
                >
                  EXPLORE CARRY TRADE →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth:"1100px", margin:"0 auto", padding: isMobile ? "32px 16px" : "48px 32px" }}>
      {/* Success toast */}
      {earnSuccess && (
        <div style={{
          position:"fixed", top:"78px", left:"50%", transform:"translateX(-50%)", zIndex:200,
          padding:"14px 24px",
          background:"rgba(15,12,28,0.85)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)",
          border:"1px solid rgba(20,241,149,0.3)",
          borderRadius:"12px", animation:"fadeUp 0.3s ease", display:"flex", gap:"12px", alignItems:"center",
          boxShadow:"0 0 30px rgba(20,241,149,0.1)",
        }}>
          <span style={{ color:"#14F195", fontWeight:700 }}>✓</span>
          <span style={{ fontSize:"13px" }}>Paper position: {earnSuccess.amount} {earnSuccess.asset.symbol} → {earnSuccess.venue} at {earnSuccess.apy.toFixed(2)}%</span>
          <PaperBadge />
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom:"36px", animation:"fadeUp 0.4s ease" }}>
        <div style={{ fontSize:"11px", fontFamily:"var(--mono)", color:"#14F195", letterSpacing:"0.18em", marginBottom:"10px" }}>{venues.length} VENUES · SOLANA DEFI · LIVE</div>
        <h1 style={{ fontFamily:"var(--serif)", fontSize: isMobile ? "28px" : "clamp(32px,4vw,52px)", fontWeight:400, lineHeight:1.1, letterSpacing:"-0.02em", marginBottom:"14px" }}>
          <span className="gradient-text">What's in your wallet?</span><br/><em style={{ color:"#555" }}>See every yield option.</em>
        </h1>
        <p style={{ fontSize:"15px", color:"#666", lineHeight:"1.7", maxWidth:"480px" }}>
          Pick your asset, compare venues, and paper trade — all in one place.
        </p>
        {isMobile && (
          <div style={{ marginTop:"10px" }}>
            <LastUpdated fetchedAt={fetchedAt} error={error} sources={sources} />
          </div>
        )}
      </div>

      {/* Asset selector bar */}
      <div style={{ marginBottom:"24px" }}>
        <div style={{ fontSize:"11px", color:"#444", fontFamily:"var(--mono)", letterSpacing:"0.12em", marginBottom:"10px" }}>SELECT WHAT YOU HOLD</div>
        <div style={{
          display:"flex", gap:"8px", flexWrap:"wrap",
        }}>
          <FilterChip active={!selectedAsset} onClick={() => setSelectedAsset(null)}>All Assets</FilterChip>
          {earnAssets.map(a => (
            <FilterChip
              key={a.symbol}
              active={selectedAsset?.symbol === a.symbol}
              onClick={() => setSelectedAsset(selectedAsset?.symbol === a.symbol ? null : a)}
              color={selectedAsset?.symbol === a.symbol ? a.color : undefined}
              logoUrl={a.logoUrl}
            >
              {a.symbol}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Search + secondary filters */}
      <div style={{ marginBottom:"24px", display:"flex", flexDirection:"column", gap:"12px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px", background:"rgba(15,12,28,0.6)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"1px solid rgba(153,69,255,0.15)", borderRadius:"12px", padding:"12px 18px" }}>
          <span style={{ color:"#444", fontSize:"18px" }}>⌕</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search venues, types, strategies…"
            style={{ flex:1, background:"none", border:"none", fontSize:"15px", color:"#F0EDE8", fontFamily:"var(--sans)" }}
          />
          {query && <button onClick={() => setQuery("")} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:"16px" }}>×</button>}
        </div>

        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center" }}>
          {[["all","All Types"], ...Object.entries(CATEGORY_META).map(([k,m]) => [k, m.label])].map(([v,l]) => (
            <FilterChip key={v} active={catFilter===v} onClick={() => setCat(v)} color={catFilter===v && v!=="all" ? CATEGORY_META[v]?.color : undefined}>{l}</FilterChip>
          ))}
          <div style={{ width:"1px", height:"20px", background:"rgba(255,255,255,0.08)" }} />
          {[["all","Any Risk"],["LOW","Low"],["MEDIUM","Medium"]].map(([v,l]) => (
            <FilterChip key={v} active={riskFilter===v} onClick={() => setRisk(v)}>{l}</FilterChip>
          ))}
          <div style={{ marginLeft:"auto", display:"flex", gap:"6px", alignItems:"center" }}>
            <span style={{ fontSize:"11px", color:"#444", fontFamily:"var(--mono)" }}>SORT</span>
            {[["apy","APY"],["tvl","TVL"],["risk","Risk"]].map(([v,l]) => (
              <FilterChip key={v} active={sortBy===v} onClick={() => setSort(v)}>{l}</FilterChip>
            ))}
          </div>
        </div>
      </div>

      {/* Results count + view toggle */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" }}>
        <div style={{ fontSize:"11px", fontFamily:"var(--mono)", color:"#444" }}>
          {loading ? "Loading live data..." : `${filtered.length} venue${filtered.length !== 1 ? "s" : ""} ${selectedAsset ? `for ${selectedAsset.symbol}` : "matching"}`}
          {!loading && viewMode === "grouped" && ` · ${grouped.length} protocol${grouped.length !== 1 ? "s" : ""}`}
        </div>
        <div style={{ display:"flex", gap:"6px" }}>
          <FilterChip active={viewMode === "grouped"} onClick={() => setViewMode("grouped")}>Grouped</FilterChip>
          <FilterChip active={viewMode === "flat"} onClick={() => setViewMode("flat")}>All Venues</FilterChip>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <LoadingSkeleton rows={8} />
      ) : viewMode === "flat" ? (
      <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
        {filtered.map((v, i) => renderVenueCard(v, i))}
      </div>
      ) : (
      <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
        {grouped.map((group, gi) => {
          const isGroupExpanded = expandedGroups.has(group.key);
          const bestApy = Math.max(...group.venues.map(v => selectedAsset ? (getRelevantApy(v, selectedAsset) ?? 0) : Math.max(v.stableApy ?? 0, v.solApy ?? 0)));
          const visibleVenues = (isGroupExpanded || group.venues.length <= PREVIEW_COUNT) ? group.venues : group.venues.slice(0, PREVIEW_COUNT);
          const hiddenCount = group.venues.length - PREVIEW_COUNT;

          return (
            <div key={group.key} style={{
              animation: `groupEnter 0.4s ease ${Math.min(gi * 0.06, 0.5)}s both`,
            }}>
              {/* Protocol group header */}
              <div style={{
                display:"flex", alignItems:"center", gap:"12px",
                padding:"12px 20px", marginBottom:"4px",
                background:"rgba(15,12,28,0.5)",
                backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
                border:`1px solid ${group.color}22`,
                borderLeft:`3px solid ${group.color}`,
                borderRadius:"12px",
              }}>
                <VenueLogo logo={group.logo} logoUrl={group.logoUrl} color={group.color} size={28} />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:"14px", color:"#D0CCC5", fontFamily:"var(--mono)" }}>{group.label}</div>
                  <div style={{ fontSize:"10px", color:"#555", fontFamily:"var(--mono)" }}>
                    {group.venues.length} venue{group.venues.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:"16px", fontFamily:"var(--serif)", color: bestApy > 0 ? apyColor : "#333", lineHeight:1 }}>
                    {bestApy > 0 ? `${bestApy.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:"9px", color:"#444", fontFamily:"var(--mono)" }}>BEST {apyLabel}</div>
                </div>
              </div>

              {/* Venue cards within group */}
              <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                {visibleVenues.map((v, i) => renderVenueCard(v, i))}
              </div>

              {/* Show more / less toggle */}
              {hiddenCount > 0 && (
                <button
                  onClick={() => {
                    setExpandedGroups(prev => {
                      const next = new Set(prev);
                      if (next.has(group.key)) next.delete(group.key);
                      else next.add(group.key);
                      return next;
                    });
                  }}
                  style={{
                    width:"100%", padding:"10px", marginTop:"4px",
                    background:"rgba(15,12,28,0.3)",
                    border:"1px solid rgba(153,69,255,0.1)",
                    borderRadius:"10px", cursor:"pointer",
                    fontSize:"11px", fontFamily:"var(--mono)", fontWeight:600,
                    color: isGroupExpanded ? "#555" : group.color,
                    transition:"all 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(153,69,255,0.06)"; e.currentTarget.style.borderColor = "rgba(153,69,255,0.2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(15,12,28,0.3)"; e.currentTarget.style.borderColor = "rgba(153,69,255,0.1)"; }}
                >
                  {isGroupExpanded ? `Show less ▲` : `Show ${hiddenCount} more ▼`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Excluded note */}
      <div style={{ marginTop:"24px", padding:"18px 20px", background:"rgba(15,12,28,0.5)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,75,75,0.1)", borderRadius:"12px", fontSize:"12px", color:"#555", lineHeight:"1.7" }}>
        <span style={{ color:"#FF8C5A", fontWeight:600 }}>Excluded: </span>
        Meteora DLMM, Orca Whirlpools, Raydium CLMM — AMM LP yield is path-dependent, IL-impaired, and non-deterministic. Not real yield.
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STRUCTURED PRODUCT TAB — One-Screen Carry Trade Calculator
═══════════════════════════════════════════════════════════════════════════ */
function StructuredProductTab({ paper, isMobile, width, market }) {
  const { venues, assets, loading } = market;

  const collateralAssets = useMemo(() => assets.filter(a => a.canCollateral && a.price), [assets]);
  const deployVenues = useMemo(() => venues.filter(v => v.stableApy && v.category !== "infra"), [venues]);

  const [collateral, setCollateral] = useState(null);
  const [colAmount, setColAmount]   = useState("");
  const [ltv, setLtv]               = useState(50);
  const [submitted, setSubmitted]   = useState(false);

  // Hard cap: $500M USD equivalent
  const MAX_USD = 500_000_000;
  const maxAmount = collateral?.price ? Math.floor(MAX_USD / collateral.price) : 1_000_000;

  const handleAmountChange = useCallback((val) => {
    const num = parseFloat(val);
    if (val === "" || val === ".") { setColAmount(val); return; }
    if (isNaN(num)) return;
    if (num > maxAmount) { setColAmount(String(maxAmount)); return; }
    setColAmount(val);
  }, [maxAmount]);

  // Auto-select first collateral when data loads
  useEffect(() => {
    if (!collateral && collateralAssets.length > 0) {
      setCollateral(collateralAssets[0]);
    }
  }, [collateral, collateralAssets]);

  // All hooks MUST be above this line (React Rules of Hooks — no hooks after conditional returns)
  const colAmt   = collateral ? (parseFloat(colAmount) || 0) : 0;
  const colUSD   = colAmt * (collateral?.price || 0);
  const actualLTV = (ltv / 100) * (collateral?.safeLTV || 0);
  const borrowUSD = colUSD * actualLTV;
  const liqPrice = borrowUSD > 0 && collateral ? borrowUSD / ((collateral.liqThreshold || 1) * colAmt) : 0;
  const liqDrop  = liqPrice > 0 ? ((collateral?.price || 0) - liqPrice) / (collateral?.price || 1) * 100 : 0;
  const hf       = borrowUSD > 0 && collateral ? (colUSD * (collateral.liqThreshold || 1)) / borrowUSD : 999;
  const hfColor  = hf > 2 ? "#14F195" : hf > 1.4 ? "#FFD93D" : "#FF4B4B";
  const borrowRate = collateral?.borrowRate || 0;

  const deployOptions = useMemo(() => {
    if (!collateral) return [];
    return deployVenues.map(v => {
      const ct = computeCarryTrade(collateral, colAmt, ltv, v);
      return { venue: v, ...ct };
    }).sort((a, b) => b.totalNetUSD - a.totalNetUSD);
  }, [collateral, colAmt, ltv, deployVenues]);

  if (loading || !collateral) {
    return (
      <div style={{ maxWidth:"1300px", margin:"0 auto", padding: isMobile ? "32px 16px" : "48px 32px" }}>
        <div style={{ marginBottom:"32px" }}>
          <div style={{ fontSize:"11px", fontFamily:"var(--mono)", color:"#FF8C5A", letterSpacing:"0.18em" }}>STRUCTURED PRODUCT · CARRY TRADE CALCULATOR</div>
          <h1 style={{ fontFamily:"var(--serif)", fontSize: isMobile ? "28px" : "clamp(32px,4vw,48px)", fontWeight:400, lineHeight:1.1, letterSpacing:"-0.02em", marginTop:"10px" }}>
            Loading live rates...
          </h1>
        </div>
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  const bestOption = deployOptions.length > 0 ? deployOptions[0] : null;

  function handlePaperTrade(option) {
    if (borrowUSD <= 0) return;
    paper.addBorrow({
      collateral,
      colAmount: colAmt,
      borrowUSD: option.borrowUSD,
      dest: option.venue,
      deployApy: option.deployApy,
      borrowRate,
      netCarryUSD: option.totalNetUSD,
    });
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setColAmount(""); }, 3000);
  }

  if (submitted) {
    return <SuccessScreen
      title="Paper carry trade opened"
      subtitle={`${colAmt} ${collateral.symbol} → ${fmtUSD(borrowUSD)} USDC`}
      detail={`+${fmtUSD(bestOption?.totalNetUSD ?? 0)}/yr net carry`}
    />;
  }

  const isWide = width > 1024;

  return (
    <div style={{ maxWidth:"1300px", margin:"0 auto", padding: isMobile ? "32px 16px" : "48px 32px" }}>
      {/* Header */}
      <div style={{ marginBottom:"32px", animation:"fadeUp 0.4s ease" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"10px" }}>
          <div style={{ fontSize:"11px", fontFamily:"var(--mono)", color:"#FF8C5A", letterSpacing:"0.18em" }}>STRUCTURED PRODUCT · CARRY TRADE CALCULATOR</div>
          <PaperBadge />
        </div>
        <h1 style={{ fontFamily:"var(--serif)", fontSize: isMobile ? "28px" : "clamp(32px,4vw,48px)", fontWeight:400, lineHeight:1.1, letterSpacing:"-0.02em", marginBottom:"12px" }}>
          <span className="gradient-text">Borrow & deploy.</span><br/><em style={{ color:"#555" }}>See every carry option.</em>
        </h1>
      </div>

      <div style={{
        display:"grid",
        gridTemplateColumns: isWide ? "380px 1fr" : "1fr",
        gap:"32px", alignItems:"start",
      }}>
        {/* LEFT — Input panel */}
        <div style={{ background:"rgba(15,12,28,0.7)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"1px solid rgba(153,69,255,0.12)", borderRadius:"16px", padding:"24px", position: isWide ? "sticky" : "static", top:"78px", animation:"fadeUp 0.4s ease" }}>
          {/* Collateral selector */}
          <div style={{ fontSize:"11px", color:"#444", fontFamily:"var(--mono)", letterSpacing:"0.12em", marginBottom:"12px" }}>COLLATERAL</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"8px", marginBottom:"16px" }}>
            {collateralAssets.map(a => (
              <AssetButton
                key={a.symbol}
                asset={a}
                selected={collateral.symbol === a.symbol}
                onClick={() => { setCollateral(a); setColAmount(""); }}
                subtitle={`${(a.safeLTV*100).toFixed(0)}% LTV · ${(a.borrowRate || 0).toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Amount input */}
          <div style={{ marginBottom:"16px" }}>
            <AmountInput
              icon={collateral.icon}
              iconColor={collateral.color}
              logoUrl={collateral.logoUrl}
              value={colAmount}
              onChange={handleAmountChange}
              placeholder={`Amount of ${collateral.symbol}`}
              borderColor={colAmt > 0 ? collateral.color+"66" : undefined}
            />
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:"6px" }}>
              {colAmt > 0 && <span style={{ fontSize:"11px", color:"#555", fontFamily:"var(--mono)" }}>≈ {fmtUSD(colUSD)} collateral</span>}
              <span style={{ fontSize:"10px", color:"#333", fontFamily:"var(--mono)", marginLeft:"auto" }}>Max: {maxAmount.toLocaleString()} {collateral.symbol}</span>
            </div>
          </div>

          {/* LTV slider */}
          {colAmt > 0 && (
            <div style={{ marginBottom:"16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"10px" }}>
                <div>
                  <span style={{ fontFamily:"var(--serif)", fontSize:"26px", letterSpacing:"-0.03em" }}>{fmtUSD(borrowUSD)}</span>
                  <span style={{ fontSize:"12px", color:"#555", marginLeft:"6px" }}>USDC</span>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:"12px", fontFamily:"var(--mono)", color:"#666" }}>LTV: {(actualLTV*100).toFixed(1)}%</div>
                </div>
              </div>
              <input type="range" min={10} max={100} value={ltv} onChange={e => setLtv(Number(e.target.value))} style={{ width:"100%", accentColor: ltv > 85 ? "#FF4B4B" : ltv > 60 ? "#FFD93D" : "#14F195", marginBottom:"8px" }} />
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                {[{p:25,l:"Conservative"},{p:60,l:"Moderate"},{p:85,l:"Aggressive"},{p:100,l:"Max"}].map(m => (
                  <button key={m.p} onClick={() => setLtv(m.p)} style={{ fontSize:"10px", fontFamily:"var(--mono)", color: ltv===m.p?"#F0EDE8":"#444", background:"none", border:"none", cursor:"pointer", borderBottom: ltv===m.p ? "1px solid #F0EDE8":"1px solid transparent" }}>{m.l}</button>
                ))}
              </div>
            </div>
          )}

          {/* Metrics row */}
          {colAmt > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px", marginBottom:"16px" }}>
              <MetricBox label="Health Factor" value={hf === 999 ? "∞" : hf.toFixed(2)} sub="Liq at <1.0" valueColor={hfColor} />
              <MetricBox label="Liq. Price" value={liqPrice > 0 ? `$${liqPrice.toFixed(0)}` : "—"} sub={liqDrop > 0 ? `−${liqDrop.toFixed(0)}%` : "—"} valueColor={liqDrop > 0 && liqDrop < 30 ? "#FF4B4B" : liqDrop < 50 ? "#FFD93D" : "#3DFFA0"} />
              <MetricBox label="Borrow/yr" value={fmtUSD(borrowUSD * borrowRate / 100)} sub={`${borrowRate.toFixed(1)}% APR`} valueColor="#FF8C5A" />
            </div>
          )}

          {ltv > 70 && colAmt > 0 && (
            <div style={{ padding:"10px 14px", background:"rgba(255,75,75,0.06)", border:"1px solid rgba(255,75,75,0.18)", borderRadius:"8px", fontSize:"12px", color:"#FF8888", lineHeight:"1.6" }}>
              ⚠ At this LTV, a {liqDrop.toFixed(0)}% drop in {collateral.symbol} triggers liquidation.
            </div>
          )}

          {/* Staking yield callout */}
          {colAmt > 0 && collateral.type === "sol" && (
            <div style={{ marginTop:"12px", padding:"10px 14px", background:"rgba(153,69,255,0.06)", border:"1px solid rgba(153,69,255,0.15)", borderRadius:"8px", fontSize:"12px", color:"#9945FF", lineHeight:"1.6", backdropFilter:"blur(8px)" }}>
              ◎ {collateral.symbol} staking yield: +7.2% on {fmtUSD(colUSD)} = +{fmtUSD(colUSD * 0.072)}/yr
            </div>
          )}
        </div>

        {/* RIGHT — Deploy options table */}
        <div style={{ animation:"fadeUp 0.4s ease 0.1s both" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
            <div style={{ fontSize:"11px", color:"#444", fontFamily:"var(--mono)", letterSpacing:"0.12em" }}>
              {colAmt > 0 ? `${deployOptions.length} DEPLOY OPTIONS · SORTED BY NET CARRY` : "DEPLOY OPTIONS"}
            </div>
            {bestOption && colAmt > 0 && bestOption.totalNetUSD > 0 && (
              <div style={{ fontSize:"11px", color:"#3DFFA0", fontFamily:"var(--mono)" }}>
                Best: {bestOption.venue.name} · +{fmtUSD(bestOption.totalNetUSD)}/yr
              </div>
            )}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
            {deployOptions.map((opt, i) => {
              const isBest = i === 0 && colAmt > 0 && opt.totalNetUSD > 0;
              return (
                <div
                  key={opt.venue.name}
                  style={{
                    padding: isMobile ? "14px 14px" : "14px 20px",
                    background: isBest ? "rgba(20,241,149,0.04)" : "rgba(15,12,28,0.4)",
                    backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
                    border:`1px solid ${isBest ? "rgba(20,241,149,0.15)" : "rgba(153,69,255,0.08)"}`,
                    borderLeft:`3px solid ${opt.venue.color}`,
                    borderRadius:"12px",
                    animation: isBest ? `cardEnter 0.4s ease ${i*0.04}s both` : `cardEnter 0.4s ease ${i*0.04}s both`,
                    ...(isBest ? { boxShadow:"0 0 20px rgba(20,241,149,0.08)" } : {}),
                  }}
                >
                  <div style={{
                    display:"grid",
                    gridTemplateColumns: isMobile
                      ? "30px 1fr auto"
                      : "34px 1fr 80px 80px 100px 100px 70px 120px",
                    alignItems:"center", gap: isMobile ? "10px" : "12px",
                  }}>
                    <VenueLogo logo={opt.venue.logo} logoUrl={opt.venue.logoUrl} color={opt.venue.color} size={isMobile ? 28 : 34} />

                    <div>
                      <div style={{ fontWeight:700, fontSize:"13px", color:"#D0CCC5", marginBottom:"2px" }}>
                        {opt.venue.name}
                        {isBest && <span style={{ fontSize:"9px", marginLeft:"6px", padding:"2px 6px", background:"rgba(20,241,149,0.1)", border:"1px solid rgba(20,241,149,0.3)", borderRadius:"4px", color:"#14F195", fontFamily:"var(--mono)", animation:"bestPulse 2s ease-in-out infinite" }}>BEST</span>}
                      </div>
                      <div style={{ fontSize:"10px", color:"#555" }}>{opt.venue.type}</div>
                    </div>

                    {!isMobile && (
                      <>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:"15px", fontFamily:"var(--serif)", color:opt.venue.color }}>{opt.deployApy.toFixed(1)}%</div>
                          <div style={{ fontSize:"9px", color:"#444", fontFamily:"var(--mono)" }}>
                            {opt.impactPct > 1 ? <span style={{ color:"#FFD93D" }}>({opt.baseDeployApy.toFixed(1)}% base)</span> : "Deploy"}
                          </div>
                        </div>

                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:"13px", fontFamily:"var(--mono)", color:"#FF8C5A" }}>−{borrowRate.toFixed(1)}%</div>
                          <div style={{ fontSize:"9px", color:"#444", fontFamily:"var(--mono)" }}>Borrow</div>
                        </div>

                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:"15px", fontFamily:"var(--mono)", fontWeight:700, color: opt.grossCarry > 0 ? "#14F195" : "#FF4B4B" }}>
                            {opt.grossCarry >= 0 ? "+" : ""}{opt.grossCarry.toFixed(2)}%
                          </div>
                          <div style={{ fontSize:"9px", color:"#444", fontFamily:"var(--mono)" }}>Net carry</div>
                        </div>

                        <div style={{ textAlign:"right" }}>
                          {colAmt > 0 ? (
                            <>
                              <div style={{ fontSize:"15px", fontFamily:"var(--mono)", fontWeight:700, color: opt.totalNetUSD > 0 ? "#14F195" : "#FF4B4B" }}>
                                {opt.totalNetUSD > 0 ? "+" : ""}{fmtUSD(opt.totalNetUSD)}
                              </div>
                              <div style={{ fontSize:"9px", color:"#444", fontFamily:"var(--mono)" }}>/year</div>
                            </>
                          ) : (
                            <div style={{ fontSize:"11px", color:"#333" }}>—</div>
                          )}
                        </div>

                        <div><RiskBadge risk={opt.venue.risk} /></div>
                      </>
                    )}

                    {/* Paper trade button or mobile summary */}
                    {isMobile ? (
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:"15px", fontFamily:"var(--mono)", fontWeight:700, color: opt.grossCarry > 0 ? "#14F195" : "#FF4B4B" }}>
                          {opt.grossCarry >= 0 ? "+" : ""}{opt.grossCarry.toFixed(1)}%
                        </div>
                        {colAmt > 0 && opt.totalNetUSD !== 0 && (
                          <div style={{ fontSize:"10px", fontFamily:"var(--mono)", color: opt.totalNetUSD > 0 ? "#14F195" : "#FF4B4B" }}>
                            {fmtUSD(opt.totalNetUSD)}/yr
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handlePaperTrade(opt)}
                        disabled={colAmt <= 0}
                        style={{
                          padding:"7px 12px", border:"none", borderRadius:"6px", cursor: colAmt > 0 ? "pointer" : "not-allowed",
                          background: colAmt > 0 ? "rgba(153,69,255,0.1)" : "rgba(255,255,255,0.03)",
                          color: colAmt > 0 ? "#DC1FFF" : "#333",
                          fontSize:"10px", fontWeight:700, fontFamily:"var(--mono)", whiteSpace:"nowrap",
                        }}
                      >
                        PAPER →
                      </button>
                    )}
                  </div>

                  {/* Mobile expanded info */}
                  {isMobile && (
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"10px", paddingTop:"8px", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display:"flex", gap:"12px", fontSize:"10px", color:"#555", fontFamily:"var(--mono)" }}>
                        <span>{opt.deployApy.toFixed(1)}% deploy</span>
                        <span>−{borrowRate.toFixed(1)}% borrow</span>
                        <RiskBadge risk={opt.venue.risk} />
                      </div>
                      <button
                        onClick={() => handlePaperTrade(opt)}
                        disabled={colAmt <= 0}
                        style={{
                          padding:"6px 10px", border:"none", borderRadius:"6px", cursor: colAmt > 0 ? "pointer" : "not-allowed",
                          background: colAmt > 0 ? "rgba(153,69,255,0.1)" : "rgba(255,255,255,0.03)",
                          color: colAmt > 0 ? "#DC1FFF" : "#333",
                          fontSize:"10px", fontWeight:700, fontFamily:"var(--mono)",
                        }}
                      >
                        PAPER →
                      </button>
                    </div>
                  )}

                  {opt.venue.flag && (
                    <div style={{ fontSize:"10px", color:"#FF8C5A", marginTop:"6px", fontFamily:"var(--mono)" }}>{opt.venue.flag}</div>
                  )}
                  {opt.impactPct > 5 && (
                    <div style={{ fontSize:"10px", color:"#FFD93D", marginTop:"6px", fontFamily:"var(--mono)", padding:"4px 8px", background:"rgba(255,211,61,0.06)", borderRadius:"4px", display:"inline-block" }}>
                      ⚠ Market impact: {opt.impactPct.toFixed(1)}% — deploying {fmtUSD(opt.borrowUSD)} into {fmt(opt.venue.tvl)} TVL compresses APY from {opt.baseDeployApy.toFixed(1)}% → {opt.deployApy.toFixed(1)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary footer */}
          {colAmt > 0 && bestOption && (
            <div style={{ marginTop:"20px", padding:"18px 20px", background: bestOption.totalNetUSD > 0 ? "rgba(20,241,149,0.05)" : "rgba(255,75,75,0.05)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:`1px solid ${bestOption.totalNetUSD > 0 ? "rgba(20,241,149,0.15)" : "rgba(255,75,75,0.15)"}`, borderRadius:"12px", boxShadow: bestOption.totalNetUSD > 0 ? "0 0 30px rgba(20,241,149,0.08)" : "none" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px" }}>
                <div>
                  <div style={{ fontSize:"10px", color:"#555", fontFamily:"var(--mono)", letterSpacing:"0.1em", marginBottom:"6px" }}>BEST OPTION</div>
                  <div style={{ display:"flex", alignItems:"baseline", gap:"8px" }}>
                    <span style={{ fontFamily:"var(--serif)", fontSize:"28px", color: bestOption.totalNetUSD > 0 ? "#14F195" : "#FF4B4B" }}>
                      {bestOption.totalNetUSD > 0 ? "+" : ""}{fmtUSD(bestOption.totalNetUSD)}/yr
                    </span>
                    <span style={{ fontSize:"13px", color:"#666" }}>via {bestOption.venue.name}</span>
                  </div>
                  <div style={{ fontSize:"11px", color:"#555", marginTop:"4px" }}>
                    {fmtUSD(bestOption.netCarryUSD)} carry {bestOption.colYieldUSD > 0 ? `+ ${fmtUSD(bestOption.colYieldUSD)} staking` : ""}
                  </div>
                </div>
                <button
                  onClick={() => handlePaperTrade(bestOption)}
                  style={{
                    padding:"14px 28px", border:"none", borderRadius:"10px", cursor:"pointer",
                    background:"linear-gradient(135deg,#9945FF,#14F195)",
                    color:"#fff", fontSize:"13px", fontWeight:800, fontFamily:"var(--mono)", letterSpacing:"0.06em",
                    boxShadow:"0 0 20px rgba(153,69,255,0.3)",
                  }}
                >
                  PAPER TRADE BEST →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PORTFOLIO TAB
═══════════════════════════════════════════════════════════════════════════ */
function PortfolioTab({ paper, isMobile }) {
  const earnPositions   = paper.positions.filter(p => p.type === "earn");
  const borrowPositions = paper.positions.filter(p => p.type === "borrow");
  const totalUSD = earnPositions.reduce((s, p) => s + p.usdVal, 0) + borrowPositions.reduce((s, p) => s + p.borrowUSD, 0);
  const totalCarryUSD = borrowPositions.reduce((s, p) => s + p.netCarryUSD, 0);
  const totalEarnYrUSD = earnPositions.reduce((s, p) => s + (p.usdVal * p.apy / 100), 0);

  if (paper.positions.length === 0) return (
    <div style={{ maxWidth:"600px", margin:"120px auto", textAlign:"center", padding:"32px", animation:"fadeUp 0.4s ease" }}>
      <div style={{ fontSize:"48px", marginBottom:"20px", opacity:0.2 }}>◎</div>
      <div style={{ fontFamily:"var(--serif)", fontSize:"28px", marginBottom:"12px" }}>No paper positions yet</div>
      <div style={{ fontSize:"14px", color:"#555", lineHeight:"1.7", marginBottom:"28px" }}>
        Use the Search tab to find yield opportunities and paper trade them, or build a carry trade in the Structured Product tab.
      </div>
      <div style={{ display:"flex", gap:"10px", justifyContent:"center" }}>
        <PaperBadge />
        <span style={{ fontSize:"12px", color:"#444" }}>All positions are simulated</span>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:"1000px", margin:"0 auto", padding: isMobile ? "32px 16px" : "52px 32px" }}>
      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap:"12px", marginBottom:"40px", animation:"fadeUp 0.4s ease" }}>
        <div style={{ background:"rgba(15,12,28,0.7)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"1px solid rgba(153,69,255,0.12)", borderRadius:"12px", padding:"20px" }}>
          <div style={{ fontSize:"10px", color:"#555", fontFamily:"var(--mono)", letterSpacing:"0.1em", marginBottom:"8px" }}>TOTAL DEPLOYED (PAPER)</div>
          <div style={{ fontFamily:"var(--serif)", fontSize:"32px", color:"#F0EDE8" }}>{fmtUSD(totalUSD)}</div>
        </div>
        <div style={{ background:"rgba(20,241,149,0.04)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"1px solid rgba(20,241,149,0.12)", borderRadius:"12px", padding:"20px" }}>
          <div style={{ fontSize:"10px", color:"#555", fontFamily:"var(--mono)", letterSpacing:"0.1em", marginBottom:"8px" }}>EARN PROJECTED / YR</div>
          <div style={{ fontFamily:"var(--serif)", fontSize:"32px", color:"#14F195" }}>+{fmtUSD(totalEarnYrUSD)}</div>
        </div>
        <div style={{ background:"rgba(255,140,90,0.04)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"1px solid rgba(255,140,90,0.12)", borderRadius:"12px", padding:"20px" }}>
          <div style={{ fontSize:"10px", color:"#555", fontFamily:"var(--mono)", letterSpacing:"0.1em", marginBottom:"8px" }}>CARRY NET / YR</div>
          <div style={{ fontFamily:"var(--serif)", fontSize:"32px", color:"#FF8C5A" }}>+{fmtUSD(totalCarryUSD)}</div>
        </div>
      </div>

      {/* Earn positions */}
      {earnPositions.length > 0 && (
        <div style={{ marginBottom:"32px" }}>
          <div style={{ fontSize:"11px", color:"#14F195", fontFamily:"var(--mono)", letterSpacing:"0.12em", marginBottom:"12px" }}>EARN POSITIONS</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            {earnPositions.map(p => (
              <div key={p.id} style={{
                display:"flex", alignItems:"center", gap: isMobile ? "10px" : "16px",
                padding: isMobile ? "14px" : "16px 20px",
                background:"rgba(15,12,28,0.5)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
                border:"1px solid rgba(20,241,149,0.1)",
                borderLeft:"3px solid #14F195", borderRadius:"12px", animation:"cardEnter 0.3s ease",
                flexWrap: isMobile ? "wrap" : "nowrap",
              }}>
                <span style={{ fontSize:"20px", color:p.asset.color }}>{p.asset.icon}</span>
                <div style={{ flex:1, minWidth: isMobile ? "120px" : "auto" }}>
                  <div style={{ fontWeight:700, color:"#D0CCC5", marginBottom:"2px" }}>{p.amount} {p.asset.symbol}</div>
                  <div style={{ fontSize:"11px", color:"#555" }}>via {p.venue} · opened {p.openedAt.toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"var(--serif)", fontSize:"22px", color:"#14F195" }}>{p.apy.toFixed(2)}%</div>
                  <div style={{ fontSize:"11px", color:"#555", fontFamily:"var(--mono)" }}>{fmtUSD(p.usdVal * p.apy / 100)}/yr</div>
                </div>
                <PaperBadge />
                <button onClick={() => paper.closePosition(p.id)} style={{ padding:"6px 12px", border:"1px solid rgba(255,255,255,0.1)", background:"transparent", borderRadius:"6px", color:"#555", fontSize:"11px", fontFamily:"var(--mono)", cursor:"pointer" }}>CLOSE</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Borrow positions */}
      {borrowPositions.length > 0 && (
        <div style={{ marginBottom:"32px" }}>
          <div style={{ fontSize:"11px", color:"#FF8C5A", fontFamily:"var(--mono)", letterSpacing:"0.12em", marginBottom:"12px" }}>CARRY TRADE POSITIONS</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            {borrowPositions.map(p => (
              <div key={p.id} style={{ padding: isMobile ? "14px" : "16px 20px", background:"rgba(15,12,28,0.5)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"1px solid rgba(255,140,90,0.1)", borderLeft:"3px solid #FF8C5A", borderRadius:"12px", animation:"cardEnter 0.3s ease" }}>
                <div style={{ display:"flex", alignItems:"center", gap: isMobile ? "10px" : "16px", flexWrap: isMobile ? "wrap" : "nowrap" }}>
                  <div style={{ flex:1, minWidth: isMobile ? "200px" : "auto" }}>
                    <div style={{ fontWeight:700, color:"#D0CCC5", marginBottom:"2px" }}>{p.colAmount} {p.collateral.symbol} → {fmtUSD(p.borrowUSD)} → {p.dest.name}</div>
                    <div style={{ fontSize:"11px", color:"#555" }}>{p.deployApy.toFixed(2)}% deploy − {p.borrowRate}% borrow · opened {p.openedAt.toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"var(--serif)", fontSize:"22px", color: p.netCarryUSD > 0 ? "#14F195":"#FF4B4B" }}>+{fmtUSD(p.netCarryUSD)}/yr</div>
                    <div style={{ fontSize:"11px", color:"#555" }}>net carry</div>
                  </div>
                  <PaperBadge />
                  <button onClick={() => paper.closePosition(p.id)} style={{ padding:"6px 12px", border:"1px solid rgba(255,255,255,0.1)", background:"transparent", borderRadius:"6px", color:"#555", fontSize:"11px", fontFamily:"var(--mono)", cursor:"pointer" }}>CLOSE</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {paper.history.length > 0 && (
        <div>
          <div style={{ fontSize:"11px", color:"#444", fontFamily:"var(--mono)", letterSpacing:"0.12em", marginBottom:"12px" }}>ACTIVITY LOG</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
            {paper.history.slice().reverse().map((h, i) => (
              <div key={i} style={{ display:"flex", gap: isMobile ? "8px" : "16px", alignItems:"center", padding:"10px 16px", background:"rgba(255,255,255,0.01)", borderRadius:"8px", fontSize:"12px", flexWrap: isMobile ? "wrap" : "nowrap" }}>
                <span style={{ fontFamily:"var(--mono)", color: h.action.includes("CLOSE") ? "#555":"#14F195", fontSize:"10px", fontWeight:700, minWidth:"80px" }}>{h.action}</span>
                <span style={{ color:"#666", flex:1 }}>{h.desc}</span>
                <span style={{ fontFamily:"var(--mono)", color:"#444", fontSize:"10px" }}>{h.at.toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
