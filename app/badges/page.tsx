"use client";

import { useEffect, useMemo, useState } from "react";

type SavedTask = { minutes?: number; done?: boolean };
type SavedPlan = { tasks?: SavedTask[]; templeVisits?: string[] };

const catalog = [
	["first", "✦", "開卷啟明", "一頁開讀，心燈初燃", "完成第一項學習任務", "gold"],
	["focus", "香", "凝心定志", "一炷專注，萬念歸一", "累積完成 60 分鐘學習", "jade"],
	["day", "◎", "日課圓滿", "朝夕勤拂，功不唐捐", "完成今日全部任務", "vermilion"],
	["study", "文", "筆耕不輟", "字字耕耘，步步生光", "累積完成 180 分鐘學習", "indigo"],
	["five", "五", "積跬成里", "不積小流，無以成江", "完成 5 項學習任務", "gold"],
	["visit", "⛩", "文昌巡禮", "行至宮闕，願與學同行", "解鎖第一枚文化徽章", "jade"],
	["three", "印", "香火相傳", "三方印記，三份初心", "解鎖 3 枚文化徽章", "vermilion"],
	["scholar", "榜", "金榜題名", "志在青雲，終有迴響", "完成 300 分鐘學習並巡禮 1 站", "indigo"],
] as const;

export default function BadgesPage() {
	const [plan, setPlan] = useState<SavedPlan>({});
	useEffect(() => { try { setPlan(JSON.parse(localStorage.getItem("wenchang-mvp") ?? "{}")); } catch { setPlan({}); } }, []);
	const progress = useMemo(() => {
		const tasks = plan.tasks ?? [];
		const completed = tasks.filter((task) => task.done);
		return { tasks: completed.length, minutes: completed.reduce((total, task) => total + (Number(task.minutes) || 0), 0), visits: plan.templeVisits?.length ?? 0, complete: tasks.length > 0 && completed.length === tasks.length };
	}, [plan]);
	const badges = catalog.map(([id, icon, title, poem, detail, tone]) => ({ id, icon, title, poem, detail, tone, unlocked: (id === "first" && progress.tasks >= 1) || (id === "focus" && progress.minutes >= 60) || (id === "day" && progress.complete) || (id === "study" && progress.minutes >= 180) || (id === "five" && progress.tasks >= 5) || (id === "visit" && progress.visits >= 1) || (id === "three" && progress.visits >= 3) || (id === "scholar" && progress.minutes >= 300 && progress.visits >= 1) }));
	const unlocked = badges.filter((badge) => badge.unlocked).length;
	return <main className="feature-page badge-page"><div className="feature-shell badge-shell">
		<button className="back-link" onClick={() => location.href = "/"}>← 返回</button>
		<section className="badge-hero"><p className="feature-kicker">WENCHANG LEARNING SEALS</p><span className="badge-hero-seal" aria-hidden="true">文昌</span><h1>我的學習徽章</h1><p>把每一次認真，收進一枚有故事的文昌勳章。</p></section>
		<section className="badge-progress-card" aria-label="徽章解鎖進度"><div><span>已收藏</span><b>{unlocked}<small> / {badges.length} 枚</small></b></div><p>完成任務、累積專注，或走進合作宮廟巡禮，即可點亮你的學習印記。</p><div className="badge-progress-track"><i style={{ width: `${unlocked / badges.length * 100}%` }} /></div></section>
		<section className="badge-gallery" aria-label="學習徽章收藏冊">{badges.map((badge) => <article className={`learning-medal ${badge.tone} ${badge.unlocked ? "is-unlocked" : "is-locked"}`} key={badge.id}><div className="medal-ribbon"><i /><i /></div><div className="medal-face"><span>{badge.unlocked ? badge.icon : "✧"}</span></div><div className="medal-copy"><b>{badge.title}</b><em>{badge.poem}</em><small>{badge.unlocked ? "已收錄於文昌學習冊" : badge.detail}</small></div></article>)}</section>
		<section className="badge-ritual-note"><span>⛩</span><p>文昌講求「勤、誠、恆」。不必一次點亮所有勳章，每日完成一點，就是朝目標更靠近。</p></section>
	</div></main>;
}
