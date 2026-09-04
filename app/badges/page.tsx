"use client";

import { useEffect, useMemo, useState } from "react";

type AchievementStats = { focusSessionsCompleted?: number; weaknessesConquered?: number };
type SavedPlan = { dailyCheckInDates?: string[]; dailyFortuneTask?: { date?: string; done?: boolean; achievementStats?: AchievementStats } };

const taipeiDate = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(date);
const addTaipeiDays = (date: string, days: number) => {
	const next = new Date(`${date}T00:00:00.000Z`);
	next.setUTCDate(next.getUTCDate() + days);
	return next.toISOString().slice(0, 10);
};
const checkInStreak = (dates: string[]) => {
	const completed = new Set(dates);
	let cursor = taipeiDate();
	let days = 0;
	while (completed.has(cursor)) { days += 1; cursor = addTaipeiDays(cursor, -1); }
	return days;
};

const catalog = [
	{ id: "focus-1", icon: "一", title: "初定心", poem: "一段專注，心便有了方向", metric: "focus" as const, target: 1, tone: "gold" },
	{ id: "focus-10", icon: "十", title: "十次凝神", poem: "十次守住，便能積成底氣", metric: "focus" as const, target: 10, tone: "jade" },
	{ id: "focus-30", icon: "三十", title: "靜讀三十", poem: "三十次回到書桌，功夫自現", metric: "focus" as const, target: 30, tone: "indigo" },
	{ id: "checkin-3", icon: "初", title: "三日晨課", poem: "三日不輟，學習開始生根", metric: "checkin" as const, target: 3, tone: "gold" },
	{ id: "checkin-7", icon: "七", title: "七日守志", poem: "七日守志，讓習慣替你前進", metric: "checkin" as const, target: 7, tone: "vermilion" },
	{ id: "checkin-14", icon: "半", title: "半月精進", poem: "半月相伴，努力成為日常", metric: "checkin" as const, target: 14, tone: "jade" },
	{ id: "weak-1", icon: "破", title: "破題開悟", poem: "看懂一次錯因，就是一次跨越", metric: "weakness" as const, target: 1, tone: "vermilion" },
	{ id: "weak-5", icon: "五", title: "五關皆過", poem: "五處弱點，已練成新的長處", metric: "weakness" as const, target: 5, tone: "indigo" },
] as const;

export default function BadgesPage() {
	const [plan, setPlan] = useState<SavedPlan>({});
	useEffect(() => {
		try { setPlan(JSON.parse(localStorage.getItem("wenchang-mvp") ?? "{}")); }
		catch { setPlan({}); }
	}, []);
	const progress = useMemo(() => {
		const dates = new Set(plan.dailyCheckInDates ?? []);
		if (plan.dailyFortuneTask?.done && plan.dailyFortuneTask.date === taipeiDate()) dates.add(taipeiDate());
		return { focus: plan.dailyFortuneTask?.achievementStats?.focusSessionsCompleted ?? 0, checkin: checkInStreak([...dates]), weakness: plan.dailyFortuneTask?.achievementStats?.weaknessesConquered ?? 0 };
	}, [plan]);
	const achievements = catalog.map((achievement) => ({ ...achievement, value: progress[achievement.metric], unlocked: progress[achievement.metric] >= achievement.target }));
	const unlocked = achievements.filter((achievement) => achievement.unlocked).length;
	const next = achievements.find((achievement) => !achievement.unlocked);
	const unit = (metric: "focus" | "checkin" | "weakness") => metric === "focus" ? "次完整專注" : metric === "checkin" ? "天連續簽到" : "題已克服弱點";
	return <main className="feature-page badge-page"><div className="feature-shell badge-shell">
		<button className="back-link" onClick={() => location.href = "/progress"}>← 返回進度</button>
		<section className="badge-hero"><p className="feature-kicker">WENCHANG TRUE ACHIEVEMENTS</p><span className="badge-hero-seal" aria-hidden="true">成就</span><h1>真實成就牆</h1><p>只有完整專注、連續簽到與真正克服回流錯題，才會點亮這裡。</p></section>
		<section className="achievement-summary" aria-label="成就總覽"><div><span>已解鎖</span><b>{unlocked}<small> / {achievements.length}</small></b></div><p>{next ? `下一枚：${next.title}・再完成 ${Math.max(0, next.target - next.value)} ${unit(next.metric)}` : "八枚成就已全數點亮，繼續留下你的學習足跡。"}</p><div className="badge-progress-track"><i style={{ width: `${(unlocked / achievements.length) * 100}%` }} /></div></section>
		<section className="achievement-metrics" aria-label="真實累積數據"><div><span>完整專注</span><b>{progress.focus}<small> 次</small></b></div><div><span>連續簽到</span><b>{progress.checkin}<small> 天</small></b></div><div><span>已克服弱點</span><b>{progress.weakness}<small> 題</small></b></div></section>
		<section className="badge-gallery achievement-gallery" aria-label="真實成就列表">{achievements.map((achievement) => <article className={`learning-medal ${achievement.tone} ${achievement.unlocked ? "is-unlocked" : "is-locked"}`} key={achievement.id}><div className="medal-ribbon"><i /><i /></div><div className="medal-face"><span>{achievement.unlocked ? achievement.icon : "✧"}</span></div><div className="medal-copy"><b>{achievement.title}</b><em>{achievement.poem}</em><small>{achievement.unlocked ? "已由真實學習紀錄解鎖" : `${achievement.value}/${achievement.target} ${unit(achievement.metric)}`}</small></div></article>)}</section>
		<section className="badge-ritual-note"><span>⛩</span><p>成就不是按下確認就能得到。每一枚都來自實際完成的專注計時、連續簽到與兩輪回流後答對的弱點題。</p></section>
	</div></main>;
}
