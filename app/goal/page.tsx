"use client";
import { useMemo, useState } from "react";

export default function GoalPage() {
  const [name, setName] = useState("學測"); const [date, setDate] = useState("2026-10-31"); const [hours, setHours] = useState(2); const [weak, setWeak] = useState("數學");
  const days = useMemo(() => Math.max(0, Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86400000)), [date]);
  const save = () => { localStorage.setItem("wenchang-mvp", JSON.stringify({ challengeName:name, examDate:date, hours, weak, goal:`準備${name}` })); location.href = "/"; };
  return <main style={{ minHeight:"100vh", padding:"28px 20px", background:"#f8f4ea", color:"#20352b", fontFamily:"Arial,'Noto Sans TC',sans-serif" }}>
    <p style={{ color:"#a37d39", letterSpacing:2, fontSize:12 }}>動態目標系統</p><h1>你的目標，<br/>你的學習節奏。</h1>
    <section style={{ padding:20, borderRadius:18, background:"#fffdf8", border:"1px solid #e7dfcf" }}>
      <label>考試或目標名稱<input value={name} onChange={e=>setName(e.target.value)} style={{ width:"100%", boxSizing:"border-box", marginTop:7, padding:12, borderRadius:10, border:"1px solid #ddd6c6" }}/></label>
      <label style={{ display:"block", marginTop:14 }}>目標日期<input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ width:"100%", boxSizing:"border-box", marginTop:7, padding:12, borderRadius:10, border:"1px solid #ddd6c6" }}/></label>
      <label style={{ display:"block", marginTop:14 }}>每日可讀時間<select value={hours} onChange={e=>setHours(Number(e.target.value))} style={{ width:"100%", marginTop:7, padding:12, borderRadius:10, border:"1px solid #ddd6c6" }}><option value={1}>1 小時</option><option value={2}>2 小時</option><option value={3}>3 小時</option></select></label>
      <label style={{ display:"block", marginTop:14 }}>優先加強科目<input value={weak} onChange={e=>setWeak(e.target.value)} style={{ width:"100%", boxSizing:"border-box", marginTop:7, padding:12, borderRadius:10, border:"1px solid #ddd6c6" }}/></label>
    </section>
    <section style={{ marginTop:16, padding:20, borderRadius:18, background:"#173e32", color:"white" }}><small>你的挑戰</small><h2 style={{ margin:"8px 0" }}>{name}倒數 {days} 天</h2><p>每日 {hours} 小時，優先加強 {weak}。系統會依日期調整任務節奏。</p></section>
    <button onClick={save} style={{ width:"100%", marginTop:16, padding:14, border:0, borderRadius:12, background:"#c69543", color:"white", fontWeight:700 }}>套用我的動態計畫</button>
  </main>;
}
