"use client";
import { useEffect, useState } from "react";
import { pilgrimageChapters } from "@/lib/pilgrimage-chapters";

export function ChapterJournal({ index }: { index: number }) {
  const chapter = pilgrimageChapters[index];
  const [note, setNote] = useState("");
  const [observed, setObserved] = useState(false);
  const [status, setStatus] = useState("");
  // Read browser-only storage after hydration so server and first client markup match.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("pilgrimage-journal-" + index) ?? "{}");
      setNote(typeof saved.note === "string" ? saved.note : "");
      setObserved(saved.observed === true);
    } catch { setStatus("無法讀取此裝置的小記，仍可繼續探索。"); }
  }, [index]);
  /* eslint-enable react-hooks/set-state-in-effect */
  function save() {
    try {
      localStorage.setItem("pilgrimage-journal-" + index, JSON.stringify({ note: note.trim(), observed }));
      setStatus("已儲存在這台裝置，不會公開或傳送 LINE。");
    } catch { setStatus("儲存失敗，請先複製文字保留。"); }
  }
  return <section className="chapter-journal" aria-labelledby="chapter-mission-title">
    <span className="chapter-eyebrow">探索任務 · 自由參加</span>
    <h2 id="chapter-mission-title">{chapter.title}</h2>
    <p>{chapter.prompt}</p>
    <label className="chapter-check"><input type="checkbox" checked={observed} onChange={e => { setObserved(e.target.checked); setStatus("尚未儲存"); }} />我已完成這一站的觀察</label>
    <label htmlFor="chapter-note">{chapter.reflection}</label>
    <textarea id="chapter-note" value={note} maxLength={280} rows={4} placeholder="寫下一點發現，留給未來的自己……" onChange={e => { setNote(e.target.value); setStatus("尚未儲存"); }} />
    <div className="chapter-journal-footer"><small>{note.length} / 280 字 · 僅存於此裝置</small><button type="button" onClick={save}>儲存探索小記</button></div>
    <p role="status">{status}</p>
    <small>探索任務不影響碎片解鎖；碎片仍以巡禮掃碼紀錄為準。</small>
  </section>;
}
