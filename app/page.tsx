"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import liff from "@line/liff";
import confetti from "canvas-confetti"; // ✨ 新增這行引入紙花套件

type Task = {
	subject: string;
	minutes: number;
	detail: string;
	done: boolean;
	color: string;
	skipped?: boolean;
};
type DeferredTask = { task: Task; availableOn: string };
type TaskAdjustmentCounts = {
	deferred: number;
	split: number;
	skipped: number;
};
type LearningDay = { date: string; minutes: number };
type LearningRecord = {
	date: string;
	minutes: number;
	tasks: {
		subject: string;
		detail: string;
		minutes: number;
		done: boolean;
	}[];
};
type Tab = "today" | "progress" | "prayer" | "profile";
const tabPaths: Record<Tab, string> = {
	today: "/today",
	progress: "/progress",
	prayer: "/prayer",
	profile: "/profile",
};
const tabFromPath = (pathname: string): Tab =>
	(Object.entries(tabPaths).find(([, path]) => path === pathname)?.[0] as Tab | undefined) ?? "today";
type FocusSession = {
	taskIndex: number;
	remainingSeconds: number;
	scheduledMinutes?: number;
	endsAt: number | null;
	paused: boolean;
	ended: boolean;
};
type DailyFortuneTask = {
	date: string;
	fortuneId: number;
	done: boolean;
	smallStepDone?: boolean;
	weakQuestions?: WeakQuestion[];
	achievementStats?: {
		focusSessionsCompleted?: number;
		weaknessesConquered?: number;
	};
};
type WeakQuestion = {
	id: string;
	questionIndex: number;
	misses: number;
	lastWrongAt: string;
	firstWrongDate: string;
	reviewStep: 1 | 2;
	nextReviewDate: string;
};
type WishReflection = {
	id: string;
	text: string;
	createdAt: string;
	reviewedAfter7Days?: boolean;
	reviewedAfter30Days?: boolean;
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
	wishReflections?: WishReflection[];
	focusSession?: FocusSession;
	remindersEnabled?: boolean;
	morningTime?: string;
	eveningTime?: string;
	oracleTickets?: number;
	oraclePlanksSpent?: number;
	oracleResultId?: number;
	dailyFortuneTask?: DailyFortuneTask;
	dailyCheckInDates?: string[];
	weakQuestions?: WeakQuestion[];
	focusRewardMinutes?: number;
	deferredTasks?: DeferredTask[];
	taskAdjustmentCounts?: TaskAdjustmentCounts;
};
type OracleStage = "idle" | "choosing" | "drawing" | "result";
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2011050459-8bPHPFCw";
const PENDING_SYNC_KEY = "wenchang-cloud-sync-pending";
const SLEEP_REMINDER_KEY = "wenchang-sleep-reminder-seen";
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
type CountdownPhase = {
	id: "steady" | "strengthen" | "sprint" | "exam";
	title: string;
	label: string;
	detail: string;
	factor: number;
	weakRatio: number;
	pastRatio: number;
};
const getCountdownPhase = (daysLeft: number): CountdownPhase => {
	if (daysLeft <= 0)
		return { id: "exam", title: "應試日整理", label: "應試日", detail: "只回顧關鍵題型與考場策略，保留穩定感。", factor: 0.35, weakRatio: 0.45, pastRatio: 0.35 };
	if (daysLeft <= 7)
		return { id: "sprint", title: "考前衝刺", label: "7 日衝刺", detail: "縮短總量、提高弱科比例，保留睡眠與考場節奏。", factor: 0.65, weakRatio: 0.55, pastRatio: 0.3 };
	if (daysLeft <= 21)
		return { id: "strengthen", title: "弱科加強", label: "21 日加強", detail: "弱科放在第一項，搭配歷屆題校正解題節奏。", factor: 0.85, weakRatio: 0.5, pastRatio: 0.32 };
	return { id: "steady", title: "穩定累積", label: "長線準備", detail: "先穩定完成，再逐步提高弱科與歷屆題的比重。", factor: 1, weakRatio: 0.45, pastRatio: 0.32 };
};
const buildCountdownTasks = (weak: string, hours: number, phase: CountdownPhase): Task[] => {
	const total = Math.max(45, Math.round((Math.max(1, hours) * 60 * phase.factor) / 5) * 5);
	const weakMinutes = Math.max(15, Math.round((total * phase.weakRatio) / 5) * 5);
	const pastMinutes = Math.max(15, Math.round((total * phase.pastRatio) / 5) * 5);
	const reviewMinutes = Math.max(10, total - weakMinutes - pastMinutes);
	return [
		{ subject: weak, minutes: weakMinutes, detail: "弱點加強・先釐清最常卡住的觀念", done: false, color: "amber" },
		{ subject: "歷屆題", minutes: pastMinutes, detail: "限時演練・記下錯因與解題步驟", done: false, color: "jade" },
		{ subject: "重點整理", minutes: reviewMinutes, detail: "回顧核心觀念・整理明日要複習的線索", done: false, color: "violet" },
	];
};
const fortunePoems = [
	{
		title: "今日箴言・春風得意",
		verse: "春風輕拂柳梢新，靜守初心得好音。",
		reading: "眼前的努力正在累積，不必急著求快，照著節奏完成今天的任務。",
	},
	{
		title: "今日箴言・專志有成",
		verse: "一念澄明書卷香，步穩方能到遠方。",
		reading:
			"先完成最重要的一件事。把注意力收回當下，成果會比焦慮更早抵達。",
	},
	{
		title: "今日箴言・厚積薄發",
		verse: "細雨潤田終成穗，深耕不語自生光。",
		reading: "看似平凡的複習最有力量。今天整理一題錯題，也是在替明天鋪路。",
	},
	{
		title: "今日箴言・柳暗花明",
		verse: "峰迴路轉雲開處，且把難題細細分。",
		reading: "遇到卡關時，先拆小步驟再前進。你不必一次解開所有問題。",
	},
	{
		title: "今日箴言・勤可補拙",
		verse: "燈下三分常不負，日添一點自成峰。",
		reading: "規律勝過衝刺。今天多專注十分鐘，長久下來會成為你的底氣。",
	},
	{
		title: "今日箴言・金榜可期",
		verse: "心定筆穩開新卷，所學終將答所求。",
		reading: "你已具備前進的條件。相信累積，帶著平靜完成下一個任務。",
	},
];
const dailyCheckInQuestions = [
	{
		subject: "地理",
		question:
			"2024 年 7 月下旬，雲林、臺南與嘉義農損嚴重。依災害時間與受影響地區判斷，最可能是何種災害？",
		choices: [
			["A", "颱風帶來的豪大雨淹沒農田"],
			["B", "強勁東北季風吹襲造成水稻倒伏"],
			["C", "梅雨季節的連續降雨造成果樹浸水"],
			["D", "強勁西南風越過山脈形成熱風使作物枯黃"],
		],
		answer: "A",
	},
	{
		subject: "公民",
		question:
			"日本擴大自越南、菲律賓、印尼、泰國等地招募外籍移工；哪一地區因同樣缺工且來源國高度重疊，受衝擊最大？",
		choices: [
			["A", "印度"],
			["B", "美國"],
			["C", "德國"],
			["D", "臺灣"],
		],
		answer: "D",
	},
	{
		subject: "臺灣史地",
		question:
			"某平埔族居住在雪山山脈與中央山脈間的平原，以竹筏穿梭溪流與海岸，生活空間最可能位於現今哪一行政區？",
		choices: [
			["A", "宜蘭縣"],
			["B", "苗栗縣"],
			["C", "屏東縣"],
			["D", "臺東縣"],
		],
		answer: "A",
	},
	{
		subject: "歷史",
		question:
			"政府提出「莊敬自強，處變不驚」，民間出現「牙刷主義」，電臺播放〈龍的傳人〉；此情境最可能與何事有關？",
		choices: [
			["A", "美國在韓戰後協防臺灣海峽"],
			["B", "美國宣布將與中華民國斷交"],
			["C", "國共內戰使政府敗退至臺灣"],
			["D", "臺灣受到同盟國軍機的空襲"],
		],
		answer: "B",
	},
] as const;
const dailyClassics = [
	{
		title: "《論語》",
		passage: "學而時習之，不亦說乎。",
		note: "每天回來複習一小段，就是累積學問的開始。",
	},
	{
		title: "《禮記・學記》",
		passage: "學然後知不足，教然後知困。",
		note: "看見不足，不是挫折，而是下一步的方向。",
	},
	{
		title: "《荀子・勸學》",
		passage: "不積跬步，無以至千里。",
		note: "把今天的小練習完成，就比昨天更靠近目標。",
	},
	{
		title: "《中庸》",
		passage: "博學之，審問之，慎思之，明辨之，篤行之。",
		note: "讀、問、想、辨、做，讓知識真正成為自己的。",
	},
] as const;
const taipeiDate = (date = new Date()) =>
	new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(date);
const makeDailyFortuneTask = (date = taipeiDate()): DailyFortuneTask => ({
	date,
	fortuneId: Number(date.replaceAll("-", "")) % fortunePoems.length,
	done: false,
});
const checkInMilestones = [
	{ days: 3, plaque: "初", title: "勤學新芽", detail: "解鎖青木牌・書院門景" },
	{ days: 7, plaque: "穩", title: "七日守志", detail: "解鎖墨綠木牌・晨鐘廊景" },
	{ days: 14, plaque: "進", title: "半月精進", detail: "解鎖朱砂木牌・燈火書齋" },
	{ days: 30, plaque: "願", title: "願成文昌殿", detail: "解鎖文昌殿祈願場景" },
] as const;
const culturalScenes = [
	{ days: 0, seal: "學", title: "書院門前", detail: "完成第一段完整專注，替今天立下學習的起點。" },
	{ days: 3, seal: "初", title: "青木書院", detail: "連續三天以完成任務回應自己，木牌正式點亮。" },
	{ days: 7, seal: "穩", title: "晨鐘長廊", detail: "七日穩定累積，讓規律成為可以依靠的節奏。" },
	{ days: 14, seal: "進", title: "燈火書齋", detail: "半月精進，回望錯題與弱點，讓理解逐漸清晰。" },
	{ days: 30, seal: "願", title: "文昌殿", detail: "三十日真實完成，解鎖專屬祈願場景與回顧時刻。" },
] as const;
const dailySmallSteps = [
	{ minutes: 5, title: "複習 5 個英文單字", detail: "把今天最常卡住的字重新讀一遍。" },
	{ minutes: 10, title: "訂正 1 題錯題", detail: "寫下錯因與正確解題線索。" },
	{ minutes: 10, title: "整理一個核心觀念", detail: "用自己的話寫成三行重點。" },
	{ minutes: 15, title: "完成一段專注練習", detail: "挑一小節內容，暫時遠離通知。" },
] as const;

const consecutiveCheckInDays = (dates: string[], today = taipeiDate()) => {
	const completed = new Set(dates);
	let cursor = today;
	let total = 0;
	while (completed.has(cursor)) {
		total += 1;
		const date = new Date(`${cursor}T00:00:00.000Z`);
		date.setUTCDate(date.getUTCDate() - 1);
		cursor = date.toISOString().slice(0, 10);
	}
	return total;
};
const addTaipeiDays = (date: string, days: number) => {
	const next = new Date(`${date}T00:00:00.000Z`);
	next.setUTCDate(next.getUTCDate() + days);
	return next.toISOString().slice(0, 10);
};

export default function Home({ initialTab = "today" }: { initialTab?: Tab }) {
	const [tab, setTab] = useState<Tab>(initialTab);
	const [navVisible, setNavVisible] = useState(true);
	const [tasks, setTasks] = useState<Task[]>(defaultTasks);
	const [deferredTasks, setDeferredTasks] = useState<DeferredTask[]>([]);
	const [adjustingTaskIndex, setAdjustingTaskIndex] = useState<number | null>(
		null,
	);
	const [taskAdjustmentCounts, setTaskAdjustmentCounts] =
		useState<TaskAdjustmentCounts>({ deferred: 0, split: 0, skipped: 0 });
	const [name, setName] = useState("30 日學習挑戰");
	const [examDate, setExamDate] = useState("2026-10-31");
	const [goal, setGoal] = useState("穩定完成每日學習任務");
	const [hours, setHours] = useState(2);
	const [weak, setWeak] = useState("數學");
	const [visits, setVisits] = useState<string[]>([]);
	const [wishes, setWishes] = useState<string[]>([]);
	const [wishReflections, setWishReflections] = useState<WishReflection[]>(
		[],
	);
	const [wish, setWish] = useState("");
	const [oracleTickets, setOracleTickets] = useState(0);
	const [oraclePlanksSpent, setOraclePlanksSpent] = useState(0);
	const [oracleStage, setOracleStage] = useState<OracleStage>("idle");
	const [selectedStick, setSelectedStick] = useState<number | null>(null);
	const [oracleResultId, setOracleResultId] = useState<number | null>(null);
	const [dailyFortuneTask, setDailyFortuneTask] = useState<DailyFortuneTask>(
		() => makeDailyFortuneTask(),
	);
	const [dailyCheckInDates, setDailyCheckInDates] = useState<string[]>([]);
	const [weakQuestions, setWeakQuestions] = useState<WeakQuestion[]>([]);
	const [selectedDailyAnswer, setSelectedDailyAnswer] = useState<
		string | null
	>(null);
	const [dailyAnswerFeedback, setDailyAnswerFeedback] = useState("");
	const [dailyCheckInDialogOpen, setDailyCheckInDialogOpen] = useState(false);
	const [checkInCeremonyOpen, setCheckInCeremonyOpen] = useState(false);
	const [reviewingWeakId, setReviewingWeakId] = useState<string | null>(null);
	const [selectedWeakAnswers, setSelectedWeakAnswers] = useState<
		Record<string, string>
	>({});
	const [weakReviewFeedback, setWeakReviewFeedback] = useState<
		Record<string, string>
	>({});
	const [weaknessNotice, setWeaknessNotice] = useState("");
	const [idToken, setIdToken] = useState<string | null>(null);
	const [lineName, setLineName] = useState<string | null>(null);
	const [syncStatus, setSyncStatus] = useState("");
	const [ready, setReady] = useState(false);
	const [weeklyMinutes, setWeeklyMinutes] = useState(0);
	const [streakDays, setStreakDays] = useState(0);
	const [learningDays, setLearningDays] = useState<LearningDay[]>([]);
	const [learningRecords, setLearningRecords] = useState<LearningRecord[]>(
		[],
	);
	const [selectedLearningDate, setSelectedLearningDate] = useState<
		string | null
	>(null);
	const [calendarMonth, setCalendarMonth] = useState(() => new Date());
	const [remindersEnabled, setRemindersEnabled] = useState(true);
	const [morningTime, setMorningTime] = useState("08:00");
	const [eveningTime, setEveningTime] = useState("20:30");
	const [editingNotifications, setEditingNotifications] = useState(false);
	const [savingNotifications, setSavingNotifications] = useState(false);
	const [careSummaryAudience, setCareSummaryAudience] = useState<"self" | "teacher" | "parent">("self");
	const [draftRemindersEnabled, setDraftRemindersEnabled] = useState(true);
	const [draftMorningTime, setDraftMorningTime] = useState("08:00");
	const [draftEveningTime, setDraftEveningTime] = useState("20:30");
	const [showSettlement, setShowSettlement] = useState(false);
	const [sleepReminderOpen, setSleepReminderOpen] = useState(false);
	const [focusIndex, setFocusIndex] = useState<number | null>(null);
	const [focusSeconds, setFocusSeconds] = useState(0);
	const [focusScheduledMinutes, setFocusScheduledMinutes] = useState(0);
	const [focusRewardMinutes, setFocusRewardMinutes] = useState(0);
	const [focusEndsAt, setFocusEndsAt] = useState<number | null>(null);
	const [focusPaused, setFocusPaused] = useState(false);
	const [focusEnded, setFocusEnded] = useState(false);
	const [focusPickerTaskIndex, setFocusPickerTaskIndex] = useState<
		number | null
	>(null);
	const [hydrated, setHydrated] = useState(false);
	const syncQueue = useRef(Promise.resolve(true));
	const lastScrollY = useRef(0);
	const navigateToTab = (nextTab: Tab) => {
		setTab(nextTab);
		if (window.location.pathname !== tabPaths[nextTab])
			window.history.pushState(null, "", tabPaths[nextTab]);
	};
	useEffect(() => {
		const syncTabFromUrl = () => setTab(tabFromPath(window.location.pathname));
		window.addEventListener("popstate", syncTabFromUrl);
		return () => window.removeEventListener("popstate", syncTabFromUrl);
	}, []);
	useEffect(() => {
		let frame: number | null = null;
		const updateNavigation = () => {
			frame = null;
			const currentY = window.scrollY;
			const difference = currentY - lastScrollY.current;
			if (currentY < 48 || difference < -6) setNavVisible(true);
			else if (difference > 6) setNavVisible(false);
			lastScrollY.current = currentY;
		};
		const onScroll = () => {
			if (frame === null) frame = window.requestAnimationFrame(updateNavigation);
		};
		lastScrollY.current = window.scrollY;
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			if (frame !== null) window.cancelAnimationFrame(frame);
		};
	}, []);
	useEffect(() => {
		setHydrated(true);
	}, []);
	useEffect(() => {
		if (!ready) return;
		const showSleepReminderIfDue = () => {
			const now = new Date();
			const time = new Intl.DateTimeFormat("en-GB", {
				timeZone: "Asia/Taipei",
				hour: "2-digit",
				minute: "2-digit",
				hourCycle: "h23",
			}).format(now);
			const today = taipeiDate(now);
			if (time >= "22:30" && localStorage.getItem(SLEEP_REMINDER_KEY) !== today) {
				localStorage.setItem(SLEEP_REMINDER_KEY, today);
				setSleepReminderOpen(true);
			}
		};
		showSleepReminderIfDue();
		const timer = window.setInterval(showSleepReminderIfDue, 30000);
		return () => window.clearInterval(timer);
	}, [ready]);
	useEffect(() => {
		const refreshRestoredPage = (event: PageTransitionEvent) => {
			if (event.persisted) window.location.reload();
		};
		window.addEventListener("pageshow", refreshRestoredPage);
		return () =>
			window.removeEventListener("pageshow", refreshRestoredPage);
	}, []);
	useEffect(() => {
		const stored = localStorage.getItem("wenchang-mvp");
		if (stored)
			try {
				const data = JSON.parse(stored) as SavedPlan;
				if (data.tasks?.length) setTasks(data.tasks);
				if (data.deferredTasks?.length)
					setDeferredTasks(data.deferredTasks);
				if (data.taskAdjustmentCounts)
					setTaskAdjustmentCounts(data.taskAdjustmentCounts);
				if (data.challengeName) setName(data.challengeName);
				if (data.examDate) setExamDate(data.examDate);
				if (data.goal) setGoal(data.goal);
				if (data.hours) setHours(data.hours);
				if (data.weak) setWeak(data.weak);
				if (data.templeVisits) setVisits(data.templeVisits);
				if (data.wishes) setWishes(data.wishes);
				if (data.wishReflections?.length)
					setWishReflections(data.wishReflections);
				else if (data.wishes?.length)
					setWishReflections(
						data.wishes.map((text, index) => ({
							id: `legacy-${index}-${text}`,
							text,
							createdAt: new Date().toISOString(),
						})),
					);
				if (typeof data.oracleTickets === "number")
					setOracleTickets(data.oracleTickets);
				if (typeof data.oraclePlanksSpent === "number")
					setOraclePlanksSpent(data.oraclePlanksSpent);
				if (typeof data.oracleResultId === "number")
					setOracleResultId(data.oracleResultId);
				if (data.dailyFortuneTask?.date === taipeiDate())
					setDailyFortuneTask(data.dailyFortuneTask);
				if (Array.isArray(data.dailyCheckInDates))
					setDailyCheckInDates(
						data.dailyCheckInDates.filter(
							(date): date is string =>
								typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date),
						),
					);
				if (Array.isArray(data.weakQuestions))
					setWeakQuestions(data.weakQuestions.slice(0, 12));
				else if (data.dailyFortuneTask?.weakQuestions?.length)
					setWeakQuestions(
						data.dailyFortuneTask.weakQuestions.map((item) => ({
							...item,
							firstWrongDate: data.dailyFortuneTask?.date ?? taipeiDate(),
							reviewStep: 1,
							nextReviewDate: addTaipeiDays(
								data.dailyFortuneTask?.date ?? taipeiDate(),
								1,
							),
						})),
					);
				if (typeof data.focusRewardMinutes === "number")
					setFocusRewardMinutes(data.focusRewardMinutes);
				if (typeof data.remindersEnabled === "boolean")
					setRemindersEnabled(data.remindersEnabled);
				if (data.morningTime) setMorningTime(data.morningTime);
				if (data.eveningTime) setEveningTime(data.eveningTime);
				const session = data.focusSession;
				if (session && session.taskIndex >= 0) {
					const remaining =
						session.paused || !session.endsAt
							? session.remainingSeconds
							: Math.max(
									0,
									Math.ceil(
										(session.endsAt - Date.now()) / 1000,
									),
								);
					setFocusIndex(session.taskIndex);
					setFocusSeconds(remaining);
					setFocusScheduledMinutes(
						session.scheduledMinutes ??
							data.tasks?.[session.taskIndex]?.minutes ??
							0,
					);
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
						scheduledMinutes: focusScheduledMinutes,
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
				wishReflections,
				oracleTickets,
				oraclePlanksSpent,
				oracleResultId,
				dailyFortuneTask,
				dailyCheckInDates,
				weakQuestions,
				focusRewardMinutes,
				deferredTasks,
				taskAdjustmentCounts,
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
		wishReflections,
		oracleTickets,
		oraclePlanksSpent,
		oracleResultId,
		dailyFortuneTask,
		dailyCheckInDates,
		weakQuestions,
		focusRewardMinutes,
		deferredTasks,
		taskAdjustmentCounts,
		ready,
		focusIndex,
		focusSeconds,
		focusScheduledMinutes,
		focusEndsAt,
		focusPaused,
		focusEnded,
		remindersEnabled,
		morningTime,
		eveningTime,
	]);
	useEffect(() => {
		liff.init({ liffId: LIFF_ID })
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
	const enqueueSync = (
		nextTasks: Task[],
		token = idToken,
		nextWishes = wishes,
	) => {
		if (!token) {
			localStorage.setItem(PENDING_SYNC_KEY, "1");
			return Promise.resolve(false);
		}
		const payload = {
			idToken: token,
			tasks: nextTasks,
			hours,
			weak,
			goal,
			challengeName: name,
			wishes: nextWishes,
			examDate,
			companionState: {
				oracleTickets,
				oraclePlanksSpent,
				oracleResultId,
				dailyFortuneTask,
				focusRewardMinutes,
				wishReflections,
			},
		};
		const request = syncQueue.current
			.catch(() => false)
			.then(async () => {
				setSyncStatus("同步中…");
				try {
					const response = await fetch("/api/progress", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(payload),
					});
					if (!response.ok) {
						const failure = (await response
							.json()
							.catch(() => null)) as { code?: string } | null;
						throw new Error(failure?.code ?? "SYNC_UNKNOWN");
					}
					setSyncStatus("已同步至雲端學習紀錄");
					return true;
				} catch (error) {
					localStorage.setItem(PENDING_SYNC_KEY, "1");
					const code =
						error instanceof Error ? error.message : "SYNC_UNKNOWN";
					setSyncStatus(`同步未完成（${code}），資料保留在此裝置`);
					return false;
				}
			});
		syncQueue.current = request;
		return request;
	};
	useEffect(() => {
		if (!idToken || localStorage.getItem(PENDING_SYNC_KEY)) return;
		fetch("/api/progress/load", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ idToken }),
		})
			.then((response) =>
				response.ok ? response.json() : Promise.reject(),
			)
			.then((data) => {
				if (!data.exists) {
					void enqueueSync(tasks);
					return;
				}
				if (data.tasks?.length) setTasks(data.tasks);
				if (data.plan) {
					setName(data.plan.challengeName ?? name);
					setExamDate(data.plan.examDate);
					setHours(data.plan.hours);
					setWeak(data.plan.weak);
					setGoal(data.plan.goal ?? goal);
					if (Array.isArray(data.plan.wishes))
						setWishes(data.plan.wishes);
				}
				if (Array.isArray(data.visits)) setVisits(data.visits);
				if (data.companionState) {
					if (typeof data.companionState.oracleTickets === "number")
						setOracleTickets(data.companionState.oracleTickets);
					if (
						typeof data.companionState.oraclePlanksSpent ===
						"number"
					)
						setOraclePlanksSpent(
							data.companionState.oraclePlanksSpent,
						);
					if (typeof data.companionState.oracleResultId === "number")
						setOracleResultId(data.companionState.oracleResultId);
					if (data.companionState.oracleResultId === null)
						setOracleResultId(null);
					if (
						data.companionState.dailyFortuneTask &&
						typeof data.companionState.dailyFortuneTask === "object"
					)
						setDailyFortuneTask(
							data.companionState
								.dailyFortuneTask as DailyFortuneTask,
						);
					if (
						typeof data.companionState.focusRewardMinutes ===
						"number"
					)
						setFocusRewardMinutes(
							data.companionState.focusRewardMinutes,
						);
					if (Array.isArray(data.companionState.wishReflections))
						setWishReflections(
							data.companionState
								.wishReflections as WishReflection[],
						);
				}
				setSyncStatus("已從雲端還原學習紀錄");
			})
			.catch(() => setSyncStatus("雲端紀錄暫時無法讀取"));
	}, [idToken]);
	useEffect(() => {
		if (!idToken || !ready || !localStorage.getItem(PENDING_SYNC_KEY))
			return;
		void enqueueSync(tasks).then((synced) => {
			if (synced) localStorage.removeItem(PENDING_SYNC_KEY);
		});
	}, [idToken, ready]);
	useEffect(() => {
		if (!idToken || !ready) return;
		const timer = window.setTimeout(() => {
			void enqueueSync(tasks);
		}, 700);
		return () => window.clearTimeout(timer);
	}, [
		idToken,
		ready,
		oracleTickets,
		oraclePlanksSpent,
		oracleResultId,
		dailyFortuneTask,
		focusRewardMinutes,
		wishReflections,
	]);
	useEffect(() => {
		if (!idToken) return;
		fetch("/api/stats", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ idToken }),
		})
			.then((response) =>
				response.ok ? response.json() : Promise.reject(),
			)
			.then((data) => {
				setWeeklyMinutes(data.weeklyMinutes ?? 0);
				setStreakDays(data.streakDays ?? 0);
				setLearningDays(Array.isArray(data.days) ? data.days : []);
				setLearningRecords(
					Array.isArray(data.records) ? data.records : [],
				);
			})
			.catch(() => undefined);
	}, [idToken, tasks]);
	useEffect(() => {
		if (!idToken) return;
		fetch("/api/preferences", { headers: { "x-line-id-token": idToken } })
			.then((response) =>
				response.ok ? response.json() : Promise.reject(),
			)
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
			(new Date(`${examDate}T00:00:00`).getTime() - Date.now()) /
				86400000,
		),
	);
	const countdownPhase = getCountdownPhase(daysLeft);
	const countdownTasks = useMemo(
		() => buildCountdownTasks(weak, hours, countdownPhase),
		[weak, hours, countdownPhase],
	);
	const countdownTotalMinutes = countdownTasks.reduce(
		(total, task) => total + task.minutes,
		0,
	);
	const completed = tasks.filter((t) => t.done).length;
	const progress = tasks.length
		? Math.round((completed / tasks.length) * 100)
		: 0;
	const plannedMinutes = useMemo(
		() => tasks.reduce((sum, task) => sum + task.minutes, 0),
		[tasks],
	);
	const energy = Math.min(100, 42 + completed * 10 + visits.length * 3);
	const dailyFortune =
		fortunePoems[dailyFortuneTask.fortuneId] ?? fortunePoems[0];
	const dailyCheckInQuestion =
		dailyCheckInQuestions[
			dailyFortuneTask.fortuneId % dailyCheckInQuestions.length
		];
	const dailyClassic =
		dailyClassics[dailyFortuneTask.fortuneId % dailyClassics.length];
	const dailySmallStep =
		dailySmallSteps[dailyFortuneTask.fortuneId % dailySmallSteps.length];
	const effectiveCheckInDates = useMemo(() => {
		const dates = new Set(dailyCheckInDates);
		if (dailyFortuneTask.done && dailyFortuneTask.date === taipeiDate())
			dates.add(taipeiDate());
		return [...dates];
	}, [dailyCheckInDates, dailyFortuneTask]);
	const checkInStreak = consecutiveCheckInDays(effectiveCheckInDates);
	const nextCheckInMilestone = checkInMilestones.find(
		(milestone) => milestone.days > checkInStreak,
	);
	const newlyUnlockedMilestone = checkInMilestones.find(
		(milestone) => milestone.days === checkInStreak,
	);
	const unlockedSceneIndex = culturalScenes.reduce(
		(latest, scene, index) => (checkInStreak >= scene.days ? index : latest),
		0,
	);
	const activeCulturalScene = culturalScenes[unlockedSceneIndex];
	const nextCulturalScene = culturalScenes[unlockedSceneIndex + 1];
	const dueWeakQuestions = weakQuestions.filter(
		(item) => item.nextReviewDate <= taipeiDate(),
	);
	const upcomingWeakQuestion = weakQuestions
		.filter((item) => item.nextReviewDate > taipeiDate())
		.sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate))[0];
	const focusPlanks = Math.floor(focusRewardMinutes / 10);
	const focusSessionsCompleted =
		dailyFortuneTask.achievementStats?.focusSessionsCompleted ?? 0;
	const weaknessesConquered =
		dailyFortuneTask.achievementStats?.weaknessesConquered ?? 0;
	const achievementUnlockedCount = [
		focusSessionsCompleted >= 1,
		focusSessionsCompleted >= 10,
		focusSessionsCompleted >= 30,
		checkInStreak >= 3,
		checkInStreak >= 7,
		checkInStreak >= 14,
		weaknessesConquered >= 1,
		weaknessesConquered >= 5,
	].filter(Boolean).length;
	const nextAchievement = [
		focusSessionsCompleted < 1 && `完成第 1 次完整專注`,
		focusSessionsCompleted >= 1 &&
			focusSessionsCompleted < 10 &&
			`再完成 ${10 - focusSessionsCompleted} 次完整專注`,
		focusSessionsCompleted >= 10 &&
			focusSessionsCompleted < 30 &&
			`再完成 ${30 - focusSessionsCompleted} 次完整專注`,
		checkInStreak < 3 && `再連續簽到 ${3 - checkInStreak} 天`,
		checkInStreak >= 3 &&
			checkInStreak < 7 &&
			`再連續簽到 ${7 - checkInStreak} 天`,
		weaknessesConquered < 1 && "克服第 1 題回流弱點",
		weaknessesConquered >= 1 &&
			weaknessesConquered < 5 &&
			`再克服 ${5 - weaknessesConquered} 題弱點`,
	].find(Boolean) as string | undefined;
	// 木牌只由完整計時結束的專注任務累積；不以抽選、登入或點擊給予。
	const planks = focusPlanks;
	// 保留舊資料相容性；抽籤介面已從產品流程移除。
	const availablePlanks = planks;
	const recordWeakQuestion = (questionIndex: number) => {
		const today = taipeiDate();
		setWeakQuestions((current) => {
			const existing = current.find(
				(item) => item.questionIndex === questionIndex,
			);
			return existing
				? current.map((item) =>
						item.questionIndex === questionIndex
							? {
									...item,
									misses: item.misses + 1,
									lastWrongAt: new Date().toISOString(),
									reviewStep: 1,
									nextReviewDate: addTaipeiDays(today, 1),
								}
							: item,
					)
				: [
						{
							id: `weak-${Date.now()}-${questionIndex}`,
							questionIndex,
							misses: 1,
							lastWrongAt: new Date().toISOString(),
							firstWrongDate: today,
							reviewStep: 1,
							nextReviewDate: addTaipeiDays(today, 1),
						},
						...current,
					].slice(0, 12);
		});
	};
	const submitWeakReview = (item: WeakQuestion) => {
		const question = dailyCheckInQuestions[item.questionIndex];
		const selected = selectedWeakAnswers[item.id];
		if (!selected) {
			setWeakReviewFeedback((current) => ({
				...current,
				[item.id]: "請先選擇一個答案。",
			}));
			return;
		}
		if (selected !== question?.answer) {
			setWeakQuestions((current) =>
				current.map((entry) =>
					entry.id === item.id
						? {
								...entry,
								misses: entry.misses + 1,
								lastWrongAt: new Date().toISOString(),
								reviewStep: 1,
								nextReviewDate: addTaipeiDays(taipeiDate(), 1),
							}
						: entry,
				),
			);
			setWeakReviewFeedback((current) => ({
				...current,
				[item.id]: "再看一次題幹，你一定能找到線索。",
			}));
			setWeaknessNotice("這題會在明天再回流，陪你把觀念練穩。");
			return;
		}
		if (item.reviewStep === 1) {
			setWeakQuestions((current) =>
				current.map((entry) =>
					entry.id === item.id
						? {
								...entry,
								reviewStep: 2,
								nextReviewDate: addTaipeiDays(entry.firstWrongDate, 3),
							}
						: entry,
				),
			);
			setWeakReviewFeedback((current) => ({
				...current,
				[item.id]: "第一輪複習答對！第 3 天會再回來確認一次。",
			}));
			setWeaknessNotice("第一輪複習答對！第 3 天會再回來確認一次。 ");
			setReviewingWeakId(null);
			return;
		}
		setWeakQuestions((current) => current.filter((entry) => entry.id !== item.id));
		setDailyFortuneTask((current) => ({
			...current,
			achievementStats: {
				...current.achievementStats,
				weaknessesConquered:
					(current.achievementStats?.weaknessesConquered ?? 0) + 1,
			},
		}));
		setWeakReviewFeedback((current) => ({
			...current,
			[item.id]: "已克服弱點。",
		}));
		setWeaknessNotice("已克服弱點，這題不會再回流。 ");
		setReviewingWeakId(null);
		setSyncStatus("已克服弱點，這題不會再回流。 ");
	};
	const completeDailyCheckIn = () => {
		if (dailyFortuneTask.done) return;
		if (completed < 1) {
			setDailyAnswerFeedback("先完成至少一項專注任務，才可以進行今日簽到。 ");
			return;
		}
		if (!selectedDailyAnswer) {
			setDailyAnswerFeedback("請先選擇一個答案。 ");
			return;
		}
		if (selectedDailyAnswer !== dailyCheckInQuestion.answer) {
			recordWeakQuestion(
				dailyFortuneTask.fortuneId % dailyCheckInQuestions.length,
			);
			setDailyAnswerFeedback("這題會在明天與第 3 天回流，陪你把觀念練穩。 ");
			return;
		}
		// 讓慶祝從答對當下延續到木牌落定，而不是一瞬即逝。
		confetti({
			particleCount: 76,
			spread: 58,
			startVelocity: 34,
			origin: { x: 0.5, y: 0.58 },
			zIndex: 130,
			colors: ["#e4bc52", "#fff3b7", "#a9513f", "#71906a"],
		});
		window.setTimeout(() => {
			confetti({
				particleCount: 48,
				angle: 60,
				spread: 52,
				origin: { x: 0.05, y: 0.72 },
				zIndex: 130,
				colors: ["#e4bc52", "#fff3b7", "#a9513f", "#71906a"],
			});
			confetti({
				particleCount: 48,
				angle: 120,
				spread: 52,
				origin: { x: 0.95, y: 0.72 },
				zIndex: 130,
				colors: ["#e4bc52", "#fff3b7", "#a9513f", "#71906a"],
			});
		}, 520);
		setDailyFortuneTask((current) => ({ ...current, done: true }));
		setDailyCheckInDates((current) =>
			current.includes(taipeiDate())
				? current
				: [...current, taipeiDate()].slice(-90),
		);
		setDailyAnswerFeedback("答對了！今日簽到完成。 ");
		setDailyCheckInDialogOpen(false);
		setCheckInCeremonyOpen(true);
		setSyncStatus("今日學習紀錄已完成；木牌將依完整專注任務自動點亮。");
	};
	const exchangeOracleTicket = () => {
		if (availablePlanks < 3) return;
		setOraclePlanksSpent((current) => current + 3);
		setOracleTickets((current) => current + 1);
		setOracleStage("choosing");
		setSelectedStick(null);
		setOracleResultId(null);
	};
	const drawFortune = () => {
		if (selectedStick === null || oracleTickets < 1) return;
		setOracleTickets((current) => current - 1);
		setOracleStage("drawing");
		window.setTimeout(() => {
			setOracleResultId(selectedStick % fortunePoems.length);
			setDailyFortuneTask((current) =>
				current.done
					? current
					: {
							...current,
							fortuneId: selectedStick % fortunePoems.length,
						},
			);
			setOracleStage("result");
		}, 1250);
	};
	const drawAgain = () => {
		setOracleStage(oracleTickets > 0 ? "choosing" : "idle");
		setSelectedStick(null);
	};
	const remaining = useMemo(
		() =>
			tasks.filter((t) => !t.done).reduce((sum, t) => sum + t.minutes, 0),
		[tasks],
	);
	useEffect(() => {
		if (!ready) return;
		const available = deferredTasks.filter(
			(item) => item.availableOn <= taipeiDate(),
		);
		if (!available.length) return;
		setTasks((current) => [
			...current,
			...available.map((item) => ({
				...item.task,
				done: false,
				skipped: false,
			})),
		]);
		setDeferredTasks((current) =>
			current.filter((item) => item.availableOn > taipeiDate()),
		);
		setSyncStatus(`已將 ${available.length} 項延後任務加入今天的清單。`);
	}, [deferredTasks, ready]);
	const pendingIndex = tasks.findIndex((task) => !task.done && !task.skipped);
	const deferTask = (index: number) => {
		const task = tasks[index];
		if (!task) return;
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		setDeferredTasks((current) => [
			...current,
			{
				task: { ...task, done: false, skipped: false },
				availableOn: taipeiDate(tomorrow),
			},
		]);
		setTasks((current) =>
			current.filter((_, taskIndex) => taskIndex !== index),
		);
		setAdjustingTaskIndex(null);
		setTaskAdjustmentCounts((current) => ({
			...current,
			deferred: current.deferred + 1,
		}));
		setSyncStatus(`「${task.subject}」已延後到明天。`);
	};
	const splitTask = (index: number) => {
		const task = tasks[index];
		if (!task || task.minutes <= 15) {
			setSyncStatus("這項任務已是 15 分鐘，可直接開始完成。 ");
			return;
		}
		const firstMinutes = 15;
		const remainingMinutes = task.minutes - firstMinutes;
		setTasks((current) =>
			current.flatMap((item, taskIndex) =>
				taskIndex === index
					? [
							{
								...item,
								minutes: firstMinutes,
								detail: `${item.detail}（第一段）`,
							},
							{
								...item,
								minutes: remainingMinutes,
								detail: `${item.detail}（第二段）`,
								done: false,
							},
						]
					: [item],
			),
		);
		setAdjustingTaskIndex(null);
		setTaskAdjustmentCounts((current) => ({
			...current,
			split: current.split + 1,
		}));
		setSyncStatus(
			`已將「${task.subject}」拆成 ${firstMinutes} 分鐘與 ${remainingMinutes} 分鐘兩段。`,
		);
	};
	const skipTask = (index: number) => {
		setTasks((current) =>
			current.map((task, taskIndex) =>
				taskIndex === index
					? { ...task, skipped: !task.skipped }
					: task,
			),
		);
		setAdjustingTaskIndex(null);
		setTaskAdjustmentCounts((current) => ({
			...current,
			skipped: current.skipped + 1,
		}));
	};
	const applyCountdownPlan = () => {
		if (completed > 0) {
			setSyncStatus("今天已有完成任務；倒數計畫會在明天自動重新安排。");
			return;
		}
		const next = buildCountdownTasks(weak, hours, countdownPhase);
		setTasks(next);
		localStorage.setItem(
			`wenchang-countdown-plan-${examDate}-${taipeiDate()}`,
			countdownPhase.id,
		);
		void enqueueSync(next);
		setSyncStatus(`已套用「${countdownPhase.title}」的今日任務安排。`);
	};
	useEffect(() => {
		if (!ready || completed > 0) return;
		const todayKey = new Intl.DateTimeFormat("en-CA", {
			timeZone: "Asia/Taipei",
		}).format(new Date());
		const modeKey = `wenchang-countdown-plan-${examDate}-${todayKey}`;
		if (localStorage.getItem(modeKey)) return;
		const next = buildCountdownTasks(weak, hours, countdownPhase);
		localStorage.setItem(modeKey, countdownPhase.id);
		setTasks(next);
		void enqueueSync(next);
	}, [ready, completed, examDate, weak, hours, countdownPhase]);
	const openFocusModePicker = (index: number) => {
		const task = tasks[index];
		if (!task || task.done) return;
		setFocusPickerTaskIndex(index);
	};
	const startFocus = () => {
		if (pendingIndex < 0) return;
		openFocusModePicker(pendingIndex);
	};
	const startFocusAt = (index: number) => openFocusModePicker(index);
	const beginFocus = () => {
		if (focusPickerTaskIndex === null) return;
		const task = tasks[focusPickerTaskIndex];
		if (!task || task.done) return;
		const minutes = task.minutes;
		const seconds = minutes * 60;
		setFocusIndex(focusPickerTaskIndex);
		setFocusSeconds(seconds);
		setFocusScheduledMinutes(minutes);
		setFocusEndsAt(Date.now() + seconds * 1000);
		setFocusPaused(false);
		setFocusEnded(false);
		setFocusPickerTaskIndex(null);
	};
	const pauseFocus = () => {
		if (!focusEndsAt) return;
		setFocusSeconds(
			Math.max(0, Math.ceil((focusEndsAt - Date.now()) / 1000)),
		);
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
		setFocusScheduledMinutes(0);
		setFocusEndsAt(null);
		setFocusPaused(false);
		setFocusEnded(false);
	};
	const abandonFocus = () => {
		if (
			!window.confirm(
				"這次專注尚未完成，要先離開嗎？目前任務會保留，隨時可以回來繼續。",
			)
		)
			return;
		closeFocus();
		setSyncStatus("任務已保留，準備好時再從 10 分鐘開始也很好。");
	};
	const sendCompletionNotice = async (task: Task, completedCount: number) => {
		if (!idToken) return;
		try {
			const response = await fetch("/api/notifications/completion", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					idToken,
					subject: task.subject,
					minutes: task.minutes,
					completedCount,
					totalCount: tasks.length,
				}),
			});
			if (response.ok) setSyncStatus("專注完成，LINE 恭喜通知已傳送！");
		} catch {
			// LINE 通知失敗不影響原本的任務完成流程。
		}
	};
	const completeFocus = () => {
		if (focusIndex === null || !focusEnded) return;
		const completedTask = tasks[focusIndex];
		const completedCount = tasks.filter((task) => task.done).length + 1;
		const rewardedMinutes = focusScheduledMinutes;
		const newlyEarnedPlanks = rewardedMinutes
			? Math.floor((focusRewardMinutes + rewardedMinutes) / 10) -
				Math.floor(focusRewardMinutes / 10)
			: 0;
		const minutesToNextPlank =
			10 - ((focusRewardMinutes + rewardedMinutes) % 10 || 10);
		if (rewardedMinutes)
			setFocusRewardMinutes((current) => current + rewardedMinutes);
		setTasks((current) => {
			const next = current.map((task, index) =>
				index === focusIndex ? { ...task, done: true } : task,
			);
			void enqueueSync(next);
			return next;
		});
		setDailyFortuneTask((current) => ({
			...current,
			achievementStats: {
				...current.achievementStats,
				focusSessionsCompleted:
					(current.achievementStats?.focusSessionsCompleted ?? 0) + 1,
			},
		}));
		void sendCompletionNotice(completedTask, completedCount);
		closeFocus();
		setSyncStatus(
			`專注 ${rewardedMinutes} 分鐘完成${newlyEarnedPlanks ? `，獲得 ${newlyEarnedPlanks} 枚祈福木牌！` : `，再累積 ${minutesToNextPlank} 分鐘可獲得 1 枚祈福木牌。`}`,
		);
	};
	useEffect(() => {
		if (focusEnded && focusIndex !== null) completeFocus();
	}, [focusEnded, focusIndex]);
	const login = async () => {
		if (!liff.isLoggedIn()) {
			liff.login();
			return;
		}
		const token = liff.getIDToken();
		if (token) {
			setIdToken(token);
			setLineName(liff.getDecodedIDToken()?.name ?? null);
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
	const sendWeeklyCareSummary = async () => {
		if (!idToken) {
			await login();
			return;
		}
		setSyncStatus("正在整理本週關懷摘要…");
		try {
			const response = await fetch("/api/weekly-summary", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ idToken, audience: careSummaryAudience }),
			});
			setSyncStatus(response.ok ? "本週關懷摘要已推播至你的 LINE OA" : "摘要推播失敗，請確認已加官方帳號好友");
		} catch {
			setSyncStatus("摘要推播失敗，請稍後再試");
		}
	};
	const saveWish = () => {
		const text = wish.trim();
		if (!text) return;
		const createdAt = new Date().toISOString();
		setWishes((current) => {
			const next = [text, ...current].slice(0, 5);
			void enqueueSync(tasks, idToken, next);
			return next;
		});
		setWishReflections((current) =>
			[
				{ id: `${Date.now()}-${text}`, text, createdAt },
				...current,
			].slice(0, 5),
		);
		setWish("");
		setSyncStatus("祈願已留存，將在第 7 天與第 30 天邀請你回望。 ");
	};
	const completeWishReview = (id: string, milestone: 7 | 30) => {
		setWishReflections((current) =>
			current.map((item) =>
				item.id !== id
					? item
					: milestone === 7
						? { ...item, reviewedAfter7Days: true }
						: { ...item, reviewedAfter30Days: true },
			),
		);
		setSyncStatus(`已完成第 ${milestone} 天的願望回顧。`);
	};
	const reviewDate = (createdAt: string, days: number) =>
		new Intl.DateTimeFormat("zh-TW", {
			month: "long",
			day: "numeric",
			timeZone: "Asia/Taipei",
		}).format(new Date(new Date(createdAt).getTime() + days * 86400000));
	const daysSinceWish = (createdAt: string) =>
		Math.max(
			0,
			Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000),
		);
	const focusTime = `${String(Math.floor(focusSeconds / 60)).padStart(2, "0")}:${String(focusSeconds % 60).padStart(2, "0")}`;
	const today = (
		<>
			<section className="hero">
				<p className="eyebrow">今日學習・{name}</p>
				<h1>
					{pendingIndex >= 0 ? "現在先完成" : "今天已經"}
					<br />
					<em>{pendingIndex >= 0 ? tasks[pendingIndex].subject : "做得很好"}</em>
				</h1>
				<div className="countdown">
					<span>{pendingIndex >= 0 ? `${tasks[pendingIndex].detail}・${tasks[pendingIndex].minutes} 分鐘` : `今日 ${completed}/${tasks.length} 項任務已完成`}</span>
				</div>
				<section className={`exam-mode-card countdown-${countdownPhase.id}`}>
						<div className="exam-mode-heading">
							<span>✦</span>
							<div>
								<small>EXAM COUNTDOWN PLAN</small>
								<b>{countdownPhase.title}・剩 {daysLeft} 天</b>
							</div>
						</div>
						<p>
							{countdownPhase.detail} 今日共 {countdownTotalMinutes} 分鐘，先完成{" "}
							<strong>{weak}</strong> 的弱點加強，再做歷屆題與重點整理。
						</p>
						<div className="exam-mode-footer">
							<span>弱科 {Math.round(countdownPhase.weakRatio * 100)}%・今晚 22:30 前準備休息</span>
							<button
								onClick={() => setSleepReminderOpen(true)}
							>
								查看提醒
							</button>
						</div>
					</section>
				<div className="hero-orb orb-one" />
				<div className="hero-orb orb-two" />
			</section>
			<section className="today-command-card" aria-label="下一個學習任務">
				<div>
					<span>下一個要完成的任務</span>
					<b>{pendingIndex >= 0 ? `${tasks[pendingIndex].subject}・${tasks[pendingIndex].detail}` : "今日任務已圓滿完成"}</b>
					<small>{pendingIndex >= 0 ? `預計 ${tasks[pendingIndex].minutes} 分鐘，完成後再決定下一步。` : "現在適合休息，讓努力慢慢沉澱。"}</small>
				</div>
				<button onClick={startFocus} disabled={pendingIndex < 0}>{pendingIndex >= 0 ? "開始專注" : "已完成"}</button>
			</section>
			<section className="progress-card">
				<div className="section-heading">
					<div>
						<p className="eyebrow">今日待辦・弱科 {weak}</p>
						<h2>完成後，再看下一件事</h2>
					</div>
					<span className="completion">
						{completed} / {tasks.length} 完成
					</span>
				</div>
				<div className="progress-track">
					<span style={{ width: `${progress}%` }} />
				</div>
				<div className="task-overview" aria-label="今日任務摘要">
					<span>
						已安排 <b>{plannedMinutes}</b> 分鐘
					</span>
					<span>
						尚餘 <b>{remaining}</b> 分鐘
					</span>
				</div>
				<details className="today-task-list">
					<summary>查看全部任務與調整選項</summary>
					<div className="tasks">
					{tasks.map((task, index) => (
						<div
							className={`task ${task.done ? "done" : ""} ${task.skipped ? "skipped" : ""}`}
							key={`${task.subject}-${index}`}
						>
							<span
								className={`check ${task.done ? "checked" : ""}`}
								aria-label={
									task.done
										? `${task.subject}已透過完整專注完成`
										: `${task.subject}需完成完整專注計時才會標記完成`
								}
								title="任務會在完整專注計時結束後自動完成"
							>
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
							<button
								className="task-focus"
								onClick={() => startFocusAt(index)}
								disabled={task.done || task.skipped}
							>
								{task.done
									? "已完成"
									: task.skipped
										? "已跳過"
										: "專注"}
							</button>
							{!task.done && (
								<button
									className="task-adjust"
									onClick={() =>
										setAdjustingTaskIndex((current) =>
											current === index ? null : index,
										)
									}
									aria-label={`調整${task.subject}任務`}
								>
									⋯
								</button>
							)}
							{adjustingTaskIndex === index && !task.done && (
								<div className="task-adjust-menu">
									<button onClick={() => deferTask(index)}>
										延後到明天
									</button>
									<button onClick={() => splitTask(index)}>
										拆成 15 分鐘
									</button>
									<button onClick={() => skipTask(index)}>
										{task.skipped ? "取消跳過" : "標記跳過"}
									</button>
								</div>
							)}
						</div>
					))}
					</div>
				</details>
			</section>
			{focusIndex !== null ? (
				<section className="focus-panel">
					<small>
						{focusEnded
							? "時間到了・正在記錄你的專注成果"
							: focusPaused
								? "已暫停・可隨時繼續"
								: `正在專注・${tasks[focusIndex].subject}`}
					</small>
					<b>{focusTime}</b>
					<p>
						{focusEnded
							? "完整倒數結束後，系統會自動把任務記錄為完成。"
							: "離開或重新整理後會依實際時間繼續倒數。"}
					</p>
					<div className="focus-reward" aria-label="祈福木牌專注獎勵">
						<span>🌸 每專注 10 分鐘獲得 1 枚祈福木牌</span>
						<b>
							已累積 {focusRewardMinutes % 10}/10 分鐘・已獲得{" "}
							{focusPlanks} 枚
						</b>
					</div>
					{focusEnded ? (
						<div className="focus-actions">
							<span>正在更新今日任務…</span>
						</div>
					) : (
						<div className="focus-actions">
							<button
								onClick={focusPaused ? resumeFocus : pauseFocus}
							>
								{focusPaused ? "繼續專注" : "暫停"}
							</button>
							<button onClick={abandonFocus}>
								保留任務，先離開
							</button>
						</div>
					)}
				</section>
			) : pendingIndex < 0 ? (
				<section className="focus-panel complete">
					<b>今日全數完成 ✦</b>
					<p>你已累積能量與祈福木牌，明天繼續前進。</p>
				</section>
			) : null}
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
	const todayKey = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Taipei",
	}).format(new Date());
	// Update the dashboard immediately from the task state. The server response
	// remains the source of truth for previous days and reconciles after sync.
	const syncedTodayMinutes =
		learningDays.find((day) => day.date === todayKey)?.minutes ?? 0;
	const displayedWeeklyMinutes = Math.max(
		0,
		weeklyMinutes - syncedTodayMinutes + todayMinutes,
	);
	const displayedStreakDays = todayMinutes > 0 ? Math.max(1, streakDays) : 0;
	const todayRecord: LearningRecord = {
		date: todayKey,
		minutes: todayMinutes,
		tasks: tasks.map((task) => ({
			subject: task.subject,
			detail: task.detail,
			minutes: task.minutes,
			done: task.done,
		})),
	};
	const selectedRecord =
		(selectedLearningDate ?? todayKey) === todayKey
			? todayRecord
			: (learningRecords.find(
					(record) => record.date === selectedLearningDate,
				) ?? null);
	const openLearningRecord = (date: string) => setSelectedLearningDate(date);
	useEffect(() => {
		if (!selectedLearningDate) return;
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setSelectedLearningDate(null);
		};
		document.addEventListener("keydown", closeOnEscape);
		return () => document.removeEventListener("keydown", closeOnEscape);
	}, [selectedLearningDate]);
	const calendarData = useMemo(() => {
		const records = new Map(
			learningDays.map((day) => [day.date, day.minutes]),
		);
		if (todayMinutes) records.set(todayKey, todayMinutes);
		const year = calendarMonth.getFullYear();
		const month = calendarMonth.getMonth();
		const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const cells = Array.from(
			{ length: firstWeekday + daysInMonth },
			(_, index) => {
				if (index < firstWeekday) return null;
				const day = index - firstWeekday + 1;
				const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
				return {
					day,
					date,
					minutes: records.get(date) ?? 0,
					isToday: date === todayKey,
					isFuture: date > todayKey,
				};
			},
		);
		return {
			cells,
			monthLabel: new Intl.DateTimeFormat("zh-TW", {
				year: "numeric",
				month: "long",
			}).format(calendarMonth),
			activeDays: [...records.keys()].filter((date) =>
				date.startsWith(
					`${year}-${String(month + 1).padStart(2, "0")}`,
				),
			).length,
		};
	}, [calendarMonth, learningDays, todayMinutes, todayKey]);
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
			<section className={`countdown-plan-card countdown-${countdownPhase.id}`} aria-label="考試倒數計畫">
				<div className="countdown-plan-heading">
					<div>
						<span>考試倒數計畫・{countdownPhase.label}</span>
						<b>{countdownPhase.title}</b>
					</div>
					<strong>{daysLeft}<small> 天</small></strong>
				</div>
				<p>{countdownPhase.detail}</p>
				<ol>
					{countdownTasks.map((task, index) => (
						<li key={task.subject}>
							<i>{index + 1}</i>
							<div><b>{task.subject}</b><span>{task.detail}</span></div>
							<small>{task.minutes} 分</small>
						</li>
					))}
				</ol>
				<div className="countdown-plan-footer">
					<span>今日安排 {countdownTotalMinutes} 分鐘・弱科優先 {Math.round(countdownPhase.weakRatio * 100)}%</span>
					<button onClick={applyCountdownPlan} disabled={completed > 0}>
						{completed > 0 ? "明日自動更新" : "重新套用今日計畫"}
					</button>
				</div>
			</section>
			<div className="milestone-card">
				<p>你的下一個里程碑</p>
				<b>
					{completed === tasks.length
						? "完成今日任務，明天繼續"
						: `先完成 ${tasks[pendingIndex]?.subject ?? "今日任務"}`}
				</b>
				<span>小步累積，會比一次衝刺走得更遠。</span>
			</div>
			<button
				className="statistics-entry"
				onClick={() => {
					location.href = "/statistics";
				}}
			>
				<span>▦</span>
				<div>
					<b>讀書統計紀錄</b>
					<small>查看專注時間、連續學習與每日足跡</small>
				</div>
				<i>›</i>
			</button>
			<button
				className="achievement-wall-link"
				onClick={() => {
					location.href = "/badges";
				}}
			>
				<span>🏅</span>
				<div>
					<small>真實成就牆・已解鎖 {achievementUnlockedCount}/8</small>
					<b>{nextAchievement ?? "八枚真實成就已全數解鎖"}</b>
				</div>
				<i>›</i>
			</button>
			<section className="weakness-card" aria-label="錯題與弱點複習">
				<div className="weakness-heading">
					<div>
						<span>錯題／弱點追蹤</span>
						<b>把不熟的地方，練成下一次的底氣</b>
					</div>
					<i>{dueWeakQuestions.length}</i>
				</div>
				{weaknessNotice && (
					<p className="weakness-notice">{weaknessNotice}</p>
				)}
				{dueWeakQuestions.length === 0 ? (
					<p className="weakness-empty">
						{upcomingWeakQuestion
							? `下一題將在 ${upcomingWeakQuestion.nextReviewDate.slice(5).replace("-", "/")} 回流複習。`
							: "目前沒有到期錯題；答錯簽到題會在隔天與第 3 天回流。"}
					</p>
				) : (
					<div className="weakness-list">
						{dueWeakQuestions.map((item) => {
							const question =
								dailyCheckInQuestions[item.questionIndex];
							if (!question) return null;
							const isReviewing = reviewingWeakId === item.id;
							return (
								<article
									className="weakness-item"
									key={item.id}
								>
									<div className="weakness-item-summary">
										<div>
											<span>
												{question.subject}・第 {item.reviewStep} 輪回流複習
											</span>
											<b>{question.question}</b>
										</div>
										<button
											onClick={() => {
												setReviewingWeakId(
													isReviewing
														? null
														: item.id,
												);
												setWeakReviewFeedback(
													(current) => ({
														...current,
														[item.id]: "",
													}),
												);
											}}
										>
											{isReviewing ? "收起" : "再次作答"}
										</button>
									</div>
									{isReviewing && (
										<div className="weakness-review">
											<div
												className="weakness-options"
												role="radiogroup"
												aria-label={`${question.subject} 弱點複習答案`}
											>
												{question.choices.map(
													([key, label]) => (
														<button
															key={key}
															className={
																selectedWeakAnswers[
																	item.id
																] === key
																	? "selected"
																	: ""
															}
															onClick={() => {
																setSelectedWeakAnswers(
																	(
																		current,
																	) => ({
																		...current,
																		[item.id]:
																			key,
																	}),
																);
																setWeakReviewFeedback(
																	(
																		current,
																	) => ({
																		...current,
																		[item.id]:
																			"",
																	}),
																);
															}}
															aria-pressed={
																selectedWeakAnswers[
																	item.id
																] === key
															}
														>
															<b>{key}</b>
															<span>{label}</span>
														</button>
													),
												)}
											</div>
											<button
												className="weakness-submit"
												onClick={() =>
													submitWeakReview(item)
												}
											>
												確認複習答案
											</button>
											{weakReviewFeedback[item.id] && (
												<p>
													{
														weakReviewFeedback[
															item.id
														]
													}
												</p>
											)}
										</div>
									)}
								</article>
							);
						})}
					</div>
				)}
			</section>
			<section
				className="learning-calendar"
				aria-label="行事曆式學習進度"
			>
				<div className="calendar-header">
					<div>
						<p>學習行事曆</p>
						<b>{calendarData.monthLabel}</b>
					</div>
					<div className="calendar-controls">
						<button
							aria-label="上個月"
							onClick={() =>
								setCalendarMonth(
									(current) =>
										new Date(
											current.getFullYear(),
											current.getMonth() - 1,
											1,
										),
								)
							}
						>
							‹
						</button>
						<button
							className="calendar-today"
							onClick={() => setCalendarMonth(new Date())}
						>
							本月
						</button>
						<button
							aria-label="下個月"
							onClick={() =>
								setCalendarMonth(
									(current) =>
										new Date(
											current.getFullYear(),
											current.getMonth() + 1,
											1,
										),
								)
							}
						>
							›
						</button>
					</div>
				</div>
				<div className="calendar-legend">
					<span>
						<i className="legend-done" />
						完成學習
					</span>
					<span>
						<i className="legend-today" />
						今天
					</span>
					<b>{calendarData.activeDays} 天已累積</b>
				</div>
				<div className="calendar-weekdays">
					{["一", "二", "三", "四", "五", "六", "日"].map((day) => (
						<span key={day}>{day}</span>
					))}
				</div>
				<div className="calendar-grid">
					{calendarData.cells.map((cell, index) =>
						cell ? (
							<button
								type="button"
								key={cell.date}
								className={`calendar-day ${cell.minutes ? "has-learning" : ""} ${cell.isToday ? "is-today" : ""} ${cell.isFuture ? "is-future" : ""}`}
								onClick={() => openLearningRecord(cell.date)}
								aria-label={`查看 ${cell.date} 的學習紀錄`}
							>
								<b>{cell.day}</b>
								{cell.minutes ? (
									<small>{cell.minutes} 分</small>
								) : (
									<i>{cell.isToday ? "今天" : ""}</i>
								)}
							</button>
						) : (
							<span key={`blank-${index}`} aria-hidden="true" />
						),
					)}
				</div>
				<p className="calendar-note">
					有色日期代表已完成學習；點亮每一天，讓努力留下足跡。
				</p>
			</section>
			{selectedLearningDate && (
				<div
					className="calendar-record-backdrop"
					role="presentation"
					onMouseDown={() => setSelectedLearningDate(null)}
				>
					<section
						className="calendar-record"
						role="dialog"
						aria-modal="true"
						aria-labelledby="calendar-record-title"
						aria-live="polite"
						onMouseDown={(event) => event.stopPropagation()}
					>
						<div className="calendar-record-heading">
							<span id="calendar-record-title">當日學習紀錄</span>
							<b>
								{selectedRecord?.date ??
									selectedLearningDate ??
									todayKey}
							</b>
							<button
								className="calendar-record-close"
								onClick={() => setSelectedLearningDate(null)}
								aria-label="關閉當日學習紀錄"
							>
								×
							</button>
						</div>
						{selectedRecord?.tasks.length ? (
							<>
								<div className="calendar-record-summary">
									<b>{selectedRecord.minutes} 分鐘</b>
									<span>
										完成{" "}
										{
											selectedRecord.tasks.filter(
												(task) => task.done,
											).length
										}
										/{selectedRecord.tasks.length} 項任務
									</span>
								</div>
								<ul>
									{selectedRecord.tasks.map((task, index) => (
										<li
											key={`${task.subject}-${index}`}
											className={
												task.done ? "done" : "pending"
											}
										>
											<i>{task.done ? "✓" : "○"}</i>
											<div>
												<b>{task.subject}</b>
												<small>{task.detail}</small>
											</div>
											<span>{task.minutes} 分</span>
										</li>
									))}
								</ul>
							</>
						) : (
							<div className="calendar-record-empty">
								<span aria-hidden="true">◌</span>
								<b>尚無學習紀錄</b>
								<p>這一天尚未建立或同步學習紀錄。</p>
							</div>
						)}
					</section>
				</div>
			)}
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
						location.href = "/statistics";
					}}
				>
					<span className="quick-icon stats">▦</span>
					<b>讀書統計</b>
					<small>紀錄・連續學習</small>
				</button>
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
						{displayedWeeklyMinutes}
						<small> 分鐘</small>
					</b>
					<p>把每一次專注，累積成看得見的進步。</p>
				</div>
				<div className="streak-mark">
					<span>🔥</span>
					<b>
						{displayedStreakDays}
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
						完成 {completed}/{tasks.length} 項任務・專注{" "}
						{todayMinutes} 分鐘
					</small>
				</div>
				<i>›</i>
			</button>
			<button
				className="badge-collection-link"
				onClick={() => {
					location.href = "/badges";
				}}
			>
				<span>🏅</span>
				<div>
					<b>真實成就牆</b>
					<small>完整專注、連續簽到與克服弱點才會解鎖</small>
				</div>
				<i>›</i>
			</button>
			{showSettlement && (
				<div
					className="settlement-backdrop"
					role="dialog"
					aria-modal="true"
				>
					<section className="settlement-modal">
						<button
							className="settlement-close"
							onClick={closeSettlement}
						>
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
						<button
							className="settlement-share"
							onClick={shareResult}
						>
							分享今日成果 ↗
						</button>
						<button
							className="settlement-done"
							onClick={closeSettlement}
						>
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
						{displayedStreakDays}
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
	const prayerView = (
		<section className="journey">
			<p className="eyebrow">智慧宮廟・學習文化回饋</p>
			<h1>
				為真實完成留下記號
				<br />
				<em>讓祈福陪你養成習慣。</em>
			</h1>
			<section
				className={`daily-fortune-task ${dailyFortuneTask.done ? "is-complete" : ""}`}
				aria-label="每日學習紀錄"
			>
				<div className="daily-fortune-task-heading">
					<b>每日學習簽到</b>
					<small>
					{dailyFortuneTask.done ? "今日已留存" : "完成任務後開放"}
					</small>
				</div>
				<p className="daily-fortune-verse">「{dailyFortune.verse}」</p>
				<div className="daily-classic">
					<i aria-hidden="true">
						{dailyFortuneTask.done ? "✓" : "典"}
					</i>
					<div>
						<span>今日典籍・{dailyClassic.title}</span>
						<strong>{dailyClassic.passage}</strong>
						<small>{dailyClassic.note}</small>
					</div>
				</div>
				<button
					onClick={() => {
						setSelectedDailyAnswer(null);
						setDailyAnswerFeedback("");
						setDailyCheckInDialogOpen(true);
					}}
					disabled={dailyFortuneTask.done || completed < 1}
				>
					{dailyFortuneTask.done
					? "今日學習紀錄已留存 ✓"
						: completed < 1
							? "先完成 1 項專注任務"
							: "翻開典籍・進行今日簽到"}
				</button>
				{!dailyFortuneTask.done && completed < 1 && (
					<p className="daily-fortune-feedback">
						完成至少一項完整專注任務後，才會開放今日簽到。
					</p>
				)}
				{dailyAnswerFeedback && (
					<p
						className={`daily-fortune-feedback ${dailyFortuneTask.done ? "correct" : ""}`}
					>
						{dailyAnswerFeedback}
					</p>
				)}
				{dailyFortuneTask.done && (
					<section
						className="daily-small-step"
						aria-label="簽到後的今日一小步"
					>
						<div className="daily-small-step-copy">
							<i aria-hidden="true">一</i>
							<div>
								<span>簽到後的今日一小步・{dailySmallStep.minutes} 分鐘</span>
								<b>{dailySmallStep.title}</b>
								<small>{dailySmallStep.detail} 完成紀錄請以專注任務計時為準。</small>
							</div>
						</div>
					</section>
				)}
				<section className="checkin-milestones" aria-label="連續簽到里程碑">
					<div className="checkin-milestones-heading">
						<div>
							<span>連續簽到</span>
							<b>{checkInStreak} 天</b>
						</div>
						<small>
							{nextCheckInMilestone
								? `再 ${nextCheckInMilestone.days - checkInStreak} 天解鎖「${nextCheckInMilestone.title}」`
								: "四枚木牌已全數解鎖"}
						</small>
					</div>
					<ol>
						{checkInMilestones.map((milestone) => {
							const unlocked = checkInStreak >= milestone.days;
							return (
								<li key={milestone.days} className={unlocked ? "unlocked" : ""}>
									<i aria-hidden="true">{unlocked ? milestone.plaque : "·"}</i>
									<div>
										<b>{milestone.days} 日・{milestone.title}</b>
										<span>{unlocked ? milestone.detail : "持續簽到以解鎖"}</span>
									</div>
								</li>
							);
						})}
					</ol>
				</section>
				<p className="daily-fortune-note">
					典籍問答是今日的學習回望；祈福木牌只會在完整專注任務結束後自動點亮。
				</p>
			</section>
			{dailyCheckInDialogOpen && (
				<div
					className="daily-checkin-backdrop"
					role="presentation"
					onMouseDown={() => setDailyCheckInDialogOpen(false)}
				>
					<section
						className="daily-checkin-dialog"
						role="dialog"
						aria-modal="true"
						aria-labelledby="daily-checkin-title"
						onMouseDown={(event) => event.stopPropagation()}
					>
						<button
							className="daily-checkin-close"
							aria-label="關閉簽到題目"
							onClick={() => setDailyCheckInDialogOpen(false)}
						>
							×
						</button>
						<span>今日典籍問答</span>
						<h2 id="daily-checkin-title">{dailyClassic.title}</h2>
						<p className="daily-checkin-passage">
							「{dailyClassic.passage}」
						</p>
						<div className="daily-checkin-question">
							<small>
								{dailyCheckInQuestion.subject}・今日簽到題
							</small>
							<b>{dailyCheckInQuestion.question}</b>
						</div>
						<div
							className="daily-checkin-options"
							role="radiogroup"
							aria-label="選擇今日簽到題答案"
						>
							{dailyCheckInQuestion.choices.map(
								([key, label]) => (
									<button
										key={key}
										className={
											selectedDailyAnswer === key
												? "selected"
												: ""
										}
										onClick={() => {
											setSelectedDailyAnswer(key);
											setDailyAnswerFeedback("");
										}}
										aria-pressed={
											selectedDailyAnswer === key
										}
									>
										<b>{key}</b>
										<span>{label}</span>
									</button>
								),
							)}
						</div>
						{dailyAnswerFeedback && (
							<p className="daily-fortune-feedback">
								{dailyAnswerFeedback}
							</p>
						)}
						<button
							className="daily-checkin-submit"
							onClick={completeDailyCheckIn}
						>
							確認答案・完成簽到
						</button>
					</section>
				</div>
			)}
			{checkInCeremonyOpen && (
				<div className="checkin-ceremony" role="presentation">
					<section
						className="checkin-ceremony-card"
						role="dialog"
						aria-modal="true"
						aria-labelledby="checkin-ceremony-title"
					>
						<div className="checkin-ceremony-rays" aria-hidden="true" />
						<p className="checkin-ceremony-kicker">今日修習留存</p>
						<div className="checkin-ceremony-seal" aria-hidden="true">
							<span>✓</span>
						</div>
						<h2 id="checkin-ceremony-title">學習紀錄完成</h2>
						<p className="checkin-ceremony-message">
							{newlyUnlockedMilestone
								? `連續 ${newlyUnlockedMilestone.days} 天簽到，已解鎖「${newlyUnlockedMilestone.title}」。`
								: "你已翻開今日典籍，也為目標留下一次踏實的前進。"}
						</p>
						<div className="checkin-ceremony-plaque">
							<i aria-hidden="true">學</i>
							<div>
								<span>文化回饋</span>
								<b>今日學習已留存</b>
							</div>
						</div>
						<div className="checkin-ceremony-step">
							<span>接著做一小步・{dailySmallStep.minutes} 分鐘</span>
							<b>{dailySmallStep.title}</b>
						</div>
						<p className="checkin-ceremony-date">願你把這份專注，帶進今天的每一段學習。</p>
						<button onClick={() => setCheckInCeremonyOpen(false)} autoFocus>
							收下祝福
						</button>
					</section>
				</div>
			)}
			<section className="cultural-reward-card" aria-label="文化化的學習回饋">
				<div className="cultural-reward-heading">
					<div className="cultural-scene-seal" aria-hidden="true">{activeCulturalScene.seal}</div>
					<div>
						<span>完成任務後的文化回饋</span>
						<b>{activeCulturalScene.title}</b>
						<p>{activeCulturalScene.detail}</p>
					</div>
					<div className="cultural-plank-count">
						<b>{planks}</b><span>已點亮木牌</span>
					</div>
				</div>
				<div className="cultural-proof">
					<div><b>{focusSessionsCompleted}</b><span>次完整專注</span></div>
					<div><b>{focusRewardMinutes}</b><span>分鐘真實累積</span></div>
					<div><b>{checkInStreak}</b><span>天學習連續</span></div>
				</div>
				<ol className="cultural-scene-path" aria-label="祈願場景解鎖進度">
					{culturalScenes.slice(1).map((scene) => {
						const unlocked = checkInStreak >= scene.days;
						return <li key={scene.days} className={unlocked ? "unlocked" : ""}>
							<i aria-hidden="true">{unlocked ? scene.seal : "·"}</i>
							<div><b>{scene.days} 日・{scene.title}</b><span>{unlocked ? "已由真實完成解鎖" : `還需連續學習 ${scene.days - checkInStreak} 天`}</span></div>
						</li>;
					})}
				</ol>
				<p className="cultural-reward-note">
					{nextCulturalScene ? `下一個場景：${nextCulturalScene.title}。完成完整專注任務、留下今日學習紀錄，讓場景隨習慣自然開展。` : "所有祈願場景皆已由你的真實學習完成解鎖。"}
				</p>
			</section>
			<section className="oracle-card" aria-label="文昌求籤" hidden>
				<div className="oracle-heading">
					<div>
						<span>文昌靈籤</span>
						<b>求一支給今天的指引</b>
					</div>
					<div className="oracle-balance">
						<span>祈福木牌</span>
						<b>
							{availablePlanks}
							<small> 枚</small>
						</b>
					</div>
				</div>
				{oracleStage === "idle" && (
					<div className="oracle-exchange">
						<div className="oracle-tube" aria-hidden="true">
							<i />
							<i />
							<i />
							<i />
							<i />
							<i />
						</div>
						<div>
							<b>以祈福木牌換取籤緣</b>
							<p>
								每 3 枚木牌可兌換 1
								次求籤機會；籤詩將依你親自選取的籤枝揭曉。
							</p>
							<button
								onClick={exchangeOracleTicket}
								disabled={availablePlanks < 3}
							>
								{availablePlanks >= 3
									? "兌換 1 次求籤機會"
									: `還差 ${3 - availablePlanks} 枚木牌`}
							</button>
						</div>
					</div>
				)}
				{oracleStage === "choosing" && (
					<div className="oracle-choice">
						<p>閉上眼想著此刻的心願，從籤筒裡親自選出一支籤。</p>
						<div
							className="fortune-sticks"
							role="group"
							aria-label="選擇一支籤"
						>
							{fortunePoems.map((_, index) => (
								<button
									className={`fortune-stick ${selectedStick === index ? "selected" : ""}`}
									key={index}
									onClick={() => setSelectedStick(index)}
									aria-label={`選擇第 ${index + 1} 支籤`}
								>
									<i>{index + 1}</i>
								</button>
							))}
						</div>
						<button
							className="oracle-draw-button"
							onClick={drawFortune}
							disabled={selectedStick === null}
						>
							請取第{" "}
							{selectedStick === null ? "—" : selectedStick + 1}{" "}
							籤 <span>→</span>
						</button>
					</div>
				)}
				{oracleStage === "drawing" && (
					<div className="oracle-drawing" aria-live="polite">
						<div className="oracle-tube shaking" aria-hidden="true">
							<i />
							<i />
							<i />
							<i />
							<i />
							<i />
							<span className="oracle-drawn-stick">
								{selectedStick !== null
									? selectedStick + 1
									: ""}
							</span>
						</div>
						<b>籤筒正在為你搖出指引</b>
						<small>靜心片刻，讓選中的籤枝自己浮現</small>
					</div>
				)}
				{oracleStage === "result" && oracleResultId !== null && (
					<div className="oracle-result">
						<div className="oracle-result-display">
							<div
								className="oracle-result-stick"
								aria-hidden="true"
							>
								<b>{oracleResultId + 1}</b>
							</div>
							<div className="oracle-lot-paper">
								<div className="oracle-lot-heading">
									<span>WENCHANG LOT</span>
									<b>第 {oracleResultId + 1} 籤</b>
								</div>
								<i className="oracle-seal">文昌</i>
								<div className="oracle-lot-body">
									<strong className="oracle-luck">
										吉<br />籤
									</strong>
									<div>
										<h2>
											{fortunePoems[oracleResultId].title}
										</h2>
										<p className="oracle-verse">
											{fortunePoems[oracleResultId].verse}
										</p>
										<p className="oracle-interpret-label">
											【解曰】
										</p>
										<p className="oracle-reading-copy">
											{
												fortunePoems[oracleResultId]
													.reading
											}
										</p>
									</div>
								</div>
								<small>
									<span>誠心求籤</span>
									<span>靜心解籤</span>
								</small>
							</div>
						</div>
						<div className="oracle-result-actions">
							<button onClick={drawAgain}>
								{oracleTickets > 0 ? "再求一籤" : "回到籤筒"}
							</button>
							{availablePlanks >= 3 && (
								<button
									className="oracle-exchange-small"
									onClick={exchangeOracleTicket}
								>
									再兌換 1 次
								</button>
							)}
						</div>
					</div>
				)}
			</section>
			<section className="wish-card">
				<div className="wish-card-heading">
					<div>
						<span>願望小記</span>
						<b>寫下你的祈願</b>
						<p>留在這裡，或分享一段匿名的祝福。</p>
					</div>
					<i aria-hidden="true">✦</i>
				</div>
				<div className="wish-composer">
					<input
						value={wish}
						onChange={(event) => setWish(event.target.value)}
						placeholder="例如：希望今天能專心完成數學"
						maxLength={40}
					/>
					<button onClick={saveWish}>留存</button>
				</div>
				{wishes.length > 0 && (
					<div className="ema-board">
						{wishes.map((item, index) => (
							<div
								className="ema-plaque"
								key={`${item}-${index}`}
							>
								<div className="ema-string"></div>
								<p>{item}</p>
							</div>
						))}
					</div>
				)}
				{wishReflections.some(
					(item) => daysSinceWish(item.createdAt) >= 7,
				) && (
					<section className="wish-review" aria-label="願望回顧">
						<div className="wish-review-heading">
							<div>
								<span>給未來的自己</span>
								<b>願望回顧</b>
							</div>
							<i>⏳</i>
						</div>
						<p>
							把當初的心願留給時間。第 7 天與第 30
							天，回來看看自己已走了多遠。
						</p>
						<div className="wish-review-list">
							{wishReflections
								.filter(
									(item) =>
										daysSinceWish(item.createdAt) >= 7,
								)
								.map((item) => {
									const elapsed = daysSinceWish(
										item.createdAt,
									);
									return (
										<article
											key={item.id}
											className="wish-review-item"
										>
											<strong>「{item.text}」</strong>
											<div className="wish-review-milestones">
												<button
													className={
														item.reviewedAfter7Days
															? "done"
															: ""
													}
													onClick={() =>
														!item.reviewedAfter7Days &&
														completeWishReview(
															item.id,
															7,
														)
													}
													disabled={
														item.reviewedAfter7Days
													}
												>
													{item.reviewedAfter7Days
														? "第 7 天已回望 ✓"
														: "回顧第 7 天"}
												</button>
												{elapsed >= 30 && (
													<button
														className={
															item.reviewedAfter30Days
																? "done"
																: ""
														}
														onClick={() =>
															!item.reviewedAfter30Days &&
															completeWishReview(
																item.id,
																30,
															)
														}
														disabled={
															item.reviewedAfter30Days
														}
													>
														{item.reviewedAfter30Days
															? "第 30 天已回望 ✓"
															: "回顧第 30 天"}
													</button>
												)}
											</div>
										</article>
									);
								})}
						</div>
					</section>
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
				body: JSON.stringify({
					idToken,
					enabled: draftRemindersEnabled,
					morningTime: draftMorningTime,
					eveningTime: draftEveningTime,
				}),
			});
			const result = (await response.json()) as { error?: string };
			if (!response.ok)
				throw new Error(
					result.error ?? "通知偏好暫時無法儲存，請稍後再試。",
				);
			setRemindersEnabled(draftRemindersEnabled);
			setMorningTime(draftMorningTime);
			setEveningTime(draftEveningTime);
			setEditingNotifications(false);
			setSyncStatus("通知偏好已儲存至 LINE 帳號");
		} catch (error) {
			setSyncStatus(
				error instanceof Error
					? error.message
					: "通知偏好暫時無法儲存，請稍後再試。",
			);
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
							<b className="notification-sync-state">
								{lineName
									? remindersEnabled
										? "已啟用"
										: "已關閉"
									: "尚未啟用"}
							</b>
							{lineName && !editingNotifications && (
								<button
									onClick={
										lineName
											? beginEditNotifications
											: login
									}
								>
									{lineName ? "修改" : "登入後設定"}
								</button>
							)}
						</div>
					</div>
					{!lineName ? (
						<>
							<p className="notification-login-notice">
								請先登入 LINE，才能儲存通知偏好
							</p>
							<button
								className="notification-login"
								onClick={login}
							>
								登入 LINE 後設定早晚提醒 <span>›</span>
							</button>
						</>
					) : editingNotifications ? (
						<>
							<label className="notification-toggle">
								<span>啟用 LINE 學習提醒</span>
								<input
									type="checkbox"
									checked={draftRemindersEnabled}
									onChange={(event) =>
										setDraftRemindersEnabled(
											event.target.checked,
										)
									}
								/>
							</label>
							<div className="notification-times">
								<label>
									<span>早晨提醒</span>
									<input
										aria-label="早晨提醒時間"
										type="time"
										value={draftMorningTime}
										disabled={!draftRemindersEnabled}
										onChange={(event) =>
											setDraftMorningTime(
												event.target.value,
											)
										}
									/>
								</label>
								<label>
									<span>晚間提醒</span>
									<input
										aria-label="晚間提醒時間"
										type="time"
										value={draftEveningTime}
										disabled={!draftRemindersEnabled}
										onChange={(event) =>
											setDraftEveningTime(
												event.target.value,
											)
										}
									/>
								</label>
							</div>
							<div className="notification-actions">
								<button
									className="cancel"
									onClick={() =>
										setEditingNotifications(false)
									}
								>
									取消
								</button>
								<button
									className="save"
									onClick={saveNotifications}
									disabled={savingNotifications}
								>
									{savingNotifications
										? "儲存中…"
										: "儲存設定"}
								</button>
							</div>
						</>
					) : (
						<div className="notification-summary">
							<div>
								<span>早晨提醒</span>
								<b>{formatReminderTime(morningTime)}</b>
							</div>
							<div>
								<span>晚間提醒</span>
								<b>{formatReminderTime(eveningTime)}</b>
							</div>
						</div>
					)}
					<small className="notification-timezone">
						台灣時間・設定會同步至你的 LINE 帳號
					</small>
					{lineName && (
						<button
							className="notification-test"
							onClick={reminder}
							disabled={!remindersEnabled}
						>
							{remindersEnabled
								? "傳送 LINE OA 測試提醒"
								: "請先啟用提醒後再測試"}
							<span>›</span>
						</button>
					)}
				</section>
				<section className="weekly-care-card" aria-label="每週關懷摘要">
					<div><span>每週關懷摘要</span><b>只看學習趨勢，不顯示題目內容</b><small>包含完成率、專注時間與最需要加強的科目。</small></div>
					<div className="care-audience" role="radiogroup" aria-label="摘要版本">
						{(["self", "teacher", "parent"] as const).map((audience) => <button key={audience} className={careSummaryAudience === audience ? "selected" : ""} onClick={() => setCareSummaryAudience(audience)} aria-pressed={careSummaryAudience === audience}>{audience === "self" ? "本人版" : audience === "teacher" ? "教師版" : "家長版"}</button>)}
					</div>
					<button className="weekly-care-send" onClick={sendWeeklyCareSummary}>{lineName ? "推播本週摘要到 LINE OA" : "登入 LINE 後推播摘要"}</button>
					<small className="weekly-care-note">教師／家長版會先推播至你的 LINE，可自行分享給已取得同意的對象。</small>
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
									void enqueueSync(tasks);
								}
							: login
					}
				>
					<span>↻</span>
					<div>
						<strong>
							{lineName ? "立即同步學習紀錄" : "連結 LINE 帳號"}
						</strong>
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
							window.confirm(
								"確定要登出 LINE 帳號嗎？本機計畫不會被刪除。",
							)
						) {
							liff.logout();
							location.reload();
						}
					}}
				>
					登出 LINE 帳號
				</button>
			)}
			{syncStatus && (
				<small className="reminder-status">{syncStatus}</small>
			)}
		</section>
	);
	if (!hydrated)
		return (
			<main>
				<section
					className="app-shell app-loading"
					aria-busy="true"
					aria-label="載入學習計畫"
				>
					<span className="brand-mark">⛩</span>
					<p>正在載入今日學習計畫…</p>
				</section>
			</main>
		);
	return (
		<main>
			<section className="app-shell">
				{/* 1. 把煙霧結構移到 app-shell 裡面，這樣煙霧才會在手機畫面內飄動 */}
				<div className="incense-smoke-wrapper" aria-hidden="true">
					{/* 左側香爐的煙霧群 (3股) */}
					<div className="smoke-group left-group">
						<div className="smoke smoke-1"></div>
						<div className="smoke smoke-2"></div>
						<div className="smoke smoke-3"></div>
					</div>
					{/* 右側香爐的煙霧群 (3股) */}
					<div className="smoke-group right-group">
						<div className="smoke smoke-4"></div>
						<div className="smoke smoke-5"></div>
						<div className="smoke smoke-6"></div>
					</div>
				</div>

				<header className="topbar">
					<div className="topbar-inner">
						<div className="brand">
							<span className="brand-mark">文</span>
							<div className="brand-copy">
								<strong>文昌同行</strong>
								<small>學習路上，與你同行</small>
							</div>
						</div>
						<div className="account">
							<button
								className="account-capsule"
								onClick={lineName ? () => navigateToTab("profile") : login}
							>
								<span
									className="line-status-dot"
									aria-hidden="true"
								/>
								<span>
									{lineName ? `${lineName}・我的` : "LINE 登入"}
								</span>
								<i aria-hidden="true">
									{lineName?.slice(0, 1) ?? "我"}
								</i>
							</button>
						</div>
					</div>
				</header>
				<nav className={`primary-nav ${navVisible ? "is-visible" : "is-hidden"}`} aria-label="主要導覽">
					<button
						className={tab === "today" ? "active" : ""}
						onClick={() => navigateToTab("today")}
					>
						<i aria-hidden="true">☀</i>
						<span>今日</span>
					</button>
					<button
						className={tab === "progress" ? "active" : ""}
						onClick={() => navigateToTab("progress")}
					>
						<i aria-hidden="true">▤</i>
						<span>進度</span>
					</button>
					<button
						className={tab === "prayer" ? "active" : ""}
						onClick={() => navigateToTab("prayer")}
					>
						<i aria-hidden="true">✦</i>
						<span>祈福</span>
					</button>
					<button
						className={tab === "profile" ? "active" : ""}
						onClick={() => navigateToTab("profile")}
					>
						<i aria-hidden="true">☺</i>
						<span>我的</span>
					</button>
				</nav>
				{tab === "today" ? (
					<>
						{today}
						{quickActions}
					</>
				) : tab === "progress" ? (
					progressView
				) : tab === "prayer" ? (
					prayerView
				) : (
					profileView
				)}
				{focusPickerTaskIndex !== null &&
					tasks[focusPickerTaskIndex] && (
						<div
							className="focus-mode-backdrop"
							role="presentation"
						>
							<section
								className="focus-mode-dialog"
								role="dialog"
								aria-modal="true"
								aria-labelledby="focus-mode-title"
							>
								<button
									className="focus-modal-close"
									onClick={() =>
										setFocusPickerTaskIndex(null)
									}
									aria-label="關閉選擇專注模式"
								>
									×
								</button>
								<span>靜心開始</span>
								<h2 id="focus-mode-title">
									完成這次的
									<br />
									<em>完整專注</em>
								</h2>
								<p>
									{tasks[focusPickerTaskIndex].subject}・
									{tasks[focusPickerTaskIndex].detail}
								</p>
								<div className="focus-mode-list">
									<button onClick={beginFocus}>
										<b>
											{tasks[focusPickerTaskIndex].minutes}
											<small> 分鐘</small>
										</b>
										<div>
											<strong>完成這項任務</strong>
											<span>完整倒數結束後，系統會自動記錄完成</span>
										</div>
										<i>開始 →</i>
									</button>
								</div>
								<small className="focus-mode-note">
									完整專注每滿 10 分鐘，可獲得 1 枚祈福木牌。
								</small>
							</section>
						</div>
					)}
				{focusIndex !== null && tasks[focusIndex] && (
					<div
						className="focus-immersive"
						role="dialog"
						aria-modal="true"
						aria-labelledby="focus-session-title"
					>
						<div className="focus-session-top">
							<span>文昌同行・專注時刻</span>
							<button onClick={abandonFocus}>先離開</button>
						</div>
						<div className="focus-session-content">
							<p>
								{focusEnded
									? "專注時間到"
									: focusPaused
										? "先深呼吸，再回到這一題"
										: `${tasks[focusIndex].subject}・${tasks[focusIndex].detail}`}
							</p>
							<h2 id="focus-session-title">{focusTime}</h2>
							<span className="focus-session-goal">
								{focusEnded
									? "正在自動記錄任務完成"
									: `本次目標・專注 ${focusScheduledMinutes} 分鐘`}
							</span>
							<div className="focus-session-progress">
								<i
									style={{
										width: `${Math.max(0, Math.min(100, 100 - (focusSeconds / Math.max(1, focusScheduledMinutes * 60)) * 100))}%`,
									}}
								/>
							</div>
							<small>
								{focusEnded
									? "完整倒數已結束，正在更新今日任務。"
									: `每滿 10 分鐘可獲得祈福木牌・本次已守住 ${Math.max(0, focusScheduledMinutes - Math.ceil(focusSeconds / 60))} 分鐘`}
							</small>
						</div>
						<div className="focus-session-actions">
							{focusEnded ? (
								<span className="focus-confirm">正在記錄完成…</span>
							) : (
								<>
									<button
										className="focus-confirm"
										onClick={
											focusPaused
												? resumeFocus
												: pauseFocus
										}
									>
										{focusPaused ? "繼續專注" : "暫停"}
									</button>
									<button onClick={abandonFocus}>
										保留任務，先離開
									</button>
								</>
							)}
						</div>
					</div>
				)}
				{tab === "today" && (
					<a
						className="line-official-banner"
						href="https://lin.ee/nNsez9Q"
						target="_blank"
						rel="noreferrer"
						aria-label="加入文昌同行 LINE 官方好友"
					>
						<img
							src="/line-official-banner.png"
							alt="加入文昌同行 LINE 官方好友"
						/>
					</a>
				)}
				{sleepReminderOpen && (
					<div
						className="sleep-reminder-backdrop"
						role="presentation"
						onMouseDown={() => setSleepReminderOpen(false)}
					>
						<section
							className="sleep-reminder-dialog"
							role="dialog"
							aria-modal="true"
							aria-labelledby="sleep-reminder-title"
							onMouseDown={(event) => event.stopPropagation()}
						>
							<div className="sleep-reminder-moon" aria-hidden="true">☾</div>
							<span>今晚的溫柔提醒</span>
							<h2 id="sleep-reminder-title">22:30 前結束複習</h2>
							<p>讓大腦好好休息。睡得夠，明天才能把今天讀過的內容真正記住。</p>
							<button onClick={() => setSleepReminderOpen(false)}>知道了，準備收心</button>
						</section>
					</div>
				)}
			</section>
		</main>
	);
}
