"use client";

/* ─── NAV TAB ────────────────────────────────────────────────────────────── */
export function NavTab({ label, active, onClick, badge }) {
  return (
    <button onClick={onClick} style={{
      padding:"7px 18px", border:"none", cursor:"pointer", borderRadius:"6px",
      background: active ? "rgba(255,255,255,0.09)" : "transparent",
      color: active ? "#F0EDE8" : "#555",
      fontSize:"13px", fontWeight: active ? 700 : 500,
      fontFamily:"var(--mono)", letterSpacing:"0.04em", transition:"all 0.15s",
      display:"flex", alignItems:"center", gap:"6px",
    }}>
      {label}
      {badge != null && badge > 0 && (
        <span style={{ fontSize:"9px", padding:"1px 5px", background:"rgba(255,211,61,0.15)", borderRadius:"8px", color:"#FFD93D", fontWeight:700 }}>{badge}</span>
      )}
    </button>
  );
}

/* ─── RISK BADGE ─────────────────────────────────────────────────────────── */
export function RiskBadge({ risk }) {
  const c = risk === "LOW"
    ? { bg:"rgba(61,255,160,0.1)",  b:"rgba(61,255,160,0.3)",  t:"#3DFFA0" }
    : { bg:"rgba(255,211,61,0.1)",  b:"rgba(255,211,61,0.3)",  t:"#FFD93D" };
  return <span style={{ fontSize:"10px", padding:"3px 8px", background:c.bg, border:`1px solid ${c.b}`, borderRadius:"3px", color:c.t, fontFamily:"var(--mono)", fontWeight:700 }}>{risk}</span>;
}

/* ─── PAPER BADGE ────────────────────────────────────────────────────────── */
export function PaperBadge() {
  return (
    <span style={{ fontSize:"9px", padding:"2px 8px", background:"rgba(255,211,61,0.1)", border:"1px solid rgba(255,211,61,0.3)", borderRadius:"3px", color:"#FFD93D", fontFamily:"var(--mono)", fontWeight:700, letterSpacing:"0.08em" }}>
      PAPER
    </span>
  );
}

/* ─── TOGGLE ─────────────────────────────────────────────────────────────── */
export function Toggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)} style={{ width:"40px", height:"22px", background: on ? "#3DFFA0":"rgba(255,255,255,0.08)", borderRadius:"11px", cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:"3px", left: on ? "21px":"3px", width:"16px", height:"16px", background: on ? "#080706":"#555", borderRadius:"50%", transition:"left 0.2s" }} />
    </div>
  );
}

/* ─── METRIC BOX ─────────────────────────────────────────────────────────── */
export function MetricBox({ label, value, sub, valueColor }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:"8px", padding:"12px", border:"1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize:"10px", color:"#444", fontFamily:"var(--mono)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"6px" }}>{label}</div>
      <div style={{ fontSize:"18px", fontWeight:700, fontFamily:"var(--mono)", color:valueColor, lineHeight:1, marginBottom:"4px" }}>{value}</div>
      <div style={{ fontSize:"10px", color:"#555", lineHeight:"1.4" }}>{sub}</div>
    </div>
  );
}

/* ─── FILTER CHIP ────────────────────────────────────────────────────────── */
export function FilterChip({ children, active, onClick, color }) {
  return (
    <button onClick={onClick} style={{
      padding:"5px 12px", border:`1px solid ${active ? (color || "rgba(255,255,255,0.3)") : "rgba(255,255,255,0.07)"}`,
      borderRadius:"20px", cursor:"pointer", fontSize:"11px", fontFamily:"var(--mono)",
      background: active ? (color ? color+"22" : "rgba(255,255,255,0.07)") : "transparent",
      color: active ? (color || "#F0EDE8") : "#555",
      transition:"all 0.15s", fontWeight: active ? 700 : 400,
    }}>{children}</button>
  );
}

/* ─── VENUE LOGO ─────────────────────────────────────────────────────────── */
export function VenueLogo({ logo, color, size = 34 }) {
  return (
    <div style={{
      width:`${size}px`, height:`${size}px`, borderRadius:"8px",
      background:color+"22", border:`1px solid ${color}44`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize: size < 30 ? "9px" : "10px", fontWeight:800, color, fontFamily:"var(--mono)",
      flexShrink:0,
    }}>{logo}</div>
  );
}

/* ─── ASSET BUTTON ───────────────────────────────────────────────────────── */
export function AssetButton({ asset, selected, onClick, subtitle }) {
  return (
    <button onClick={onClick} style={{
      display:"flex", alignItems:"center", gap:"9px", padding:"11px 14px",
      background: selected ? `${asset.color}18` : "rgba(255,255,255,0.03)",
      border:`1.5px solid ${selected ? asset.color+"55" : "rgba(255,255,255,0.07)"}`,
      borderRadius:"10px", cursor:"pointer", transition:"all 0.15s",
    }}>
      <span style={{ fontSize:"20px", color:asset.color }}>{asset.icon}</span>
      <div style={{ textAlign:"left" }}>
        <div style={{ fontSize:"13px", fontWeight:700, color: selected ? "#F0EDE8":"#777", fontFamily:"var(--mono)" }}>{asset.symbol}</div>
        {subtitle && <div style={{ fontSize:"10px", color: selected ? asset.color:"#444" }}>{subtitle}</div>}
      </div>
    </button>
  );
}

/* ─── AMOUNT INPUT ───────────────────────────────────────────────────────── */
export function AmountInput({ icon, iconColor, value, onChange, placeholder, borderColor }) {
  return (
    <div style={{
      display:"flex", alignItems:"center",
      background:"rgba(255,255,255,0.04)",
      border:`1.5px solid ${borderColor || "rgba(255,255,255,0.09)"}`,
      borderRadius:"10px", padding:"13px 16px", gap:"10px",
    }}>
      <span style={{ fontSize:"22px", color:iconColor }}>{icon}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^0-9.]/g,""))}
        placeholder={placeholder}
        style={{ flex:1, background:"none", border:"none", fontSize:"20px", fontWeight:700, color:"#F0EDE8", fontFamily:"var(--mono)" }}
      />
    </div>
  );
}

/* ─── SUCCESS SCREEN ─────────────────────────────────────────────────────── */
export function SuccessScreen({ title, subtitle, detail }) {
  return (
    <div style={{ maxWidth:"480px", margin:"120px auto", textAlign:"center", padding:"32px", animation:"fadeUp 0.3s ease" }}>
      <div style={{ width:"64px", height:"64px", borderRadius:"50%", background:"rgba(61,255,160,0.08)", border:"2px solid #3DFFA0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"28px", margin:"0 auto 20px" }}>✓</div>
      <div style={{ fontFamily:"var(--serif)", fontSize:"28px", marginBottom:"8px" }}>{title}</div>
      <div style={{ fontSize:"14px", color:"#555" }}>{subtitle}</div>
      {detail && <div style={{ fontSize:"13px", color:"#3DFFA0", marginTop:"8px", fontFamily:"var(--mono)", fontWeight:700 }}>{detail}</div>}
      <div style={{ marginTop:"12px" }}><PaperBadge /></div>
    </div>
  );
}
