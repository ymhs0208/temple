"use client";

import { useMemo, useState } from "react";

const initialTasks = [
  { subject: "數學", minutes: 45, detail: "弱點複習・一元二次方程式", done: true, color: "amber" },
  { subject: "英文", minutes: 30, detail: "單字 + 閱讀練習", done: true, color: "jade" },
  { subject: "自然", minutes: 30, detail: "化學基礎・酸鹼與鹽", done: false, color: "violet" },
];

export default function Home() {
  const [tasks, setTasks] = useState(initialTasks);
  const [started, setStarted] = useState(false);
  const completed = tasks.filter((task) => task.done).length;
  const energy = 62 + completed * 10;
  const planks = 10 + completed;
  const progress = Math.round((completed / tasks.length) * 100);
  const remaining = useMemo(() => tasks.filter((task) => !task.done).reduce((sum, task) => sum + task.minutes, 0), [tasks]);

  function toggleTask(index: number) {
    setTasks((current) => current.map((task, i) => i === index ? { ...task, done: !task.done } : task));
  }

  return (
    <main>
      <section className="app-shell">
        <header className="topbar">
          <div className="brand"><span className="brand-mark">✦</span><span>文昌同行</span></div>
          <button className="avatar" aria-label="開啟個人設定">林</button>
        </header>

        <section className="hero">
          <p className="eyebrow">30 日學習挑戰</p>
          <h1>今天的每一步，<br /><em>都算數。</em></h1>
          <div className="countdown"><span>距離國中會考</span><strong>29</strong><span>天</span></div>
          <div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
        </section>

        <section className="stats" aria-label="今日學習狀態">
          <div className="stat"><span className="stat-icon fire">♨</span><div><small>今日能量</small><b>{energy}<i> / 100</i></b></div></div>
          <div className="stat"><span className="stat-icon blossom">✿</span><div><small>祈福木牌</small><b>{planks}<i> 枚</i></b></div></div>
        </section>

        <section className="progress-card">
          <div className="section-heading"><div><p className="eyebrow">DAY 29</p><h2>今日任務</h2></div><span className="completion">{completed} / {tasks.length} 完成</span></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>

          <div className="tasks">
            {tasks.map((task, index) => (
              <button className={`task ${task.done ? "done" : ""}`} onClick={() => toggleTask(index)} key={task.subject} aria-pressed={task.done}>
                <span className={`check ${task.done ? "checked" : ""}`}>{task.done ? "✓" : ""}</span>
                <span className={`subject-dot ${task.color}`} />
                <span className="task-copy"><b>{task.subject}</b><small>{task.detail}</small></span>
                <span className="minutes">{task.minutes}<small>分</small></span>
              </button>
            ))}
          </div>
          <div className="reward"><span>✿</span><p>完成今天全部任務，即可再獲得 <b>1 枚祈福木牌</b></p></div>
        </section>

        <section className="encouragement">
          <span>「</span><p>{completed === tasks.length ? "今日圓滿完成。你的堅持，正在為未來開路。" : "不用一次做到完美，持續前進就是最好的答案。"}</p><span>」</span>
        </section>

        <button className="start-button" onClick={() => setStarted(!started)}>
          <span>{started ? "✓" : "▶"}</span>{started ? "正在進行今日挑戰" : remaining ? `開始學習 · ${remaining} 分鐘` : "今日任務已全數完成"}
        </button>
        <nav><button className="active">⌂<span>今日</span></button><button>▥<span>進度</span></button><button>✿<span>祈福</span></button><button>◌<span>我的</span></button></nav>
      </section>
    </main>
  );
}
