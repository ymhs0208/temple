"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import liff from "@line/liff";

type Task = {
	subject: string;
	minutes: number;
	detail: string;
	done: boolean;
	color: string;
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
	weakQuestions?: WeakQuestion[];
};
type WeakQuestion = {
	id: string;
	questionIndex: number;
	misses: number;
	lastWrongAt: string;
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
	focusRewardMinutes?: number;
};
type OracleStage = "idle" | "choosing" | "drawing" | "result";
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2011050459-8bPHPFCw";
const PENDING_SYNC_KEY = "wenchang-cloud-sync-pending";
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
const fortunePoems = [
	{ title: "第一籤・春風得意", verse: "春風輕拂柳梢新，靜守初心得好音。", reading: "眼前的努力正在累積，不必急著求快，照著節奏完成今天的任務。" },
	{ title: "第二籤・專志有成", verse: "一念澄明書卷香，步穩方能到遠方。", reading: "先完成最重要的一件事。把注意力收回當下，成果會比焦慮更早抵達。" },
	{ title: "第三籤・厚積薄發", verse: "細雨潤田終成穗，深耕不語自生光。", reading: "看似平凡的複習最有力量。今天整理一題錯題，也是在替明天鋪路。" },
	{ title: "第四籤・柳暗花明", verse: "峰迴路轉雲開處，且把難題細細分。", reading: "遇到卡關時，先拆小步驟再前進。你不必一次解開所有問題。" },
	{ title: "第五籤・勤可補拙", verse: "燈下三分常不負，日添一點自成峰。", reading: "規律勝過衝刺。今天多專注十分鐘，長久下來會成為你的底氣。" },
	{ title: "第六籤・金榜可期", verse: "心定筆穩開新卷，所學終將答所求。", reading: "你已具備前進的條件。相信累積，帶著平靜完成下一個任務。" },
];
const dailyCheckInQuestions = [
	{ subject: "地理", question: "2024 年 7 月下旬，雲林、臺南與嘉義農損嚴重。依災害時間與受影響地區判斷，最可能是何種災害？", choices: [["A", "颱風帶來的豪大雨淹沒農田"], ["B", "強勁東北季風吹襲造成水稻倒伏"], ["C", "梅雨季節的連續降雨造成果樹浸水"], ["D", "強勁西南風越過山脈形成熱風使作物枯黃"]], answer: "A" },
	{ subject: "公民", question: "日本擴大自越南、菲律賓、印尼、泰國等地招募外籍移工；哪一地區因同樣缺工且來源國高度重疊，受衝擊最大？", choices: [["A", "印度"], ["B", "美國"], ["C", "德國"], ["D", "臺灣"]], answer: "D" },
	{ subject: "臺灣史地", question: "某平埔族居住在雪山山脈與中央山脈間的平原，以竹筏穿梭溪流與海岸，生活空間最可能位於現今哪一行政區？", choices: [["A", "宜蘭縣"], ["B", "苗栗縣"], ["C", "屏東縣"], ["D", "臺東縣"]], answer: "A" },
	{ subject: "歷史", question: "政府提出「莊敬自強，處變不驚」，民間出現「牙刷主義」，電臺播放〈龍的傳人〉；此情境最可能與何事有關？", choices: [["A", "美國在韓戰後協防臺灣海峽"], ["B", "美國宣布將與中華民國斷交"], ["C", "國共內戰使政府敗退至臺灣"], ["D", "臺灣受到同盟國軍機的空襲"]], answer: "B" },
] as const;
const focusModes = [
	{ minutes: 10, label: "暖身專注", detail: "先完成 10 分鐘，進入讀書狀態" },
	{ minutes: 25, label: "番茄專注", detail: "適合單一小節複習或寫題" },
	{ minutes: 45, label: "深度專注", detail: "適合完整章節與錯題整理" },
] as const;
const taipeiDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
const makeDailyFortuneTask = (date = taipeiDate()): DailyFortuneTask => ({ date, fortuneId: Number(date.replaceAll("-", "")) % fortunePoems.length, done: false });

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
	const [wishReflections, setWishReflections] = useState<WishReflection[]>([]);
	const [wish, setWish] = useState("");
	const [oracleTickets, setOracleTickets] = useState(0);
	const [oraclePlanksSpent, setOraclePlanksSpent] = useState(0);
	const [oracleStage, setOracleStage] = useState<OracleStage>("idle");
	const [selectedStick, setSelectedStick] = useState<number | null>(null);
	const [oracleResultId, setOracleResultId] = useState<number | null>(null);
	const [dailyFortuneTask, setDailyFortuneTask] = useState<DailyFortuneTask>(() => makeDailyFortuneTask());
	const [selectedDailyAnswer, setSelectedDailyAnswer] = useState<string | null>(null);
	const [dailyAnswerFeedback, setDailyAnswerFeedback] = useState("");
	const [reviewingWeakId, setReviewingWeakId] = useState<string | null>(null);
	const [selectedWeakAnswers, setSelectedWeakAnswers] = useState<Record<string, string>>({});
	const [weakReviewFeedback, setWeakReviewFeedback] = useState<Record<string, string>>({});
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
	const [draftRemindersEnabled, setDraftRemindersEnabled] = useState(true);
	const [draftMorningTime, setDraftMorningTime] = useState("08:00");
	const [draftEveningTime, setDraftEveningTime] = useState("20:30");
	const [showSettlement, setShowSettlement] = useState(false);
	const [focusIndex, setFocusIndex] = useState<number | null>(null);
	const [focusSeconds, setFocusSeconds] = useState(0);
	const [focusScheduledMinutes, setFocusScheduledMinutes] = useState(0);
	const [focusRewardMinutes, setFocusRewardMinutes] = useState(0);
	const [focusEndsAt, setFocusEndsAt] = useState<number | null>(null);
	const [focusPaused, setFocusPaused] = useState(false);
	const [focusEnded, setFocusEnded] = useState(false);
	const [focusPickerTaskIndex, setFocusPickerTaskIndex] = useState<number | null>(null);
	const [hydrated, setHydrated] = useState(false);
	const syncQueue = useRef(Promise.resolve(true));
	useEffect(() => {
		setHydrated(true);
	}, []);
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
				if (data.challengeName) setName(data.challengeName);
				if (data.examDate) setExamDate(data.examDate);
				if (data.goal) setGoal(data.goal);
				if (data.hours) setHours(data.hours);
				if (data.weak) setWeak(data.weak);
				if (data.templeVisits) setVisits(data.templeVisits);
				if (data.wishes) setWishes(data.wishes);
				if (data.wishReflections?.length) setWishReflections(data.wishReflections);
				else if (data.wishes?.length) setWishReflections(data.wishes.map((text, index) => ({ id: `legacy-${index}-${text}`, text, createdAt: new Date().toISOString() })));
				if (typeof data.oracleTickets === "number") setOracleTickets(data.oracleTickets);
				if (typeof data.oraclePlanksSpent === "number") setOraclePlanksSpent(data.oraclePlanksSpent);
				if (typeof data.oracleResultId === "number") setOracleResultId(data.oracleResultId);
				if (data.dailyFortuneTask?.date === taipeiDate()) setDailyFortuneTask(data.dailyFortuneTask);
				if (typeof data.focusRewardMinutes === "number") setFocusRewardMinutes(data.focusRewardMinutes);
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
					setFocusScheduledMinutes(session.scheduledMinutes ?? data.tasks?.[session.taskIndex]?.minutes ?? 0);
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
				focusRewardMinutes,
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
		focusRewardMinutes,
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
					if (typeof data.companionState.oracleTickets === "number") setOracleTickets(data.companionState.oracleTickets);
					if (typeof data.companionState.oraclePlanksSpent === "number") setOraclePlanksSpent(data.companionState.oraclePlanksSpent);
					if (typeof data.companionState.oracleResultId === "number") setOracleResultId(data.companionState.oracleResultId);
					if (data.companionState.oracleResultId === null) setOracleResultId(null);
					if (data.companionState.dailyFortuneTask && typeof data.companionState.dailyFortuneTask === "object") setDailyFortuneTask(data.companionState.dailyFortuneTask as DailyFortuneTask);
					if (typeof data.companionState.focusRewardMinutes === "number") setFocusRewardMinutes(data.companionState.focusRewardMinutes);
					if (Array.isArray(data.companionState.wishReflections)) setWishReflections(data.companionState.wishReflections as WishReflection[]);
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
		const timer = window.setTimeout(() => { void enqueueSync(tasks); }, 700);
		return () => window.clearTimeout(timer);
	}, [idToken, ready, oracleTickets, oraclePlanksSpent, oracleResultId, dailyFortuneTask, focusRewardMinutes, wishReflections]);
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
	const examModeActive = daysLeft <= 7;
	const completed = tasks.filter((t) => t.done).length;
	const progress = tasks.length
		? Math.round((completed / tasks.length) * 100)
		: 0;
	const plannedMinutes = useMemo(
		() => tasks.reduce((sum, task) => sum + task.minutes, 0),
		[tasks],
	);
	const energy = Math.min(100, 42 + completed * 10 + visits.length * 3);
	const dailyFortune = fortunePoems[dailyFortuneTask.fortuneId] ?? fortunePoems[0];
	const dailyCheckInQuestion = dailyCheckInQuestions[dailyFortuneTask.fortuneId % dailyCheckInQuestions.length];
	const weakQuestions = dailyFortuneTask.weakQuestions ?? [];
	const focusPlanks = Math.floor(focusRewardMinutes / 10);
	const planks = 10 + completed + visits.length + (dailyFortuneTask.done ? 1 : 0) + focusPlanks;
	const availablePlanks = Math.max(0, planks - oraclePlanksSpent);
	const recordWeakQuestion = (questionIndex: number) => {
		setDailyFortuneTask((current) => {
			const weakQuestions = current.weakQuestions ?? [];
			const existing = weakQuestions.find((item) => item.questionIndex === questionIndex);
			return {
				...current,
				weakQuestions: existing
					? weakQuestions.map((item) => item.questionIndex === questionIndex ? { ...item, misses: item.misses + 1, lastWrongAt: new Date().toISOString() } : item)
					: [{ id: `weak-${Date.now()}-${questionIndex}`, questionIndex, misses: 1, lastWrongAt: new Date().toISOString() }, ...weakQuestions].slice(0, 12),
			};
		});
	};
	const submitWeakReview = (item: WeakQuestion) => {
		const question = dailyCheckInQuestions[item.questionIndex];
		const selected = selectedWeakAnswers[item.id];
		if (!selected) {
			setWeakReviewFeedback((current) => ({ ...current, [item.id]: "請先選擇一個答案。" }));
			return;
		}
		if (selected !== question?.answer) {
			setDailyFortuneTask((current) => ({ ...current, weakQuestions: (current.weakQuestions ?? []).map((entry) => entry.id === item.id ? { ...entry, misses: entry.misses + 1, lastWrongAt: new Date().toISOString() } : entry) }));
			setWeakReviewFeedback((current) => ({ ...current, [item.id]: "再看一次題幹，你一定能找到線索。" }));
			return;
		}
		setDailyFortuneTask((current) => ({ ...current, weakQuestions: (current.weakQuestions ?? []).filter((entry) => entry.id !== item.id) }));
		setWeakReviewFeedback((current) => ({ ...current, [item.id]: "答對了！已從弱點清單移除。" }));
		setReviewingWeakId(null);
		setSyncStatus("弱點複習答對，已更新你的學習紀錄。");
	};
	const completeDailyCheckIn = () => {
		if (dailyFortuneTask.done) return;
		if (!selectedDailyAnswer) { setDailyAnswerFeedback("請先選擇一個答案。 "); return; }
		if (selectedDailyAnswer !== dailyCheckInQuestion.answer) { recordWeakQuestion(dailyFortuneTask.fortuneId % dailyCheckInQuestions.length); setDailyAnswerFeedback("這題已加入弱點複習，稍後可以再挑戰一次。 "); return; }
		setDailyFortuneTask((current) => ({ ...current, done: true }));
		setDailyAnswerFeedback("答對了！今日簽到完成。 ");
		setSyncStatus("今日簽到題答對，獲得 1 枚祈福木牌！");
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
			setDailyFortuneTask((current) => current.done ? current : { ...current, fortuneId: selectedStick % fortunePoems.length });
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
	const pendingIndex = tasks.findIndex((task) => !task.done);
	useEffect(() => {
		if (!ready || !examModeActive) return;
		const todayKey = new Intl.DateTimeFormat("en-CA", {
			timeZone: "Asia/Taipei",
		}).format(new Date());
		const modeKey = `wenchang-exam-mode-${examDate}-${todayKey}`;
		if (localStorage.getItem(modeKey)) return;
		setTasks((current) => {
			const next = current.map((task) => {
				const factor = task.subject === weak ? 0.8 : 0.6;
				const minutes = Math.max(
					15,
					Math.round((task.minutes * factor) / 5) * 5,
				);
				return {
					...task,
					minutes,
					detail:
						task.subject === weak
							? "考前弱科重點複習"
							: "考前重點整理・保留體力",
				};
			});
			localStorage.setItem(modeKey, "applied");
			void enqueueSync(next);
			return next;
		});
	}, [ready, examModeActive, examDate, weak]);
	const toggleTask = (index: number) =>
		setTasks((current) => {
			const next = current.map((task, i) =>
				i === index ? { ...task, done: !task.done } : task,
			);
			void enqueueSync(next);
			return next;
		});
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
	const beginFocus = (minutes: number) => {
		if (focusPickerTaskIndex === null) return;
		const task = tasks[focusPickerTaskIndex];
		if (!task || task.done) return;
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
		if (!window.confirm("這次專注尚未完成，要先離開嗎？目前任務會保留，隨時可以回來繼續。")) return;
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
		if (focusIndex === null) return;
		const completedTask = tasks[focusIndex];
		const completedCount = tasks.filter((task) => task.done).length + 1;
		const rewardedMinutes = focusEnded ? focusScheduledMinutes : 0;
		const newlyEarnedPlanks = rewardedMinutes
			? Math.floor((focusRewardMinutes + rewardedMinutes) / 10) - Math.floor(focusRewardMinutes / 10)
			: 0;
		const minutesToNextPlank = 10 - ((focusRewardMinutes + rewardedMinutes) % 10 || 10);
		if (rewardedMinutes) setFocusRewardMinutes((current) => current + rewardedMinutes);
		setTasks((current) => {
			const next = current.map((task, index) =>
				index === focusIndex ? { ...task, done: true } : task,
			);
			void enqueueSync(next);
			return next;
		});
		void sendCompletionNotice(completedTask, completedCount);
		closeFocus();
		setSyncStatus(rewardedMinutes
			? `專注 ${rewardedMinutes} 分鐘完成${newlyEarnedPlanks ? `，獲得 ${newlyEarnedPlanks} 枚祈福木牌！` : `，再累積 ${minutesToNextPlank} 分鐘可獲得 1 枚祈福木牌。`}`
			: "任務已提前完成；完整專注滿 10 分鐘即可獲得 1 枚祈福木牌。"
		);
	};
	const finishFocusAndContinue = () => {
		const nextIndex = tasks.findIndex((task, index) => index !== focusIndex && !task.done);
		completeFocus();
		if (nextIndex >= 0) window.setTimeout(() => openFocusModePicker(nextIndex), 180);
	};
	const toggleAllTasks = () => {
		const shouldComplete = completed !== tasks.length;
		const confirmation = shouldComplete
			? "確定要將今天所有任務標記為完成嗎？"
			: "確定要重新開啟今天所有任務嗎？";
		if (!window.confirm(confirmation)) return;
		setTasks((current) => {
			const next = current.map((task) => ({
				...task,
				done: shouldComplete,
			}));
			void enqueueSync(next);
			return next;
		});
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
		setWishReflections((current) => [{ id: `${Date.now()}-${text}`, text, createdAt }, ...current].slice(0, 5));
		setWish("");
		setSyncStatus("祈願已留存，將在第 7 天與第 30 天邀請你回望。 ");
	};
	const completeWishReview = (id: string, milestone: 7 | 30) => {
		setWishReflections((current) => current.map((item) => item.id !== id ? item : milestone === 7 ? { ...item, reviewedAfter7Days: true } : { ...item, reviewedAfter30Days: true }));
		setSyncStatus(`已完成第 ${milestone} 天的願望回顧。`);
	};
	const reviewDate = (createdAt: string, days: number) => new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", timeZone: "Asia/Taipei" }).format(new Date(new Date(createdAt).getTime() + days * 86400000));
	const daysSinceWish = (createdAt: string) => Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000));
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
						<div className="exam-mode-heading">
							<span>✦</span>
							<div>
								<small>EXAM MODE</small>
								<b>考前衝刺模式・剩 {daysLeft} 天</b>
							</div>
						</div>
						<p>
							今天已自動降低任務量，優先保留{" "}
							<strong>{weak}</strong>{" "}
							的重點複習；穩定完成，也要保留睡眠。
						</p>
						<div className="exam-mode-footer">
							<span>🌙 今晚 22:30 前準備休息</span>
							<button
								onClick={() =>
									setSyncStatus(
										"睡眠提醒：今晚 22:30 前結束複習，讓大腦好好休息。",
									)
								}
							>
								查看提醒
							</button>
						</div>
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
				<div className="task-overview" aria-label="今日任務摘要">
					<span>
						已安排 <b>{plannedMinutes}</b> 分鐘
					</span>
					<span>
						尚餘 <b>{remaining}</b> 分鐘
					</span>
					<div>
						<button
							className="task-primary-action"
							onClick={startFocus}
							disabled={pendingIndex < 0}
						>
							{pendingIndex < 0
								? "今日已完成"
								: `專注下一項・${tasks[pendingIndex].minutes} 分`}
						</button>
						<button
							className="task-secondary-action"
							onClick={toggleAllTasks}
						>
							{completed === tasks.length
								? "重新開啟"
								: "全部完成"}
						</button>
					</div>
				</div>
				<div className="tasks">
					{tasks.map((task, index) => (
						<div
							className={`task ${task.done ? "done" : ""}`}
							key={`${task.subject}-${index}`}
						>
							<button
								className={`check ${task.done ? "checked" : ""}`}
								onClick={() => toggleTask(index)}
								aria-label={`${task.done ? "取消完成" : "完成"}${task.subject}：${task.detail}`}
								aria-pressed={task.done}
							>
								{task.done ? "✓" : ""}
							</button>
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
								disabled={task.done}
							>
								{task.done ? "已完成" : "專注"}
							</button>
						</div>
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
					<div className="focus-reward" aria-label="祈福木牌專注獎勵">
						<span>🌸 每專注 10 分鐘獲得 1 枚祈福木牌</span>
						<b>已累積 {focusRewardMinutes % 10}/10 分鐘・已獲得 {focusPlanks} 枚</b>
					</div>
					{focusEnded ? (
						<div className="focus-actions">
							<button onClick={completeFocus}>確認完成</button>
							<button
								onClick={() => {
									setFocusSeconds(300);
									setFocusScheduledMinutes((current) => current + 5);
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
							<button
								onClick={focusPaused ? resumeFocus : pauseFocus}
							>
								{focusPaused ? "繼續專注" : "暫停"}
							</button>
							<button
								onClick={() => {
									if (
										window.confirm(
											"確定要提前完成並標記任務嗎？",
										)
									)
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
					開始專注・{tasks[pendingIndex].subject}{" "}
					{tasks[pendingIndex].minutes} 分鐘
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
			<div className="milestone-card">
				<p>你的下一個里程碑</p>
				<b>
					{completed === tasks.length
						? "完成今日任務，明天繼續"
						: `先完成 ${tasks[pendingIndex]?.subject ?? "今日任務"}`}
				</b>
				<span>小步累積，會比一次衝刺走得更遠。</span>
			</div>
			<button className="statistics-entry" onClick={() => { location.href = "/statistics"; }}>
				<span>▦</span>
				<div><b>讀書統計紀錄</b><small>查看專注時間、連續學習與每日足跡</small></div>
				<i>›</i>
			</button>
			<section className="weakness-card" aria-label="錯題與弱點複習">
				<div className="weakness-heading">
					<div><span>錯題／弱點追蹤</span><b>把不熟的地方，練成下一次的底氣</b></div>
					<i>{weakQuestions.length}</i>
				</div>
				{weakQuestions.length === 0 ? <p className="weakness-empty">目前沒有待複習錯題；每日簽到題答錯時，會自動收在這裡。</p> : <div className="weakness-list">{weakQuestions.map((item) => {
					const question = dailyCheckInQuestions[item.questionIndex];
					if (!question) return null;
					const isReviewing = reviewingWeakId === item.id;
					return <article className="weakness-item" key={item.id}>
						<div className="weakness-item-summary"><div><span>{question.subject}・累計錯誤 {item.misses} 次</span><b>{question.question}</b></div><button onClick={() => { setReviewingWeakId(isReviewing ? null : item.id); setWeakReviewFeedback((current) => ({ ...current, [item.id]: "" })); }}>{isReviewing ? "收起" : "再次作答"}</button></div>
						{isReviewing && <div className="weakness-review"><div className="weakness-options" role="radiogroup" aria-label={`${question.subject} 弱點複習答案`}>{question.choices.map(([key, label]) => <button key={key} className={selectedWeakAnswers[item.id] === key ? "selected" : ""} onClick={() => { setSelectedWeakAnswers((current) => ({ ...current, [item.id]: key })); setWeakReviewFeedback((current) => ({ ...current, [item.id]: "" })); }} aria-pressed={selectedWeakAnswers[item.id] === key}><b>{key}</b><span>{label}</span></button>)}</div><button className="weakness-submit" onClick={() => submitWeakReview(item)}>確認複習答案</button>{weakReviewFeedback[item.id] && <p>{weakReviewFeedback[item.id]}</p>}</div>}
					</article>;
				})}</div>}
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
			<button className="badge-collection-link" onClick={() => { location.href = "/badges"; }}>
				<span>🏅</span><div><b>我的學習徽章</b><small>查看你的文昌學習勳章與解鎖進度</small></div><i>›</i>
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
			<section className={`daily-fortune-task ${dailyFortuneTask.done ? "is-complete" : ""}`} aria-label="每日籤詩任務">
				<div className="daily-fortune-task-heading"><b>每日學習簽到</b><small>{dailyFortuneTask.done ? "今日已簽到" : "答對簽到"}</small></div>
				<p className="daily-fortune-verse">「{dailyFortune.verse}」</p>
				<div className="daily-fortune-action"><i aria-hidden="true">{dailyFortuneTask.done ? "✓" : "題"}</i><div><span>{dailyCheckInQuestion.subject}・今日簽到題</span><strong>{dailyCheckInQuestion.question}</strong></div></div>
				<div className="daily-checkin-options" role="radiogroup" aria-label="選擇今日簽到題答案">{dailyCheckInQuestion.choices.map(([key, label]) => <button key={key} className={selectedDailyAnswer === key ? "selected" : ""} onClick={() => { if (!dailyFortuneTask.done) { setSelectedDailyAnswer(key); setDailyAnswerFeedback(""); } }} disabled={dailyFortuneTask.done} aria-pressed={selectedDailyAnswer === key}><b>{key}</b><span>{label}</span></button>)}</div>
				<button onClick={completeDailyCheckIn} disabled={dailyFortuneTask.done}>{dailyFortuneTask.done ? "今日簽到完成・已獲得木牌 ✓" : "確認答案・完成簽到"}</button>
				{dailyAnswerFeedback && <p className={`daily-fortune-feedback ${dailyFortuneTask.done ? "correct" : ""}`}>{dailyAnswerFeedback}</p>}
				<p className="daily-fortune-note">每天一題；答對後即可完成簽到並獲得 1 枚祈福木牌。</p>
			</section>
			<section className="oracle-card" aria-label="文昌求籤">
				<div className="oracle-heading">
					<div><span>文昌靈籤</span><b>求一支給今天的指引</b></div>
					<div className="oracle-balance"><span>祈福木牌</span><b>{availablePlanks}<small> 枚</small></b></div>
				</div>
				{oracleStage === "idle" && (
					<div className="oracle-exchange">
						<div className="oracle-tube" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
						<div><b>以祈福木牌換取籤緣</b><p>每 3 枚木牌可兌換 1 次求籤機會；籤詩將依你親自選取的籤枝揭曉。</p><button onClick={exchangeOracleTicket} disabled={availablePlanks < 3}>{availablePlanks >= 3 ? "兌換 1 次求籤機會" : `還差 ${3 - availablePlanks} 枚木牌`}</button></div>
					</div>
				)}
				{oracleStage === "choosing" && (
					<div className="oracle-choice">
						<p>閉上眼想著此刻的心願，從籤筒裡親自選出一支籤。</p>
						<div className="fortune-sticks" role="group" aria-label="選擇一支籤">
							{fortunePoems.map((_, index) => <button className={`fortune-stick ${selectedStick === index ? "selected" : ""}`} key={index} onClick={() => setSelectedStick(index)} aria-label={`選擇第 ${index + 1} 支籤`}><i>{index + 1}</i></button>)}
						</div>
						<button className="oracle-draw-button" onClick={drawFortune} disabled={selectedStick === null}>請取第 {selectedStick === null ? "—" : selectedStick + 1} 籤 <span>→</span></button>
					</div>
				)}
				{oracleStage === "drawing" && <div className="oracle-drawing" aria-live="polite"><div className="oracle-tube shaking" aria-hidden="true"><i /><i /><i /><i /><i /><i /><span className="oracle-drawn-stick">{selectedStick !== null ? selectedStick + 1 : ""}</span></div><b>籤筒正在為你搖出指引</b><small>靜心片刻，讓選中的籤枝自己浮現</small></div>}
				{oracleStage === "result" && oracleResultId !== null && <div className="oracle-result"><div className="oracle-result-display"><div className="oracle-result-stick" aria-hidden="true"><b>{oracleResultId + 1}</b></div><div className="oracle-lot-paper"><div className="oracle-lot-heading"><span>WENCHANG LOT</span><b>第 {oracleResultId + 1} 籤</b></div><i className="oracle-seal">文昌</i><div className="oracle-lot-body"><strong className="oracle-luck">吉<br />籤</strong><div><h2>{fortunePoems[oracleResultId].title}</h2><p className="oracle-verse">{fortunePoems[oracleResultId].verse}</p><p className="oracle-interpret-label">【解曰】</p><p className="oracle-reading-copy">{fortunePoems[oracleResultId].reading}</p></div></div><small><span>誠心求籤</span><span>靜心解籤</span></small></div></div><div className="oracle-result-actions"><button onClick={drawAgain}>{oracleTickets > 0 ? "再求一籤" : "回到籤筒"}</button>{availablePlanks >= 3 && <button className="oracle-exchange-small" onClick={exchangeOracleTicket}>再兌換 1 次</button>}</div></div>}
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
				{wishReflections.some((item) => daysSinceWish(item.createdAt) >= 7) && <section className="wish-review" aria-label="願望回顧">
					<div className="wish-review-heading"><div><span>給未來的自己</span><b>願望回顧</b></div><i>⏳</i></div>
					<p>把當初的心願留給時間。第 7 天與第 30 天，回來看看自己已走了多遠。</p>
					<div className="wish-review-list">{wishReflections.filter((item) => daysSinceWish(item.createdAt) >= 7).map((item) => {
						const elapsed = daysSinceWish(item.createdAt);
						return <article key={item.id} className="wish-review-item"><strong>「{item.text}」</strong><div className="wish-review-milestones"><button className={item.reviewedAfter7Days ? "done" : ""} onClick={() => !item.reviewedAfter7Days && completeWishReview(item.id, 7)} disabled={item.reviewedAfter7Days}>{item.reviewedAfter7Days ? "第 7 天已回望 ✓" : "回顧第 7 天"}</button>{elapsed >= 30 && <button className={item.reviewedAfter30Days ? "done" : ""} onClick={() => !item.reviewedAfter30Days && completeWishReview(item.id, 30)} disabled={item.reviewedAfter30Days}>{item.reviewedAfter30Days ? "第 30 天已回望 ✓" : "回顧第 30 天"}</button>}</div></article>;
					})}</div>
				</section>}
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
					<div className="brand">
						<span className="brand-mark">文</span>
						<div className="brand-copy">
							<strong>文昌同行</strong>
							<small>學習路上，與你同行</small>
						</div>
					</div>
					<div className="account">
						<button className="line-login" onClick={login}>
							<span className="line-status-dot" aria-hidden="true" />
							{lineName ? "LINE 已連結" : "LINE 登入"}
						</button>
						<button
							className="avatar"
							onClick={() => setTab("profile")}
						>
							{lineName?.slice(0, 1) ?? "我"}
						</button>
					</div>
				</header>
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
				{focusPickerTaskIndex !== null && tasks[focusPickerTaskIndex] && (
					<div className="focus-mode-backdrop" role="presentation">
						<section className="focus-mode-dialog" role="dialog" aria-modal="true" aria-labelledby="focus-mode-title">
							<button className="focus-modal-close" onClick={() => setFocusPickerTaskIndex(null)} aria-label="關閉選擇專注模式">×</button>
							<span>靜心開始</span>
							<h2 id="focus-mode-title">選擇這次的<br /><em>專注節奏</em></h2>
							<p>{tasks[focusPickerTaskIndex].subject}・{tasks[focusPickerTaskIndex].detail}</p>
							<div className="focus-mode-list">{focusModes.map((mode) => <button key={mode.minutes} onClick={() => beginFocus(mode.minutes)}><b>{mode.minutes}<small> 分鐘</small></b><div><strong>{mode.label}</strong><span>{mode.detail}</span></div><i>開始 →</i></button>)}</div>
							<small className="focus-mode-note">完整專注每滿 10 分鐘，可獲得 1 枚祈福木牌。</small>
						</section>
					</div>
				)}
				{focusIndex !== null && tasks[focusIndex] && (
					<div className="focus-immersive" role="dialog" aria-modal="true" aria-labelledby="focus-session-title">
						<div className="focus-session-top"><span>文昌同行・專注時刻</span><button onClick={abandonFocus}>先離開</button></div>
						<div className="focus-session-content"><p>{focusEnded ? "專注時間到" : focusPaused ? "先深呼吸，再回到這一題" : `${tasks[focusIndex].subject}・${tasks[focusIndex].detail}`}</p><h2 id="focus-session-title">{focusTime}</h2><span className="focus-session-goal">{focusEnded ? "你完成這段專注了嗎？" : `本次目標・專注 ${focusScheduledMinutes} 分鐘`}</span><div className="focus-session-progress"><i style={{ width: `${Math.max(0, Math.min(100, 100 - (focusSeconds / Math.max(1, focusScheduledMinutes * 60)) * 100))}%` }} /></div><small>{focusEnded ? "完成後會更新任務，並帶你接續下一個讀書步驟。" : `每滿 10 分鐘可獲得祈福木牌・本次已守住 ${Math.max(0, focusScheduledMinutes - Math.ceil(focusSeconds / 60))} 分鐘`}</small></div>
						<div className="focus-session-actions">{focusEnded ? <><button className="focus-confirm" onClick={finishFocusAndContinue}>完成並接續下一項</button><button onClick={completeFocus}>完成並回到任務</button></> : <><button className="focus-confirm" onClick={focusPaused ? resumeFocus : pauseFocus}>{focusPaused ? "繼續專注" : "暫停"}</button><button onClick={abandonFocus}>保留任務，先離開</button></>}</div>
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
			</section>
		</main>
	);
}
