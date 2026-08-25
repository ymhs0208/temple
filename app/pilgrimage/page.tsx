"use client";

import { useEffect, useRef, useState } from "react";
import liff from "@line/liff";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2011050459-8bPHPFCw";

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
	},
	{
		id: "story_2",
		name: "旱溪媽・樂成宮",
		district: "臺中州",
		badge: "樂",
		story: "旱溪媽祖以慈悲庇佑地方，當年也一同駐駕於台中市區，賜福黎民。",
		insight: "歷史碎片 2/7：收集到旱溪媽的祝福。",
		color: "vermilion",
	},
	{
		id: "story_3",
		name: "新港媽・奉天宮",
		district: "嘉義廳",
		badge: "奉",
		story: "搭乘火車遠道而來的新港媽，為當年的台中帶來了無比的熱鬧與安定。",
		insight: "歷史碎片 3/7：感受鐵道與信仰的結合。",
		color: "gold",
	},
	{
		id: "story_4",
		name: "北港媽・朝天宮",
		district: "嘉義廳",
		badge: "朝",
		story: "北港朝天宮的香火鼎盛，當年參與七媽會更是轟動全台。",
		insight: "歷史碎片 4/7：重溫百年前的萬人空巷。",
		color: "jade",
	},
	{
		id: "story_5",
		name: "南瑤媽・南瑤宮",
		district: "臺中州",
		badge: "南",
		story: "彰化南瑤宮媽祖也是七媽會的重要貴賓，共同守護中部子民。",
		insight: "歷史碎片 5/7：信仰跨越了縣市的界線。",
		color: "violet",
	},
	{
		id: "story_6",
		name: "鹿港媽・天后宮",
		district: "臺中州",
		badge: "天",
		story: "鹿港天后宮歷史悠久，當年其陣頭與儀仗為七媽會增添了無數光彩。",
		insight: "歷史碎片 6/7：傳統陣頭的百年記憶。",
		color: "blue",
	},
	{
		id: "story_7",
		name: "梧棲媽・朝元宮",
		district: "臺中州",
		badge: "元",
		story: "海線的梧棲媽祖也受邀來到山線，促成了山海媽祖齊聚一堂的佳話。",
		insight: "歷史碎片 7/7：山海會聚的奇蹟。",
		color: "cyan",
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

export default function Pilgrimage() {
	const [code, setCode] = useState("");
	const [visits, setVisits] = useState<string[]>([]);
	const [notice, setNotice] = useState("");
	const [idToken, setIdToken] = useState<string | null>(null);
	const [selectedMatsuId, setSelectedMatsuId] = useState<string | null>(null);

	// ✅ 進入頁面不強制開啟相機
	const [scannerOpen, setScannerOpen] = useState(false);

	const [quizState, setQuizState] = useState<QuizState>("IDLE");

	// ✅ 測驗錯誤提示與過關彈窗狀態
	const [quizError, setQuizError] = useState("");
	const [showRewardModal, setShowRewardModal] = useState(false);
	const [rewardMatsu, setRewardMatsu] = useState<(typeof matsus)[0] | null>(
		null,
	);

	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const animationRef = useRef<number | null>(null);

	const unlockedCount = visits.length;
	const unlockedMatsus = matsus.slice(0, unlockedCount);
	const selectedMatsu =
		matsus.find((matsu) => matsu.id === selectedMatsuId) ??
		unlockedMatsus[unlockedCount - 1] ??
		matsus[0];
	const isAllCollected = unlockedCount === matsus.length;

	useEffect(() => {
		try {
			setVisits(
				JSON.parse(localStorage.getItem("matsu-1917-mvp") ?? "{}")
					.matsuVisits ?? [],
			);
		} catch {}
		liff.init({ liffId: LIFF_ID })
			.then(() => {
				if (liff.isLoggedIn()) setIdToken(liff.getIDToken());
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
			})
			.catch(() => setNotice("巡禮資料暫時只保存在此裝置"));
	}, [idToken]);

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

				<section
					className="feature-hero temple-hero"
					style={{ backgroundColor: "#e0f2fe" }}
				>
					<span
						className="feature-kicker"
						style={{ color: "#1e3a8a" }}
					>
						1917 七媽會・台中萬春宮
					</span>
					<h1>
						尋找七媽蹤跡，
						<br />
						<em>收集百年歷史碎片。</em>
					</h1>
					<p>
						掃描活動現場 QR Code，依序解鎖 1917
						年七媽會的專屬故事。集滿七塊碎片即可開啟隱藏劇情！
					</p>
					<div className="temple-illustration">
						<span>🌸</span>
						<i>✦</i>
						<i>✦</i>
						<i>✦</i>
					</div>
				</section>

				<section className="ritual-progress">
					<span>歷史碎片收集進度</span>
					<b>
						{unlockedCount}
						<small> / {matsus.length} 塊</small>
					</b>
					<div>
						<i
							style={{
								width: `${(unlockedCount / matsus.length) * 100}%`,
								backgroundColor: "#a855f7",
							}}
						/>
					</div>
				</section>

				{/* ✅ DOM 完全保留原始結構，不加上任何額外標籤或 inline-style 干擾 */}
				<section className="scan-card">
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
									setSelectedMatsuId(matsu.id)
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
						{quizState === "IDLE" && (
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
							<div className="text-center w-full">
								<h2
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
											setQuizState("PASSED");
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
						)}

						{quizState === "PASSED" && (
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

								{/* 🌟 放入你生成的精美圖片 */}
								<img
									src="/matsu-completed.png"
									alt="七媽大團圓"
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

				<p className="feature-note">
					展示用代碼：QR01 ～
					QR07。測試時請隨意輸入此範圍內的代碼，即可體驗循序解鎖的效果。
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
								onClick={() => setShowRewardModal(false)}
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
								收下並繼續探索
							</button>
						</div>
					</div>
				)}
			</div>
		</main>
	);
}
