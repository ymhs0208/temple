"use client";

import { useEffect, useMemo, useState } from "react";

type Task = {
  subject: string;
  minutes: number;
  detail: string;
  done: boolean;
  color: string;
};

type SavedPlan = {
  tasks?: Task[];
  challengeName?: string;
  examDate?: string;
  goal?: string;
  hours?: number;
  weak?: string;
};

const defaultTasks: Task[] = [
  { subject: "數學", minutes: 45, detail: "錯題整理與觀念複習", done: false, color: "amber" },
  { subject: "英文", minutes: 30, detail: "單字與閱讀練習", done: false, color: "jade" },
  { subject: "自然", minutes: 30, detail: "重點複習", done: false, color: "violet" },
];

const prompts = [
  "今天我只剩 60 分鐘，怎麼安排？",
  "我的弱科錯題很多，現在先做什麼？",
  "我焦慮讀不下去，給我一個 15 分鐘起步法。",
];

export default function CoachPage() {
  const [plan, setPlan] = useState<SavedPlan>({
    challengeName: "30 日學習挑戰",
    examDate: "2026-10-31",
    goal: "穩定完成每日學習任務",
    hours: 2,
    weak: "數學",
    tasks: defaultTasks,
  });
  const [message, setMessage] = useState(prompts[0]);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wenchang-mvp");
      if (saved) setPlan((current) => ({ ...current, ...(JSON.parse(saved) as SavedPlan) }));
    } catch {}
  }, []);

  const daysLeft = useMemo(() => {
    const timestamp = new Date(`${plan.examDate ?? ""}T00:00:00`).getTime();
    return Number.isNaN(timestamp) ? 0 : Math.max(0, Math.ceil((timestamp - Date.now()) / 86400000));
  }, [plan.examDate]);
  const tasks = plan.tasks?.length ? plan.tasks : defaultTasks;
  const remaining = tasks.filter((task) => !task.done);

  const askCoach = async (nextMessage = message) => {
    const question = nextMessage.trim();
    if (!question || loading) return;
    setMessage(question);
    setLoading(true);
    setError("");
    setAnswer("");
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: question,
          context: {
            daysLeft,
            weakSubject: plan.weak,
            dailyHours: plan.hours,
            goal: plan.goal,
            tasks,
          },
        }),
      });
      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error || "目前無法取得建議");
      setAnswer(data.answer);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "目前無法取得建議");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="feature-page coach-page">
      <section className="feature-shell">
        <button className="back-link" onClick={() => (location.href = "/")}>‹ 回到今日</button>
        <header className="feature-hero coach-hero">
          <span className="feature-kicker">AI STUDY COACH</span>
          <h1>你的 AI<br /><em>學習軍師</em></h1>
          <p>把今天的時間與卡關告訴軍師，得到可立即執行的學習下一步。</p>
          <div className="coach-orbit">✦<small>PLAN</small></div>
        </header>

        <section className="coach-context" aria-label="目前學習情境">
          <span>距離目標 <b>{daysLeft}</b> 天</span>
          <span>弱科 <b>{plan.weak ?? "未設定"}</b></span>
          <span>今日可用 <b>{plan.hours ?? 2} 小時</b></span>
        </section>

        <section className="coach-card">
          <div className="card-title"><span>✦</span><div><b>今天想請軍師幫什麼？</b><small>軍師會參考目前的目標與任務，不會自動變更你的計畫。</small></div></div>
          <div className="coach-prompts">
            {prompts.map((prompt) => <button key={prompt} onClick={() => void askCoach(prompt)} disabled={loading}>{prompt}</button>)}
          </div>
          <label className="coach-input-label" htmlFor="coach-question">你的問題</label>
          <textarea id="coach-question" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder="例如：我只剩一小時，要先讀哪一科？" />
          <button className="feature-cta" onClick={() => void askCoach()} disabled={loading}>{loading ? "軍師正在安排…" : "請軍師給我建議"}<span>›</span></button>
        </section>

        <section className="coach-today">
          <div><b>今日尚未完成</b><small>{remaining.length ? `${remaining.length} 項任務等待你開始` : "今日任務已完成，安排好休息吧"}</small></div>
          <ul>{remaining.slice(0, 3).map((task, index) => <li key={`${task.subject}-${index}`}><span>{task.subject}</span><b>{task.minutes} 分鐘</b></li>)}</ul>
        </section>

        {(loading || answer || error) && <section className="coach-answer" aria-live="polite">
          <span>{loading ? "✦ AI 正在整理你的學習情境" : error ? "請稍後再試" : "✦ 軍師的建議"}</span>
          {loading ? <div className="coach-loading"><i /><i /><i /></div> : error ? <p className="coach-error">{error}</p> : <p>{answer}</p>}
        </section>}
        <p className="feature-note">AI 建議只用於學習規劃與鼓勵；最適合你的節奏，仍由你自己決定。</p>
      </section>
    </main>
  );
}
