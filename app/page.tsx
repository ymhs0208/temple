"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import liff from "@line/liff";
import { confirmAction } from "../lib/confirm-action";
import { NotificationPreview } from "./notification-preview";
import { WeeklySummaryCard } from "./weekly-summary-card";
import { fortunePoems } from "../lib/fortune-poems";
import "./integrated-header.css";
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
	oracleWelcomeGranted?: boolean;
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
	const [oracleTickets, setOracleTickets] = useState(1);
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
	const [completionFeedback, setCompletionFeedback] = useState<{ subject: string; completedCount: number; totalCount: number; remainingMinutes: number; streak: number } | null>(null);
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
	const [draftRemindersEnabled, setDraftRemindersEnabled] = useState(true);
	const [draftMorningTime, setDraftMorningTime] = useState("08:00");
	const [draftEveningTime, setDraftEveningTime] = useState("20:30");
	const [notificationKinds, setNotificationKinds] = useState({ morningEnabled: true, eveningEnabled: true, weeklyEnabled: false });
	const [draftNotificationKinds, setDraftNotificationKinds] = useState(notificationKinds);
	const [notificationPreferencesReady, setNotificationPreferencesReady] = useState(false);
	const [notificationPreferencesError, setNotificationPreferencesError] = useState(false);
	const [showSettlement, setShowSettlement] = useState(false);
	const [sleepReminderOpen, setSleepReminderOpen] = useState(false);
	const [focusIndex, setFocusIndex] = useState<number | null>(null);
	const [focusSeconds, setFocusSeconds] = useState(0);
	const [focusScheduledMinutes, setFocusScheduledMinutes] = useState(0);
	const [focusRewardMinutes, setFocusRewardMinutes] = useState(0);
	const [focusEndsAt, setFocusEndsAt] = useState<number | null>(null);
	const [focusPaused, setFocusPaused] = useState(false);
	const [focusNoiseEnabled, setFocusNoiseEnabled] = useState(false);
	const [focusNoiseVolume, setFocusNoiseVolume] = useState(0.12);
	const focusNoiseRef = useRef<{ context: AudioContext; source: AudioBufferSourceNode; gain: GainNode } | null>(null);
	const [focusEnded, setFocusEnded] = useState(false);
	const [focusPickerTaskIndex, setFocusPickerTaskIndex] = useState<
		number | null
	>(null);
	const [unlockCelebration, setUnlockCelebration] = useState<{
		title: string;
		detail: string;
		icon: string;
	} | null>(null);
	const previousAchievementCount = useRef<number | null>(null);
	const [hydrated, setHydrated] = useState(false);
	const [onboardingOpen, setOnboardingOpen] = useState(false);
	const [onboardingStep, setOnboardingStep] = useState(0);
	const syncQueue = useRef(Promise.resolve(true));
	const navigateToTab = (nextTab: Tab) => {
		setTab(nextTab);
		if (window.location.pathname !== tabPaths[nextTab])
			window.history.pushState(null, "", tabPaths[nextTab]);
		window.scrollTo({ top: 0, behavior: "instant" });
	};
	useEffect(() => {
		const syncTabFromUrl = () => setTab(tabFromPath(window.location.pathname));
		window.addEventListener("popstate", syncTabFromUrl);
		return () => window.removeEventListener("popstate", syncTabFromUrl);
	}, []);
	useEffect(() => {
		setHydrated(true);
	}, []);
	useEffect(() => {
		if (hydrated && !localStorage.getItem("wenchang-onboarding-complete")) setOnboardingOpen(true);
	}, [hydrated]);
	const onboardingSteps = [
		{ icon: "✓", title: "今日", detail: "安排今天的學習任務，開始專注並直接勾選完成。" },
		{ icon: "▥", title: "進度", detail: "查看專注時間、完成率與最近的學習趨勢。" },
		{ icon: "✦", title: "祈福", detail: "完成簽到、求一支學習籤，也能到匿名祈福牆留下祝福。" },
		{ icon: "⛩", title: "巡禮", detail: "到合作宮廟掃描 QR Code，探索故事並收藏文化碎片。" },
	] as const;
	const finishOnboarding = () => {
		localStorage.setItem("wenchang-onboarding-complete", "true");
		setOnboardingOpen(false);
	};
	useEffect(() => {
		if (!focusNoiseEnabled || focusIndex === null) {
			focusNoiseRef.current?.source.stop();
			focusNoiseRef.current?.context.close();
			focusNoiseRef.current = null;
			return;
		}
		if (focusNoiseRef.current) {
			focusNoiseRef.current.gain.gain.value = focusNoiseVolume;
			return;
		}
		const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AudioContextClass) return;
		const context = new AudioContextClass();
		const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
		const data = buffer.getChannelData(0);
		for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
		const source = context.createBufferSource();
		const gain = context.createGain();
		source.buffer = buffer;
		source.loop = true;
		gain.gain.value = focusNoiseVolume;
		source.connect(gain).connect(context.destination);
		source.start();
		focusNoiseRef.current = { context, source, gain };
		return () => {
			if (focusNoiseRef.current?.source === source) {
				source.stop();
				void context.close();
				focusNoiseRef.current = null;
			}
		};
	}, [focusNoiseEnabled, focusNoiseVolume, focusIndex]);
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
					setOracleTickets(data.oracleWelcomeGranted ? data.oracleTickets : data.oracleTickets + 1);
				if (!data.oracleWelcomeGranted) {
					localStorage.setItem("wenchang-mvp", JSON.stringify({ ...data, oracleWelcomeGranted: true, oracleTickets: (data.oracleTickets ?? 0) + 1 }));
				}
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
				oracleWelcomeGranted: true,
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
				setNotificationKinds({ morningEnabled: data.morningEnabled ?? true, eveningEnabled: data.eveningEnabled ?? true, weeklyEnabled: data.weeklyEnabled ?? false });
				setNotificationPreferencesError(false);
				setNotificationPreferencesReady(true);
			})
			.catch(() => {
				setNotificationPreferencesError(true);
				setNotificationPreferencesReady(false);
			});
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
	const achievementUnlocks = [
		{ title: "初定心", detail: "完成第 1 次完整專注", icon: "一" },
		{ title: "十次凝神", detail: "完成 10 次完整專注", icon: "十" },
		{ title: "靜讀三十", detail: "完成 30 次完整專注", icon: "三十" },
		{ title: "三日晨課", detail: "連續完成 3 天學習簽到", icon: "初" },
		{ title: "七日守志", detail: "連續完成 7 天學習簽到", icon: "七" },
		{ title: "半月精進", detail: "連續完成 14 天學習簽到", icon: "半" },
		{ title: "破題開悟", detail: "完成第 1 題弱點回流複習", icon: "破" },
		{ title: "五關皆過", detail: "克服 5 題回流弱點", icon: "五" },
	] as const;
	useEffect(() => {
		if (!hydrated) return;
		if (previousAchievementCount.current === null) {
			previousAchievementCount.current = achievementUnlockedCount;
			return;
		}
		if (achievementUnlockedCount > previousAchievementCount.current) {
			const unlocked = achievementUnlocks[achievementUnlockedCount - 1];
			if (unlocked) setUnlockCelebration(unlocked);
		}
		previousAchievementCount.current = achievementUnlockedCount;
	}, [achievementUnlockedCount, hydrated]);
	// 木牌只由完整計時結束的專注任務累積；不以抽選、登入或點擊給予。
	const planks = focusPlanks;
	// 木牌可兌換求籤機會；兌換不會產生新的木牌。
	const availablePlanks = Math.max(0, planks - oraclePlanksSpent);
	const minutesToNextPlank = focusRewardMinutes % 10 === 0 ? 10 : 10 - (focusRewardMinutes % 10);
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
	const startWelcomeOracle = () => {
		if (oracleTickets < 1) return;
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
	const toggleTask = (index: number) => {
		const task = tasks[index];
		if (!task || task.skipped) return;
		setTasks((current) => {
			const next = current.map((item, taskIndex) =>
				taskIndex === index ? { ...item, done: !item.done } : item,
			);
			void enqueueSync(next);
			return next;
		});
		setCompletionFeedback({
			subject: completedTask.subject,
			completedCount,
			totalCount: tasks.length,
			remainingMinutes: tasks.reduce((sum, task, index) => sum + (index !== focusIndex && !task.done && !task.skipped ? task.minutes : 0), 0),
			streak: Math.max(1, streakDays),
		});
		setSyncStatus(task.done ? `「${task.subject}」已恢復為未完成。` : `「${task.subject}」已直接標記完成。`);
	};
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
	const abandonFocus = async () => {
		if (
			!await confirmAction({ title: "要先離開專注嗎？", message: "這次倒數尚未完成。任務會保留，但本次計時將結束，之後可以重新開始。", confirmLabel: "保留任務並離開", cancelLabel: "繼續專注" })
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
	const weeklyChartData = Array.from({ length: 7 }, (_, offset) => {
		const date = new Date();
		date.setDate(date.getDate() - (6 - offset));
		const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(date);
		const record = learningDays.find((day) => day.date === key);
		return { key, label: new Intl.DateTimeFormat("zh-TW", { weekday: "short", timeZone: "Asia/Taipei" }).format(date), minutes: record?.minutes ?? 0 };
	});
	const chartMaxMinutes = Math.max(30, ...weeklyChartData.map((day) => day.minutes));
	const todayTaskEntries = tasks
		.map((task, index) => ({ task, index }))
		.sort(({ task: a }, { task: b }) => {
			const rank = (item: Task) => item.done ? 3 : item.skipped ? 4 : item.subject === (pendingIndex >= 0 ? tasks[pendingIndex]?.subject : "") ? 0 : 1;
			return rank(a) - rank(b);
		});
	const today = (
		<>
			<header className="simple-today-heading"><div><p>今日學習</p><h1>{tasks.length === 0 ? "從一個小計畫開始" : pendingIndex >= 0 ? `今天還有 ${tasks.length - completed} 個任務` : completed === tasks.length ? "今天的任務都完成了" : "今天沒有待辦任務"}</h1><span>{name} · 距離目標 {daysLeft} 天</span></div><a href="/goal">調整計畫</a></header>
			<section className="simple-next-task" aria-label="下一個學習任務"><div><span>{pendingIndex >= 0 ? "建議先完成" : "下一步"}</span><h2>{pendingIndex >= 0 ? tasks[pendingIndex].subject : tasks.length === 0 ? "建立你的今日任務" : completed === tasks.length ? "辛苦了，休息一下吧" : "任務已跳過或延後"}</h2><p>{pendingIndex >= 0 ? `因為它是今天剩餘時間最適合先處理的任務。${tasks[pendingIndex].detail}` : "可以查看學習紀錄，或調整今天的安排。"}</p></div>{pendingIndex >= 0 ? <button onClick={startFocus}>開始 {tasks[pendingIndex].minutes} 分鐘專注 →</button> : <a href={tasks.length > 0 && completed === tasks.length ? "/progress" : "/goal"}>{tasks.length > 0 && completed === tasks.length ? "查看今日成果" : "設定學習計畫"} →</a>}</section>
			{completionFeedback && <section className="task-completion-feedback" aria-live="polite"><div className="task-completion-heading"><span>✓</span><div><small>剛剛完成</small><h2>{completionFeedback.subject}完成</h2></div><button aria-label="關閉完成回饋" onClick={() => setCompletionFeedback(null)}>×</button></div><div className="task-completion-metrics"><div><b>{completionFeedback.completedCount}<small> / {completionFeedback.totalCount}</small></b><span>今日完成</span></div><div><b>{completionFeedback.remainingMinutes}<small> 分鐘</small></b><span>剩餘時間</span></div><div><b>{completionFeedback.streak}<small> 天</small></b><span>連續學習</span></div></div><div className="task-completion-actions"><button onClick={() => { setCompletionFeedback(null); if (pendingIndex >= 0) startFocus(); }}>開始下一項</button><button onClick={() => setCompletionFeedback(null)}>休息一下</button><a href="/progress">查看今日成果</a></div></section>}
			<section id="today-todos" className="progress-card" aria-labelledby="today-todos-title">
				<div className="section-heading">
					<div>
						<h2 id="today-todos-title">今日待辦</h2>
						<p className="todo-instruction">完成了就打勾；想計時，點選任務名稱。</p>
					</div>
					<span className="completion">
						{completed} / {tasks.length} 完成
					</span>
				</div>
				<div className="progress-track" role="progressbar" aria-label="今日完成度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
					<span style={{ width: `${progress}%` }} />
				</div>
				<div className="task-overview" aria-label="今日任務摘要">
					<span>
						已安排 <b>{plannedMinutes}</b> 分鐘
					</span>
					<span>
						待完成 <b>{tasks.filter(task => !task.done && !task.skipped).reduce((sum, task) => sum + task.minutes, 0)}</b> 分鐘
					</span>
				</div>
						<div className="today-task-list">
					<div className="tasks">{tasks.length === 0 && <p>還沒有任務，先設定每天可讀的時間與科目。</p>}
					{todayTaskEntries.map(({ task, index }) => (
						<div
							className={`task ${task.done ? "done" : ""} ${task.skipped ? "skipped" : ""} ${index === pendingIndex ? "is-next" : ""}`}
							key={`${task.subject}-${index}`}
						>
							<button
								type="button"
								className={`check ${task.done ? "checked" : ""}`}
								aria-label={`${task.done ? "取消完成" : "直接完成"}${task.subject}任務`}
								aria-pressed={task.done}
								disabled={Boolean(task.skipped)}
								onClick={() => toggleTask(index)}
								title={task.skipped ? "已跳過的任務無法勾選" : "點選即可切換完成狀態"}
							>
								{task.done ? "✓" : ""}
							</button>
											<button
												className="task-copy task-open"
												onClick={() => startFocusAt(index)}
												disabled={task.done || task.skipped}
												aria-label={`開始${task.subject}專注`}
											>
												<b>{task.subject}</b>
												<small>{task.detail}</small>
												<small className={`task-status ${task.done ? "is-done" : task.skipped ? "is-skipped" : focusIndex === index ? "is-active" : "is-pending"}`}>
													{task.done ? "已完成" : task.skipped ? "已跳過" : focusIndex === index ? "進行中" : "未開始"}
												</small>
											</button>
							<span className="minutes">
								{task.minutes}
								<small>分</small>
							</span>
							{!task.done && (
								<button
									className="task-adjust"
									onClick={() =>
										setAdjustingTaskIndex((current) =>
											current === index ? null : index,
										)
									}
									aria-label={`調整${task.subject}任務`}
									aria-expanded={adjustingTaskIndex === index}
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
				</div>
			</section>
			<section className="today-ai-entry" aria-label="AI 學習教練入口"><div className="today-ai-entry-mark" aria-hidden="true">✦</div><div><span>需要不同安排？</span><strong>問 AI 學習教練</strong><p>告訴我剩餘時間，我會依今日任務幫你排下一步。</p></div><div className="today-ai-entry-actions"><a href="/coach">開啟教練</a><small>也可在 LINE 傳「我只有一小時」</small></div></section>
			<section className="today-pilgrimage-recommendation" aria-label="文昌巡禮推薦">
				<div className="today-pilgrimage-recommendation-icon" aria-hidden="true">⛩</div>
				<div className="today-pilgrimage-recommendation-copy">
					<span>學習之外，也去發現一段文化故事</span>
					<strong>🌸 祈福木牌 × {planks}</strong>
					<p>目前已解鎖 {visits.length} 個巡禮徽章。到合作宮廟掃描 QR Code，收藏文化故事與專屬徽章。</p>
				</div>
				<a href="/pilgrimage">開始文昌巡禮 <span aria-hidden="true">→</span></a>
			</section>

			<details className="simple-study-note"><summary>學習目標與提醒</summary><div><p><b>我的目標</b>{goal}</p><p><b>{countdownPhase.title}</b>{countdownPhase.detail}</p><button onClick={() => setSleepReminderOpen(true)}>查看今晚休息提醒</button><a href="/progress">查看倒數階段建議 →</a></div></details>
			{syncStatus && <p className="simple-sync-status" role="status">{syncStatus}</p>}
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
		<section className="journey progress-workspace" id="learning-progress">
			<header className="progress-page-heading"><div><p>我的學習紀錄</p><h1>學習進度</h1><span>{name} · 距離目標還有 {daysLeft} 天</span></div><a href="/today">回到今日任務 →</a></header>
			<section className="progress-overview" aria-label="學習概況">
				<div className="progress-today-stat"><span>今日任務</span><strong>{completed}<small> / {tasks.length} 項</small></strong><progress value={completed} max={Math.max(1,tasks.length)} aria-label="今日任務完成進度"/><p>{tasks.length ? `完成度 ${progress}%` : "先建立今天的學習計畫"}</p></div>
				<div><span>今日完成時間</span><strong>{todayMinutes}<small> 分鐘</small></strong><p>已完成任務的累積時間</p></div>
				<div><span>本週完成時間</span><strong>{displayedWeeklyMinutes}<small> 分鐘</small></strong><p>每次完成，都會累積在這裡</p></div>
			</section>
			<section className="progress-next-step"><div><span>接下來</span><h2>{pendingIndex >= 0 ? `繼續完成「${tasks[pendingIndex].subject}」` : completed === tasks.length && tasks.length > 0 ? "今天的任務都完成了！" : "確認今天的學習安排"}</h2><p>{pendingIndex >= 0 ? `預計 ${tasks[pendingIndex].minutes} 分鐘，回到今日即可開始。` : "可以回顧學習紀錄，或調整下一步的目標。"}</p></div><a href="/today">{pendingIndex >= 0 ? "繼續學習 →" : "查看今日任務 →"}</a></section>
			<section className="progress-charts" aria-label="學習數據圖表">
				<article className="progress-chart-card"><header><div><span>最近 7 天</span><h2>每天學了多久？</h2></div><b>{displayedWeeklyMinutes} 分鐘</b></header><div className="weekly-bar-chart" role="img" aria-label={`最近七天共學習 ${displayedWeeklyMinutes} 分鐘`}>{weeklyChartData.map((day) => <div className="weekly-bar-item" key={day.key} title={`${day.key}：${day.minutes} 分鐘`}><div className="weekly-bar-track"><i style={{ height: `${day.minutes ? Math.max(8, (day.minutes / chartMaxMinutes) * 100) : 0}%` }} /></div><small>{day.label}</small><em>{day.minutes || ""}</em></div>)}</div><p>柱子越高，代表當天完成的學習時間越多。</p></article>
				<article className="progress-chart-card progress-completion-chart"><header><div><span>今天</span><h2>任務完成多少？</h2></div><b>{progress}%</b></header><div className="completion-ring" style={{ "--completion": `${progress}%` } as CSSProperties}><strong>{completed}<small> / {tasks.length}</small></strong><span>項任務</span></div><p>{tasks.length ? `還有 ${Math.max(0, tasks.length - completed)} 項任務待完成。` : "先建立今日學習計畫。"}</p></article>
			</section>
			<div className="progress-content-grid">
				<div className="progress-main-column">
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
								aria-label={`${cell.date}${cell.isToday ? "，今天" : ""}，${cell.minutes ? `已完成 ${cell.minutes} 分鐘` : "尚無完成紀錄"}，點選查看`}
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
					點選日期查看當天任務與完成紀錄。
				</p>
			</section>

			<section className="weakness-card" aria-label="錯題與弱點複習">
				<div className="weakness-heading">
					<div>
						<span>到期錯題複習</span>
						<b>今天有 {dueWeakQuestions.length} 題可以複習</b>
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
												role="group"
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

				</div>
				<aside className="progress-side-column" aria-label="計畫與更多紀錄">
					<section className="progress-tools"><h2>更多學習紀錄</h2><a href="/statistics"><span aria-hidden="true">▦</span><div><b>詳細統計</b><small>查看時間、連續學習與每日紀錄</small></div><span aria-hidden="true">›</span></a><a href="/badges"><span aria-hidden="true">✦</span><div><b>我的學習徽章</b><small>查看收藏、進度與解鎖條件</small></div><span aria-hidden="true">›</span></a><a href="/goal"><span aria-hidden="true">◎</span><div><b>調整學習計畫</b><small>修改目標日期、科目與每日時間</small></div><span aria-hidden="true">›</span></a></section>
					<details className="progress-plan-details"><summary><div><b>倒數階段建議</b><small>{countdownPhase.label} · {daysLeft} 天</small></div><span>展開</span></summary>
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

					</details>
				</aside>
			</div>
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
				<div><b>功能總覽</b><small>完成今日任務後，還可以從這裡繼續</small></div>
				<span>6 個學習工具</span>
			</div>
			<div className="quick-grid">
				<button
					onClick={() => {
						location.href = "/progress";
					}}
				>
					<span className="quick-icon stats">▦</span>
					<b>學習進度</b>
					<small>查看完成率與本週狀態</small>
				</button>
				<button
					onClick={() => {
						location.href = "/goal";
					}}
				>
					<span className="quick-icon goal">◎</span>
					<b>調整學習計畫</b>
					<small>修改日期、弱科與每日時間</small>
				</button>
				<button onClick={() => { location.href = "/coach"; }}>
					<span className="quick-icon focus">✦</span>
					<b>學習教練</b>
					<small>遇到卡關時取得下一步建議</small>
				</button>
				<button
					onClick={() => {
						location.href = "/prayer-wall";
					}}
				>
					<span className="quick-icon wall">✦</span>
					<b>祈福牆</b>
					<small>留下祈願，也看看大家的祝福</small>
				</button>
				<button
					onClick={() => {
						location.href = "/pilgrimage";
					}}
				>
					<span className="quick-icon temple">⛩</span>
					<b>文昌巡禮</b>
					<small>已收集 {visits.length} / 7 枚文化徽章</small>
				</button>
				<button onClick={() => { location.href = "/badges"; }}>
					<span className="quick-icon badge">🏅</span>
					<b>學習徽章</b>
					<small>查看成就與下一個解鎖目標</small>
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
					aria-label="今日學習結算"
				>
					<section className="settlement-modal">
						<button
							className="settlement-close"
							aria-label="關閉今日結算"
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
		<section id="prayer-simple" className="journey prayer-workspace">
			<header className="prayer-intro">
				<p className="eyebrow">✦ 給努力的自己，一點鼓勵</p>
				<h1>停一下，為自己加油</h1>
				<p>完成一項任務後簽到；到祈福牆留下祝福，再用木牌換一支學習鼓勵籤。</p>
				<div className="prayer-shortcuts" aria-label="祈福頁快速入口">
					<a href="#prayer-checkin">✓ 今日簽到</a>
					<a href="#prayer-wish">② 祈福牆</a>
					<a href="#prayer-oracle">③ 學習籤</a>
				</div>
			</header>
			<section
				id="prayer-checkin"
				className={`daily-fortune-task ${dailyFortuneTask.done ? "is-complete" : ""}`}
				aria-label="每日學習紀錄"
			>
				<div className="daily-fortune-task-heading">
					<b>① 今日簽到</b>
					<small>
					{dailyFortuneTask.done ? "今日已完成 ✓" : completed >= 1 ? "現在可以簽到" : "尚未開放"}
					</small>
				</div>
				<p className="daily-fortune-verse">「{dailyFortune.verse}」</p>

				<button
					onClick={() => {
						if (completed < 1) { navigateToTab("today"); return; }
						setSelectedDailyAnswer(null);
						setDailyAnswerFeedback("");
						setDailyCheckInDialogOpen(true);
					}}
					disabled={dailyFortuneTask.done}
				>
					{dailyFortuneTask.done
					? "今日學習紀錄已留存 ✓"
						: completed < 1
							? "先去完成今日任務"
							: "回答一題，完成今日簽到"}
				</button>
				{!dailyFortuneTask.done && completed < 1 && (
					<p className="daily-fortune-feedback">
						完成至少一項今日任務後，就能回答一題完成簽到。
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
				<details className="prayer-details">
					<summary>今日典籍與簽到里程碑 · {checkInStreak} 天連續</summary>
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
				</details>
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
			<section id="prayer-wish" className="wish-card">
				<button
					className="wall-link"
					onClick={() => {
						location.href = "/prayer-wall";
					}}
				>
					<span className="wall-link-icon" aria-hidden="true">✦</span>
					<div>
						<b>探索匿名祈福牆</b>
						<small>匿名留下祝福，看看大家的心願</small>
					</div>
					<i aria-hidden="true">›</i>
				</button>
				<small className="wall-safety-note">請保持匿名，不要留下姓名、電話、地址或其他個人資料。</small>
			</section>
			<section id="prayer-oracle" className="oracle-card" aria-label="文昌求籤">
				<div className="oracle-heading">
					<div>
						<span>文昌靈籤</span>
						<b>③ 求一支學習籤</b>
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
							<p className="oracle-plank-guide">
								木牌取得方式：完成完整專注任務，每 10 分鐘獲得 1 枚。{minutesToNextPlank > 0
									? ` 再專注 ${minutesToNextPlank} 分鐘可獲得下一枚。`
									: " 下一枚木牌已準備好。"}
							</p>
							<p>收錄 {fortunePoems.length} 支學習鼓勵籤，送給正在努力的你。原創勵志內容，不作成績或吉凶預測。</p>
							<p>
								每 3 枚木牌可兌換 1
								次求籤機會；籤詩將依你親自選取的籤枝揭曉。
							</p>
							{oracleTickets > 0 && (
								<button className="oracle-welcome-button" onClick={startWelcomeOracle}>
									首次贈送・免費求一籤
								</button>
							)}
							<button
								onClick={exchangeOracleTicket}
								disabled={availablePlanks < 3}
							>
								{availablePlanks >= 3
									? "用 3 枚木牌求籤"
									: `還差 ${3 - availablePlanks} 枚木牌`}
							</button>
						</div>
					</div>
				)}
				{oracleStage === "choosing" && (
					<div className="oracle-choice">
						<p>從 {fortunePoems.length} 支籤中選一個號碼，看看今天的小鼓勵。</p>
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
									aria-pressed={selectedStick === index}
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
										勵<br />志
									</strong>
									<div>
										<h2>
											{fortunePoems[oracleResultId].title}
										</h2>
										<p className="oracle-verse">
											{fortunePoems[oracleResultId].verse}
										</p>
										<p className="oracle-interpret-label">
											【給你的鼓勵】
										</p>
										<p className="oracle-reading-copy">
											{
												fortunePoems[oracleResultId]
													.reading
											}
										</p>
										<div className="oracle-action"><b>今天的小任務</b><p>{fortunePoems[oracleResultId].action}</p><small>挑適合自己的做就好，不必一次做到完美。</small></div>
									</div>
								</div>
								<small>
									<span>誠心求籤</span>
									<span>靜心解籤</span>
								</small>
							</div>
						</div>
						<div className="oracle-result-actions">
							<button className="oracle-start-action" onClick={startFocus} disabled={pendingIndex < 0}>
								{pendingIndex >= 0 ? "把鼓勵帶回今日・開始專注" : "今日任務已完成"}
							</button>
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
			<details className="prayer-details prayer-explore">
				<summary>探索更多 · 學習累積與文昌巡禮</summary>
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
			</details>
		</section>
	);
	const formatReminderTime = (value: string) => {
		const [hour, minute] = value.split(":").map(Number);
		return `${hour >= 12 ? "下午" : "上午"} ${String(hour % 12 || 12).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
	};
	const beginEditNotifications = () => {
		setDraftNotificationKinds(notificationKinds);
		setDraftRemindersEnabled(remindersEnabled);
		setDraftMorningTime(morningTime);
		setDraftEveningTime(eveningTime);
		setEditingNotifications(true);
	};
	const saveNotifications = async () => {
		if (!draftMorningTime || !draftEveningTime || draftMorningTime === draftEveningTime) {
			setSyncStatus("請選擇兩個不同的提醒時間。");
			return;
		}
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
					...draftNotificationKinds,
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
			setNotificationKinds(draftNotificationKinds);
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
		<section className="journey profile-page" id="account-settings">
			<header className="settings-intro">
				<p className="eyebrow">我的學習空間</p>
				<h1>帳號與設定</h1>
				<p>把目標、提醒與學習紀錄，調整成適合你的樣子。</p>
			</header>
			<section className="profile-identity">
				<span>{lineName?.slice(0, 1) ?? "我"}</span>
				<div>
					<b>{lineName ?? "嗨，學習夥伴！"}</b>
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
				<h2>我的學習計畫</h2>
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
			</div>
			<section className="proactive-service-card" aria-labelledby="proactive-service-title">
				<div className="proactive-service-heading"><span aria-hidden="true">🔔</span><div><p>LINE 主動學習服務</p><h2 id="proactive-service-title">每天提醒你下一步，不必等到想起來才開始</h2></div></div>
				<div className="proactive-service-flow">
					<div><b>早晨</b><span>整理今天任務</span></div><i aria-hidden="true">→</i>
					<div><b>學習中</b><span>完成後即時鼓勵</span></div><i aria-hidden="true">→</i>
					<div><b>週日</b><span>回顧一週進步</span></div>
				</div>
				<p className="proactive-service-note">只會傳送給你的 LINE，不會直接通知老師或家長；可在下方自由開關。</p>
			</section>
				<section className="notification-preference">
					<div className="notification-heading">
						<h2>LINE 學習通知</h2>
						<div className="notification-status-actions">
							<b className="notification-sync-state">
								{lineName
									? !notificationPreferencesReady ? "設定尚未載入" : remindersEnabled
										? "已啟用"
										: "已關閉"
									: "尚未啟用"}
							</b>
							{lineName && !editingNotifications && (
								<button
									disabled={!notificationPreferencesReady}
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
								登入 LINE 後設定通知 <span>›</span>
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
								<fieldset className="line-notification-kinds" disabled={!draftRemindersEnabled || savingNotifications}>
									<legend>想收到哪些通知？</legend>
									{([
										["morningEnabled", "每日學習提醒", "列出今天的任務與預計時間"],
										["eveningEnabled", "晚間未完成提醒", "有未完成任務才通知"],
										["weeklyEnabled", "每週學習回顧", "週日晚間取代一般提醒，不額外多發一則"],
									] as const).map(([key, title, detail]) => <label key={key}>
										<input type="checkbox" checked={draftNotificationKinds[key]} onChange={e => setDraftNotificationKinds(current => ({ ...current, [key]: e.target.checked }))} />
										<span><b>{title}</b><small>{detail}</small></span>
									</label>)}
								</fieldset>
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
									<span>晚間／週日回顧時間</span>
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
								<b>{remindersEnabled && notificationKinds.morningEnabled ? formatReminderTime(morningTime) : "已關閉"}</b>
							</div>
							<div>
								<span>晚間提醒</span>
								<b>{remindersEnabled && notificationKinds.eveningEnabled ? formatReminderTime(eveningTime) : "已關閉"}</b>
							</div>
							<div><span>每週回顧</span><b>{remindersEnabled && notificationKinds.weeklyEnabled ? `週日 ${formatReminderTime(eveningTime)}` : "已關閉"}</b></div>
						</div>
					)}
					<small className="notification-timezone">
						台灣時間・這三類自動通知每天最多兩則。週日回顧取代晚間提醒；需加入 LINE 官方帳號好友，並同步學習紀錄。
					</small>
					{lineName && !notificationPreferencesReady && <p role="status">{notificationPreferencesError ? "通知設定載入失敗，請重新整理後再試。" : "通知設定尚未載入…"} <button type="button" onClick={() => window.location.reload()}>重新載入</button></p>}
					<NotificationPreview />
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
				<WeeklySummaryCard key={idToken ?? "guest"} idToken={idToken} login={login} />
			<section className="service-section">
				<h2>常用功能</h2>
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
				<h2>你的資料，由你掌握</h2>
				<p>
					讀書計畫、完成紀錄與巡禮徽章會在 LINE
					登入後同步。個人祈願可留在裝置，公開祈福牆則可選匿名發佈。
				</p>
			</section>
			{lineName && (
				<button
					className="logout-button"
					onClick={async () => {
						if (
							await confirmAction({ title: "登出 LINE 帳號？", message: "本機學習計畫不會被刪除。需要同步時，再登入即可。", confirmLabel: "登出帳號", cancelLabel: "保持登入" })
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

				<header className="topbar integrated-header">
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
								<img className="line-brand-icon" src="/line-brand-icon.png" alt="LINE" />
								<span>{lineName ? `${lineName}・我的` : "LINE 登入"}</span>
								<i aria-hidden="true">{lineName?.slice(0, 1) ?? "我"}</i>
							</button>
						</div>
				<nav className="header-navigation" aria-label="主要導覽">
					<button
						className={tab === "today" ? "active" : ""}
						aria-current={tab === "today" ? "page" : undefined}
						onClick={() => navigateToTab("today")}
					>
						<i aria-hidden="true">☀</i>
						<span>今日</span>
					</button>
					<button
						className={tab === "progress" ? "active" : ""}
						aria-current={tab === "progress" ? "page" : undefined}
						onClick={() => navigateToTab("progress")}
					>
						<i aria-hidden="true">▤</i>
						<span>進度</span>
					</button>
					<button
						className={tab === "prayer" ? "active" : ""}
						aria-current={tab === "prayer" ? "page" : undefined}
						onClick={() => navigateToTab("prayer")}
					>
						<i aria-hidden="true">✦</i>
						<span>祈福</span>
					</button>
					<button
						className={tab === "profile" ? "active" : ""}
						aria-current={tab === "profile" ? "page" : undefined}
						onClick={() => navigateToTab("profile")}
					>
						<i aria-hidden="true">☺</i>
						<span>我的</span>
					</button>
				</nav>
					</div>
				</header>
				{tab === "today" ? (
					<section id="today-simple" aria-label="今日學習工作區">
						{today}
						<details className="simple-more-tools"><summary>其他功能 <small>進度、徽章、教練與祈福</small></summary>{quickActions}<a className="simple-line-link" href="https://lin.ee/nNsez9Q" target="_blank" rel="noreferrer">加入 LINE 官方好友，接收學習提醒 ↗</a></details>
					</section>
				) : tab === "progress" ? (
					progressView
				) : tab === "prayer" ? (
					prayerView
				) : (
					profileView
				)}
				{onboardingOpen && (
					<div className="onboarding-backdrop" role="presentation">
						<section className="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
							<div className="onboarding-progress" aria-label={`引導第 ${onboardingStep + 1} 步，共 ${onboardingSteps.length} 步`}>
								{onboardingSteps.map((_, index) => <i key={index} className={index === onboardingStep ? "active" : index < onboardingStep ? "done" : ""} />)}
							</div>
							<span className="onboarding-kicker">文昌同行・開始使用</span>
							<div className="onboarding-icon" aria-hidden="true">{onboardingSteps[onboardingStep].icon}</div>
							<h2 id="onboarding-title">{onboardingSteps[onboardingStep].title}</h2>
							<p>{onboardingSteps[onboardingStep].detail}</p>
							<div className="onboarding-actions">
								<button className="onboarding-skip" onClick={finishOnboarding}>先跳過</button>
								{onboardingStep < onboardingSteps.length - 1 ? <button className="onboarding-next" onClick={() => setOnboardingStep((step) => step + 1)}>下一步 →</button> : <button className="onboarding-next" onClick={finishOnboarding}>開始使用</button>}
							</div>
						</section>
					</div>
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
							<div className="focus-noise-control" aria-label="白噪音控制">
								<button
									className={focusNoiseEnabled ? "is-on" : ""}
									onClick={() => setFocusNoiseEnabled((enabled) => !enabled)}
									aria-pressed={focusNoiseEnabled}
								>
									<span aria-hidden="true">◌</span> 白噪音 {focusNoiseEnabled ? "開啟中" : "關閉"}
								</button>
								{focusNoiseEnabled && (
									<label>
										音量
										<input
											type="range"
											min="0"
											max="0.35"
											step="0.01"
											value={focusNoiseVolume}
											onChange={(event) => setFocusNoiseVolume(Number(event.target.value))}
										/>
									</label>
								)}
							</div>
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
				{unlockCelebration && (
					<div
						className="badge-unlock-backdrop"
						role="presentation"
						onMouseDown={() => setUnlockCelebration(null)}
					>
						<div
							className="badge-unlock-dialog"
							role="dialog"
							aria-modal="true"
							aria-labelledby="badge-unlock-title"
							onMouseDown={(event) => event.stopPropagation()}
						>
							<div className="badge-unlock-sparkles" aria-hidden="true">✦　✧　✦</div>
							<span className="badge-unlock-kicker">NEW ACHIEVEMENT</span>
							<div className="badge-unlock-medal" aria-hidden="true"><span>{unlockCelebration.icon}</span></div>
							<h2 id="badge-unlock-title">解鎖新勳章</h2>
							<strong>{unlockCelebration.title}</strong>
							<p>{unlockCelebration.detail}</p>
							<button onClick={() => setUnlockCelebration(null)}>收下勳章</button>
						</div>
					</div>
				)}
			</section>
		</main>
	);
}
