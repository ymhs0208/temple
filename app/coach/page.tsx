"use client";

import { useEffect, useMemo, useState } from "react";
import "./coach.css";
import liff from "@line/liff";
import { taipeiDate } from "@/lib/taipei-date";

type Task = {
  subject: string;
  minutes: number;
  detail: string;
  done: boolean;
  color: string;
};

type SavedPlan = {
  tasksDate?: string;
  tasks?: Task[];
  challengeName?: string;
  examDate?: string;
  goal?: string;
  hours?: number;
  weak?: string;
  focusRewardMinutes?: number;
  dailyFortuneTask?: { done?: boolean; date?: string };
  weakQuestions?: Array<{ nextReviewDate?: string }>;
};

const prompts = [
  "今天我只剩 60 分鐘，怎麼安排？",
  "我的弱科錯題很多，現在先做什麼？",
  "我焦慮讀不下去，給我一個 15 分鐘起步法。",
];

export default function CoachPage() {
  const [plan, setPlan] = useState<SavedPlan>({});
  const [idToken, setIdToken] = useState<string | null>(null);
  const [dataStatus, setDataStatus] = useState("正在讀取個人資料…");
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(false);
  const [weekly, setWeekly] = useState<{ rate: number; minutes: number; subjects: string[] } | null>(null);
  const [cloudCounts, setCloudCounts] = useState<{ total: number | null; due: number | null } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(0);
  const [availableMinutes, setAvailableMinutes] = useState(60);
  const [energy, setEnergy] = useState("穩定");
  const [history, setHistory] = useState<Array<{ question: string; answer: string; source: "ai" | "plan"; date: string }>>([]);
  const [message, setMessage] = useState(prompts[0]);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"ai" | "plan" | null>(null);

  /* Browser storage is hydrated after SSR to preserve the initial server markup. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    setNow(Date.now());
    setDataLoading(true);
    setDataError(false);
    setAnswer("");
    const load = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "2011050459-8bPHPFCw" });
        if (cancelled) return;
        if (liff.isLoggedIn()) {
          const token = liff.getIDToken();
          if (!token) throw new Error("登入已過期，請重新登入。");
          setIdToken(token);
          setHistory([]);
          setPlan({});
          const response = await fetch("/api/coach/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(15000) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "個人資料讀取失敗");
          if (cancelled) return;
          const personal = result.profile;
          setWeekly(personal?.weekly ?? null);
          setCloudCounts({ total: personal?.weakQuestionCount ?? null, due: personal?.dueWeakQuestionCount ?? null });
          setPlan(personal ? { examDate: personal.examDate, weak: personal.weakSubject, goal: personal.goal, hours: personal.dailyHours, tasks: personal.tasks, dailyFortuneTask: { date: taipeiDate(), done: personal.checkInDone } } : {});
          setDataStatus(personal ? `已讀取 LINE 帳號的雲端紀錄 · ${new Date(personal.updatedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })} 更新` : "此帳號尚未建立學習計畫，請先設定目標。");
          setDataError(!personal);
          return;
        }
        setIdToken(null);
        setWeekly(null);
        setCloudCounts(null);
        const saved = JSON.parse(localStorage.getItem("wenchang-mvp") || "null") as SavedPlan | null;
        setPlan(saved && typeof saved === "object" ? { ...saved, tasks: saved.tasksDate === taipeiDate() && Array.isArray(saved.tasks) ? saved.tasks : [] } : {});
        setDataStatus(saved ? "使用此裝置的學習紀錄（未驗證帳號）；今日任務只採用今天的資料。" : "尚無個人資料，請先建立學習目標。");
        setDataError(!saved);
        const previous = JSON.parse(localStorage.getItem("wenchang-coach-history") || "[]");
        setHistory(Array.isArray(previous) ? previous.filter(item => item && typeof item.question === "string" && typeof item.answer === "string" && typeof item.date === "string").slice(0, 5) : []);
      } catch (error) {
        if (!cancelled) { setDataError(true); setDataStatus(error instanceof Error ? error.message : "資料讀取失敗，請重試。"); }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const daysLeft = useMemo(() => {
    const timestamp = new Date(`${plan.examDate ?? ""}T00:00:00+08:00`).getTime();
    return !now || Number.isNaN(timestamp) ? null : Math.max(0, Math.ceil((timestamp - now) / 86400000));
  }, [plan.examDate, now]);
  const tasks = plan.tasks ?? [];
  const remaining = tasks.filter((task) => !task.done);
  const completedTasks = tasks.filter((task) => task.done);
  const completedMinutes = completedTasks.reduce((sum, task) => sum + task.minutes, 0);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
  const weakQuestions = Array.isArray(plan.weakQuestions) ? plan.weakQuestions : [];
  const dueWeakQuestions = weakQuestions.filter((item) => item.nextReviewDate && item.nextReviewDate <= today);

  const askCoach = async (nextMessage = message) => {
    const question = nextMessage.trim();
    if (!question || loading || dataLoading || dataError) return;
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
          idToken,
          message: question,
          context: {
            availableMinutes,
            energy,
            daysLeft,
            weakSubject: plan.weak,
            dailyHours: plan.hours,
            goal: plan.goal,
            tasks,
				weakQuestionCount: cloudCounts ? cloudCounts.total : plan.weakQuestions ? weakQuestions.length : null,
				dueWeakQuestionCount: cloudCounts ? cloudCounts.due : plan.weakQuestions ? dueWeakQuestions.length : null,
				focusMinutes: plan.focusRewardMinutes ?? completedMinutes,
				checkInDone: plan.dailyFortuneTask?.date === today && Boolean(plan.dailyFortuneTask?.done),
          },
        }),
      });
      const data = (await response.json()) as { answer?: string; error?: string; source?: "ai" | "plan" };
      if (!response.ok || !data.answer) throw new Error(data.error || "目前無法取得建議");
      setAnswer(data.answer);
      const entry = { question, answer: data.answer, source: data.source ?? "ai" as const, date: new Date().toISOString() };
      setHistory((current) => {
        const next = [entry, ...current].slice(0, 5);
        try { if (!idToken) localStorage.setItem("wenchang-coach-history", JSON.stringify(next)); } catch { /* Storage may be unavailable; keep the current in-memory state. */ }
        return next;
      });
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
          <h1>你的 AI <em>學習軍師</em></h1>
          <p>把「不知道從哪開始」，變成今天做得到的下一步。一起拆解弱科、安排時間，也照顧你的學習節奏。</p>
          <div className="coach-hero-tag">✦ 每一步，都有方向</div>
        </header>

        <section className="coach-context" aria-label="目前學習情境">
          <span>距離目標 <b>{daysLeft ?? "未設定"}{daysLeft !== null ? " 天" : ""}</b></span>
          <span>弱科 <b>{plan.weak ?? "未設定"}</b></span>
          <span>今日可用 <b>{plan.hours ?? "未設定"}{plan.hours ? " 小時" : ""}</b></span>
        </section>

        <div className="coach-workspace">
        <div className="coach-main-column">
        <section className="coach-setup" aria-label="本次學習設定">
          <div className="coach-section-heading"><div><span>01 / 調整步調</span><h2>先找到今天的節奏</h2></div><span className="coach-duration">{availableMinutes} 分鐘</span></div>
          <fieldset><legend>這次可以讀多久？</legend><div className="coach-options">{[15, 30, 60, 90].map((minutes) => <button key={minutes} aria-pressed={availableMinutes === minutes} onClick={() => setAvailableMinutes(minutes)} disabled={loading || dataLoading || dataError}>{minutes} 分鐘</button>)}</div></fieldset>
          <fieldset><legend>目前的學習狀態</legend><div className="coach-options">{["有衝勁", "穩定", "有點累", "焦慮卡關"].map((value) => <button key={value} aria-pressed={energy === value} onClick={() => setEnergy(value)} disabled={loading || dataLoading || dataError}>{value}</button>)}</div></fieldset>
          <p>這次安排以 {availableMinutes} 分鐘為上限，包含起步、練習與回顧。</p>
        </section>

        <section className="coach-card">
					<div className="coach-section-heading"><div><span>02 / 找到下一步</span><h2>今天想解決什麼？</h2></div></div>
					<button className="coach-auto-plan" onClick={() => void askCoach("請根據我今天的真實進度，給我最優先的下一步安排。")} disabled={loading || dataLoading || dataError}>根據今天進度安排下一步 <span>→</span></button>
          <div className="coach-prompts">
            {prompts.map((prompt) => <button key={prompt} onClick={() => void askCoach(prompt)} disabled={loading || dataLoading || dataError}>{prompt}</button>)}
          </div>
          <div className="coach-input-heading"><label className="coach-input-label" htmlFor="coach-question">也可以說說你的狀況</label><span>{message.length} / 500</span></div>
          <textarea id="coach-question" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder="例如：我只剩一小時，要先讀哪一科？" />
          <button className="feature-cta" onClick={() => void askCoach()} disabled={loading || dataLoading || dataError || !message.trim()}>{loading ? "正在整理建議…" : "詢問學習教練"}<span>›</span></button>
        </section>

        {(loading || answer || error) && <section className="coach-answer" aria-live="polite"><h2>給你的學習建議</h2>
					<span>{loading ? "✦ AI 正在整理你的學習情境" : error ? "請稍後再試" : source === "plan" ? "✦ 基本規劃（未使用 AI 生成）" : "✦ AI 教練建議"}</span>
          {loading ? <div className="coach-loading"><i /><i /><i /></div> : error ? <p className="coach-error">{error}</p> : <p>{answer}</p>}
        </section>}
        {answer && !loading && !error && <div className="coach-action-links"><a href="/today">前往今日任務 →</a><a href="/progress">查看學習進度 ↗</a></div>}
        </div>
        <aside className="coach-sidebar" aria-label="我的學習摘要">
        <section className="coach-evidence" aria-label="教練使用的今日資料"><h2>我的學習摘要</h2>
					<div><span>已完成</span><b>{completedTasks.length} 項・{completedMinutes} 分</b></div>
					<div><span>待回流錯題</span><b>{cloudCounts ? cloudCounts.due ?? "尚無資料" : plan.weakQuestions ? `${dueWeakQuestions.length} 題` : "尚無資料"}</b></div>
					<div><span>弱點題庫</span><b>{cloudCounts ? cloudCounts.total ?? "尚無資料" : plan.weakQuestions ? `${weakQuestions.length} 題` : "尚無資料"}</b></div>
					<p>{weekly ? `近 7 天任務完成率 ${weekly.rate}% · 完成任務合計 ${weekly.minutes} 分鐘。${weekly.subjects.join("；")}` : "近 7 天雲端紀錄尚無資料，不推估完成率或成績。"}</p>
				</section>
        <section className="coach-today">
          <div><h2>今日待辦</h2><small>{remaining.length ? `${remaining.length} 項任務等待你開始` : "目前沒有待辦任務，可前往今日頁面確認計畫"}</small></div>
          <ul>{remaining.map((task, index) => <li key={`${task.subject}-${index}`}><span>{task.subject}</span><b>{task.minutes} 分鐘</b><small>{task.detail}</small></li>)}</ul>
        </section>

        <section className="coach-data-status" aria-live="polite"><b>個人化資料</b><p>{dataStatus}</p><button disabled={loading || dataLoading} onClick={() => setRefresh(value => value + 1)}>重新讀取</button><a href="/goal">設定目標 →</a>{!idToken && !dataLoading && <a href="/profile">前往登入 →</a>}<details><summary>資料如何使用？</summary><p>詢問時會將學習摘要交給 AI 產生建議；登入憑證不會傳給 AI。</p></details></section>
        </aside>
        </div>
        <section className="coach-history">
          <div className="coach-section-heading"><div><span>03 / 留下方向</span><h2>最近的軍師建議</h2></div>{history.length > 0 && <button onClick={() => { setHistory([]); try { if (!idToken) localStorage.removeItem("wenchang-coach-history"); } catch { /* Storage may be unavailable; keep the current in-memory state. */ } }}>清除紀錄</button>}</div>
          <p>{idToken ? "此帳號的建議只保留於本次頁面，避免共用裝置混用紀錄。" : "最近 5 次建議保留在此裝置，方便下次回顧。"}</p>
          {history.length ? history.map((item, index) => <details key={`${item.date}-${index}`}><summary>{item.question}<small>{new Date(item.date).toLocaleDateString("zh-TW")} · {item.source === "plan" ? "基本規劃" : "AI 建議"}</small></summary><p>{item.answer}</p></details>) : <div className="coach-empty">還沒有建議紀錄。選好時間，問軍師第一個問題吧。</div>}
        </section>
        <p className="feature-note">AI 建議只用於學習規劃與鼓勵；最適合你的節奏，仍由你自己決定。</p>
      </section>
    </main>
  );
}
