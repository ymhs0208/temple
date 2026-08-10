"use client";

import { useState } from "react";

export default function Pilgrimage() {
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  return <main style={{ minHeight:"100vh", padding:"28px 20px", background:"#f8f4ea", color:"#20352b", fontFamily:"Arial,'Noto Sans TC',sans-serif" }}>
    <p style={{ color:"#a37d39", fontSize:12, letterSpacing:2 }}>智慧宮廟・文昌巡禮</p><h1 style={{ fontSize:30, margin:"8px 0 12px" }}>把努力，走成一段文化旅程。</h1>
    <p style={{ color:"#647167", lineHeight:1.7 }}>到合作宮廟掃描巡禮 QR Code，解鎖文昌文化內容與專屬徽章；學習完成可累積祈福木牌。</p>
    <section style={{ marginTop:24, padding:20, borderRadius:18, background:"#fffdf8", border:"1px solid #e7dfcf" }}><b>今日巡禮任務</b><p style={{ color:"#6c766d", fontSize:14 }}>尋找合作宮廟的文昌 QR Code，完成文化小知識。</p><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="輸入或掃描 QR Code" style={{ width:"100%", padding:12, borderRadius:10, border:"1px solid #ddd6c6", boxSizing:"border-box" }}/><button onClick={() => setUnlocked(code.trim().length > 3)} style={{ width:"100%", marginTop:10, padding:13, border:0, borderRadius:11, background:"#173e32", color:"white", fontWeight:700 }}>解鎖巡禮內容</button></section>
    {unlocked && <section style={{ marginTop:16, padding:20, borderRadius:18, background:"#fff5da" }}><b>✿ 文昌文化徽章已解鎖</b><p style={{ lineHeight:1.7 }}>文昌信仰象徵尊師重道與勤學自勉。今天完成一個小任務，也是在為自己的目標累積力量。</p><strong>獲得：文化徽章 × 1、祈福木牌 × 1</strong></section>}
    <p style={{ marginTop:24, color:"#879087", fontSize:12 }}>正式合作宮廟可配置專屬 QR Code、文化內容與巡禮活動。</p>
  </main>;
}
