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
  focusRewardMinutes?: number;
  dailyFortuneTask?: { done?: boolean };
  weakQuestions?: Array<{ nextReviewDate?: string }>;
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
  const [source, setSource] = useState<"ai" | "plan" | null>(null);

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
  const completedTasks = tasks.filter((task) => task.done);
  const completedMinutes = completedTasks.reduce((sum, task) => sum + task.minutes, 0);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
  const weakQuestions = plan.weakQuestions ?? [];
  const dueWeakQuestions = weakQuestions.filter((item) => (item.nextReviewDate ?? "") <= today);

  const askCoach = async (nextMessage = message) => {
    const question = nextMessage.trim();
    if (!question || loading) return;
    setMessage(question);
    setLoading(true);
    setError("");
    setAnswer("");
		setSource(null);
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
				weakQuestionCount: weakQuestions.length,
				dueWeakQuestionCount: dueWeakQuestions.length,
				focusMinutes: plan.focusRewardMinutes ?? completedMinutes,
				checkInDone: Boolean(plan.dailyFortuneTask?.done),
          },
        }),
      });
      const data = (await response.json()) as { answer?: string; error?: string; source?: "ai" | "plan" };
      if (!response.ok || !data.answer) throw new Error(data.error || "目前無法取得建議");
      setAnswer(data.answer);
			setSource(data.source ?? "ai");
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

				<section className="coach-evidence" aria-label="教練使用的今日資料">
					<div><span>已完成</span><b>{completedTasks.length} 項・{completedMinutes} 分</b></div>
					<div><span>待回流錯題</span><b>{dueWeakQuestions.length} 題</b></div>
					<div><span>弱點題庫</span><b>{weakQuestions.length} 題</b></div>
					<p>教練只根據這些真實進度、考試倒數與弱科安排下一步。</p>
				</section>

        <section className="coach-card">
					<div className="card-title"><span>✦</span><div><b>今天的下一步怎麼排？</b><small>教練會綜合倒數、弱科、錯題與已完成內容；不會自動變更你的計畫。</small></div></div>
					<button className="coach-auto-plan" onClick={() => void askCoach("請根據我今天的真實進度，給我最優先的下一步安排。")} disabled={loading}>依今天資料產出下一步 <span>→</span></button>
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
					<span>{loading ? "✦ AI 正在整理你的學習情境" : error ? "請稍後再試" : source === "plan" ? "✦ 今日資料策略" : "✦ AI 教練建議"}</span>
          {loading ? <div className="coach-loading"><i /><i /><i /></div> : error ? <p className="coach-error">{error}</p> : <p>{answer}</p>}
        </section>}
        <p className="feature-note">AI 建議只用於學習規劃與鼓勵；最適合你的節奏，仍由你自己決定。</p>
      </section>
    </main>
  );
}
