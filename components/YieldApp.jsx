"use client";
import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from "react";
import {
  VENUES, CATEGORY_META, ASSETS, COLLATERAL_ASSETS,
  fmt, fmtUSD, computeCarryTrade, computeMarketImpact,
  computeStructuredPosition, findBestBorrowMarket, computeBorrowImpact, STRATEGIES,
  getVenuesForAsset, getRelevantApy, getApyLabel, getApyColor,
  enrichVenues, enrichAssets, enrichPrices, tokenLogo,
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
/* ─── Animated Background Layer ─────────────────────────────────────────── */
const ORB_DATA = [
  { top:"2%",  left:"0%",   size:350, color:"rgba(153,69,255,0.10)",  anim:"floatOrb1 28s ease-in-out infinite",         blur:80 },
  { top:"8%",  right:"0%",  size:300, color:"rgba(20,241,149,0.07)",  anim:"floatOrb2 34s ease-in-out infinite",         blur:70 },
  { top:"30%", left:"5%",   size:400, color:"rgba(220,31,255,0.05)",  anim:"floatOrb3 40s ease-in-out infinite",         blur:90 },
  { top:"20%", right:"10%", size:250, color:"rgba(153,69,255,0.08)",  anim:"floatOrb4 26s ease-in-out infinite",         blur:60 },
  { top:"55%", left:"40%",  size:320, color:"rgba(20,241,149,0.05)",  anim:"floatOrb5 44s linear infinite",              blur:75 },
  { top:"70%", left:"0%",   size:280, color:"rgba(153,69,255,0.06)",  anim:"floatOrb2 36s ease-in-out infinite reverse", blur:70 },
  { top:"45%", right:"0%",  size:360, color:"rgba(220,31,255,0.04)",  anim:"floatOrb1 42s ease-in-out infinite reverse", blur:85 },
  { top:"80%", left:"50%",  size:300, color:"rgba(20,241,149,0.06)",  anim:"floatOrb3 30s ease-in-out infinite reverse", blur:70 },
  { top:"10%", left:"45%",  size:220, color:"rgba(153,69,255,0.07)",  anim:"floatOrb4 32s ease-in-out infinite reverse", blur:55 },
  { top:"90%", right:"5%",  size:260, color:"rgba(220,31,255,0.05)",  anim:"floatOrb5 38s linear infinite reverse",      blur:65 },
];

function buildParticles() {
  const particles = [];
  for (let i = 0; i < 20; i++) {
    particles.push({
      left: `${(i * 5.1) % 98}%`,
      bottom: `${-5 - (i * 13) % 25}%`,
      size: 1.5 + (i % 4),
      color: i % 4 === 0 ? "rgba(153,69,255,0.5)"
        : i % 4 === 1 ? "rgba(20,241,149,0.4)"
        : i % 4 === 2 ? "rgba(220,31,255,0.35)"
        : "rgba(153,69,255,0.3)",
      duration: 18 + (i * 3.7) % 25,
      delay: (i * 1.8) % 18,
      reverse: i % 2 === 0,
    });
  }
  return particles;
}
const PARTICLE_DATA = buildParticles();

function AnimatedBackground() {
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:0,
      pointerEvents:"none", overflow:"hidden",
    }}>
      {ORB_DATA.map((orb, i) => (
        <div key={`orb-${i}`} style={{
          position:"absolute",
          top: orb.top, left: orb.left, right: orb.right,
          width: orb.size, height: orb.size,
          borderRadius:"50%",
          background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
          filter: `blur(${orb.blur}px)`,
          animation: orb.anim,
          willChange:"transform",
        }} />
      ))}
      {PARTICLE_DATA.map((p, i) => (
        <div key={`p-${i}`} style={{
          position:"absolute",
          left: p.left,
          bottom: p.bottom,
          width: p.size, height: p.size,
          borderRadius:"50%",
          background: p.color,
          boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
          animation: `${p.reverse ? "particleDriftReverse" : "particleDrift"} ${p.duration}s linear ${p.delay}s infinite`,
          willChange:"transform",
        }} />
      ))}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("search");
  const market = useMarketData();
  const paper = usePaperPortfolio(market.prices);
  const w = useWindowWidth();
  const isMobile = w < 768;

  return (
    <div style={{ minHeight:"100vh", fontFamily:"var(--sans)", color:"#F0EDE8" }}>
      {/* Animated background — fixed, full viewport */}
      {!isMobile && <AnimatedBackground />}

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

      <div style={{ position:"relative", zIndex:1 }}>
        {tab === "search"     && <SearchTab paper={paper} isMobile={isMobile} width={w} market={market} />}
        {tab === "structured" && <StructuredProductTab paper={paper} isMobile={isMobile} width={w} market={market} />}
        {tab === "portfolio"  && <PortfolioTab paper={paper} isMobile={isMobile} width={w} market={market} />}
      </div>
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

  // View mode state
  const [viewMode, setViewMode]           = useState("discover");  // "discover" | "analyze" | "list"
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [expandedTile, setExpandedTile]   = useState(null);   // protocol key for expanded bento tile
  const [heatmapCell, setHeatmapCell]     = useState(null);   // { protocol, asset } for expanded heat map cell

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

  /* ─── Heatmap data (Analyze mode) ───────────────────────────────────── */
  const heatmapData = useMemo(() => {
    const matrix = new Map();
    let maxApy = 0;
    for (const group of grouped) {
      const assetMap = new Map();
      for (const asset of earnAssets) {
        // Find the best APY across all venues in this group for this asset
        let bestApy = null;
        let bestVenue = null;
        let venueCount = 0;
        for (const v of group.venues) {
          const apy = getRelevantApy(v, asset);
          if (apy != null && apy > 0) {
            venueCount++;
            if (bestApy == null || apy > bestApy) {
              bestApy = apy;
              bestVenue = v;
            }
          }
        }
        if (bestApy != null) {
          assetMap.set(asset.symbol, { apy: bestApy, venue: bestVenue, venueCount });
          if (bestApy > maxApy) maxApy = bestApy;
        }
      }
      matrix.set(group.key, assetMap);
    }
    return { protocols: grouped, assets: earnAssets, matrix, maxApy };
  }, [grouped, earnAssets]);

  /* ─── Tile layout (Discover mode) ───────────────────────────────────── */
  const tileLayout = useMemo(() => {
    return grouped.map((g) => {
      const bestApy = Math.max(...g.venues.map(v => selectedAsset ? (getRelevantApy(v, selectedAsset) ?? 0) : Math.max(v.stableApy ?? 0, v.solApy ?? 0)));
      const totalTvl = g.venues.reduce((s, v) => s + (v.tvl ?? 0), 0);
      return { ...g, hero: false, totalTvl, bestApy };
    }).sort((a, b) => (b.totalTvl || 0) - (a.totalTvl || 0)).map((g, i) => ({ ...g, hero: i < 3 }));
  }, [grouped, selectedAsset]);

  /* ─── Smart view-mode behaviors ───────────────────────────────────────── */
  // Reset expanded groups + tile/cell state when filters change
  useEffect(() => {
    setExpandedGroups(new Set());
    setExpandedTile(null);
    setHeatmapCell(null);
  }, [selectedAsset, catFilter, riskFilter, query]);

  // Auto-switch to list mode when text search query is non-empty
  useEffect(() => {
    if (query) setViewMode("list");
  }, [query]);

  // Auto-switch back to discover when query is cleared
  useEffect(() => {
    if (!query) setViewMode("discover");
  }, [query]);

  // Clear expandedTile when leaving discover mode
  useEffect(() => {
    if (viewMode !== "discover") setExpandedTile(null);
    if (viewMode !== "analyze") setHeatmapCell(null);
  }, [viewMode]);

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

  /* ─── Heatmap color helper ──────────────────────────────────────────── */
  function heatmapColor(apy, maxApy) {
    if (apy == null) return "rgba(255,255,255,0.02)";
    const intensity = Math.min(apy / Math.max(maxApy, 15), 1);
    if (intensity < 0.33) return `rgba(59,130,246,${(0.15 + intensity * 0.6).toFixed(2)})`;
    if (intensity < 0.66) return `rgba(20,241,149,${(0.15 + intensity * 0.6).toFixed(2)})`;
    return `rgba(255,211,61,${(0.2 + intensity * 0.6).toFixed(2)})`;
  }

  /* ─── DISCOVER MODE — Bento Grid ────────────────────────────────────── */
  function renderDiscoverView() {
    const cols = isMobile ? "1fr" : width < 768 ? "repeat(2, 1fr)" : width < 1100 ? "repeat(3, 1fr)" : "repeat(4, 1fr)";
    return (
      <div style={{
        display:"grid",
        gridTemplateColumns: cols,
        gap:"10px",
      }}>
        {tileLayout.map((group, gi) => {
          const isExpanded = expandedTile === group.key;
          // Collect which assets this protocol supports
          const supportedAssets = new Set();
          for (const v of group.venues) {
            if (v.reserves) {
              Object.keys(v.reserves).forEach(k => supportedAssets.add(k));
            } else {
              if (v.stableApy != null) { supportedAssets.add("USDC"); supportedAssets.add("USDT"); }
              if (v.solApy != null) { supportedAssets.add("SOL"); supportedAssets.add("JitoSOL"); }
            }
          }

          const isGroupExpanded = expandedGroups.has(group.key);
          const visibleVenues = (isGroupExpanded || group.venues.length <= PREVIEW_COUNT) ? group.venues : group.venues.slice(0, PREVIEW_COUNT);
          const hiddenCount = group.venues.length - PREVIEW_COUNT;

          return (
            <div
              key={group.key}
              style={{
                gridColumn: isExpanded ? "1 / -1" : "span 1",
                background:"rgba(15,12,28,0.5)",
                backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
                border:`1px solid ${isExpanded ? "rgba(153,69,255,0.25)" : "rgba(153,69,255,0.08)"}`,
                borderLeft:`3px solid ${group.color}`,
                borderRadius:"14px",
                transition:"all 0.3s ease, transform 0.2s ease",
                animation:`tileEnter 0.4s ease ${Math.min(gi * 0.06, 0.6)}s both`,
                opacity: expandedTile && !isExpanded ? 0.5 : 1,
                cursor: isExpanded ? "default" : "pointer",
                transformStyle:"preserve-3d",
              }}
              onMouseMove={e => {
                if (isExpanded || isMobile) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                e.currentTarget.style.transform = `perspective(800px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg) scale(1.02)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "perspective(800px) rotateX(0) rotateY(0) scale(1)";
              }}
              onClick={() => { if (!isExpanded) setExpandedTile(group.key); }}
            >
              {/* Tile Header */}
              <div
                style={{
                  display:"flex", alignItems:"center", gap:"10px",
                  padding:"14px 16px 0",
                  cursor: isExpanded ? "pointer" : "default",
                }}
                onClick={e => {
                  if (isExpanded) { e.stopPropagation(); setExpandedTile(null); }
                }}
              >
                <VenueLogo logo={group.logo} logoUrl={group.logoUrl} color={group.color} size={26} />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:"13px", color:"#D0CCC5", fontFamily:"var(--mono)" }}>{group.label}</div>
                </div>
                <RiskBadge risk={group.venues[0]?.risk || "LOW"} />
                {isExpanded && (
                  <button
                    onClick={e => { e.stopPropagation(); setExpandedTile(null); }}
                    style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:"18px", lineHeight:1 }}
                  >✕</button>
                )}
              </div>

              {/* APY + Stats — compact row */}
              <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", padding:"10px 16px 6px" }}>
                <div style={{
                  fontSize:"26px",
                  fontFamily:"var(--serif)",
                  color: group.bestApy > 0 ? apyColor : "#333",
                  lineHeight:1,
                  textShadow: gi < 3 && group.bestApy > 0 ? "0 0 20px rgba(20,241,149,0.4)" : "none",
                }}>
                  {group.bestApy > 0 ? `${group.bestApy.toFixed(1)}%` : "—"}
                </div>
                <div style={{ fontSize:"10px", color:"#555", fontFamily:"var(--mono)", textAlign:"right" }}>
                  <span>{group.venues.length} venue{group.venues.length !== 1 ? "s" : ""}</span>
                  <span style={{ color:"#333" }}> · </span>
                  <span>{group.totalTvl > 0 ? fmt(group.totalTvl) : "—"}</span>
                </div>
              </div>

              {/* Mini asset bar */}
              <div style={{
                display:"flex", alignItems:"center", gap:"3px",
                padding:"0 16px 12px", flexWrap:"wrap",
              }}>
                {[...supportedAssets].slice(0, 8).map(sym => {
                  const assetObj = earnAssets.find(a => a.symbol === sym);
                  return (
                    <div key={sym} title={sym} style={{
                      width:"18px", height:"18px", borderRadius:"50%",
                      background: assetObj ? `${assetObj.color}33` : "rgba(255,255,255,0.06)",
                      border:`1px solid ${assetObj ? assetObj.color + "55" : "rgba(255,255,255,0.1)"}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      overflow:"hidden",
                    }}>
                      {assetObj?.logoUrl ? (
                        <img src={assetObj.logoUrl} alt={sym} style={{ width:"14px", height:"14px", borderRadius:"50%", objectFit:"cover" }} />
                      ) : (
                        <span style={{ fontSize:"7px", color: assetObj?.color || "#555", fontWeight:800, fontFamily:"var(--mono)" }}>{sym.slice(0,2)}</span>
                      )}
                    </div>
                  );
                })}
                {supportedAssets.size > 8 && (
                  <span style={{ fontSize:"9px", color:"#444", fontFamily:"var(--mono)" }}>+{supportedAssets.size - 8}</span>
                )}
              </div>

              {/* Expanded venue cards */}
              {isExpanded && (
                <div style={{ padding:"0 12px 16px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ height:"12px" }} />
                  <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                    {visibleVenues.map((v, i) => renderVenueCard(v, i))}
                  </div>
                  {hiddenCount > 0 && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
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
                      {isGroupExpanded ? "Show less ▲" : `Show ${hiddenCount} more ▼`}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  /* ─── ANALYZE MODE — Heat Map Matrix ────────────────────────────────── */
  function renderAnalyzeView() {
    const { protocols, assets: heatAssets, matrix, maxApy } = heatmapData;

    return (
      <div>
        {/* Scrollable matrix wrapper */}
        <div style={{
          overflowX:"auto", WebkitOverflowScrolling:"touch",
          borderRadius:"14px",
          border:"1px solid rgba(153,69,255,0.08)",
          background:"rgba(15,12,28,0.4)",
          backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
        }}>
          <table style={{
            borderCollapse:"collapse", width:"100%",
            minWidth: `${64 * heatAssets.length + 160}px`,
          }}>
            <thead>
              <tr>
                {/* Corner cell */}
                <th style={{
                  position:"sticky", left:0, top:0, zIndex:4,
                  background:"rgba(15,12,28,0.95)", backdropFilter:"blur(12px)",
                  padding:"12px 16px", textAlign:"left",
                  fontSize:"10px", color:"#444", fontFamily:"var(--mono)", fontWeight:400,
                  borderBottom:"1px solid rgba(153,69,255,0.1)",
                  borderRight:"1px solid rgba(153,69,255,0.08)",
                  minWidth:"140px",
                }}>
                  Protocol × Asset
                </th>
                {/* Asset columns */}
                {heatAssets.map(asset => (
                  <th key={asset.symbol} style={{
                    position:"sticky", top:0, zIndex:3,
                    background:"rgba(15,12,28,0.95)", backdropFilter:"blur(12px)",
                    padding:"10px 6px", textAlign:"center",
                    borderBottom:"1px solid rgba(153,69,255,0.1)",
                    minWidth:"64px",
                  }}>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
                      {asset.logoUrl ? (
                        <img src={asset.logoUrl} alt={asset.symbol} style={{ width:"20px", height:"20px", borderRadius:"50%", objectFit:"cover" }} />
                      ) : (
                        <span style={{ fontSize:"14px", color:asset.color }}>{asset.icon}</span>
                      )}
                      <span style={{ fontSize:"9px", color:"#777", fontFamily:"var(--mono)", fontWeight:600 }}>{asset.symbol}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {protocols.map((group, ri) => {
                const assetMap = matrix.get(group.key) || new Map();
                const isRowExpanded = heatmapCell?.protocol === group.key;

                return (
                  <Fragment key={group.key}>
                    <tr>
                      {/* Protocol name — sticky left */}
                      <td style={{
                        position:"sticky", left:0, zIndex:2,
                        background:"rgba(15,12,28,0.9)", backdropFilter:"blur(12px)",
                        padding:"10px 16px",
                        borderBottom:"1px solid rgba(255,255,255,0.03)",
                        borderRight:"1px solid rgba(153,69,255,0.08)",
                      }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                          <VenueLogo logo={group.logo} logoUrl={group.logoUrl} color={group.color} size={22} />
                          <div>
                            <div style={{ fontSize:"12px", fontWeight:600, color:"#D0CCC5", fontFamily:"var(--mono)" }}>{group.label}</div>
                            <div style={{ fontSize:"9px", color:"#444", fontFamily:"var(--mono)" }}>{group.venues.length} venues</div>
                          </div>
                        </div>
                      </td>
                      {/* APY cells */}
                      {heatAssets.map((asset, ci) => {
                        const cell = assetMap.get(asset.symbol);
                        const apy = cell?.apy ?? null;
                        const isActive = heatmapCell?.protocol === group.key && heatmapCell?.asset === asset.symbol;

                        return (
                          <td
                            key={asset.symbol}
                            onClick={() => {
                              if (cell) {
                                setHeatmapCell(isActive ? null : { protocol: group.key, asset: asset.symbol });
                              }
                            }}
                            style={{
                              padding:"0",
                              borderBottom:"1px solid rgba(255,255,255,0.03)",
                              animation:`heatmapFade 0.3s ease ${Math.min((ri * heatAssets.length + ci) * 0.02, 1)}s both`,
                            }}
                          >
                            <div
                              onMouseEnter={e => {
                                e.currentTarget.style.transform = "scale(1.08)";
                                e.currentTarget.style.boxShadow = "0 0 12px rgba(153,69,255,0.3)";
                                e.currentTarget.style.zIndex = "5";
                                e.currentTarget.style.position = "relative";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.transform = "scale(1)";
                                e.currentTarget.style.boxShadow = "none";
                                e.currentTarget.style.zIndex = "auto";
                                e.currentTarget.style.position = "static";
                              }}
                              title={cell ? `${group.label} · ${asset.symbol}: ${apy.toFixed(1)}% APY${cell.venueCount > 1 ? ` (${cell.venueCount} venues)` : ""}` : "No data"}
                              style={{
                                background: heatmapColor(apy, maxApy),
                                padding:"10px 6px",
                                textAlign:"center",
                                cursor: cell ? "pointer" : "default",
                                transition:"all 0.15s ease",
                                border: isActive ? "2px solid rgba(153,69,255,0.5)" : "2px solid transparent",
                                borderRadius: isActive ? "4px" : "0",
                                minHeight:"40px",
                                display:"flex", alignItems:"center", justifyContent:"center",
                              }}
                            >
                              <span style={{
                                fontSize:"11px", fontFamily:"var(--mono)", fontWeight:600,
                                color: apy != null ? "#fff" : "#333",
                                textShadow: apy != null ? "0 1px 4px rgba(0,0,0,0.5)" : "none",
                              }}>
                                {apy != null ? apy.toFixed(1) : "—"}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    {/* Expanded row: show venue card for clicked cell */}
                    {isRowExpanded && heatmapCell?.asset && (() => {
                      const cellData = assetMap.get(heatmapCell.asset);
                      if (!cellData?.venue) return null;
                      const matchedAsset = earnAssets.find(a => a.symbol === heatmapCell.asset);
                      return (
                        <tr>
                          <td colSpan={heatAssets.length + 1} style={{ padding:"8px 12px", background:"rgba(15,12,28,0.6)" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"8px" }}>
                              <span style={{ fontSize:"10px", color:"#555", fontFamily:"var(--mono)" }}>
                                Best {heatmapCell.asset} venue in {group.label}
                              </span>
                              <button
                                onClick={() => setHeatmapCell(null)}
                                style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:"14px", marginLeft:"auto" }}
                              >✕</button>
                            </div>
                            {renderVenueCard(cellData.venue, 0)}
                          </td>
                        </tr>
                      );
                    })()}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Color Legend */}
        <div style={{
          display:"flex", alignItems:"center", gap:"16px", marginTop:"12px",
          fontSize:"10px", fontFamily:"var(--mono)", color:"#555",
          flexWrap:"wrap",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
            <div style={{ width:"12px", height:"12px", borderRadius:"2px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)" }} />
            <span>No data</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
            <div style={{ width:"12px", height:"12px", borderRadius:"2px", background:"rgba(59,130,246,0.35)" }} />
            <span>0–5%</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
            <div style={{ width:"12px", height:"12px", borderRadius:"2px", background:"rgba(20,241,149,0.45)" }} />
            <span>5–10%</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
            <div style={{ width:"12px", height:"12px", borderRadius:"2px", background:"rgba(255,211,61,0.55)" }} />
            <span>10%+</span>
          </div>
        </div>
      </div>
    );
  }

  /* ─── LIST MODE — Flat Venue List ───────────────────────────────────── */
  function renderListView() {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
        {filtered.map((v, i) => renderVenueCard(v, i))}
      </div>
    );
  }

  return (
    <div style={{ maxWidth:"1400px", margin:"0 auto", padding: isMobile ? "32px 16px" : "48px 32px" }}>
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
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px", flexWrap:"wrap", gap:"8px" }}>
        <div style={{ fontSize:"11px", fontFamily:"var(--mono)", color:"#444" }}>
          {loading ? "Loading live data..." : `${filtered.length} venue${filtered.length !== 1 ? "s" : ""} ${selectedAsset ? `for ${selectedAsset.symbol}` : "matching"}`}
          {!loading && viewMode === "discover" && ` · ${grouped.length} protocol${grouped.length !== 1 ? "s" : ""}`}
        </div>
        <div style={{ display:"flex", gap:"6px" }}>
          <FilterChip active={viewMode === "discover"} onClick={() => setViewMode("discover")}>⊞ Discover</FilterChip>
          <FilterChip active={viewMode === "analyze"} onClick={() => setViewMode("analyze")}>⊟ Analyze</FilterChip>
          <FilterChip active={viewMode === "list"} onClick={() => setViewMode("list")}>≡ All Venues</FilterChip>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <LoadingSkeleton rows={8} />
      ) : viewMode === "discover" ? renderDiscoverView()
        : viewMode === "analyze" ? renderAnalyzeView()
        : renderListView()}

      {/* Excluded note */}
      <div style={{ marginTop:"24px", padding:"18px 20px", background:"rgba(15,12,28,0.5)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,75,75,0.1)", borderRadius:"12px", fontSize:"12px", color:"#555", lineHeight:"1.7" }}>
        <span style={{ color:"#FF8C5A", fontWeight:600 }}>Excluded: </span>
        Meteora DLMM, Orca Whirlpools, Raydium CLMM — AMM LP yield is path-dependent, IL-impaired, and non-deterministic. Not real yield.
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STRUCTURED PRODUCT TAB — Advanced Carry Trade Calculator
═══════════════════════════════════════════════════════════════════════════ */
function StructuredProductTab({ paper, isMobile, width, market }) {
  const { venues, assets, loading } = market;

  const collateralAssets = useMemo(() => assets.filter(a => a.canCollateral && a.price), [assets]);

  const [collateral, setCollateral]   = useState(null);
  const [colAmount, setColAmount]     = useState("");
  const [borrowAsset, setBorrowAsset] = useState(null);
  const [ltv, setLtv]                 = useState(null);
  const [submitted, setSubmitted]     = useState(false);

  // Borrowable assets: assets that have borrow rates available
  const borrowableAssets = useMemo(() => {
    const syms = new Set();
    for (const v of venues) {
      if (v.reserves) {
        for (const [sym, r] of Object.entries(v.reserves)) {
          if (r.borrowApy > 0) syms.add(sym);
        }
      }
    }
    return assets.filter(a => syms.has(a.symbol));
  }, [venues, assets]);

  // Auto-select USDC as default borrow asset
  useEffect(() => {
    if (!borrowAsset && borrowableAssets.length > 0) {
      setBorrowAsset(borrowableAssets.find(a => a.symbol === "USDC") || borrowableAssets[0]);
    }
  }, [borrowAsset, borrowableAssets]);

  // Best borrow market for selected borrow asset
  const bestBorrowMarket = useMemo(() => {
    if (!borrowAsset) return null;
    return findBestBorrowMarket(borrowAsset, venues);
  }, [borrowAsset, venues]);

  // LTV: default to collateral's safeLTV; max is collateral's maxLTV
  const maxLtv = Math.round((collateral?.maxLTV || 0.75) * 100);
  const safeLtv = Math.round((collateral?.safeLTV || 0.50) * 100);
  const effectiveLtv = ltv ?? safeLtv;

  // Reset LTV when collateral changes
  useEffect(() => { setLtv(null); }, [collateral]);

  // Cap: $1B
  const MAX_USD = 1_000_000_000;
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

  // Deploy venues: filter based on borrow asset type
  const deployVenues = useMemo(() => {
    if (!borrowAsset) return venues.filter(v => v.stableApy && v.category !== "infra");
    return getVenuesForAsset(borrowAsset, venues).filter(v => v.category !== "infra");
  }, [borrowAsset, venues]);

  const colAmt = collateral ? (parseFloat(colAmount) || 0) : 0;

  // Deploy options with new computation
  const deployOptions = useMemo(() => {
    if (!collateral || !borrowAsset || colAmt <= 0) return [];
    return deployVenues.map(v => {
      const pos = computeStructuredPosition({
        collateral, colAmount: colAmt,
        borrowAsset, borrowMarket: bestBorrowMarket,
        deployVenue: v, ltvPct: effectiveLtv,
      });
      return { venue: v, ...pos };
    }).sort((a, b) => b.totalNetUSD - a.totalNetUSD);
  }, [collateral, colAmt, borrowAsset, bestBorrowMarket, effectiveLtv, deployVenues]);

  // Derived metrics for display
  const colUSD = colAmt * (collateral?.price || 0);
  const borrowUSD = colUSD * (effectiveLtv / 100);
  const baseBorrowRate = bestBorrowMarket?.reserve?.borrowApy || collateral?.borrowRate || 0;
  const borrowReserveTvl = bestBorrowMarket?.reserve?.tvl || 0;
  const borrowSupplyApy = bestBorrowMarket?.reserve?.supplyApy || 0;
  const { effectiveRate: effectiveBorrowRate, impactPct: borrowImpactPct }
    = computeBorrowImpact(borrowUSD, borrowReserveTvl, borrowSupplyApy, baseBorrowRate);
  const liqPrice = borrowUSD > 0 && collateral ? borrowUSD / ((collateral.liqThreshold || 1) * colAmt) : 0;
  const liqDrop = liqPrice > 0 ? ((collateral?.price || 0) - liqPrice) / (collateral?.price || 1) * 100 : 0;
  const hf = borrowUSD > 0 && collateral ? (colUSD * (collateral.liqThreshold || 1)) / borrowUSD : 999;
  const hfColor = hf > 2 ? "#14F195" : hf > 1.4 ? "#FFD93D" : "#FF4B4B";
  const colYieldApy = collateral?.earnApy || 0;

  // LTV presets
  const ltvPresets = useMemo(() => {
    const conservative = Math.round(safeLtv * 0.5);
    const safe = safeLtv;
    const moderate = Math.min(Math.round(safeLtv * 1.3), Math.round(maxLtv * 0.85));
    const max = maxLtv;
    return [
      { p: conservative, l: "Conservative" },
      { p: safe, l: "Safe" },
      { p: moderate, l: "Moderate" },
      { p: max, l: "Max" },
    ];
  }, [safeLtv, maxLtv]);

  // Strategy handler
  function applyStrategy(strat) {
    const col = collateralAssets.find(a => a.symbol === strat.collateral);
    const bor = borrowableAssets.find(a => a.symbol === strat.borrowAsset);
    if (col) setCollateral(col);
    if (bor) setBorrowAsset(bor);
    setLtv(strat.suggestedLtv);
    setColAmount("");
  }

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
    if (option.borrowUSD <= 0) return;
    paper.addBorrow({
      collateral,
      colAmount: colAmt,
      borrowUSD: option.borrowUSD,
      dest: option.venue,
      deployApy: option.effectiveDeployApy,
      borrowRate: option.effectiveBorrowRate,
      netCarryUSD: option.totalNetUSD,
    });
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setColAmount(""); }, 3000);
  }

  if (submitted) {
    return <SuccessScreen
      title="Paper carry trade opened"
      subtitle={`${colAmt} ${collateral.symbol} → ${fmtUSD(borrowUSD)} ${borrowAsset?.symbol || "USDC"}`}
      detail={`+${fmtUSD(bestOption?.totalNetUSD ?? 0)}/yr net carry`}
    />;
  }

  const isWide = width > 1024;

  return (
    <div style={{ maxWidth:"1300px", margin:"0 auto", padding: isMobile ? "32px 16px" : "48px 32px" }}>
      {/* Header */}
      <div style={{ marginBottom:"28px", animation:"fadeUp 0.4s ease" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"10px" }}>
          <div style={{ fontSize:"11px", fontFamily:"var(--mono)", color:"#FF8C5A", letterSpacing:"0.18em" }}>STRUCTURED PRODUCT · CARRY TRADE CALCULATOR</div>
          <PaperBadge />
        </div>
        <h1 style={{ fontFamily:"var(--serif)", fontSize: isMobile ? "28px" : "clamp(32px,4vw,48px)", fontWeight:400, lineHeight:1.1, letterSpacing:"-0.02em", marginBottom:"12px" }}>
          <span className="gradient-text">Borrow & deploy.</span><br/><em style={{ color:"#555" }}>See every carry option.</em>
        </h1>
      </div>

      {/* ── Strategy Cards ──────────────────────────────────────────────── */}
      <div style={{ marginBottom:"28px" }}>
        <div style={{ fontSize:"11px", color:"#444", fontFamily:"var(--mono)", letterSpacing:"0.12em", marginBottom:"12px" }}>EXPLORE STRATEGIES</div>
        <div style={{
          display:"flex", gap:"10px",
          overflowX:"auto", WebkitOverflowScrolling:"touch",
          paddingBottom:"4px",
        }}>
          {STRATEGIES.map((strat, si) => {
            const isActive = collateral?.symbol === strat.collateral && borrowAsset?.symbol === strat.borrowAsset;
            return (
              <div
                key={strat.name}
                onClick={() => applyStrategy(strat)}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = strat.color + "55"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = isActive ? strat.color + "44" : "rgba(153,69,255,0.1)"; }}
                style={{
                  flex:"0 0 auto",
                  width: isMobile ? "160px" : "180px",
                  padding:"16px",
                  background: isActive ? `${strat.color}0A` : "rgba(15,12,28,0.5)",
                  backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
                  border:`1px solid ${isActive ? strat.color + "44" : "rgba(153,69,255,0.1)"}`,
                  borderRadius:"14px",
                  cursor:"pointer",
                  transition:"all 0.2s ease",
                  animation:`cardEnter 0.4s ease ${si * 0.06}s both`,
                }}
              >
                <div style={{ fontWeight:700, fontSize:"13px", color:"#D0CCC5", marginBottom:"6px", fontFamily:"var(--mono)" }}>{strat.name}</div>
                <div style={{ fontSize:"10px", color:"#666", lineHeight:"1.5", marginBottom:"10px", minHeight:"30px" }}>{strat.desc}</div>
                <div style={{ display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap" }}>
                  <span style={{ fontSize:"10px", fontFamily:"var(--mono)", color:strat.color }}>{strat.collateral} → {strat.borrowAsset}</span>
                  <span style={{ fontSize:"9px", color:"#555", fontFamily:"var(--mono)" }}>{strat.suggestedLtv}% LTV</span>
                  <RiskBadge risk={strat.risk} />
                </div>
              </div>
            );
          })}
        </div>
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
                subtitle={`${Math.round(a.maxLTV*100)}% max · ${(a.earnApy || 0).toFixed(1)}% yield`}
              />
            ))}
          </div>

          {/* Borrow asset selector */}
          <div style={{ fontSize:"11px", color:"#444", fontFamily:"var(--mono)", letterSpacing:"0.12em", marginBottom:"10px" }}>BORROW ASSET</div>
          <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"6px" }}>
            {borrowableAssets.map(a => (
              <FilterChip
                key={a.symbol}
                active={borrowAsset?.symbol === a.symbol}
                onClick={() => setBorrowAsset(a)}
                color={borrowAsset?.symbol === a.symbol ? a.color : undefined}
                logoUrl={a.logoUrl}
              >
                {a.symbol}
              </FilterChip>
            ))}
          </div>
          {bestBorrowMarket && (
            <div style={{ fontSize:"10px", color:"#555", fontFamily:"var(--mono)", marginBottom:"16px" }}>
              via {bestBorrowMarket.venue.name} · {baseBorrowRate.toFixed(1)}% borrow rate
            </div>
          )}

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
                  <span style={{ fontSize:"12px", color:"#555", marginLeft:"6px" }}>{borrowAsset?.symbol || "USDC"}</span>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:"12px", fontFamily:"var(--mono)", color:"#666" }}>LTV: {effectiveLtv}%</div>
                </div>
              </div>
              <input type="range" min={5} max={maxLtv} value={effectiveLtv} onChange={e => setLtv(Number(e.target.value))} style={{ width:"100%", accentColor: effectiveLtv > maxLtv * 0.85 ? "#FF4B4B" : effectiveLtv > safeLtv ? "#FFD93D" : "#14F195", marginBottom:"8px" }} />
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                {ltvPresets.map(m => (
                  <button key={m.l} onClick={() => setLtv(m.p)} style={{ fontSize:"10px", fontFamily:"var(--mono)", color: effectiveLtv===m.p?"#F0EDE8":"#444", background:"none", border:"none", cursor:"pointer", borderBottom: effectiveLtv===m.p ? "1px solid #F0EDE8":"1px solid transparent" }}>{m.l}</button>
                ))}
              </div>
            </div>
          )}

          {/* Metrics row */}
          {colAmt > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px", marginBottom:"16px" }}>
              <MetricBox label="Health Factor" value={hf === 999 ? "∞" : hf.toFixed(2)} sub="Liq at <1.0" valueColor={hfColor} />
              <MetricBox label="Liq. Price" value={liqPrice > 0 ? `$${liqPrice.toFixed(0)}` : "—"} sub={liqDrop > 0 ? `−${liqDrop.toFixed(0)}%` : "—"} valueColor={liqDrop > 0 && liqDrop < 30 ? "#FF4B4B" : liqDrop < 50 ? "#FFD93D" : "#3DFFA0"} />
              <MetricBox
                label="Borrow Rate"
                value={`${baseBorrowRate.toFixed(1)}%${borrowImpactPct > 1 ? ` → ${effectiveBorrowRate.toFixed(1)}%` : ""}`}
                sub={borrowImpactPct > 1 ? `+${borrowImpactPct.toFixed(1)}% impact` : `${fmtUSD(borrowUSD * baseBorrowRate / 100)}/yr`}
                valueColor="#FF8C5A"
              />
            </div>
          )}

          {effectiveLtv > maxLtv * 0.85 && colAmt > 0 && (
            <div style={{ padding:"10px 14px", background:"rgba(255,75,75,0.06)", border:"1px solid rgba(255,75,75,0.18)", borderRadius:"8px", fontSize:"12px", color:"#FF8888", lineHeight:"1.6" }}>
              ⚠ At this LTV, a {liqDrop.toFixed(0)}% drop in {collateral.symbol} triggers liquidation.
            </div>
          )}

          {/* Collateral yield callout — any yield-bearing collateral */}
          {colAmt > 0 && colYieldApy > 0 && (
            <div style={{ marginTop:"12px", padding:"10px 14px", background:"rgba(153,69,255,0.06)", border:"1px solid rgba(153,69,255,0.15)", borderRadius:"8px", fontSize:"12px", color:"#9945FF", lineHeight:"1.6", backdropFilter:"blur(8px)" }}>
              ◎ {collateral.symbol} yield: +{colYieldApy.toFixed(1)}% on {fmtUSD(colUSD)} = +{fmtUSD(colUSD * (colYieldApy / 100))}/yr
            </div>
          )}
        </div>

        {/* RIGHT — Deploy options table */}
        <div style={{ animation:"fadeUp 0.4s ease 0.1s both" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
            <div style={{ fontSize:"11px", color:"#444", fontFamily:"var(--mono)", letterSpacing:"0.12em" }}>
              {colAmt > 0 ? `${deployOptions.length} DEPLOY OPTIONS · SORTED BY TOTAL NET` : "DEPLOY OPTIONS — Enter an amount to calculate"}
            </div>
            {bestOption && colAmt > 0 && bestOption.totalNetUSD > 0 && (
              <div style={{ fontSize:"11px", color:"#3DFFA0", fontFamily:"var(--mono)" }}>
                Best: {bestOption.venue.name} · +{fmtUSD(bestOption.totalNetUSD)}/yr
              </div>
            )}
          </div>

          {colAmt <= 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
              {deployVenues.slice(0, 6).map((v, i) => {
                const baseApy = getRelevantApy(v, borrowAsset) || 0;
                return (
                  <div key={v.name} style={{
                    padding:"14px 20px",
                    background:"rgba(15,12,28,0.4)",
                    backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
                    border:"1px solid rgba(153,69,255,0.08)",
                    borderLeft:`3px solid ${v.color}`,
                    borderRadius:"12px",
                    display:"flex", alignItems:"center", gap:"12px",
                    animation:`cardEnter 0.4s ease ${i*0.04}s both`,
                  }}>
                    <VenueLogo logo={v.logo} logoUrl={v.logoUrl} color={v.color} size={30} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:"13px", color:"#D0CCC5" }}>{v.name}</div>
                      <div style={{ fontSize:"10px", color:"#555" }}>{v.type}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:"15px", fontFamily:"var(--serif)", color: v.color }}>{baseApy > 0 ? `${baseApy.toFixed(1)}%` : "—"}</div>
                      <div style={{ fontSize:"9px", color:"#444", fontFamily:"var(--mono)" }}>Deploy APY</div>
                    </div>
                    <RiskBadge risk={v.risk} />
                  </div>
                );
              })}
            </div>
          )}

          {colAmt > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
              {deployOptions.map((opt, i) => {
                const isBest = i === 0 && opt.totalNetUSD > 0;
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
                      animation:`cardEnter 0.4s ease ${i*0.04}s both`,
                      ...(isBest ? { boxShadow:"0 0 20px rgba(20,241,149,0.08)" } : {}),
                    }}
                  >
                    <div style={{
                      display:"grid",
                      gridTemplateColumns: isMobile
                        ? "30px 1fr auto"
                        : "34px 1fr 90px 90px 80px 90px 100px 70px 100px",
                      alignItems:"center", gap: isMobile ? "10px" : "10px",
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
                          {/* Deploy APY */}
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:"14px", fontFamily:"var(--serif)", color:opt.venue.color }}>{opt.effectiveDeployApy.toFixed(1)}%</div>
                            <div style={{ fontSize:"9px", color:"#444", fontFamily:"var(--mono)" }}>
                              {opt.supplyImpactPct > 1 ? <span style={{ color:"#FFD93D" }}>({opt.baseDeployApy.toFixed(1)}% base)</span> : "Deploy"}
                            </div>
                          </div>

                          {/* Borrow Rate */}
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:"13px", fontFamily:"var(--mono)", color:"#FF8C5A" }}>−{opt.effectiveBorrowRate.toFixed(1)}%</div>
                            <div style={{ fontSize:"9px", color:"#444", fontFamily:"var(--mono)" }}>
                              {opt.borrowImpactPct > 1 ? <span style={{ color:"#FFD93D" }}>({opt.baseBorrowRate.toFixed(1)}% base)</span> : "Borrow"}
                            </div>
                          </div>

                          {/* Collateral Yield */}
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:"13px", fontFamily:"var(--mono)", color: opt.colYieldApy > 0 ? "#9945FF" : "#333" }}>
                              {opt.colYieldApy > 0 ? `+${opt.colYieldApy.toFixed(1)}%` : "—"}
                            </div>
                            <div style={{ fontSize:"9px", color:"#444", fontFamily:"var(--mono)" }}>Col. Yield</div>
                          </div>

                          {/* Net Carry */}
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:"14px", fontFamily:"var(--mono)", fontWeight:700, color: opt.grossCarry > 0 ? "#14F195" : "#FF4B4B" }}>
                              {opt.grossCarry >= 0 ? "+" : ""}{opt.grossCarry.toFixed(2)}%
                            </div>
                            <div style={{ fontSize:"9px", color:"#444", fontFamily:"var(--mono)" }}>Net Carry</div>
                          </div>

                          {/* Total Annual */}
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:"15px", fontFamily:"var(--mono)", fontWeight:700, color: opt.totalNetUSD > 0 ? "#14F195" : "#FF4B4B" }}>
                              {opt.totalNetUSD > 0 ? "+" : ""}{fmtUSD(opt.totalNetUSD)}
                            </div>
                            <div style={{ fontSize:"9px", color:"#444", fontFamily:"var(--mono)" }}>/year total</div>
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
                          {opt.totalNetUSD !== 0 && (
                            <div style={{ fontSize:"10px", fontFamily:"var(--mono)", color: opt.totalNetUSD > 0 ? "#14F195" : "#FF4B4B" }}>
                              {fmtUSD(opt.totalNetUSD)}/yr
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePaperTrade(opt)}
                          style={{
                            padding:"7px 12px", border:"none", borderRadius:"6px", cursor:"pointer",
                            background:"rgba(153,69,255,0.1)",
                            color:"#DC1FFF",
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
                        <div style={{ display:"flex", gap:"8px", fontSize:"10px", color:"#555", fontFamily:"var(--mono)", flexWrap:"wrap" }}>
                          <span>{opt.effectiveDeployApy.toFixed(1)}% deploy</span>
                          <span>−{opt.effectiveBorrowRate.toFixed(1)}% borrow</span>
                          {opt.colYieldApy > 0 && <span style={{ color:"#9945FF" }}>+{opt.colYieldApy.toFixed(1)}% col</span>}
                          <RiskBadge risk={opt.venue.risk} />
                        </div>
                        <button
                          onClick={() => handlePaperTrade(opt)}
                          style={{
                            padding:"6px 10px", border:"none", borderRadius:"6px", cursor:"pointer",
                            background:"rgba(153,69,255,0.1)",
                            color:"#DC1FFF",
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
                    {/* Supply-side impact warning */}
                    {opt.supplyImpactPct > 5 && (
                      <div style={{ fontSize:"10px", color:"#FFD93D", marginTop:"6px", fontFamily:"var(--mono)", padding:"4px 8px", background:"rgba(255,211,61,0.06)", borderRadius:"4px", display:"inline-block" }}>
                        ⚠ Supply impact: {opt.supplyImpactPct.toFixed(1)}% — deploying {fmtUSD(opt.borrowUSD)} into {fmt(opt.venue.tvl)} TVL compresses APY {opt.baseDeployApy.toFixed(1)}% → {opt.effectiveDeployApy.toFixed(1)}%
                      </div>
                    )}
                    {/* Borrow-side impact warning */}
                    {opt.borrowImpactPct > 5 && (
                      <div style={{ fontSize:"10px", color:"#FFD93D", marginTop:"4px", fontFamily:"var(--mono)", padding:"4px 8px", background:"rgba(255,211,61,0.06)", borderRadius:"4px", display:"inline-block" }}>
                        ⚠ Borrow impact: +{opt.borrowImpactPct.toFixed(1)}% — borrowing {fmtUSD(opt.borrowUSD)} pushes rate {opt.baseBorrowRate.toFixed(1)}% → {opt.effectiveBorrowRate.toFixed(1)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

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
                    {fmtUSD(bestOption.netCarryUSD)} carry{bestOption.colYieldUSD > 0 ? ` + ${fmtUSD(bestOption.colYieldUSD)} collateral yield` : ""}
                    {bestOption.borrowImpactPct > 1 && <span style={{ color:"#FFD93D" }}> · borrow impact +{bestOption.borrowImpactPct.toFixed(1)}%</span>}
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
