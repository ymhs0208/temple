"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { pilgrimageLessons } from "@/lib/pilgrimage-lessons";
import { pilgrimageStops } from "@/lib/pilgrimage-data";
import "./chapter-lesson.css";

export function ChapterLesson({ index }: { index: number }) {
  const lesson = pilgrimageLessons[index];
  const stop = pilgrimageStops[index];
  const [questionIndex, setQuestionIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [complete, setComplete] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  const [phase, setPhase] = useState(0);
  const [reduced, setReduced] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const question = lesson.questions[questionIndex];
  const correct = checked && choice === question.answer;
  const storageKey = "pilgrimage-lesson-v1-" + stop.id;

  // Hydrate device-local practice history after SSR, following the existing journal.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try { setComplete(localStorage.getItem(storageKey) === "complete"); }
    catch { setStorageNotice("無法讀取本機練習紀錄，仍可完成本次挑戰。"); }
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!celebrating) return;
    const modal = dialog.current;
    if (!modal) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      setReduced(media.matches);
      if (media.matches) setPhase(3);
    };
    updateMotion();
    media.addEventListener("change", updateMotion);
    modal.showModal();
    const timers = media.matches ? [] : [
      window.setTimeout(() => setPhase(1), 650),
      window.setTimeout(() => setPhase(2), 1650),
      window.setTimeout(() => setPhase(3), 3100),
    ];
    return () => {
      timers.forEach(window.clearTimeout);
      media.removeEventListener("change", updateMotion);
      modal.close();
    };
  }, [celebrating]);

  function celebrate() { setPhase(0); setCelebrating(true); }
  function next() {
    if (!correct) return;
    if (questionIndex + 1 < lesson.questions.length) {
      setQuestionIndex(questionIndex + 1); setChoice(null); setChecked(false);
      heading.current?.focus();
      return;
    }
    setComplete(true);
    try { localStorage.setItem(storageKey, "complete"); setStorageNotice("學習完成紀錄已存於這台裝置，尚未同步至帳號。"); }
    catch { setStorageNotice("本次挑戰已完成，但此裝置無法儲存紀錄；重新整理後可能需要再次挑戰。"); }
    celebrate();
  }
  return <section className="chapter-lesson" aria-labelledby="lesson-title">
    <div className="lesson-heading"><span>讀完故事，試試你的發現</span><b>{complete ? "✓ 本站學習完成" : "2 題知識挑戰"}</b></div>
    <h2 id="lesson-title">不只到過，也讀懂這一站</h2>
    <p>{lesson.takeaway}</p>
    {complete ? <div className="lesson-complete">
      <span className="lesson-mini-seal" aria-hidden="true">{stop.badge}</span>
      <div><h3>{lesson.title}</h3><p>你已完成兩題，認識了這一站的地方故事。</p></div>
      <button type="button" onClick={celebrate}>重播慶祝動畫</button>
      <details><summary>回顧我學到的知識</summary>{lesson.questions.map(item => <article key={item.question}><h4>{item.question}</h4><p>{item.explanation}</p></article>)}</details>
    </div> : <div className="lesson-question">
      <div className="lesson-meter" role="progressbar" aria-label="本關答題進度" aria-valuemin={0} aria-valuemax={2} aria-valuenow={questionIndex}><span style={{ width: questionIndex * 50 + "%" }} /></div>
      <h3 ref={heading} tabIndex={-1}>第 {questionIndex + 1} / 2 題 · {question.question}</h3>
      <fieldset disabled={correct}><legend>選出你認為正確的答案</legend>
        {question.choices.map((answer, i) => <label key={answer} className={choice === i ? "selected" : ""}>
          <input type="radio" name={"lesson-choice-" + index} checked={choice === i} onChange={() => { setChoice(i); setChecked(false); }} />
          <span>{answer}</span>
        </label>)}
      </fieldset>
      {checked && <div role="status" className={"lesson-feedback " + (correct ? "correct" : "retry")}><b>{correct ? "答對了！一起看懂原因。" : "還差一點，看看線索後再選一次。"}</b><p>{question.explanation}</p></div>}
      {correct ? <button type="button" className="lesson-primary" onClick={next}>{questionIndex === 1 ? "完成學習・揭曉專屬徽印" : "我理解了，下一題"}</button> : <button type="button" className="lesson-primary" disabled={choice === null} onClick={() => setChecked(true)}>確認答案</button>}
      <small>不限次數，答錯不扣分；題目依本頁故事編寫。</small>
    </div>}
    <p className="lesson-storage" role="status">{storageNotice || "學習徽印與掃碼碎片分開計算；練習紀錄僅存於此裝置。"}</p>
    {celebrating && <dialog ref={dialog} className="lesson-celebration" data-phase={phase} data-reduced={reduced} aria-labelledby="celebration-title" onCancel={() => setCelebrating(false)}>
      <div className="celebration-inner">
        <button type="button" className="celebration-skip" onClick={() => setCelebrating(false)}>{phase < 3 ? "略過動畫，查看成果" : "關閉慶祝"}</button>
        <div className="celebration-particles" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ "--angle": i * 360 / 28 + "deg", "--delay": (i % 7) * 60 + "ms", "--distance": 110 + (i % 4) * 20 + "px" } as CSSProperties} />)}</div>
        <p className="celebration-kicker">CHAPTER {String(index + 1).padStart(2, "0")} · 知識的光，因你亮起</p>
        <div className="celebration-stage" aria-hidden="true"><div className="celebration-orbit" /><div className="celebration-ring" /><div className="celebration-seal"><small>學 習 完 成</small><strong>{stop.badge}</strong><span>七媽會 · 1917</span></div></div>
        <p className="celebration-phase" role="status">{["正在匯聚你的發現…", "點亮這一站的知識…", "專屬學習徽印，為你揭曉", "恭喜！你不只到過，也讀懂了。"][phase]}</p>
        <h2 id="celebration-title">{lesson.title}</h2><p>{stop.name} · 2 / 2 題完成</p>
        <div className="celebration-knowledge"><b>這次，你帶走的知識</b><p>{lesson.takeaway}</p></div>
        <button type="button" className="celebration-continue" onClick={() => setCelebrating(false)}>收下這份成就，繼續探索</button>
        <small>重播不會重複增加碎片或巡禮證書。</small>
      </div>
    </dialog>}
  </section>;
}
