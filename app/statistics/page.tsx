"use client";

import { useEffect, useMemo, useState } from "react";
import liff from "@line/liff";

type Task = { subject: string; minutes: number; detail: string; done: boolean };
type LearningDay = { date: string; minutes: number };
type LearningRecord = { date: string; minutes: number; tasks: Task[] };
type StoredPlan = { tasks?: Task[]; challengeName?: string; goal?: string };

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2011050459-8bPHPFCw";
const taipeiDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());

export default function StatisticsPage() {
	const [tasks, setTasks] = useState<Task[]>([]);
	const [name, setName] = useState("30 日學習挑戰");
	const [goal, setGoal] = useState("穩定完成每日學習任務");
	const [weeklyMinutes, setWeeklyMinutes] = useState(0);
	const [streakDays, setStreakDays] = useState(0);
	const [learningDays, setLearningDays] = useState<LearningDay[]>([]);
	const [learningRecords, setLearningRecords] = useState<LearningRecord[]>([]);
	const [calendarMonth, setCalendarMonth] = useState(() => new Date());
	const [selectedDate, setSelectedDate] = useState<string | null>(null);

	useEffect(() => {
		try {
			const stored = JSON.parse(localStorage.getItem("wenchang-mvp") ?? "{}") as StoredPlan;
			if (stored.tasks) setTasks(stored.tasks);
			if (stored.challengeName) setName(stored.challengeName);
			if (stored.goal) setGoal(stored.goal);
		} catch {}
		liff.init({ liffId: LIFF_ID }).then(async () => {
			if (!liff.isLoggedIn()) return;
			const idToken = liff.getIDToken();
			if (!idToken) return;
			const response = await fetch("/api/stats", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
			if (!response.ok) return;
			const data = await response.json();
			setWeeklyMinutes(data.weeklyMinutes ?? 0);
			setStreakDays(data.streakDays ?? 0);
			setLearningDays(Array.isArray(data.days) ? data.days : []);
			setLearningRecords(Array.isArray(data.records) ? data.records : []);
		}).catch(() => undefined);
	}, []);

	const today = taipeiDate();
	const doneTasks = tasks.filter((task) => task.done);
	const todayMinutes = doneTasks.reduce((sum, task) => sum + task.minutes, 0);
	const completed = doneTasks.length;
	const displayedWeeklyMinutes = Math.max(0, weeklyMinutes - (learningDays.find((day) => day.date === today)?.minutes ?? 0) + todayMinutes);
	const calendar = useMemo(() => {
		const recordMap = new Map(learningDays.map((day) => [day.date, day.minutes]));
		if (todayMinutes) recordMap.set(today, todayMinutes);
		const year = calendarMonth.getFullYear();
		const month = calendarMonth.getMonth();
		const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
		const count = new Date(year, month + 1, 0).getDate();
		return { monthLabel: new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long" }).format(calendarMonth), activeDays: [...recordMap.keys()].filter((date) => date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).length, cells: Array.from({ length: firstDay + count }, (_, index) => {
			if (index < firstDay) return null;
			const day = index - firstDay + 1;
			const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
			return { day, date, minutes: recordMap.get(date) ?? 0, isToday: date === today, isFuture: date > today };
		}) };
	}, [calendarMonth, learningDays, today, todayMinutes]);
	const selectedRecord = selectedDate === today ? { date: today, minutes: todayMinutes, tasks } : learningRecords.find((record) => record.date === selectedDate);
	const share = async () => {
		const text = `⛩ 文昌同行｜${name}\n本週累積專注 ${displayedWeeklyMinutes} 分鐘，連續學習 ${streakDays} 天。\n今天完成 ${completed}/${tasks.length} 項任務。\n${goal}`;
		try { if (navigator.share) await navigator.share({ title: "我的讀書統計", text }); else await navigator.clipboard.writeText(text); } catch {}
	};

	return <main className="statistics-main"><section className="feature-shell statistics-page">
		<header className="statistics-header"><button onClick={() => { location.href = "/"; }}>← 返回首頁</button><div><span>STUDY INSIGHTS</span><h1>讀書統計紀錄</h1><p>把每一次完成，變成看得見的前進。</p></div></header>
		<section className="statistics-hero"><div><span>本週專注</span><b>{displayedWeeklyMinutes}<small> 分鐘</small></b><p>{name}</p></div><div><span>連續學習</span><b>{streakDays}<small> 天</small></b><p>持續累積，就是最可靠的進步。</p></div><div><span>今日完成</span><b>{completed}<small> / {tasks.length} 項</small></b><p>已投入 {todayMinutes} 分鐘</p></div></section>
		<section className="learning-calendar statistics-calendar" aria-label="行事曆式學習紀錄"><div className="calendar-header"><div><p>學習行事曆</p><b>{calendar.monthLabel}</b></div><div className="calendar-controls"><button aria-label="上個月" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button><button className="calendar-today" onClick={() => setCalendarMonth(new Date())}>本月</button><button aria-label="下個月" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button></div></div><div className="calendar-legend"><span><i className="legend-done" />完成學習</span><span><i className="legend-today" />今天</span><b>{calendar.activeDays} 天已累積</b></div><div className="calendar-weekdays">{["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{calendar.cells.map((cell, index) => cell ? <button type="button" key={cell.date} className={`calendar-day ${cell.minutes ? "has-learning" : ""} ${cell.isToday ? "is-today" : ""} ${cell.isFuture ? "is-future" : ""}`} onClick={() => setSelectedDate(cell.date)}><b>{cell.day}</b>{cell.minutes ? <small>{cell.minutes} 分</small> : <i>{cell.isToday ? "今天" : ""}</i>}</button> : <span key={`blank-${index}`} />)}</div><p className="calendar-note">點選日期即可查看當天的任務完成紀錄。</p></section>
		<section className="statistics-actions"><button onClick={share}><span>↗</span><div><b>分享我的成果</b><small>把本週努力分享給朋友</small></div></button><button onClick={() => { location.href = "/badges"; }}><span>🏅</span><div><b>我的學習徽章</b><small>查看已解鎖的成就</small></div></button></section>
		{selectedDate && <div className="calendar-record-backdrop" role="presentation" onMouseDown={() => setSelectedDate(null)}><section className="calendar-record" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="calendar-record-heading"><span>當日學習紀錄</span><b>{selectedDate}</b><button className="calendar-record-close" onClick={() => setSelectedDate(null)} aria-label="關閉">×</button></div>{selectedRecord?.tasks.length ? <><div className="calendar-record-summary"><b>{selectedRecord.minutes} 分鐘</b><span>完成 {selectedRecord.tasks.filter((task) => task.done).length}/{selectedRecord.tasks.length} 項任務</span></div><ul>{selectedRecord.tasks.map((task, index) => <li key={`${task.subject}-${index}`} className={task.done ? "done" : "pending"}><i>{task.done ? "✓" : "○"}</i><div><b>{task.subject}</b><small>{task.detail}</small></div><span>{task.minutes} 分</span></li>)}</ul></> : <div className="calendar-record-empty"><span>◌</span><b>尚無學習紀錄</b><p>這一天尚未建立或同步學習紀錄。</p></div>}</section></div>}
	</section></main>;
}
