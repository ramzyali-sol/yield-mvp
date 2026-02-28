"use client";
import dynamic from "next/dynamic";

const YieldApp = dynamic(() => import("../components/YieldApp"), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: "100vh", background: "#0A0A0F",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: "28px", height: "28px",
        border: "2px solid rgba(153,69,255,0.2)",
        borderTopColor: "#9945FF", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
    </div>
  ),
});

export default function Home() {
  return <YieldApp />;
}
