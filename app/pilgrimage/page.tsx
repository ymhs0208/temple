"use client";

import { useEffect, useRef, useState } from "react";
import liff from "@line/liff";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2011050459-8bPHPFCw";
const taipeiDate = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(date);

// 定義 7 尊媽祖的故事順序 (固定依照此順序解鎖)
const matsus = [
	{
		id: "story_1",
		name: "台中媽・萬春宮",
		district: "臺中州",
		badge: "萬",
		story: "萬春宮身為 1917 年七媽會的主辦方之一，見證了這場百年難得一見的宗教盛事。",
		insight: "歷史碎片 1/7：萬春宮的香火延續至今。",
		color: "rose",
		address: "臺中市中區成功路 212 號",
		openHours: "建議參拜 06:00–22:00",
		coordinates: { lat: 24.1455, lng: 120.6859 },
	},
	{
		id: "story_2",
		name: "旱溪媽・樂成宮",
		district: "臺中州",
		badge: "樂",
		story: "旱溪媽祖以慈悲庇佑地方，當年也一同駐駕於台中市區，賜福黎民。",
		insight: "歷史碎片 2/7：收集到旱溪媽的祝福。",
		color: "vermilion",
		address: "臺中市東區旱溪街 48 號",
		openHours: "建議參拜 04:00–22:00",
		coordinates: { lat: 24.1366, lng: 120.7057 },
	},
	{
		id: "story_3",
		name: "新港媽・奉天宮",
		district: "嘉義廳",
		badge: "奉",
		story: "搭乘火車遠道而來的新港媽，為當年的台中帶來了無比的熱鬧與安定。",
		insight: "歷史碎片 3/7：感受鐵道與信仰的結合。",
		color: "gold",
		address: "嘉義縣新港鄉新民路 53 號",
		openHours: "建議參拜 04:00–23:00",
		coordinates: { lat: 23.5542, lng: 120.3477 },
	},
	{
		id: "story_4",
		name: "北港媽・朝天宮",
		district: "嘉義廳",
		badge: "朝",
		story: "北港朝天宮的香火鼎盛，當年參與七媽會更是轟動全台。",
		insight: "歷史碎片 4/7：重溫百年前的萬人空巷。",
		color: "jade",
		address: "雲林縣北港鎮中山路 178 號",
		openHours: "建議參拜 04:00–23:00",
		coordinates: { lat: 23.568, lng: 120.305 },
	},
	{
		id: "story_5",
		name: "南瑤媽・南瑤宮",
		district: "臺中州",
		badge: "南",
		story: "彰化南瑤宮媽祖也是七媽會的重要貴賓，共同守護中部子民。",
		insight: "歷史碎片 5/7：信仰跨越了縣市的界線。",
		color: "violet",
		address: "彰化縣彰化市南瑤路 43 號",
		openHours: "建議參拜 04:00–22:00",
		coordinates: { lat: 24.0691, lng: 120.5364 },
	},
	{
		id: "story_6",
		name: "鹿港媽・天后宮",
		district: "臺中州",
		badge: "天",
		story: "鹿港天后宮歷史悠久，當年其陣頭與儀仗為七媽會增添了無數光彩。",
		insight: "歷史碎片 6/7：傳統陣頭的百年記憶。",
		color: "blue",
		address: "彰化縣鹿港鎮中山路 430 號",
		openHours: "建議參拜 05:00–22:00",
		coordinates: { lat: 24.0566, lng: 120.4315 },
	},
	{
		id: "story_7",
		name: "梧棲媽・朝元宮",
		district: "臺中州",
		badge: "元",
		story: "海線的梧棲媽祖也受邀來到山線，促成了山海媽祖齊聚一堂的佳話。",
		insight: "歷史碎片 7/7：山海會聚的奇蹟。",
		color: "cyan",
		address: "臺中市梧棲區梧棲路 140 號",
		openHours: "建議參拜 05:00–22:00",
		coordinates: { lat: 24.2536, lng: 120.5304 },
	},
];

// 預先設定好分佈在各地的 7 個實體 QR Code 代碼
const validPhysicalQRCodes = [
	"QR01",
	"QR02",
	"QR03",
	"QR04",
	"QR05",
	"QR06",
	"QR07",
];

type BarcodeDetectorInstance = {
	detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};
type BarcodeDetectorConstructor = new (options?: {
	formats?: string[];
}) => BarcodeDetectorInstance;
type ScannerWindow = Window &
	typeof globalThis & { BarcodeDetector?: BarcodeDetectorConstructor };
function qrCodeFromValue(value: string) {
	try {
		return (
			new URL(value).searchParams.get("code")?.toUpperCase() ??
			value.trim().toUpperCase()
		);
	} catch {
		return value.trim().toUpperCase();
	}
}

type QuizState = "IDLE" | "PLAYING" | "PASSED";
type UserLocation = { lat: number; lng: number };
type PilgrimageCertificate = { number: string; issuedAt: string; name: string };

function distanceFrom(location: UserLocation, destination: UserLocation) {
	const earthRadiusKm = 6371;
	const toRadians = (value: number) => (value * Math.PI) / 180;
	const latitudeDelta = toRadians(destination.lat - location.lat);
	const longitudeDelta = toRadians(destination.lng - location.lng);
	const a =
		Math.sin(latitudeDelta / 2) ** 2 +
		Math.cos(toRadians(location.lat)) * Math.cos(toRadians(destination.lat)) *
			Math.sin(longitudeDelta / 2) ** 2;
	return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function Pilgrimage() {
	const [code, setCode] = useState("");
	const [visits, setVisits] = useState<string[]>([]);
	const [notice, setNotice] = useState("");
	const [idToken, setIdToken] = useState<string | null>(null);
	const [lineName, setLineName] = useState<string | null>(null);
	const [certificate, setCertificate] = useState<PilgrimageCertificate | null>(null);
	const [selectedMatsuId, setSelectedMatsuId] = useState<string | null>(null);
	const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
	const [locationMessage, setLocationMessage] = useState("");

	// ✅ 進入頁面不強制開啟相機
	const [scannerOpen, setScannerOpen] = useState(false);

	const [quizState, setQuizState] = useState<QuizState>("IDLE");
	const [showCertificate, setShowCertificate] = useState(false);
	const [hasCompletedQuiz, setHasCompletedQuiz] = useState(false);

	// ✅ 測驗錯誤提示與過關彈窗狀態
	const [quizError, setQuizError] = useState("");
	const [showRewardModal, setShowRewardModal] = useState(false);
	const [rewardMatsu, setRewardMatsu] = useState<(typeof matsus)[0] | null>(
		null,
	);

	const videoRef = useRef<HTMLVideoElement>(null);
	const scanCardRef = useRef<HTMLElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const animationRef = useRef<number | null>(null);

	const unlockedCount = visits.length;
	const unlockedMatsus = matsus.slice(0, unlockedCount);
	const selectedMatsu =
		matsus.find((matsu) => matsu.id === selectedMatsuId) ??
		unlockedMatsus[unlockedCount - 1] ??
		matsus[0];
	const isAllCollected = unlockedCount === matsus.length;
	const nextMatsu = matsus[unlockedCount] ?? null;
	const openNavigation = (matsu: (typeof matsus)[number]) => {
		window.open(
			`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(matsu.address)}`,
			"_blank",
			"noopener,noreferrer",
		);
	};
	const requestLocation = () => {
		if (!navigator.geolocation) {
			setLocationMessage("此裝置不支援定位，仍可直接開啟導航。");
			return;
		}
		setLocationMessage("正在取得目前位置…");
		navigator.geolocation.getCurrentPosition(
			(position) => {
				setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
				setLocationMessage("已更新與各站的直線距離。");
			},
			() => setLocationMessage("無法取得位置，請允許定位權限後再試一次。"),
			{ enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
		);
	};
	const shareJourney = async () => {
		const text = isAllCollected
			? "我已完成「1917 七媽會・台中萬春宮」七站巡禮，收集所有百年歷史碎片！"
			: `我正在進行「1917 七媽會・台中萬春宮」巡禮，已收集 ${unlockedCount}/${matsus.length} 塊歷史碎片。`;
		try {
			if (navigator.share) await navigator.share({ title: "1917 七媽會巡禮", text });
			else await navigator.clipboard.writeText(text);
			setNotice(navigator.share ? "已開啟分享選單。" : "巡禮成果已複製，可貼給朋友。");
		} catch {}
	};
	const syncPilgrimageState = (state: { quizCompleted: boolean; certificate: PilgrimageCertificate | null }) => {
		if (!idToken) return;
		void fetch("/api/visits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken, pilgrimageState: state }) });
	};
	const issueCertificate = () => {
		if (certificate) return certificate;
		const issued = new Date();
		const nextCertificate = {
			number: `1917-${taipeiDate(issued).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
			issuedAt: issued.toISOString(),
			name: lineName || "七媽會巡禮者",
		};
		setCertificate(nextCertificate);
		const plan = JSON.parse(localStorage.getItem("matsu-1917-mvp") ?? "{}");
		localStorage.setItem("matsu-1917-mvp", JSON.stringify({ ...plan, pilgrimageCertificate: nextCertificate }));
		syncPilgrimageState({ quizCompleted: true, certificate: nextCertificate });
		return nextCertificate;
	};
	const shareCertificate = async () => {
		if (!certificate) return;
		const text = `${certificate.name} 已完成「1917 七媽會・台中萬春宮」七站巡禮。完成證書：${certificate.number}`;
		try { if (navigator.share) await navigator.share({ title: "1917 七媽會完成證書", text }); else await navigator.clipboard.writeText(text); } catch {}
	};

	useEffect(() => {
		try {
			const saved = JSON.parse(localStorage.getItem("matsu-1917-mvp") ?? "{}");
			setVisits(saved.matsuVisits ?? []);
			if (saved.pilgrimageCertificate) setCertificate(saved.pilgrimageCertificate as PilgrimageCertificate);
			if (saved.pilgrimageQuizCompleted || saved.pilgrimageCertificate) setHasCompletedQuiz(true);
		} catch {}
		liff.init({ liffId: LIFF_ID })
			.then(() => {
				if (liff.isLoggedIn()) { setIdToken(liff.getIDToken()); setLineName(liff.getDecodedIDToken()?.name ?? null); }
			})
			.catch(() => setNotice("LINE 同步暫時無法使用"));
	}, []);

	useEffect(() => {
		if (!idToken) return;
		fetch("/api/visits", { headers: { "x-line-id-token": idToken } })
			.then((response) =>
				response.ok ? response.json() : Promise.reject(),
			)
			.then((data) => {
				if (Array.isArray(data.visits)) setVisits(data.visits);
				if (data.pilgrimageState?.certificate) setCertificate(data.pilgrimageState.certificate as PilgrimageCertificate);
				if (data.pilgrimageState?.quizCompleted || data.pilgrimageState?.certificate) setHasCompletedQuiz(true);
			})
			.catch(() => setNotice("巡禮資料暫時只保存在此裝置"));
	}, [idToken]);

	useEffect(() => {
		if (idToken && certificate && hasCompletedQuiz) syncPilgrimageState({ quizCompleted: true, certificate });
	}, [idToken, certificate, hasCompletedQuiz]);

	useEffect(() => {
		if (!selectedMatsuId && unlockedMatsus.length > 0) {
			setSelectedMatsuId(unlockedMatsus[unlockedMatsus.length - 1].id);
		}
	}, [selectedMatsuId, unlockedMatsus]);

	useEffect(() => {
		if (!scannerOpen) return;
		let cancelled = false;
		const stop = () => {
			if (animationRef.current)
				cancelAnimationFrame(animationRef.current);
			streamRef.current?.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
		};
		const start = async () => {
			try {
				const Detector = (window as ScannerWindow).BarcodeDetector;
				if (!Detector) {
					setNotice(
						"此瀏覽器暫不支援相機辨識，請使用碎片碼手動解鎖。",
					);
					setScannerOpen(false);
					return;
				}
				const stream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: "environment" },
					audio: false,
				});
				if (cancelled) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}
				streamRef.current = stream;
				const video = videoRef.current;
				if (!video) return;
				video.srcObject = stream;
				await video.play();
				const detector = new Detector({ formats: ["qr_code"] });
				const scan = async () => {
					if (cancelled || !videoRef.current) return;
					try {
						const result = await detector.detect(videoRef.current);
						if (result[0]?.rawValue) {
							setCode(qrCodeFromValue(result[0].rawValue));
							setNotice("已讀取碎片碼，請按「解鎖」確認。");
							setScannerOpen(false);
							return;
						}
					} catch {}
					animationRef.current = requestAnimationFrame(scan);
				};
				void scan();
			} catch {
				setNotice("無法開啟相機，請確認相機權限或改用手動輸入。");
				setScannerOpen(false);
			}
		};
		void start();
		return () => {
			cancelled = true;
			stop();
		};
	}, [scannerOpen]);

	const unlock = async () => {
		const normalized = qrCodeFromValue(code);

		if (!validPhysicalQRCodes.includes(normalized)) {
			setNotice("這不是本次活動的碎片碼。可使用 QR01 至 QR07 進行測試。");
			return;
		}

		if (visits.includes(normalized)) {
			setNotice(`這個地點的碎片您已經收集過囉！趕快去尋找下一個吧！`);
			return;
		}

		const expectedCode = validPhysicalQRCodes[unlockedCount];
		if (!expectedCode) {
			setNotice("七塊碎片都已收集完成，快去完成最終歷史問答吧！");
			return;
		}
		if (normalized !== expectedCode) {
			setNotice(`這是較後面的碎片，請先前往第 ${unlockedCount + 1} 站「${matsus[unlockedCount].name}」尋找 ${expectedCode}。`);
			return;
		}

		const nextVisits = [...visits, normalized];
		const newUnlockedCount = nextVisits.length;
		const newlyUnlockedMatsu = matsus[newUnlockedCount - 1];

		setVisits(nextVisits);
		setSelectedMatsuId(newlyUnlockedMatsu.id);

		// ✅ 解鎖成功時，開啟過關知識彈窗
		setRewardMatsu(newlyUnlockedMatsu);
		setShowRewardModal(true);

		const plan = JSON.parse(localStorage.getItem("matsu-1917-mvp") ?? "{}");
		localStorage.setItem(
			"matsu-1917-mvp",
			JSON.stringify({ ...plan, matsuVisits: nextVisits }),
		);

		if (idToken) {
			const response = await fetch("/api/visits", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ idToken, code: normalized }),
			});
			setNotice(
				response.ok
					? `尋獲歷史碎片！成功解鎖「${newlyUnlockedMatsu.name}」的故事。`
					: `尋獲歷史碎片！目前暫存於此裝置。`,
			);
		} else {
			setNotice(`尋獲歷史碎片！登入 LINE 後可同步進度。`);
		}
		setCode("");
	};

	return (
		<main className="feature-page">
			<div className="feature-shell pilgrimage-shell">
				<button
					className="back-link"
					onClick={() => (location.href = "/")}
				>
					← 返回
				</button>

				<section className="feature-hero temple-hero">
					<div className="temple-hero-content">
						<div className="temple-hero-label"><span>⛩</span> 1917 七媽會・台中萬春宮</div>
						<p className="temple-hero-eyebrow">百年香火匯聚，從第一站開始尋回記憶</p>
						<h1>尋找七媽蹤跡，<em>收集百年歷史碎片。</em></h1>
						<p className="temple-hero-description">掃描活動現場 QR Code，依序解鎖 1917 年七媽會的專屬故事。集滿七塊碎片，即可開啟隱藏劇情。</p>
						<div className="temple-hero-meta"><span>七座宮廟</span><i /> <span>七段故事</span><i /> <span>一場時空巡禮</span></div>
					</div>
				</section>

				<section className="ritual-progress pilgrimage-progress-card" aria-label="巡禮進度與參與方式">
					<div className="ritual-progress-summary">
						<span>歷史碎片收集進度</span>
						<b>{unlockedCount}<small> / {matsus.length} 塊</small></b>
						<div><i style={{ width: `${(unlockedCount / matsus.length) * 100}%`, backgroundColor: "#a855f7" }} /></div>
					</div>
					<div className="pilgrimage-steps" aria-label="巡禮參與方式">
						<div><span>01</span><b>查看下一站</b><small>依導覽前往指定宮廟</small></div>
						<div><span>02</span><b>掃描現場 QR Code</b><small>依序解鎖專屬歷史故事</small></div>
						<div><span>03</span><b>集滿七塊碎片</b><small>完成問答，開啟隱藏劇情</small></div>
						<button type="button" onClick={() => scanCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>前往掃描</button>
					</div>
				</section>

				<section className="pilgrimage-guide" aria-labelledby="pilgrimage-guide-title">
					<div className="pilgrimage-guide-heading">
						<div>
							<span>七媽會・實體巡禮地圖</span>
							<h2 id="pilgrimage-guide-title">沿著七座宮廟，收集百年記憶</h2>
						</div>
						<button type="button" onClick={requestLocation}>⌖ 顯示距離</button>
					</div>
					<div className="next-stop-card">
						{nextMatsu ? (
							<>
								<div>
									<span>下一站 · 第 {unlockedCount + 1} 站</span>
									<b>{nextMatsu.name}</b>
									<small>{nextMatsu.address}</small>
								</div>
								<button type="button" onClick={() => openNavigation(nextMatsu)}>前往導航 ↗</button>
							</>
						) : (
							<div><span>巡禮完成</span><b>七塊歷史碎片已全數收集</b><small>回到任一宮廟，重溫這段百年故事。</small></div>
						)}
					</div>
					{locationMessage && <p className="location-message">{locationMessage}</p>}
					<ol className="pilgrimage-map">
						{matsus.map((matsu, index) => {
							const completed = index < unlockedCount;
							const distance = userLocation ? distanceFrom(userLocation, matsu.coordinates).toFixed(1) : null;
							return (
								<li key={matsu.id} className={completed ? "completed" : index === unlockedCount ? "next" : ""}>
									<div className="map-stop-number">{completed ? "✓" : index + 1}</div>
									<div className="map-stop-details">
										<b>{matsu.name}</b>
										<small>{matsu.address}</small>
										<span>{matsu.openHours}{distance ? ` · 約 ${distance} 公里` : ""}</span>
									</div>
									<button type="button" aria-label={`導航至${matsu.name}`} onClick={() => openNavigation(matsu)}>導航 ↗</button>
								</li>
							);
						})}
					</ol>
					<p className="guide-note">距離為直線估算；實際路線、交通與開放時間請以宮廟公告及導航服務為準。</p>
				</section>

				{/* ✅ DOM 完全保留原始結構，不加上任何額外標籤或 inline-style 干擾 */}
				<section className="scan-card" ref={scanCardRef}>
					<div className="card-title">
						<span>🔍</span>
						<div>
							<b>尋找與掃描</b>
							<small>
								掃描現場 QR Code；無法開啟相機時，也可手動輸入。
							</small>
						</div>
					</div>
					<div className="code-row">
						<input
							value={code}
							onChange={(event) => setCode(event.target.value)}
							placeholder="例如 QR01"
						/>
						<button
							onClick={unlock}
							style={{ backgroundColor: "#8b5cf6" }}
						>
							解鎖碎片
						</button>
					</div>

					<button
						onClick={() => setScannerOpen((current) => !current)}
						style={{
							width: "100%",
							padding: "14px",
							marginTop: "16px",
							backgroundColor: scannerOpen
								? "#fef3c7"
								: "#ddd6fe", // 淺黃色 / 淺紫色
							color: scannerOpen ? "#b45309" : "#5b21b6",
							border: "none",
							borderRadius: "16px",
							fontSize: "1.05rem",
							fontWeight: "bold",
							cursor: "pointer",
							boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
							transition: "all 0.2s ease",
						}}
					>
						{scannerOpen ? "關閉相機" : "📸 開啟相機尋找碎片"}
					</button>

					{scannerOpen && (
						<div
							style={{
								position: "relative",
								overflow: "hidden",
								borderRadius: "16px",
								border: "3px solid #bfdbfe",
								marginTop: "16px",
								backgroundColor: "#000",
							}}
						>
							<video
								ref={videoRef}
								muted
								playsInline
								style={{ width: "100%", display: "block" }}
							/>
							{/* 掃描線動畫元素 */}
							<div
								className="animate-scan"
								style={{
									position: "absolute",
									left: 0,
									width: "100%",
									height: "4px",
									backgroundColor: "#60a5fa",
									boxShadow: "0 0 12px 4px #bfdbfe",
									pointerEvents: "none",
								}}
							/>
							<span
								style={{
									position: "absolute",
									bottom: "16px",
									width: "100%",
									textAlign: "center",
									color: "white",
									textShadow: "0px 2px 4px rgba(0,0,0,0.8)",
									fontWeight: "bold",
									letterSpacing: "1px",
								}}
							>
								請將 QR Code 對準畫面
							</span>
						</div>
					)}
					{notice && (
						<p
							style={{
								marginTop: "12px",
								color: "#e11d48",
								fontWeight: "bold",
								fontSize: "0.9rem",
								textAlign: "center",
								backgroundColor: "#fee2e2",
								padding: "8px",
								borderRadius: "8px",
							}}
						>
							{notice}
						</p>
					)}
				</section>

				<section
					className="temple-route"
					aria-label="碎片地圖"
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(12, 1fr)", // 切成 12 欄網格
						gap: "8px", // 縮小間距以容納更多方塊
						marginTop: "24px",
						marginBottom: "24px",
					}}
				>
					{matsus.map((matsu, index) => {
						const isStoryUnlocked = index < unlockedCount;

						// 🌟 核心排版邏輯：前 3 個佔 4 欄 (上排)，後 4 個佔 3 欄 (下排)
						const gridColumnSpan = index < 3 ? "span 4" : "span 3";

						// 活潑可愛的 Q 版專屬配色
						const bgColors = [
							"#ffe4e6",
							"#ffedd5",
							"#fef9c3",
							"#e0e7ff",
							"#e0f2fe",
							"#ede9fe",
							"#fae8ff",
						];
						const textColors = [
							"#be123c",
							"#c2410c",
							"#a16207",
							"#3b82f6",
							"#0369a1",
							"#6d28d9",
							"#a21caf",
						];

						return (
							<button
								key={matsu.id}
								onClick={() =>
									isStoryUnlocked &&
									(location.href = `/pilgrimage/${matsu.id}`)
								}
								disabled={!isStoryUnlocked}
								style={{
									gridColumn: gridColumnSpan,
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									justifyContent: "center",
									padding: "10px 4px", // 縮小左右內距
									backgroundColor: isStoryUnlocked
										? bgColors[index]
										: "#f3f4f6",
									border: `2px solid ${isStoryUnlocked ? bgColors[index] : "#e5e7eb"}`,
									borderRadius: "16px", // 縮小一點圓角比例
									opacity: isStoryUnlocked ? 1 : 0.7,
									cursor: isStoryUnlocked
										? "pointer"
										: "not-allowed",
									boxShadow:
										selectedMatsuId === matsu.id
											? "inset 0 4px 6px rgba(0,0,0,0.1)"
											: "0 2px 4px rgba(0,0,0,0.05)",
									transform:
										selectedMatsuId === matsu.id
											? "scale(0.94)"
											: "scale(1)",
									transition: "all 0.2s ease",
								}}
							>
								<span
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										width: "36px", // 縮小圓形徽章
										height: "36px",
										borderRadius: "50%",
										backgroundColor: isStoryUnlocked
											? "#ffffff"
											: "#d1d5db",
										color: isStoryUnlocked
											? textColors[index]
											: "#9ca3af",
										fontSize: "1.1rem",
										fontWeight: "bold",
										marginBottom: "6px",
										boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
									}}
								>
									{isStoryUnlocked ? matsu.badge : "?"}
								</span>
								<div
									style={{
										textAlign: "center",
										width: "100%",
									}}
								>
									<small
										style={{
											display: "block",
											color: isStoryUnlocked
												? textColors[index]
												: "#6b7280",
											marginBottom: "2px",
											fontSize: "0.65rem",
											fontWeight: "bold",
										}}
									>
										碎片 {index + 1}
									</small>
									<b
										style={{
											color: isStoryUnlocked
												? textColors[index]
												: "#9ca3af",
											fontSize: "0.75rem", // 縮小字體以適應一行 4 個
											lineHeight: "1.3",
											display: "block",
										}}
									>
										{/* 將「台中媽・萬春宮」自動斷行，保持排版整齊 */}
										{isStoryUnlocked ? (
											<>
												{matsu.name.split("・")[0]}
												<br />
												{matsu.name.split("・")[1]}
											</>
										) : (
											<>
												尚待
												<br />
												尋找
											</>
										)}
									</b>
								</div>
							</button>
						);
					})}
				</section>

				<section
					className={`culture-card temple-story ${selectedMatsu.color}`}
				>
					<div className="culture-symbol">
						{unlockedCount > 0 ? selectedMatsu.badge : "?"}
					</div>
					<div>
						<span>
							{unlockedCount > 0
								? `${selectedMatsu.district}・已解鎖碎片`
								: "未知的歷史碎片"}
						</span>
						<h2>
							{unlockedCount > 0
								? selectedMatsu.name
								: "尚未解鎖任何故事"}
						</h2>
						<p>
							{unlockedCount > 0
								? selectedMatsu.story
								: "前往活動現場尋找並掃描第一塊碎片碼，重溫這段百年記憶。"}
						</p>
						<div className="study-insight">
							<b>碎片解鎖提示</b>
							<small>
								{unlockedCount > 0
									? selectedMatsu.insight
									: "每一塊碎片都藏著 1917 年的小秘密喔！"}
							</small>
						</div>
					</div>
				</section>

				{isAllCollected && (
					<section
						className="badge-card"
						style={{
							marginTop: "24px",
							backgroundColor: "#fef3c7",
							borderColor: "#fde68a",
							display: "block",
						}}
					>
						<button className="journey-share" type="button" onClick={shareJourney}>↗ 分享我的巡禮成果</button>
						{quizState === "IDLE" && !hasCompletedQuiz && (
							<div className="text-center w-full">
								<h2
									style={{
										color: "#92400e",
										fontSize: "1.25rem",
										fontWeight: "bold",
										marginBottom: "8px",
									}}
								>
									✨ 恭喜集滿七塊歷史碎片！
								</h2>
								<p
									style={{
										color: "#b45309",
										marginBottom: "16px",
									}}
								>
									1917 年的七媽會大門已為您開啟。
								</p>
								<button
									onClick={() => {
										setQuizState("PLAYING");
										setQuizError("");
									}}
									style={{
										backgroundColor: "#f59e0b",
										color: "#fff",
										padding: "8px 24px",
										borderRadius: "999px",
										fontWeight: "bold",
									}}
								>
									開始歷史問答
								</button>
							</div>
						)}

						{quizState === "PLAYING" && (
							<div className="quiz-backdrop" role="presentation" onMouseDown={() => setQuizState("IDLE")}>
								<section className="quiz-dialog" role="dialog" aria-modal="true" aria-labelledby="quiz-title" onMouseDown={(event) => event.stopPropagation()}>
									<button className="quiz-close" aria-label="關閉歷史問答" onClick={() => setQuizState("IDLE")}>×</button>
									<div className="text-center w-full">
								<h2
									id="quiz-title"
									style={{
										color: "#1e40af",
										fontSize: "1.25rem",
										fontWeight: "bold",
										marginBottom: "16px",
									}}
								>
									歷史問答挑戰
								</h2>
								<p
									style={{
										marginBottom: "16px",
										fontWeight: "bold",
									}}
								>
									請問 1917
									年的七媽會，主要是慶祝台中車站與哪條鐵路的通車？
								</p>

								<div
									style={{
										display: "flex",
										flexDirection: "column",
										gap: "8px",
									}}
								>
									{/* ✅ 使用原本按鈕邊框，替換 onClick 邏輯 */}
									<button
										onClick={() =>
											setQuizError(
												"再想想看喔！當年高鐵還沒出現呢！",
											)
										}
										style={{
											padding: "8px",
											border: "1px solid #93c5fd",
											borderRadius: "8px",
										}}
									>
										A. 高鐵通車
									</button>

									<button
											onClick={() => {
											setQuizState("IDLE");
											issueCertificate();
											setHasCompletedQuiz(true);
											const saved = JSON.parse(localStorage.getItem("matsu-1917-mvp") ?? "{}");
											localStorage.setItem("matsu-1917-mvp", JSON.stringify({ ...saved, pilgrimageQuizCompleted: true }));
											setShowCertificate(true);
											setQuizError("");
										}}
										style={{
											padding: "8px",
											border: "1px solid #93c5fd",
											borderRadius: "8px",
											backgroundColor: "#eff6ff",
										}}
									>
										B. 縱貫鐵路台中段通車
									</button>

									<button
										onClick={() =>
											setQuizError(
												"再想想看喔！捷運是很近代才有的建設！",
											)
										}
										style={{
											padding: "8px",
											border: "1px solid #93c5fd",
											borderRadius: "8px",
										}}
									>
										C. 台中捷運通車
									</button>
								</div>

								{/* ✅ 錯誤提示框 */}
								{quizError && (
									<div
										style={{
											marginTop: "16px",
											padding: "12px",
											backgroundColor: "#fee2e2",
											color: "#e11d48",
											borderRadius: "8px",
											fontWeight: "bold",
											fontSize: "0.95rem",
										}}
									>
										💡 {quizError}
									</div>
								)}
									</div>
								</section>
							</div>
						)}
						{quizState === "IDLE" && hasCompletedQuiz && <div className="text-center w-full"><h2 style={{ color: "#92400e", fontSize: "1.25rem", fontWeight: "bold", marginBottom: "8px" }}>✨ 歷史問答已完成</h2><p style={{ color: "#b45309", marginBottom: "16px" }}>你已通過最終問答，完成證書已保存。</p><button onClick={() => setShowCertificate(true)} style={{ backgroundColor: "#f59e0b", color: "#fff", padding: "8px 24px", borderRadius: "999px", fontWeight: "bold" }}>查看完成證書</button></div>}

						{false && quizState === "PASSED" && (
							<div
								className="text-center w-full"
								style={{
									animation: "popIn 0.5s ease-out forwards",
								}}
							>
								<h2
									style={{
										color: "#6b21a8",
										fontSize: "1.4rem", // 稍微放大標題
										fontWeight: "bold",
										marginBottom: "12px",
									}}
								>
									🎉 解鎖隱藏故事！
								</h2>
								{certificate && <section className="pilgrimage-certificate" aria-label="1917 七媽會完成證書"><span>1917 七媽會・台中萬春宮</span><h3>巡禮完成證書</h3><p>茲證明</p><b>{certificate.name}</b><p>已完成七站歷史碎片巡禮，並通過最終問答。</p><small>發證日期　{new Intl.DateTimeFormat("zh-TW", { dateStyle: "long", timeZone: "Asia/Taipei" }).format(new Date(certificate.issuedAt))}</small><i>完成序號　{certificate.number}</i><div><button onClick={shareCertificate}>分享證書 ↗</button><button onClick={() => window.print()}>保存為 PDF</button></div></section>}

								{/* 🌟 放入你生成的精美圖片 */}
								<img
									alt="萬春宮百年巡禮"
									src="/wanchun-1917-hero.png"
									style={{
										width: "100%",
										maxWidth: "200px",
										margin: "0 auto 16px",
										borderRadius: "16px",
										boxShadow:
											"0 4px 12px rgba(107, 33, 168, 0.15)",
									}}
								/>

								<p
									style={{
										color: "#7e22ce",
										marginBottom: "16px",
										lineHeight: "1.6",
									}}
								>
									原來當年七媽會期間，台中市區湧入了超過平時人口數倍的信眾！萬春宮身為地主，不僅準備了豐盛的祭典，更讓各地香客感受到了台中濃濃的人情味。
									<br />
									<br />
									感謝您參與這場百年的時空旅行！
								</p>
							</div>
						)}
					</section>
				)}
				{showCertificate && certificate && <div className="certificate-backdrop" role="presentation" onMouseDown={() => setShowCertificate(false)}><section className="certificate-dialog" role="dialog" aria-modal="true" aria-label="巡禮完成證書" onMouseDown={(event) => event.stopPropagation()}><button className="quiz-close" aria-label="關閉完成證書" onClick={() => setShowCertificate(false)}>×</button><h2>🎉 解鎖隱藏故事！</h2><section className="pilgrimage-certificate" aria-label="1917 七媽會完成證書"><span>1917 七媽會・台中萬春宮</span><h3>巡禮完成證書</h3><p>茲證明</p><b>{certificate.name}</b><p>已完成七站歷史碎片巡禮，並通過最終問答。</p><small>發證日期　{new Intl.DateTimeFormat("zh-TW", { dateStyle: "long", timeZone: "Asia/Taipei" }).format(new Date(certificate.issuedAt))}</small><i>完成序號　{certificate.number}</i><div><button onClick={shareCertificate}>分享證書 ↗</button><button onClick={() => window.print()}>保存為 PDF</button></div></section></section></div>}

				<p className="feature-note">
					展示用代碼：QR01 ～ QR07。請依序輸入，才能體驗完整的巡禮解鎖流程。
				</p>

				{/* ✅ 絕對安全的彈出視窗：放在最底層且脫離文件流，絕不干擾 Grid 或 Flex */}
				{showRewardModal && rewardMatsu && (
					<div
						style={{
							position: "fixed",
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							backgroundColor: "rgba(0,0,0,0.5)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							zIndex: 9999,
							padding: "20px",
						}}
					>
						<div
							style={{
								backgroundColor: "#fff",
								padding: "24px",
								borderRadius: "24px",
								width: "100%",
								maxWidth: "340px",
								textAlign: "center",
								border: "4px solid #fde68a",
								boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
							}}
						>
							<h2
								style={{
									fontSize: "1.4rem",
									fontWeight: "bold",
									color: "#b45309",
									marginBottom: "16px",
								}}
							>
								✨ 恭喜解鎖！
							</h2>
							<div
								style={{
									fontSize: "2.5rem",
									width: "72px",
									height: "72px",
									lineHeight: "72px",
									margin: "0 auto 12px",
									backgroundColor: "#fef3c7",
									borderRadius: "50%",
									color: "#d97706",
									border: "2px solid #fde68a",
								}}
							>
								{rewardMatsu.badge}
							</div>
							<h3
								style={{
									fontSize: "1.25rem",
									fontWeight: "bold",
									color: "#374151",
									marginBottom: "12px",
								}}
							>
								{rewardMatsu.name}
							</h3>

							<div
								style={{
									backgroundColor: "#e0f2fe",
									padding: "16px",
									borderRadius: "16px",
									color: "#1e3a8a",
									marginBottom: "24px",
									fontSize: "0.95rem",
									textAlign: "left",
									lineHeight: "1.6",
								}}
							>
								<b
									style={{
										display: "block",
										marginBottom: "6px",
									}}
								>
									💡 歷史碎片：
								</b>
								{rewardMatsu.story}
							</div>

							<button
								onClick={() => (location.href = `/pilgrimage/${rewardMatsu.id}`)}
								style={{
									backgroundColor: "#f59e0b",
									color: "white",
									padding: "12px 32px",
									borderRadius: "999px",
									fontWeight: "bold",
									border: "none",
									fontSize: "1rem",
									cursor: "pointer",
									width: "100%",
									boxShadow:
										"0 4px 6px rgba(245, 158, 11, 0.25)",
								}}
							>
								閱讀完整故事
							</button>
							<button onClick={() => setShowRewardModal(false)} style={{ marginTop: "10px", border: "none", background: "transparent", color: "#8a7756", fontSize: "0.9rem", cursor: "pointer" }}>稍後再看</button>
						</div>
					</div>
				)}
			</div>
		</main>
	);
}
