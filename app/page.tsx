"use client";
import dynamic from "next/dynamic";

const YieldApp = dynamic(() => import("../components/YieldApp"), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: "100vh", background: "#080706",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: "28px", height: "28px",
        border: "2px solid rgba(61,255,160,0.2)",
        borderTopColor: "#3DFFA0", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
    </div>
  ),
});

export default function Home() {
  return <YieldApp />;
}
