"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import "./badges.css";
import { BadgeArt, badgeDesigns } from "./badge-art";

type Metric = "focus" | "checkin" | "weakness";
type SavedPlan = { dailyCheckInDates?: string[]; dailyFortuneTask?: { date?: string; done?: boolean; achievementStats?: { focusSessionsCompleted?: number; weaknessesConquered?: number } } };
type Badge = { id: string; title: string; icon: string; metric: Metric; target: number; rank: number };
const families: { metric: Metric; label: string; icon: string; targets: number[]; names: string[] }[] = [
  { metric: "focus", label: "專注冒險", icon: "✦", targets: [1, 5, 10, 30, 50, 100], names: ["專注小火花", "書桌探險家", "十分投入", "專注領航員", "星光守護者", "百次專注傳奇"] },
  { metric: "checkin", label: "習慣養成", icon: "☀", targets: [1, 3, 7, 14, 21, 30], names: ["出發的勇氣", "三日小萌芽", "一週小太陽", "半月追光者", "習慣魔法師", "三十日恆星"] },
  { metric: "weakness", label: "弱點突破", icon: "⚡", targets: [1, 3, 5, 10, 20, 50], names: ["第一道突破", "解題探路者", "五關小勇士", "觀念修復師", "難題挑戰王", "突破大師"] },
];
const catalog: Badge[] = families.flatMap(f => f.targets.map((target, rank) => ({ id: `${f.metric}-${target}`, title: f.names[rank], icon: f.icon, metric: f.metric, target, rank })));
const ranks = ["初登場", "新秀", "進階", "菁英", "大師", "傳奇"];
const unit = (metric: Metric) => metric === "focus" ? "次完整專注" : metric === "checkin" ? "天連續簽到" : "題已克服弱點";
const day = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
function longestStreak(dates: string[]) {
  let best = 0, run = 0, previous = 0;
  for (const date of [...new Set(dates)].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()) {
    const time = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(time) || date > day()) continue;
    run = time - previous === 86400000 ? run + 1 : 1;
    best = Math.max(best, run); previous = time;
  }
  return best;
}
const safeCount = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
function Medal({ badge }: { badge: Badge }) {
  const [motif, shape, metal, edge] = badgeDesigns[badge.metric][badge.rank];
  return <div className={`collection-medal tier-${badge.rank} shape-${shape} motif-${motif}`} style={{ "--metal": metal, "--edge": edge, "--ribbon": edge } as CSSProperties} aria-hidden="true"><div className="collection-ribbons"/><div className="collection-coin"><BadgeArt motif={motif}/><small>{badge.target}</small></div><div className="collection-stars">{badge.rank > 3 ? "✦ ✦ ✦" : "✦"}</div></div>;
}

export default function BadgesPage() {
  const [plan, setPlan] = useState<SavedPlan>({});
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<"all" | "unlocked" | Metric>("all");
  const [selected, setSelected] = useState<Badge | null>(null);
  const [playing, setPlaying] = useState(false);
  const [replay, setReplay] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const read = () => {
      try { const saved = JSON.parse(localStorage.getItem("wenchang-mvp") ?? "{}"); setPlan(saved && typeof saved === "object" ? saved : {}); } catch { setPlan({}); }
      setReady(true);
    };
    read(); window.addEventListener("storage", read); window.addEventListener("focus", read);
    return () => { window.removeEventListener("storage", read); window.removeEventListener("focus", read); };
  }, []);
  useEffect(() => { if (selected) dialog.current?.showModal(); }, [selected]);
  const progress = useMemo(() => {
    const dates = Array.isArray(plan.dailyCheckInDates) ? plan.dailyCheckInDates.filter(d => typeof d === "string") : [];
    if (plan.dailyFortuneTask?.done && plan.dailyFortuneTask.date === day()) dates.push(day());
    return { focus: safeCount(plan.dailyFortuneTask?.achievementStats?.focusSessionsCompleted), checkin: longestStreak(dates), weakness: safeCount(plan.dailyFortuneTask?.achievementStats?.weaknessesConquered) };
  }, [plan]);
  const earned = (badge: Badge) => progress[badge.metric] >= badge.target;
  const unlocked = catalog.filter(earned).length;
  const next = catalog.filter(b => !earned(b)).sort((a, b) => progress[b.metric] / b.target - progress[a.metric] / a.target)[0];
  const visible = catalog.filter(b => filter === "all" || (filter === "unlocked" ? earned(b) : b.metric === filter));
  const open = (badge: Badge, animate = false) => { setSelected(badge); setPlaying(animate); setReplay(r => r + 1); };
  return <main id="badge-collection">
    <a className="collection-back" href="/progress">← 返回學習進度</a>
    <header className="collection-hero">
      <div><p className="collection-eyebrow">每一份努力，都值得閃耀</p><h1>我的學習徽章</h1><p>把每天的小進步，收藏成閃閃發亮的大成就。</p></div>
      <div className="collection-showcase" aria-hidden="true"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><Medal badge={catalog[5]}/><span className="showcase-caption">你的努力，自帶光芒</span></div>
    </header>
    <section className="collection-overview" aria-label="徽章收集進度">
      <div><span>我的收藏</span><strong>{ready ? unlocked : "—"}<small> / {catalog.length} 枚</small></strong><progress value={unlocked} max={catalog.length} aria-label="已解鎖徽章"/></div>
      <div><span>下一個小目標</span><h2>{next ? next.title : "全圖鑑完成！"}</h2><p>{!ready ? "正在讀取學習紀錄…" : next ? `再完成 ${next.target - progress[next.metric]} ${unit(next.metric)}，就能點亮它。` : "18 枚徽章都已點亮，繼續創造你的新紀錄。"}</p><a href={next?.metric === "checkin" ? "/prayer#prayer-checkin" : "/today"}>繼續我的挑戰 →</a></div>
    </section>
    <div className="collection-toolbar"><div><h2>你的成就圖鑑</h2><p>點選勳章，查看解鎖條件與動畫。</p></div><span>{visible.length} 枚徽章</span></div>
    <nav className="collection-filters" aria-label="徽章分類">{[{id:"all",label:"全部收藏"},{id:"unlocked",label:"已解鎖"},...families.map(f => ({id:f.metric,label:`${f.icon} ${f.label}`}))].map(f => <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id as typeof filter)}>{f.label}</button>)}</nav>
    <section className="collection-grid" aria-label="學習徽章列表" aria-busy={!ready}>
      {visible.map(b => <button key={b.id} className={`collection-card ${b.metric} ${earned(b) ? "earned" : "locked"}`} onClick={() => open(b)} disabled={!ready} aria-label={`${b.title}，${earned(b) ? "已解鎖" : "未解鎖"}，查看詳情`}><div className="collection-card-top"><span>{ranks[b.rank]}</span><span>{earned(b) ? "✓ 已解鎖" : "未解鎖"}</span></div><Medal badge={b}/><h3>{b.title}</h3><p>{b.target} {unit(b.metric)}</p><progress value={Math.min(progress[b.metric], b.target)} max={b.target} aria-label={`${b.title}解鎖進度`}/><small>{earned(b) ? "已收藏 · 點我欣賞" : `${progress[b.metric]} / ${b.target} · 查看挑戰`}</small></button>)}
    </section>
    {visible.length === 0 && <section className="collection-empty"><span>✧</span><h2>第一枚徽章，等你來點亮</h2><p>完成一次專注或今日簽到，就能開始收藏。</p><a href="/today">開始今天的學習 →</a></section>}
    <aside className="collection-note">✦ 徽章依本機已保存的學習紀錄計算；簽到採歷來最長連續天數，中斷不會收回已達成的簽到徽章。</aside>
    <dialog ref={dialog} className="collection-dialog" onClose={() => { setSelected(null); setPlaying(false); }} aria-labelledby="collection-dialog-title">
      {selected && <div className={`collection-dialog-body ${selected.metric} reveal-${badgeDesigns[selected.metric][selected.rank][4]} ${playing ? "is-celebrating" : ""}`} style={{ "--reveal-color": badgeDesigns[selected.metric][selected.rank][2], "--reveal-edge": badgeDesigns[selected.metric][selected.rank][3] } as CSSProperties} key={`${selected.id}-${replay}`}>
        <button className="collection-close" aria-label="關閉勳章詳情" onClick={() => dialog.current?.close()}>×</button>
        <p className="collection-eyebrow">{playing ? earned(selected) ? "重溫你的榮耀時刻" : "動畫預覽 · 尚未解鎖" : `${ranks[selected.rank]}勳章`}</p>
        <div className="collection-stage"><div className="collection-burst"/>{playing && <div className="collection-confetti" aria-hidden="true">{Array.from({length:24}, (_,i) => <i key={i} style={{"--i": i} as CSSProperties}/>)}</div>}<Medal badge={selected}/></div>
        <h2 id="collection-dialog-title">{selected.title}</h2><p>{earned(selected) ? "這份努力，已經成為你的閃亮收藏。" : `完成 ${selected.target} ${unit(selected.metric)}，就能正式收藏。`}</p><p className="collection-detail-progress">目前進度 {Math.min(progress[selected.metric], selected.target)} / {selected.target}</p>
        <p className="collection-badge-story">{badgeDesigns[selected.metric][selected.rank][5]}</p>
        <button className="collection-primary" onClick={() => { setPlaying(true); setReplay(r => r + 1); }}>{playing ? "再播放一次" : earned(selected) ? "欣賞勳章動畫" : "預覽解鎖動畫"}</button><button className="collection-dismiss" onClick={() => dialog.current?.close()}>返回我的收藏</button>
      </div>}
    </dialog>
  </main>;
}
