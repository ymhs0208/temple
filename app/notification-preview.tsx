"use client";
import { useState } from "react";

const previews = [
  { title: "每日學習提醒", heading: "今天，從一件事開始", intro: "同學，Day 13・還有 3 個任務，共 60 分鐘。", lines: ["已完成 0 / 3 項", "數學 · 25 分鐘", "英文 · 20 分鐘", "國文 · 15 分鐘"], button: "前往今日任務", color: "#287C64" },
  { title: "晚間未完成提醒", heading: "今天還有一點小進度", intro: "同學，Day 13・還有 1 個任務，共 15 分鐘。", lines: ["已完成 2 / 3 項", "國文 · 15 分鐘"], button: "繼續學習", color: "#526BA4" },
  { title: "每週學習回顧", heading: "這週的努力，一起回顧", intro: "最近七天的學習紀錄", lines: ["完成任務累積 180 分鐘", "任務完成率 80%", "數學 · 完成 4/5 項", "英文 · 完成 4/5 項"], button: "查看完整進度", color: "#7661A8" },
];
export function NotificationPreview() {
  const [index, setIndex] = useState(0);
  const item = previews[index];
  return <details className="line-flex-preview">
    <summary>預覽 LINE 卡片樣式（不會傳送通知）</summary>
    <div className="line-preview-options" role="group" aria-label="選擇通知預覽">
      {previews.map((preview, i) => <button type="button" key={preview.title} aria-pressed={i === index} onClick={() => setIndex(i)}>{preview.title}</button>)}
    </div>
    <p>以下是示意資料，實際通知會依已同步的任務產生；LINE 各裝置顯示可能略有不同。</p>
    <article className="line-preview-bubble" aria-live="polite">
      <header style={{ background: item.color }}><small>文昌同行・學習陪伴</small><h3>{item.heading}</h3></header>
      <div><p>{item.intro}</p>{item.lines.map(line => <p key={line}>{line}</p>)}
        <small>依已同步的學習紀錄整理；開啟網站後再決定下一步。</small>
        <span className="line-preview-cta" style={{ background: item.color }}>{item.button}</span>
      </div>
    </article>
  </details>;
}
