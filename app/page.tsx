"use client";

import { useEffect, useMemo, useState } from "react";
import liff from "@line/liff";

type Task = {
  subject: string;
  minutes: number;
  detail: string;
  done: boolean;
  color: string;
};
type LearningDay = { date: string; minutes: number };
type Tab = "today" | "progress" | "prayer" | "profile";
type FocusSession = {
  taskIndex: number;
  remainingSeconds: number;
  endsAt: number | null;
  paused: boolean;
  ended: boolean;
};
type SavedPlan = {
  tasks?: Task[];
  challengeName?: string;
  examDate?: string;
  goal?: string;
  hours?: number;
  weak?: string;
  templeVisits?: string[];
  wishes?: string[];
  focusSession?: FocusSession;
  remindersEnabled?: boolean;
  morningTime?: string;
  eveningTime?: string;
};
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2011050459-8bPHPFCw";
const defaultTasks: Task[] = [
  {
    subject: "數學",
    minutes: 45,
    detail: "弱點複習與錯題整理",
    done: false,
    color: "amber",
  },
  {
    subject: "英文",
    minutes: 30,
    detail: "單字＋閱讀練習",
    done: false,
    color: "jade",
  },
  {
    subject: "自然",
    minutes: 30,
    detail: "觀念複習與題型演練",
    done: false,
    color: "violet",
  },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("today");
  const [tasks, setTasks] = useState<Task[]>(defaultTasks);
  const [name, setName] = useState("30 日學習挑戰");
  const [examDate, setExamDate] = useState("2026-10-31");
  const [goal, setGoal] = useState("穩定完成每日學習任務");
  const [hours, setHours] = useState(2);
  const [weak, setWeak] = useState("數學");
  const [visits, setVisits] = useState<string[]>([]);
  const [wishes, setWishes] = useState<string[]>([]);
  const [wish, setWish] = useState("");
  const [idToken, setIdToken] = useState<string | null>(null);
  const [lineName, setLineName] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [learningDays, setLearningDays] = useState<LearningDay[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [morningTime, setMorningTime] = useState("08:00");
  const [eveningTime, setEveningTime] = useState("20:30");
  const [editingNotifications, setEditingNotifications] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [draftRemindersEnabled, setDraftRemindersEnabled] = useState(true);
  const [draftMorningTime, setDraftMorningTime] = useState("08:00");
  const [draftEveningTime, setDraftEveningTime] = useState("20:30");
  const [showSettlement, setShowSettlement] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [focusEndsAt, setFocusEndsAt] = useState<number | null>(null);
  const [focusPaused, setFocusPaused] = useState(false);
  const [focusEnded, setFocusEnded] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("wenchang-mvp");
    if (stored)
      try {
        const data = JSON.parse(stored) as SavedPlan;
        if (data.tasks?.length) setTasks(data.tasks);
        if (data.challengeName) setName(data.challengeName);
        if (data.examDate) setExamDate(data.examDate);
        if (data.goal) setGoal(data.goal);
        if (data.hours) setHours(data.hours);
        if (data.weak) setWeak(data.weak);
        if (data.templeVisits) setVisits(data.templeVisits);
        if (data.wishes) setWishes(data.wishes);
        if (typeof data.remindersEnabled === "boolean")
          setRemindersEnabled(data.remindersEnabled);
        if (data.morningTime) setMorningTime(data.morningTime);
        if (data.eveningTime) setEveningTime(data.eveningTime);
        const session = data.focusSession;
        if (session && session.taskIndex >= 0) {
          const remaining =
            session.paused || !session.endsAt
              ? session.remainingSeconds
              : Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000));
          setFocusIndex(session.taskIndex);
          setFocusSeconds(remaining);
          setFocusPaused(session.paused);
          setFocusEndsAt(session.paused ? null : session.endsAt);
          setFocusEnded(session.ended || remaining === 0);
        }
      } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const focusSession =
      focusIndex === null
        ? undefined
        : {
            taskIndex: focusIndex,
            remainingSeconds: focusSeconds,
            endsAt: focusEndsAt,
            paused: focusPaused,
            ended: focusEnded,
          };
    localStorage.setItem(
      "wenchang-mvp",
      JSON.stringify({
        tasks,
        challengeName: name,
        examDate,
        goal,
        hours,
        weak,
        templeVisits: visits,
        wishes,
        focusSession,
        remindersEnabled,
        morningTime,
        eveningTime,
      }),
    );
  }, [
    tasks,
    name,
    examDate,
    goal,
    hours,
    weak,
    visits,
    wishes,
    ready,
    focusIndex,
    focusSeconds,
    focusEndsAt,
    focusPaused,
    focusEnded,
    remindersEnabled,
    morningTime,
    eveningTime,
  ]);
  useEffect(() => {
    liff
      .init({ liffId: LIFF_ID })
      .then(() => {
        if (liff.isLoggedIn()) {
          const token = liff.getIDToken();
          if (token) setIdToken(token);
          setLineName(liff.getDecodedIDToken()?.name ?? null);
        }
      })
      .catch(() => setSyncStatus("LINE 服務暫時無法使用"));
  }, []);
  useEffect(() => {
    if (!ready) return;
    const key = new Date().toISOString().slice(0, 10);
    if (
      new Date().getHours() >= 20 &&
      localStorage.getItem("wenchang-settlement-dismissed") !== key
    )
      setShowSettlement(true);
  }, [ready]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);
  useEffect(() => {
    if (focusIndex === null || focusPaused || focusEnded || !focusEndsAt)
      return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((focusEndsAt - Date.now()) / 1000),
      );
      setFocusSeconds(remaining);
      if (remaining === 0) {
        setFocusEnded(true);
        setFocusEndsAt(null);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [focusIndex, focusPaused, focusEnded, focusEndsAt]);
  const sync = async (nextTasks: Task[]) => {
    if (!idToken) return;
    setSyncStatus("同步中…");
    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idToken,
          tasks: nextTasks,
          hours,
          weak,
          goal,
          challengeName: name,
          examDate,
        }),
      });
      setSyncStatus(
        response.ok ? "已同步至雲端學習紀錄" : "同步未完成，資料保留在此裝置",
      );
    } catch {
      setSyncStatus("同步未完成，資料保留在此裝置");
    }
  };
  useEffect(() => {
    if (!idToken) return;
    fetch("/api/progress/load", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (!data.exists) return;
        if (data.tasks?.length) setTasks(data.tasks);
        if (data.plan) {
          setExamDate(data.plan.examDate);
          setHours(data.plan.hours);
          setWeak(data.plan.weak);
          setGoal(data.plan.goal ?? goal);
        }
        if (Array.isArray(data.visits)) setVisits(data.visits);
        setSyncStatus("已從雲端還原學習紀錄");
      })
      .catch(() => setSyncStatus("雲端紀錄暫時無法讀取"));
  }, [idToken]);
  useEffect(() => {
    if (!idToken) return;
    fetch("/api/stats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        setWeeklyMinutes(data.weeklyMinutes ?? 0);
        setStreakDays(data.streakDays ?? 0);
        setLearningDays(Array.isArray(data.days) ? data.days : []);
      })
      .catch(() => undefined);
  }, [idToken, tasks]);
  useEffect(() => {
    if (!idToken) return;
    fetch("/api/preferences", { headers: { "x-line-id-token": idToken } })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        setRemindersEnabled(data.enabled ?? true);
        setMorningTime(data.morningTime ?? "08:00");
        setEveningTime(data.eveningTime ?? "20:30");
        setDraftRemindersEnabled(data.enabled ?? true);
        setDraftMorningTime(data.morningTime ?? "08:00");
        setDraftEveningTime(data.eveningTime ?? "20:30");
      })
      .catch(() => undefined);
  }, [idToken]);
  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(`${examDate}T00:00:00`).getTime() - Date.now()) / 86400000,
    ),
  );
  const examModeActive = daysLeft <= 7;
  const completed = tasks.filter((t) => t.done).length;
  const progress = Math.round((completed / tasks.length) * 100);
  const energy = Math.min(100, 42 + completed * 10 + visits.length * 3);
  const planks = 10 + completed + visits.length;
  const remaining = useMemo(
    () => tasks.filter((t) => !t.done).reduce((sum, t) => sum + t.minutes, 0),
    [tasks],
  );
  const pendingIndex = tasks.findIndex((task) => !task.done);
  useEffect(() => {
    if (!ready || !examModeActive) return;
    const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
    const modeKey = `wenchang-exam-mode-${examDate}-${todayKey}`;
    if (localStorage.getItem(modeKey)) return;
    setTasks((current) => {
      const next = current.map((task) => {
        const factor = task.subject === weak ? 0.8 : 0.6;
        const minutes = Math.max(15, Math.round((task.minutes * factor) / 5) * 5);
        return { ...task, minutes, detail: task.subject === weak ? "考前弱科重點複習" : "考前重點整理・保留體力" };
      });
      localStorage.setItem(modeKey, "applied");
      void sync(next);
      return next;
    });
  }, [ready, examModeActive, examDate, weak]);
  const toggleTask = (index: number) =>
    setTasks((current) => {
      const next = current.map((task, i) =>
        i === index ? { ...task, done: !task.done } : task,
      );
      void sync(next);
      return next;
    });
  const startFocus = () => {
    if (pendingIndex < 0) return;
    const seconds = tasks[pendingIndex].minutes * 60;
    setFocusIndex(pendingIndex);
    setFocusSeconds(seconds);
    setFocusEndsAt(Date.now() + seconds * 1000);
    setFocusPaused(false);
    setFocusEnded(false);
  };
  const pauseFocus = () => {
    if (!focusEndsAt) return;
    setFocusSeconds(Math.max(0, Math.ceil((focusEndsAt - Date.now()) / 1000)));
    setFocusEndsAt(null);
    setFocusPaused(true);
  };
  const resumeFocus = () => {
    setFocusEndsAt(Date.now() + focusSeconds * 1000);
    setFocusPaused(false);
  };
  const closeFocus = () => {
    setFocusIndex(null);
    setFocusSeconds(0);
    setFocusEndsAt(null);
    setFocusPaused(false);
    setFocusEnded(false);
  };
  const completeFocus = () => {
    if (focusIndex === null) return;
    setTasks((current) => {
      const next = current.map((task, index) =>
        index === focusIndex ? { ...task, done: true } : task,
      );
      void sync(next);
      return next;
    });
    closeFocus();
    setSyncStatus("專注完成，任務已同步更新！");
  };
  const login = async () => {
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }
    const token = liff.getIDToken();
    if (token) {
      setIdToken(token);
      setLineName(liff.getDecodedIDToken()?.name ?? null);
      void sync(tasks);
    }
  };
  const reminder = async () => {
    if (!idToken) {
      await login();
      return;
    }
    setSyncStatus("正在傳送提醒…");
    try {
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken, kind: "morning" }),
      });
      setSyncStatus(
        response.ok
          ? "已傳送 LINE OA 測試提醒"
          : "提醒傳送失敗，請確認已加官方帳號好友",
      );
    } catch {
      setSyncStatus("提醒傳送失敗，請稍後再試");
    }
  };
  const saveWish = () => {
    const text = wish.trim();
    if (!text) return;
    setWishes((current) => [text, ...current].slice(0, 5));
    setWish("");
  };
  const focusTime = `${String(Math.floor(focusSeconds / 60)).padStart(2, "0")}:${String(focusSeconds % 60).padStart(2, "0")}`;
  const today = (
    <>
      <section className="hero">
        <p className="eyebrow">{name.toUpperCase()}</p>
        <h1>
          距離目標還有
          <br />
          <em>{daysLeft} 天</em>
        </h1>
        <div className="countdown">
          <span>每天 {hours} 小時・先完成今天</span>
        </div>
        {examModeActive && (
          <section className="exam-mode-card">
            <div className="exam-mode-heading"><span>✦</span><div><small>EXAM MODE</small><b>考前衝刺模式・剩 {daysLeft} 天</b></div></div>
            <p>今天已自動降低任務量，優先保留 <strong>{weak}</strong> 的重點複習；穩定完成，也要保留睡眠。</p>
            <div className="exam-mode-footer"><span>🌙 今晚 22:30 前準備休息</span><button onClick={() => setSyncStatus("睡眠提醒：今晚 22:30 前結束複習，讓大腦好好休息。")} >查看提醒</button></div>
          </section>
        )}
        <div className="hero-orb orb-one" />
        <div className="hero-orb orb-two" />
      </section>
      <section className="stats">
        <div className="stat">
          <span className="stat-icon fire">🔥</span>
          <div>
            <small>今日能量</small>
            <b>
              {energy}
              <i> / 100</i>
            </b>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon blossom">🌸</span>
          <div>
            <small>祈福木牌</small>
            <b>
              {planks}
              <i> 枚</i>
            </b>
          </div>
        </div>
      </section>
      <section className="progress-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">今日任務・弱科 {weak}</p>
            <h2>一步一步完成</h2>
          </div>
          <span className="completion">
            {completed} / {tasks.length} 完成
          </span>
        </div>
        <div className="progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="tasks">
          {tasks.map((task, index) => (
            <button
              className={`task ${task.done ? "done" : ""}`}
              onClick={() => toggleTask(index)}
              key={`${task.subject}-${index}`}
              aria-pressed={task.done}
            >
              <span className={`check ${task.done ? "checked" : ""}`}>
                {task.done ? "✓" : ""}
              </span>
              <span className={`subject-dot ${task.color}`} />
              <span className="task-copy">
                <b>{task.subject}</b>
                <small>{task.detail}</small>
              </span>
              <span className="minutes">
                {task.minutes}
                <small>分</small>
              </span>
            </button>
          ))}
        </div>
      </section>
      {focusIndex !== null ? (
        <section className="focus-panel">
          <small>
            {focusEnded
              ? "時間到了・確認你的專注成果"
              : focusPaused
                ? "已暫停・可隨時繼續"
                : `正在專注・${tasks[focusIndex].subject}`}
          </small>
          <b>{focusTime}</b>
          <p>
            {focusEnded
              ? "你完成這段專注了嗎？確認後才會標記任務完成。"
              : "離開或重新整理後會依實際時間繼續倒數。"}
          </p>
          {focusEnded ? (
            <div className="focus-actions">
              <button onClick={completeFocus}>確認完成</button>
              <button
                onClick={() => {
                  setFocusSeconds(300);
                  setFocusEndsAt(Date.now() + 300000);
                  setFocusPaused(false);
                  setFocusEnded(false);
                }}
              >
                再加 5 分鐘
              </button>
            </div>
          ) : (
            <div className="focus-actions">
              <button onClick={focusPaused ? resumeFocus : pauseFocus}>
                {focusPaused ? "繼續專注" : "暫停"}
              </button>
              <button
                onClick={() => {
                  if (window.confirm("確定要提前完成並標記任務嗎？"))
                    completeFocus();
                }}
              >
                提前完成
              </button>
            </div>
          )}
        </section>
      ) : pendingIndex >= 0 ? (
        <button className="start-button" onClick={startFocus}>
          開始專注・{tasks[pendingIndex].subject} {tasks[pendingIndex].minutes}{" "}
          分鐘
        </button>
      ) : (
        <section className="focus-panel complete">
          <b>今日全數完成 ✦</b>
          <p>你已累積能量與祈福木牌，明天繼續前進。</p>
        </section>
      )}
      <section className="encouragement">
        <span>「</span>
        <p>
          {completed === tasks.length
            ? "今天的努力已經完成，請帶著安心休息。"
            : `你的目標是：${goal}`}
        </p>
        <span>」</span>
      </section>
      {syncStatus && <p className="reminder-status">{syncStatus}</p>}
    </>
  );
  const todayMinutes = tasks
    .filter((task) => task.done)
    .reduce((sum, task) => sum + task.minutes, 0);
  const calendarData = useMemo(() => {
    const records = new Map(learningDays.map((day) => [day.date, day.minutes]));
    const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
    if (todayMinutes) records.set(todayKey, todayMinutes);
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => {
      if (index < firstWeekday) return null;
      const day = index - firstWeekday + 1;
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { day, date, minutes: records.get(date) ?? 0, isToday: date === todayKey, isFuture: date > todayKey };
    });
    return { cells, monthLabel: new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long" }).format(calendarMonth), activeDays: [...records.keys()].filter((date) => date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).length };
  }, [calendarMonth, learningDays, todayMinutes]);
  const progressView = (
    <section className="journey">
      <p className="eyebrow">動態目標進度</p>
      <h1>
        {name}
        <br />
        <em>倒數 {daysLeft} 天</em>
      </h1>
      <div className="journey-summary">
        <div>
          <b>{progress}%</b>
          <span>今日完成度</span>
        </div>
        <div>
          <b>{completed}</b>
          <span>完成任務</span>
        </div>
        <div>
          <b>{remaining}</b>
          <span>剩餘分鐘</span>
        </div>
      </div>
      <div className="milestone-card">
        <p>你的下一個里程碑</p>
        <b>
          {completed === tasks.length
            ? "完成今日任務，明天繼續"
            : `先完成 ${tasks[pendingIndex]?.subject ?? "今日任務"}`}
        </b>
        <span>小步累積，會比一次衝刺走得更遠。</span>
      </div>
      <section className="learning-calendar" aria-label="行事曆式學習進度">
        <div className="calendar-header">
          <div>
            <p>學習行事曆</p>
            <b>{calendarData.monthLabel}</b>
          </div>
          <div className="calendar-controls">
            <button aria-label="上個月" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button>
            <button className="calendar-today" onClick={() => setCalendarMonth(new Date())}>本月</button>
            <button aria-label="下個月" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button>
          </div>
        </div>
        <div className="calendar-legend"><span><i className="legend-done" />完成學習</span><span><i className="legend-today" />今天</span><b>{calendarData.activeDays} 天已累積</b></div>
        <div className="calendar-weekdays">{["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{calendarData.cells.map((cell, index) => cell ? <div key={cell.date} className={`calendar-day ${cell.minutes ? "has-learning" : ""} ${cell.isToday ? "is-today" : ""} ${cell.isFuture ? "is-future" : ""}`}><b>{cell.day}</b>{cell.minutes ? <small>{cell.minutes} 分</small> : <i>{cell.isToday ? "今天" : ""}</i>}</div> : <span key={`blank-${index}`} aria-hidden="true" />)}</div>
        <p className="calendar-note">有色日期代表已完成學習；點亮每一天，讓努力留下足跡。</p>
      </section>
      <div className="empty-panel">
        <b>需要調整計畫嗎？</b>
        <p>
          考試日期、每日時間、弱科與目標都可以隨時重新設定，今天的任務會重新建立。
        </p>
        <button
          className="start-button"
          onClick={() => {
            location.href = "/goal";
          }}
        >
          調整我的學習目標
        </button>
      </div>
    </section>
  );
  const shareResult = async () => {
    const text = `⛩ 文昌同行｜${name}\n今天完成 ${completed}/${tasks.length} 項任務，累積專注 ${tasks.filter((task) => task.done).reduce((sum, task) => sum + task.minutes, 0)} 分鐘。\n🔥 能量 ${energy}/100　🌸 祈福木牌 ${planks} 枚\n${goal}\n${location.origin}`;
    try {
      if (navigator.share)
        await navigator.share({ title: "我的文昌同行成果", text });
      else {
        await navigator.clipboard.writeText(text);
        setSyncStatus("成果文字已複製，可貼到 LINE 分享");
      }
    } catch {}
  };
  const quickActions = (
    <section className="quick-actions">
      <div className="quick-title">
        <b>常用功能</b>
        <span>從這裡快速開始</span>
      </div>
      <div className="quick-grid">
        <button
          onClick={() => {
            location.href = "/goal";
          }}
        >
          <span className="quick-icon goal">◎</span>
          <b>調整目標</b>
          <small>日期・弱科・時間</small>
        </button>
        <button
          onClick={() => {
            if (pendingIndex >= 0) startFocus();
          }}
        >
          <span className="quick-icon focus">◷</span>
          <b>開始專注</b>
          <small>
            {pendingIndex >= 0
              ? `${tasks[pendingIndex].minutes} 分鐘任務`
              : "今日已完成"}
          </small>
        </button>
        <button
          onClick={() => {
            location.href = "/prayer-wall";
          }}
        >
          <span className="quick-icon wall">✦</span>
          <b>匿名祈福牆</b>
          <small>留下今日祈願</small>
        </button>
        <button
          onClick={() => {
            location.href = "/pilgrimage";
          }}
        >
          <span className="quick-icon temple">⛩</span>
          <b>文昌巡禮</b>
          <small>{visits.length} 枚文化徽章</small>
        </button>
      </div>
    </section>
  );
  const learningBadges = [
    {
      icon: "✦",
      title: "啟程之星",
      detail: "完成第一項任務",
      unlocked: completed >= 1,
    },
    {
      icon: "🔥",
      title: "三日專注",
      detail: "連續學習 3 天",
      unlocked: streakDays >= 3,
    },
    {
      icon: "◷",
      title: "專注達人",
      detail: "本週完成 300 分鐘",
      unlocked: weeklyMinutes >= 300,
    },
    {
      icon: "✓",
      title: "今日圓滿",
      detail: "完成今日所有任務",
      unlocked: completed === tasks.length && tasks.length > 0,
    },
    {
      icon: "⛩",
      title: "文昌巡禮",
      detail: "解鎖第一枚文化徽章",
      unlocked: visits.length >= 1,
    },
  ];
  const closeSettlement = () => {
    localStorage.setItem(
      "wenchang-settlement-dismissed",
      new Date().toISOString().slice(0, 10),
    );
    setShowSettlement(false);
  };
  const retentionCard = (
    <>
      <section className="retention-card">
        <div>
          <span>本週完成</span>
          <b>
            {weeklyMinutes}
            <small> 分鐘</small>
          </b>
          <p>把每一次專注，累積成看得見的進步。</p>
        </div>
        <div className="streak-mark">
          <span>🔥</span>
          <b>
            {streakDays}
            <small> 天</small>
          </b>
          <p>連續學習</p>
        </div>
      </section>
      <button
        className="settlement-teaser"
        onClick={() => setShowSettlement(true)}
      >
        <span>🌙</span>
        <div>
          <b>查看今日結算</b>
          <small>
            完成 {completed}/{tasks.length} 項任務・專注 {todayMinutes} 分鐘
          </small>
        </div>
        <i>›</i>
      </button>
      <section className="learning-badges">
        <div className="badge-heading">
          <div>
            <b>我的學習徽章</b>
            <small>
              {learningBadges.filter((badge) => badge.unlocked).length} /{" "}
              {learningBadges.length} 已解鎖
            </small>
          </div>
          <span>🏅</span>
        </div>
        <div className="badge-grid">
          {learningBadges.map((badge) => (
            <div
              key={badge.title}
              className={badge.unlocked ? "unlocked" : "locked"}
            >
              <i>{badge.icon}</i>
              <b>{badge.title}</b>
              <small>{badge.detail}</small>
            </div>
          ))}
        </div>
      </section>
      {showSettlement && (
        <div className="settlement-backdrop" role="dialog" aria-modal="true">
          <section className="settlement-modal">
            <button className="settlement-close" onClick={closeSettlement}>
              ×
            </button>
            <span>🌙 今日結算</span>
            <h2>
              你今天完成了
              <br />
              <em>{todayMinutes} 分鐘的專注</em>
            </h2>
            <div className="settlement-stats">
              <div>
                <b>
                  {completed}
                  <small> / {tasks.length}</small>
                </b>
                <span>完成任務</span>
              </div>
              <div>
                <b>{energy}</b>
                <span>今日能量</span>
              </div>
              <div>
                <b>{planks}</b>
                <span>祈福木牌</span>
              </div>
            </div>
            <p>
              {completed === tasks.length && tasks.length > 0
                ? "今日計畫圓滿完成。這份持續，就是通往目標最踏實的力量。"
                : "不必把每一天做到完美；今天投入的每一分鐘，都已經算數。"}
            </p>
            <button className="settlement-share" onClick={shareResult}>
              分享今日成果 ↗
            </button>
            <button className="settlement-done" onClick={closeSettlement}>
              收下今日的鼓勵
            </button>
          </section>
        </div>
      )}
    </>
  );
  const shareCard = (
    <section className="share-card">
      <div className="share-card-top">
        <span>⛩ 文昌同行</span>
        <small>今日學習成果</small>
      </div>
      <h2>{name}</h2>
      <p>完成每一小步，都是向目標靠近。</p>
      <div className="share-metrics">
        <div>
          <b>
            {completed}
            <small> / {tasks.length}</small>
          </b>
          <span>完成任務</span>
        </div>
        <div>
          <b>
            {tasks
              .filter((task) => task.done)
              .reduce((sum, task) => sum + task.minutes, 0)}
            <small> 分</small>
          </b>
          <span>專注時間</span>
        </div>
        <div>
          <b>
            {streakDays}
            <small> 天</small>
          </b>
          <span>連續學習</span>
        </div>
      </div>
      <button onClick={shareResult}>
        分享我的成果 <span>↗</span>
      </button>
    </section>
  );
  const prayerMessage =
    progress >= 100
      ? "今日圓滿。把完成感留給自己，帶著安定迎接明天。"
      : progress >= 50
        ? "你正在前進，不必完美，持續就是最好的祈願。"
        : "先從眼前的一小步開始，專注會慢慢累積成力量。";
  const prayerView = (
    <section className="journey">
      <p className="eyebrow">智慧宮廟・祈福同行</p>
      <h1>
        為努力祈願
        <br />
        <em>也為自己留下一句話。</em>
      </h1>
      <section className="blessing-card">
        <span>今日文昌箴言</span>
        <b>積跬步以至千里</b>
        <p>{prayerMessage}</p>
        <small>依今日完成度 {progress}% 生成的鼓勵內容</small>
      </section>
      <section className="wish-card">
        <b>寫下你的祈願</b>
        <p>它會保留在此裝置，也可發佈到匿名祈福牆。</p>
        <div>
          <input
            value={wish}
            onChange={(event) => setWish(event.target.value)}
            placeholder="例如：希望今天能專心完成數學"
            maxLength={40}
          />
          <button onClick={saveWish}>留存</button>
        </div>
        {wishes.length > 0 && (
          <ul>
            {wishes.map((item, index) => (
              <li key={`${item}-${index}`}>✦ {item}</li>
            ))}
          </ul>
        )}
        <button
          className="wall-link"
          onClick={() => {
            location.href = "/prayer-wall";
          }}
        >
          <span>✦</span>
          <div>
            <b>探索匿名祈福牆</b>
            <small>匿名留下祝福，看看大家的心願</small>
          </div>
          <i>›</i>
        </button>
      </section>
      <div className="empty-panel">
        <b>🌸 祈福木牌 × {planks}</b>
        <p>
          目前已解鎖 {visits.length} 個巡禮徽章。到合作宮廟掃描 QR
          Code，收藏文化故事與專屬徽章。
        </p>
        <button
          className="start-button"
          onClick={() => {
            location.href = "/pilgrimage";
          }}
        >
          開始文昌巡禮
        </button>
      </div>
    </section>
  );
  const formatReminderTime = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    return `${hour >= 12 ? "下午" : "上午"} ${String(hour % 12 || 12).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };
  const beginEditNotifications = () => {
    setDraftRemindersEnabled(remindersEnabled);
    setDraftMorningTime(morningTime);
    setDraftEveningTime(eveningTime);
    setEditingNotifications(true);
  };
  const saveNotifications = async () => {
    if (!idToken) {
      setSyncStatus("請先登入 LINE，才能儲存通知偏好");
      return;
    }
    setSavingNotifications(true);
    try {
      const response = await fetch("/api/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken, enabled: draftRemindersEnabled, morningTime: draftMorningTime, eveningTime: draftEveningTime }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "通知偏好暫時無法儲存，請稍後再試。");
      setRemindersEnabled(draftRemindersEnabled);
      setMorningTime(draftMorningTime);
      setEveningTime(draftEveningTime);
      setEditingNotifications(false);
      setSyncStatus("通知偏好已儲存至 LINE 帳號");
    } catch {
      setSyncStatus("通知偏好暫時無法儲存，請稍後再試");
    } finally {
      setSavingNotifications(false);
    }
  };
  const profileView = (
    <section className="journey profile-page">
      <p className="eyebrow">我的帳號與服務</p>
      <h1>
        {lineName ?? "學習夥伴"}
        <br />
        <em>管理你的學習服務</em>
      </h1>
      <section className="profile-identity">
        <span>{lineName?.slice(0, 1) ?? "我"}</span>
        <div>
          <b>{lineName ?? "尚未連結 LINE"}</b>
          <small>
            {lineName
              ? "LINE 身分已驗證・雲端資料可同步"
              : "連結 LINE 後可跨裝置保存紀錄"}
          </small>
        </div>
        <i className={lineName ? "online" : ""}>
          {lineName ? "已連結" : "未連結"}
        </i>
      </section>
      <div className="account-list">
        <div>
          <span>目前挑戰</span>
          <b>{name}</b>
        </div>
        <div>
          <span>目標日期</span>
          <b>{examDate}</b>
        </div>
        <div>
          <span>雲端同步</span>
          <b>{lineName ? "已啟用" : "尚未啟用"}</b>
        </div>
        <section className="notification-preference">
          <div className="notification-heading">
            <span>通知偏好</span>
            <div className="notification-status-actions">
              <b className="notification-sync-state">{lineName ? (remindersEnabled ? "已啟用" : "已關閉") : "尚未啟用"}</b>
              {!editingNotifications && <button onClick={lineName ? beginEditNotifications : login}>{lineName ? "修改" : "登入後設定"}</button>}
            </div>
          </div>
          {!lineName ? (
            <><p className="notification-login-notice">請先登入 LINE，才能儲存通知偏好</p><button className="notification-login" onClick={login}>登入 LINE 後設定早晚提醒 <span>›</span></button></>
          ) : editingNotifications ? (
            <>
              <label className="notification-toggle">
                <span>啟用 LINE 學習提醒</span>
                <input type="checkbox" checked={draftRemindersEnabled} onChange={(event) => setDraftRemindersEnabled(event.target.checked)} />
              </label>
              <div className="notification-times">
                <label>
                  <span>早晨提醒</span>
                  <input aria-label="早晨提醒時間" type="time" value={draftMorningTime} disabled={!draftRemindersEnabled} onChange={(event) => setDraftMorningTime(event.target.value)} />
                </label>
                <label>
                  <span>晚間提醒</span>
                  <input aria-label="晚間提醒時間" type="time" value={draftEveningTime} disabled={!draftRemindersEnabled} onChange={(event) => setDraftEveningTime(event.target.value)} />
                </label>
              </div>
              <div className="notification-actions"><button className="cancel" onClick={() => setEditingNotifications(false)}>取消</button><button className="save" onClick={saveNotifications} disabled={savingNotifications}>{savingNotifications ? "儲存中…" : "儲存設定"}</button></div>
            </>
          ) : (
            <div className="notification-summary">
              <div><span>早晨提醒</span><b>{formatReminderTime(morningTime)}</b></div>
              <div><span>晚間提醒</span><b>{formatReminderTime(eveningTime)}</b></div>
            </div>
          )}
          <small className="notification-timezone">台灣時間・設定會同步至你的 LINE 帳號</small>
          {lineName && <button className="notification-test" onClick={reminder} disabled={!remindersEnabled}>{remindersEnabled ? "傳送 LINE OA 測試提醒" : "請先啟用提醒後再測試"}<span>›</span></button>}
        </section>
      </div>
      <section className="service-section">
        <b>帳號服務</b>
        <button
          onClick={() => {
            location.href = "/coach";
          }}
        >
          <span>✦</span>
          <div>
            <strong>AI 學習軍師</strong>
            <small>依今天狀態取得可執行建議</small>
          </div>
          <em>›</em>
        </button>
        <button
          onClick={() => {
            location.href = "/goal";
          }}
        >
          <span>◎</span>
          <div>
            <strong>調整學習目標</strong>
            <small>修改日期、弱科與自訂任務</small>
          </div>
          <em>›</em>
        </button>
        <button
          onClick={
            lineName
              ? () => {
                  void sync(tasks);
                }
              : login
          }
        >
          <span>↻</span>
          <div>
            <strong>{lineName ? "立即同步學習紀錄" : "連結 LINE 帳號"}</strong>
            <small>
              {lineName
                ? "將目前任務與完成狀態存入雲端"
                : "跨裝置保存進度與巡禮徽章"}
            </small>
          </div>
          <em>›</em>
        </button>
      </section>
      <section className="privacy-card">
        <b>你的資料與隱私</b>
        <p>
          讀書計畫、完成紀錄與巡禮徽章會在 LINE
          登入後同步。個人祈願可留在裝置，公開祈福牆則可選匿名發佈。
        </p>
      </section>
      {lineName && (
        <button
          className="logout-button"
          onClick={() => {
            if (
              window.confirm("確定要登出 LINE 帳號嗎？本機計畫不會被刪除。")
            ) {
              liff.logout();
              location.reload();
            }
          }}
        >
          登出 LINE 帳號
        </button>
      )}
      {syncStatus && <small className="reminder-status">{syncStatus}</small>}
    </section>
  );
  return (
    <main>
      <section className="app-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">⛩</span>
            <span>文昌同行</span>
          </div>
          <div className="account">
            <button className="line-login" onClick={login}>
              {lineName ? `LINE・${lineName}` : "LINE 登入"}
            </button>
            <button className="avatar" onClick={() => setTab("profile")}>
              {lineName?.slice(0, 1) ?? "我"}
            </button>
          </div>
        </header>
        {tab === "today" ? (
          <>
            {quickActions}
            {today}
            {retentionCard}
          </>
        ) : tab === "progress" ? (
          <>
            {progressView}
            {retentionCard}
            {shareCard}
          </>
        ) : tab === "prayer" ? (
          prayerView
        ) : (
          profileView
        )}
        <nav>
          <button
            className={tab === "today" ? "active" : ""}
            onClick={() => setTab("today")}
          >
            ⌂<span>今日</span>
          </button>
          <button
            className={tab === "progress" ? "active" : ""}
            onClick={() => setTab("progress")}
          >
            ▥<span>進度</span>
          </button>
          <button
            className={tab === "prayer" ? "active" : ""}
            onClick={() => setTab("prayer")}
          >
            ✿<span>祈福</span>
          </button>
          <button
            className={tab === "profile" ? "active" : ""}
            onClick={() => setTab("profile")}
          >
            ◌<span>我的</span>
          </button>
        </nav>
      </section>
    </main>
  );
}
