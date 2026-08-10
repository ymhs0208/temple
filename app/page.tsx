"use client";

import { useEffect, useMemo, useState } from "react";
import liff from "@line/liff";

type Task = { subject: string; minutes: number; detail: string; done: boolean; color: string };
type Tab = "today" | "progress" | "prayer" | "profile";

const defaultTasks: Task[] = [
  { subject: "數學", minutes: 45, detail: "弱點複習與錯題整理", done: false, color: "amber" },
  { subject: "英文", minutes: 30, detail: "單字＋閱讀練習", done: false, color: "jade" },
  { subject: "自然", minutes: 30, detail: "觀念複習與題型演練", done: false, color: "violet" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("today");
  const [tasks, setTasks] = useState<Task[]>(defaultTasks);
  const [name, setName] = useState("30 日學習挑戰");
  const [examDate, setExamDate] = useState("2026-10-31");
  const [goal, setGoal] = useState("穩定完成每日學習任務");
  const [hours, setHours] = useState(2);
  const [lineName, setLineName] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("wenchang-mvp");
    if (stored) {
      try {
        const data = JSON.parse(stored) as Partial<{ tasks: Task[]; challengeName: string; examDate: string; goal: string; hours: number }>;
        if (data.tasks) setTasks(data.tasks);
        if (data.challengeName) setName(data.challengeName);
        if (data.examDate) setExamDate(data.examDate);
        if (data.goal) setGoal(data.goal);
        if (data.hours) setHours(data.hours);
      } catch { /* Ignore outdated local data. */ }
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("wenchang-mvp", JSON.stringify({ tasks, challengeName: name, examDate, goal, hours }));
  }, [tasks, name, examDate, goal, hours]);
  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) return;
    liff.init({ liffId }).then(() => {
      if (liff.isLoggedIn()) setLineName(liff.getDecodedIDToken()?.name ?? null);
    }).catch(() => undefined);
  }, []);

  const daysLeft = Math.max(0, Math.ceil((new Date(`${examDate}T00:00:00`).getTime() - Date.now()) / 86400000));
  const completed = tasks.filter((task) => task.done).length;
  const progress = Math.round((completed / tasks.length) * 100);
  const energy = Math.min(100, 42 + completed * 10);
  const planks = 10 + completed;
  const remaining = useMemo(() => tasks.filter((task) => !task.done).reduce((sum, task) => sum + task.minutes, 0), [tasks]);
  const toggleTask = (index: number) => setTasks((current) => current.map((task, i) => i === index ? { ...task, done: !task.done } : task));
  const login = async () => { if (!process.env.NEXT_PUBLIC_LIFF_ID) return; if (!liff.isLoggedIn()) liff.login(); else setLineName(liff.getDecodedIDToken()?.name ?? null); };

  const today = <>
    <section className="hero"><p className="eyebrow">{name.toUpperCase()}</p><h1>距離目標還有<br /><em>{daysLeft} 天</em></h1><div className="countdown"><span>每天 {hours} 小時，持續累積</span></div><div className="hero-orb orb-one" /><div className="hero-orb orb-two" /></section>
    <section className="stats"><div className="stat"><span className="stat-icon fire">🔥</span><div><small>今日能量</small><b>{energy}<i> / 100</i></b></div></div><div className="stat"><span className="stat-icon blossom">🌸</span><div><small>祈福木牌</small><b>{planks}<i> 枚</i></b></div></div></section>
    <section className="progress-card"><div className="section-heading"><div><p className="eyebrow">今日任務</p><h2>一步一步完成</h2></div><span className="completion">{completed} / {tasks.length} 完成</span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><div className="tasks">{tasks.map((task, index) => <button className={`task ${task.done ? "done" : ""}`} onClick={() => toggleTask(index)} key={`${task.subject}-${index}`}><span className={`check ${task.done ? "checked" : ""}`}>{task.done ? "✓" : ""}</span><span className={`subject-dot ${task.color}`} /><span className="task-copy"><b>{task.subject}</b><small>{task.detail}</small></span><span className="minutes">{task.minutes}<small>分</small></span></button>)}</div><div className="reward"><span>🌸</span><p>完成一項任務，獲得能量與 1 枚祈福木牌。</p></div></section>
    <section className="encouragement"><span>「</span><p>{completed === tasks.length ? "今天的努力已經完成，請帶著安心休息。" : `你的目標是：${goal}`}</p><span>」</span></section><button className="start-button" onClick={() => setTab("progress")}>繼續學習・剩餘 {remaining} 分鐘</button>
  </>;
  const progressView = <section className="journey"><p className="eyebrow">動態目標進度</p><h1>{name}<br /><em>倒數 {daysLeft} 天</em></h1><div className="journey-summary"><div><b>{progress}%</b><span>今日完成度</span></div><div><b>{completed}</b><span>完成任務</span></div><div><b>{energy}</b><span>累積能量</span></div></div><div className="empty-panel"><b>依你的目標持續調整</b><p>考試日期、每日可讀時間與弱科，都可以隨時重新設定。</p><button className="start-button" onClick={() => { location.href = "/goal"; }}>調整我的學習目標</button></div></section>;
  const prayerView = <section className="journey"><p className="eyebrow">智慧宮廟加分主題</p><h1>文昌同行<br /><em>把學習轉成祈福文化體驗</em></h1><div className="empty-panel"><b>🌸 祈福木牌 × {planks}</b><p>到合作宮廟掃描 QR Code，解鎖文化故事、巡禮徽章與專屬祝福。</p><button className="start-button" onClick={() => { location.href = "/pilgrimage"; }}>開始文昌巡禮</button></div></section>;
  const profileView = <section className="journey"><p className="eyebrow">我的帳號</p><h1>{lineName ?? "學習夥伴"}<br /><em>你的 30 日同行計畫</em></h1><div className="empty-panel"><b>目前設定：{name}</b><p>考試日：{examDate}<br />每日學習：{hours} 小時</p><button className="start-button" onClick={() => { location.href = "/goal"; }}>調整我的學習目標</button><button className="plan-link" onClick={() => { location.href = "/pilgrimage"; }}>智慧宮廟・文昌巡禮</button><button className="test-reminder" onClick={login}>{lineName ? "LINE 已連結" : "連結 LINE 帳號"}</button></div></section>;

  return <main><section className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark">⛩</span><span>文昌同行</span></div><div className="account"><button className="line-login" onClick={login}>{lineName ? `LINE・${lineName}` : "LINE 登入"}</button><button className="avatar" onClick={() => setTab("profile")}>{lineName?.slice(0, 1) ?? "我"}</button></div></header>{tab === "today" ? today : tab === "progress" ? progressView : tab === "prayer" ? prayerView : profileView}<nav><button className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}>⌂<span>今日</span></button><button className={tab === "progress" ? "active" : ""} onClick={() => setTab("progress")}>▥<span>進度</span></button><button className={tab === "prayer" ? "active" : ""} onClick={() => setTab("prayer")}>✿<span>祈福</span></button><button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>◌<span>我的</span></button></nav></section></main>;
}
