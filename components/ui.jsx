"use client";
import { useState } from "react";

/* ─── NAV TAB ────────────────────────────────────────────────────────────── */
export function NavTab({ label, active, onClick, badge }) {
  return (
    <button onClick={onClick} style={{
      padding:"8px 20px", border:"none", cursor:"pointer", borderRadius:"8px",
      background: active
        ? "linear-gradient(135deg, rgba(153,69,255,0.2), rgba(20,241,149,0.1))"
        : "transparent",
      color: active ? "#F0EDE8" : "#666",
      fontSize:"13px", fontWeight: active ? 700 : 500,
      fontFamily:"var(--mono)", letterSpacing:"0.04em", transition:"all 0.2s",
      display:"flex", alignItems:"center", gap:"6px",
      border: active ? "1px solid rgba(153,69,255,0.25)" : "1px solid transparent",
    }}>
      {label}
      {badge != null && badge > 0 && (
        <span style={{ fontSize:"9px", padding:"1px 6px", background:"rgba(153,69,255,0.2)", borderRadius:"8px", color:"#DC1FFF", fontWeight:700 }}>{badge}</span>
      )}
    </button>
  );
}

/* ─── RISK BADGE ─────────────────────────────────────────────────────────── */
export function RiskBadge({ risk }) {
  const c = risk === "LOW"
    ? { bg:"rgba(20,241,149,0.08)", b:"rgba(20,241,149,0.25)", t:"#14F195" }
    : { bg:"rgba(255,211,61,0.08)", b:"rgba(255,211,61,0.25)", t:"#FFD93D" };
  return <span style={{ fontSize:"10px", padding:"3px 8px", background:c.bg, border:`1px solid ${c.b}`, borderRadius:"4px", color:c.t, fontFamily:"var(--mono)", fontWeight:700 }}>{risk}</span>;
}

/* ─── PAPER BADGE ────────────────────────────────────────────────────────── */
export function PaperBadge() {
  return (
    <span style={{ fontSize:"9px", padding:"2px 8px", background:"rgba(153,69,255,0.1)", border:"1px solid rgba(153,69,255,0.3)", borderRadius:"4px", color:"#DC1FFF", fontFamily:"var(--mono)", fontWeight:700, letterSpacing:"0.08em" }}>
      PAPER
    </span>
  );
}

/* ─── TOGGLE ─────────────────────────────────────────────────────────────── */
export function Toggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)} style={{
      width:"40px", height:"22px",
      background: on ? "linear-gradient(135deg, #9945FF, #14F195)" : "rgba(255,255,255,0.06)",
      borderRadius:"11px", cursor:"pointer", position:"relative", transition:"background 0.3s",
      flexShrink:0, border: on ? "none" : "1px solid rgba(255,255,255,0.1)",
    }}>
      <div style={{
        position:"absolute", top:"3px", left: on ? "21px":"3px",
        width:"16px", height:"16px",
        background: on ? "#fff" : "#555",
        borderRadius:"50%", transition:"left 0.2s",
        boxShadow: on ? "0 0 8px rgba(153,69,255,0.5)" : "none",
      }} />
    </div>
  );
}

/* ─── METRIC BOX ─────────────────────────────────────────────────────────── */
export function MetricBox({ label, value, sub, valueColor }) {
  return (
    <div style={{
      background:"rgba(15,12,28,0.6)",
      backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
      borderRadius:"10px", padding:"14px",
      border:"1px solid rgba(153,69,255,0.1)",
    }}>
      <div style={{ fontSize:"10px", color:"#555", fontFamily:"var(--mono)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"6px" }}>{label}</div>
      <div style={{
        fontSize:"18px", fontWeight:700, fontFamily:"var(--mono)",
        color:valueColor, lineHeight:1, marginBottom:"4px",
        textShadow: valueColor ? `0 0 20px ${valueColor}44` : "none",
      }}>{value}</div>
      <div style={{ fontSize:"10px", color:"#555", lineHeight:"1.4" }}>{sub}</div>
    </div>
  );
}

/* ─── FILTER CHIP ────────────────────────────────────────────────────────── */
export function FilterChip({ children, active, onClick, color, logoUrl }) {
  return (
    <button onClick={onClick} style={{
      padding:"5px 14px",
      border: active
        ? "1px solid rgba(153,69,255,0.4)"
        : "1px solid rgba(255,255,255,0.06)",
      borderRadius:"20px", cursor:"pointer", fontSize:"11px", fontFamily:"var(--mono)",
      background: active
        ? "linear-gradient(135deg, rgba(153,69,255,0.15), rgba(20,241,149,0.08))"
        : "rgba(15,12,28,0.4)",
      backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)",
      color: active ? "#F0EDE8" : "#555",
      transition:"all 0.2s", fontWeight: active ? 700 : 400,
      display:"flex", alignItems:"center", gap:"6px",
    }}>
      {logoUrl && (
        <img src={logoUrl} alt="" style={{ width:"14px", height:"14px", borderRadius:"50%", objectFit:"cover" }}
          onError={e => { e.target.style.display = "none"; }} />
      )}
      {children}
    </button>
  );
}

/* ─── VENUE LOGO ─────────────────────────────────────────────────────────── */
export function VenueLogo({ logo, logoUrl, color, size = 34 }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div style={{
      width:`${size}px`, height:`${size}px`, borderRadius:"10px",
      background: `rgba(15,12,28,0.8)`,
      border:`1px solid ${color}33`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize: size < 30 ? "9px" : "10px", fontWeight:800, color, fontFamily:"var(--mono)",
      flexShrink:0, overflow:"hidden",
      boxShadow: `0 0 12px ${color}15`,
    }}>
      {logoUrl && !imgError ? (
        <img
          src={logoUrl}
          alt={logo}
          style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:"9px" }}
          onError={() => setImgError(true)}
        />
      ) : logo}
    </div>
  );
}

/* ─── ASSET BUTTON ───────────────────────────────────────────────────────── */
export function AssetButton({ asset, selected, onClick, subtitle }) {
  const [imgError, setImgError] = useState(false);

  return (
    <button onClick={onClick} style={{
      display:"flex", alignItems:"center", gap:"9px", padding:"11px 14px",
      background: selected
        ? `linear-gradient(135deg, ${asset.color}18, ${asset.color}08)`
        : "rgba(15,12,28,0.5)",
      border: selected
        ? `1.5px solid ${asset.color}55`
        : "1.5px solid rgba(153,69,255,0.08)",
      borderRadius:"10px", cursor:"pointer", transition:"all 0.2s",
      backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)",
    }}>
      {asset.logoUrl && !imgError ? (
        <img
          src={asset.logoUrl}
          alt={asset.symbol}
          style={{ width:"24px", height:"24px", borderRadius:"50%", objectFit:"cover" }}
          onError={() => setImgError(true)}
        />
      ) : (
        <span style={{ fontSize:"20px", color:asset.color }}>{asset.icon}</span>
      )}
      <div style={{ textAlign:"left" }}>
        <div style={{ fontSize:"13px", fontWeight:700, color: selected ? "#F0EDE8":"#777", fontFamily:"var(--mono)" }}>{asset.symbol}</div>
        {subtitle && <div style={{ fontSize:"10px", color: selected ? asset.color:"#444" }}>{subtitle}</div>}
      </div>
    </button>
  );
}

/* ─── AMOUNT INPUT ───────────────────────────────────────────────────────── */
export function AmountInput({ icon, iconColor, value, onChange, placeholder, borderColor, logoUrl }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div style={{
      display:"flex", alignItems:"center",
      background:"rgba(15,12,28,0.6)",
      backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
      border:`1.5px solid ${borderColor || "rgba(153,69,255,0.12)"}`,
      borderRadius:"12px", padding:"13px 16px", gap:"10px",
    }}>
      {logoUrl && !imgError ? (
        <img src={logoUrl} alt="" style={{ width:"26px", height:"26px", borderRadius:"50%", objectFit:"cover" }}
          onError={() => setImgError(true)} />
      ) : (
        <span style={{ fontSize:"22px", color:iconColor }}>{icon}</span>
      )}
      <input
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^0-9.]/g,""))}
        placeholder={placeholder}
        style={{ flex:1, background:"none", border:"none", fontSize:"20px", fontWeight:700, color:"#F0EDE8", fontFamily:"var(--mono)" }}
      />
    </div>
  );
}

/* ─── LOADING SKELETON ───────────────────────────────────────────────────── */
export function LoadingSkeleton({ rows = 6 }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          height:"62px", borderRadius:"10px",
          background:"linear-gradient(90deg, rgba(153,69,255,0.03), rgba(153,69,255,0.06), rgba(153,69,255,0.03))",
          backgroundSize:"200% 100%",
          border:"1px solid rgba(153,69,255,0.06)",
          animation:`shimmerGlass 1.8s ease-in-out ${i * 0.1}s infinite`,
        }} />
      ))}
    </div>
  );
}

/* ─── LAST UPDATED INDICATOR ────────────────────────────────────────────── */
export function LastUpdated({ fetchedAt, error, sources }) {
  if (!fetchedAt && !error) return null;

  const ago = fetchedAt ? Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000) : null;
  const isStale = ago != null && ago > 120;

  const activeSources = sources ? Object.entries(sources).filter(([, v]) => v).map(([k]) => k) : [];
  const dotColor = error ? "#FF4B4B" : isStale ? "#FFD93D" : "#14F195";

  return (
    <div style={{
      display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap",
    }}>
      <div style={{
        width:"6px", height:"6px", borderRadius:"50%",
        background: dotColor,
        flexShrink: 0,
        animation: !error && !isStale ? "dotPulse 2s ease-in-out infinite" : "none",
        color: dotColor,
      }} />

      <span style={{ fontSize:"10px", fontFamily:"var(--mono)", color: error ? "#FF4B4B" : isStale ? "#FFD93D" : "#555" }}>
        {error
          ? "STALE DATA — fetch failed"
          : ago != null
            ? `Updated ${ago < 5 ? "just now" : `${ago}s ago`}`
            : "Loading..."
        }
      </span>

      {activeSources.length > 0 && (
        <span style={{ fontSize:"9px", fontFamily:"var(--mono)", color:"#333" }}>
          [{activeSources.join(", ")}]
        </span>
      )}
    </div>
  );
}

/* ─── SUCCESS SCREEN ─────────────────────────────────────────────────────── */
export function SuccessScreen({ title, subtitle, detail }) {
  return (
    <div style={{ maxWidth:"480px", margin:"120px auto", textAlign:"center", padding:"32px", animation:"fadeUp 0.3s ease" }}>
      <div style={{
        width:"64px", height:"64px", borderRadius:"50%",
        background:"linear-gradient(135deg, rgba(153,69,255,0.1), rgba(20,241,149,0.1))",
        border:"2px solid rgba(153,69,255,0.3)",
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:"28px", margin:"0 auto 20px",
        boxShadow:"0 0 30px rgba(20,241,149,0.2), 0 0 60px rgba(153,69,255,0.1)",
        color:"#14F195",
      }}>✓</div>
      <div style={{ fontFamily:"var(--serif)", fontSize:"28px", marginBottom:"8px" }}>{title}</div>
      <div style={{ fontSize:"14px", color:"#555" }}>{subtitle}</div>
      {detail && <div style={{ fontSize:"13px", color:"#14F195", marginTop:"8px", fontFamily:"var(--mono)", fontWeight:700 }}>{detail}</div>}
      <div style={{ marginTop:"12px" }}><PaperBadge /></div>
    </div>
  );
}
