"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { pilgrimageChapters } from "@/lib/pilgrimage-chapters";
import { pilgrimageLessons } from "@/lib/pilgrimage-lessons";
import { pilgrimageStops } from "@/lib/pilgrimage-data";
import "./unlock-reveal.css";

export function UnlockReveal({ stopId, collected, onDismiss }: { stopId: string; collected: number; onDismiss: () => void }) {
  const index = pilgrimageStops.findIndex(stop => stop.id === stopId);
  const stop = pilgrimageStops[index];
  const chapter = pilgrimageChapters[index];
  const lesson = pilgrimageLessons[index];
  const modal = useRef<HTMLDialogElement>(null);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const element = modal.current;
    if (!element) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => { if (media.matches) setSettled(true); };
    media.addEventListener("change", finish);
    const timer = window.setTimeout(() => setSettled(true), media.matches ? 0 : 2800);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", finish);
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  if (!stop) return null;
  return <dialog ref={modal} className="pilgrimage-unlock-reveal" data-settled={settled} aria-labelledby="unlock-reveal-title" aria-describedby="unlock-reveal-description" onCancel={onDismiss}>
    <div className="unlock-reveal-art">
      <div className="unlock-reveal-toolbar">
        <span>巡禮護照 · 第 {String(index + 1).padStart(2, "0")} 站</span>
        <button type="button" aria-label="關閉碎片解鎖視窗" onClick={onDismiss}>×</button>
      </div>
      <div className="unlock-reveal-stage" aria-hidden="true">
        <div className="unlock-reveal-halo" /><div className="unlock-reveal-orbit" />
        <div className="unlock-reveal-sparks">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ "--a": i * 15 + "deg", "--d": (i % 6) * 65 + "ms" } as CSSProperties} />)}</div>
        <div className="unlock-reveal-stamp"><span>歷 史 碎 片</span><strong>{stop.badge}</strong><small>1917 · 七媽會</small></div>
      </div>
      <p className="unlock-reveal-status" role="status">{settled ? "✓ 這段記憶，已收入你的護照" : "光芒匯聚，新的故事即將展開…"}</p>
      <h2 id="unlock-reveal-title">{stop.name}</h2>
      <p className="unlock-reveal-subtitle">{chapter.title}</p>
      <button className="unlock-reveal-skip" type="button" onClick={() => { if (settled) onDismiss(); else setSettled(true); }}>{settled ? "收下碎片，返回巡禮" : "略過動畫"}</button>
    </div>
    <div className="unlock-reveal-content">
      <div className="unlock-reveal-progress"><span>碎片收集進度</span><b>{collected} / 7</b></div>
      <div className="unlock-reveal-track" role="progressbar" aria-label="已收集的巡禮碎片" aria-valuemin={0} aria-valuemax={7} aria-valuenow={collected}><span style={{ width: Math.min(100, collected / 7 * 100) + "%" }} /></div>
      <p id="unlock-reveal-description">{collected === 7 ? "七塊碎片已集齊！讀完本站故事後，回巡禮頁挑戰最終問答。" : `再收集 ${7 - collected} 塊碎片，就能開啟最終問答。`}</p>
      <section className="unlock-reveal-learning"><span>這一站，你會認識</span><p>{lesson.takeaway}</p><div><b>讀故事</b><span aria-hidden="true">→</span><b>答 2 題</b><span aria-hidden="true">→</span><b>獲得學習徽印</b></div></section>
      <p className="unlock-reveal-note">已解鎖故事與探索小記；學習徽印需完成本站知識挑戰。</p>
      <a className="unlock-reveal-primary" href={`/pilgrimage/${stop.id}`}>閱讀故事，開始知識挑戰 <span aria-hidden="true">→</span></a>
      <button className="unlock-reveal-later" type="button" onClick={onDismiss}>留在巡禮頁，稍後再讀</button>
    </div>
  </dialog>;
}
