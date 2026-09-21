"use client";

import { useEffect, useRef, useState } from "react";
import liff from "@line/liff";
import { UnlockReveal } from "./unlock-reveal";
import { pilgrimageChapters } from "@/lib/pilgrimage-chapters";
import "./pilgrimage-redesign.css";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2011050459-8bPHPFCw";
const taipeiDate = (date = new Date()) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(date);

// 定義 7 尊媽祖的故事順序 (固定依照此順序解鎖)
const matsus = [
    {
        id: "story_1",
        name: "台中媽・萬春宮",
        district: "臺中州",
        badge: "萬",
        story: "萬春宮身為 1917 年七媽會的主辦方，與樂成宮共同促成這場百年難得一見的宗教盛事，見證了台中火車站落成的歷史時刻。",
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
        story: "旱溪媽祖長年以慈悲庇佑大台中地區，當年與萬春宮共同擔任東道主，將神尊請至台中市區駐駕，賜福黎民。",
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
        story: "搭乘剛通車的縱貫線火車遠道而來的新港媽，為當年的台中帶來了無比的熱鬧，也象徵著現代鐵道與傳統信仰的結合。",
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
        story: "北港朝天宮香火鼎盛，當年遠赴台中參與七媽會，萬人空巷的盛況轟動全台，成為一段信仰佳話。",
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
        story: "彰化南瑤宮媽祖也是當年七媽會的重要貴賓。信眾隨香徒步來到台中，展現了跨越縣市界線的虔誠與團結。",
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
        story: "鹿港天后宮歷史悠久，當年其華麗的陣頭與儀仗來到台中，為七媽會增添了無數光彩，展現深厚的工藝與陣頭文化。",
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
        story: "海線的梧棲媽祖受邀來到台中盆地，促成了「山海媽祖齊聚一堂」的珍貴歷史畫面，將海線的祈福心意帶入山城。",
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
        Math.cos(toRadians(location.lat)) *
            Math.cos(toRadians(destination.lat)) *
            Math.sin(longitudeDelta / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function Pilgrimage() {
    const [code, setCode] = useState("");
    const [visits, setVisits] = useState<string[]>([]);
    const [notice, setNotice] = useState("");
    const [idToken, setIdToken] = useState<string | null>(null);
    const [lineName, setLineName] = useState<string | null>(null);
    const [certificate, setCertificate] =
        useState<PilgrimageCertificate | null>(null);
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
                setUserLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
                setLocationMessage("已更新與各站的直線距離。");
            },
            () =>
                setLocationMessage("無法取得位置，請允許定位權限後再試一次。"),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
        );
    };
    const shareJourney = async () => {
        const text = isAllCollected
            ? "我已完成「1917 七媽會・台中萬春宮」七站巡禮，收集所有文化歷史碎片！"
            : `我正在進行「1917 七媽會・台中萬春宮」巡禮，已收集 ${unlockedCount}/${matsus.length} 塊歷史碎片。`;
        const canShare = typeof navigator.share === "function";
        try {
            if (canShare)
                await navigator.share({ title: "1917 七媽會巡禮", text });
            else await navigator.clipboard.writeText(text);
            setNotice(
                canShare ? "已開啟分享選單。" : "巡禮成果已複製，可貼給朋友。",
            );
        } catch {}
    };
    const syncPilgrimageState = (state: {
        quizCompleted: boolean;
        certificate: PilgrimageCertificate | null;
    }) => {
        if (!idToken) return;
        void fetch("/api/visits", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ idToken, pilgrimageState: state }),
        });
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
        localStorage.setItem(
            "matsu-1917-mvp",
            JSON.stringify({ ...plan, pilgrimageCertificate: nextCertificate }),
        );
        syncPilgrimageState({
            quizCompleted: true,
            certificate: nextCertificate,
        });
        return nextCertificate;
    };
    const shareCertificate = async () => {
        if (!certificate) return;
        const text = `${certificate.name} 已完成「1917 七媽會・台中萬春宮」七站巡禮。完成證書：${certificate.number}`;
        try {
            if (navigator.share)
                await navigator.share({ title: "1917 七媽會完成證書", text });
            else await navigator.clipboard.writeText(text);
        } catch {}
    };

    useEffect(() => {
        try {
            const saved = JSON.parse(
                localStorage.getItem("matsu-1917-mvp") ?? "{}",
            );
            setVisits(saved.matsuVisits ?? []);
            if (saved.pilgrimageCertificate)
                setCertificate(
                    saved.pilgrimageCertificate as PilgrimageCertificate,
                );
            if (saved.pilgrimageQuizCompleted || saved.pilgrimageCertificate)
                setHasCompletedQuiz(true);
        } catch {}
        liff.init({ liffId: LIFF_ID })
            .then(() => {
                if (liff.isLoggedIn()) {
                    setIdToken(liff.getIDToken());
                    setLineName(liff.getDecodedIDToken()?.name ?? null);
                }
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
                if (Array.isArray(data.visits)) {
                    setVisits((current) => [
                        ...new Set([...current, ...data.visits]),
                    ]);
                }
                if (data.pilgrimageState?.certificate)
                    setCertificate(
                        data.pilgrimageState
                            .certificate as PilgrimageCertificate,
                    );
                if (
                    data.pilgrimageState?.quizCompleted ||
                    data.pilgrimageState?.certificate
                )
                    setHasCompletedQuiz(true);
            })
            .catch(() => setNotice("巡禮資料暫時只保存在此裝置"));
    }, [idToken]);

    useEffect(() => {
        if (idToken && certificate && hasCompletedQuiz)
            syncPilgrimageState({ quizCompleted: true, certificate });
    }, [idToken, certificate, hasCompletedQuiz]);

    useEffect(() => {
        if (!selectedMatsuId && unlockedMatsus.length > 0) {
            setSelectedMatsuId(unlockedMatsus[unlockedMatsus.length - 1].id);
        }
    }, [selectedMatsuId, unlockedMatsus]);

    useEffect(() => {
        if (!scannerOpen) return;
        let cancelled = false;
        let stream: MediaStream | null = null;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const video = videoRef.current;
        const stop = () => {
            clearTimeout(timer);
            stream?.getTracks().forEach((track) => track.stop());
            if (video) video.srcObject = null;
        };
        const start = async () => {
            try {
                setNotice("");
                if (!window.isSecureContext) {
                    throw new Error("INSECURE_CONTEXT");
                }
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error("CAMERA_UNAVAILABLE");
                }
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: "environment" },
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                });
                if (cancelled || !video) {
                    stop();
                    return;
                }
                video.srcObject = stream;
                await video.play();
                // Software decoding also works when BarcodeDetector is unavailable.
                const { default: jsQR } = await import("jsqr");
                if (cancelled) return;
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d", { willReadFrequently: true });
                if (!context) throw new Error("DECODER_UNAVAILABLE");
                const scan = () => {
                    if (cancelled) return;
                    if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
                        const scale = Math.min(1, 960 / video.videoWidth);
                        canvas.width = Math.round(video.videoWidth * scale);
                        canvas.height = Math.round(video.videoHeight * scale);
                        context.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
                        const result = jsQR(frame.data, frame.width, frame.height);
                        if (result?.data) {
                            stop();
                            setCode(qrCodeFromValue(result.data));
                            setNotice("已讀取碎片碼，請按「解鎖」確認。");
                            setScannerOpen(false);
                            return;
                        }
                    }
                    timer = setTimeout(() => {
                        try {
                            scan();
                        } catch {
                            stop();
                            setNotice("影像辨識暫時失敗，請重新開啟相機，或手動輸入碎片碼。");
                            setScannerOpen(false);
                        }
                    }, 180);
                };
                scan();
            } catch (error) {
                stop();
                if (cancelled) return;
                const name = error instanceof Error ? error.name : "";
                const message = error instanceof Error ? error.message : "";
                if (message === "INSECURE_CONTEXT") {
                    setNotice("相機需要安全連線，請使用 HTTPS 網址開啟本頁。");
                } else if (name === "NotAllowedError" || name === "SecurityError") {
                    setNotice("相機存取被拒絕，請在瀏覽器的網站設定允許相機後重試。若在 LINE 等 App 內開啟，請改用 Safari 或 Chrome 開啟本頁。");
                } else if (name === "NotFoundError") {
                    setNotice("找不到可用的相機，請改用有相機的裝置或手動輸入碎片碼。");
                } else if (name === "NotReadableError" || name === "AbortError") {
                    setNotice("相機暫時無法啟動，請關閉其他使用相機的 App 後重試，或手動輸入碎片碼。");
                } else {
                    setNotice("無法啟動掃描，請使用 Safari 或 Chrome 開啟本頁重試，或手動輸入碎片碼。");
                }
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
            setNotice(
                `這是較後面的碎片，請先前往第 ${unlockedCount + 1} 站「${matsus[unlockedCount].name}」尋找 ${expectedCode}。`,
            );
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
        setScannerOpen(false);

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
        <main id="pilgrimage-adventure" className="feature-page">
            <div className="feature-shell pilgrimage-shell">
                <button
                    className="back-link"
                    onClick={() => (location.href = "/")}
                >
                    ← 返回
                </button>

                <section
                    className="feature-hero temple-hero"
                    aria-label="七媽會文化巡禮"
                >
                    <div className="temple-hero-content">
                        <div className="temple-hero-label">
                            <span>⛩</span> 1917 七媽會・台中萬春宮
                        </div>
                        <p className="temple-hero-eyebrow">你的文化探索護照</p>
                        <h1>
                            走進七座宮廟，
                            <br />
                            <em>帶走不一樣的發現。</em>
                        </h1>
                        <p className="temple-hero-description">
                            每一站，發現一個地方、解鎖一段故事。依序完成現場掃碼，收集七塊碎片，再挑戰最終問答。
                        </p>
                        <div className="temple-hero-meta">
                            <span>07 座宮廟</span>
                            <i /> <span>07 個探索任務</span>
                            <i /> <span>01 份完成證書</span>
                        </div>
                    </div>
                </section>

                <section
                    className="ritual-progress pilgrimage-progress-card"
                    aria-label="巡禮進度與參與方式"
                >
                    <div className="ritual-progress-summary">
                        <span>我的巡禮護照</span>
                        <b>
                            {unlockedCount}
                            <small> / {matsus.length} 塊</small>
                        </b>
                        <div
                            role="progressbar"
                            aria-label="歷史碎片收集進度"
                            aria-valuemin={0}
                            aria-valuemax={7}
                            aria-valuenow={unlockedCount}
                        >
                            <i
                                style={{
                                    width: `${(unlockedCount / matsus.length) * 100}%`,
                                    backgroundColor: "#287c64",
                                }}
                            />
                        </div>
                    </div>
                    <nav className="passport-stamps" aria-label="七站收集護照">
                        {matsus.map((stop, i) => (
                            <div
                                key={stop.id}
                                className={`passport-stamp ${i < unlockedCount ? "collected" : i === unlockedCount ? "current" : ""}`}
                                aria-label={`第 ${i + 1} 站 ${stop.name}，${i < unlockedCount ? "已收集" : i === unlockedCount ? "下一站" : "待解鎖"}`}
                            >
                                <span>
                                    {i < unlockedCount
                                        ? stop.badge
                                        : String(i + 1).padStart(2, "0")}
                                </span>
                                <small>{stop.name.split("・")[1]}</small>
                            </div>
                        ))}
                    </nav>
                </section>

                <div className="pilgrimage-action-grid">
                    <section
                        className="pilgrimage-guide"
                        aria-labelledby="pilgrimage-guide-title"
                    >
                        <div className="pilgrimage-guide-heading">
                            <div>
                                <span>01 · 出發前</span>
                                <h2 id="pilgrimage-guide-title">
                                    {nextMatsu
                                        ? "下一站，往這裡走"
                                        : "七站足跡，已收集齊全"}
                                </h2>
                            </div>
                            <button type="button" onClick={requestLocation}>
                                ⌖ 顯示距離
                            </button>
                        </div>
                        <div className="next-stop-card">
                            {nextMatsu ? (
                                <>
                                    <div>
                                        <span>
                                            下一站 · 第 {unlockedCount + 1} 站
                                        </span>
                                        <b>{nextMatsu.name}</b>
                                        <small>{nextMatsu.address}</small>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            openNavigation(nextMatsu)
                                        }
                                    >
                                        前往導航 ↗
                                    </button>
                                </>
                            ) : (
                                <div>
                                    <span>巡禮完成</span>
                                    <b>七塊歷史碎片已全數收集</b>
                                    <small>
                                        回到任一宮廟，重溫這段文化故事。
                                    </small>
                                </div>
                            )}
                        </div>
                        {locationMessage && (
                            <p className="location-message">
                                {locationMessage}
                            </p>
                        )}
                        <details className="adventure-travel travel-directory">
                            <summary>
                                <span
                                    className="travel-summary-icon"
                                    aria-hidden="true"
                                >
                                    ⌖
                                </span>
                                <span className="travel-summary-copy">
                                    <b>七站地址與交通資訊</b>
                                    <small>
                                        查看各站位置，開啟地圖規劃路線
                                    </small>
                                </span>
                                <span
                                    className="travel-chevron"
                                    aria-hidden="true"
                                >
                                    ⌄
                                </span>
                            </summary>
                            <div className="travel-directory-intro">
                                <span>依巡禮順序排列 · 共 {matsus.length} 站</span>
                                <small>跨縣市旅程，可分次完成</small>
                            </div>
                            <ol className="travel-stop-list">
                                {matsus.map((matsu, index) => {
                                    const completed = index < unlockedCount;
                                    const distance = userLocation
                                        ? distanceFrom(
                                              userLocation,
                                              matsu.coordinates,
                                          ).toFixed(1)
                                        : null;
                                    return (
                                        <li
                                            key={matsu.id}
                                            className={
                                                completed
                                                    ? "completed"
                                                    : index === unlockedCount
                                                      ? "next"
                                                      : ""
                                            }
                                        >
                                            <div
                                                className="travel-stop-number"
                                                aria-label={`第 ${index + 1} 站`}
                                            >
                                                {String(index + 1).padStart(
                                                    2,
                                                    "0",
                                                )}
                                            </div>
                                            <div className="travel-stop-copy">
                                                <div className="travel-stop-title">
                                                    <b>{matsu.name}</b>
                                                    <span>
                                                        {completed
                                                            ? "✓ 已收集"
                                                            : index ===
                                                                unlockedCount
                                                              ? "下一站"
                                                              : "待探索"}
                                                    </span>
                                                </div>
                                                <p>{matsu.address}</p>
                                                <small>{matsu.openHours}</small>
                                                {distance && (
                                                    <small className="travel-distance">
                                                        距目前位置約 {distance}{" "}
                                                        公里（直線）
                                                    </small>
                                                )}
                                            </div>
                                            <button
                                                className="travel-navigate"
                                                type="button"
                                                aria-label={`開啟地圖導航至${matsu.name}`}
                                                onClick={() =>
                                                    openNavigation(matsu)
                                                }
                                            >
                                                地圖導航{" "}
                                                <span aria-hidden="true">
                                                    ↗
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ol>
                        </details>
                        <p className="guide-note">
                            距離為直線估算；實際路線、交通與開放時間請以宮廟公告及導航服務為準。
                        </p>
                    </section>

                    <section className="scan-card" ref={scanCardRef}>
                        <div className="card-title">
                            <span>🔍</span>
                            <div>
                                <b>
                                    {nextMatsu
                                        ? "02 · 抵達後，收下碎片"
                                        : "七站掃碼已完成"}
                                </b>
                                <small>
                                    掃描現場 QR
                                    Code；無法開啟相機時，也可手動輸入。
                                </small>
                            </div>
                        </div>
                        <div className="code-row">
                            <input
                                aria-label="現場碎片代碼"
                                value={code}
                                onChange={(event) =>
                                    setCode(event.target.value)
                                }
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
                            onClick={() =>
                                setScannerOpen((current) => !current)
                            }
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
                                        textShadow:
                                            "0px 2px 4px rgba(0,0,0,0.8)",
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
                </div>
                <section
                    className="adventure-chapters"
                    aria-labelledby="chapter-list-title"
                >
                    <header>
                        <span className="chapter-eyebrow">
                            YOUR JOURNEY · 七站章節
                        </span>
                        <h2 id="chapter-list-title">
                            下一段故事，等你親自發現
                        </h2>
                        <p>
                            先看每站的探索主題；現場掃碼後，即可閱讀完整故事並寫下小記。
                        </p>
                    </header>
                    <ol className="adventure-chapter-grid">
                        {matsus.map((matsu, index) => {
                            const chapter = pilgrimageChapters[index];
                            const unlocked = index < unlockedCount;
                            const next = index === unlockedCount;
                            return (
                                <li
                                    key={matsu.id}
                                    className={
                                        unlocked
                                            ? "is-collected"
                                            : next
                                              ? "is-next"
                                              : ""
                                    }
                                >
                                    <div className="chapter-card-top">
                                        <span
                                            className="chapter-stamp"
                                            aria-hidden="true"
                                        >
                                            {chapter.icon}
                                        </span>
                                        <span className="chapter-state">
                                            {unlocked
                                                ? "✓ 碎片已收集"
                                                : next
                                                  ? "下一站 · 等你探索"
                                                  : "故事待解鎖"}
                                        </span>
                                    </div>
                                    <small>
                                        CHAPTER{" "}
                                        {String(index + 1).padStart(2, "0")} ·{" "}
                                        {chapter.theme}
                                    </small>
                                    <h3>{chapter.title}</h3>
                                    <b>{matsu.name}</b>
                                    <p>{chapter.prompt}</p>
                                    <div className="chapter-card-detail">
                                        <span>
                                            <strong>探索任務</strong>
                                            {chapter.mission}
                                        </span>
                                        <span>
                                            <strong>你會學到</strong>
                                            {chapter.knowledge}
                                        </span>
                                    </div>
                                    <a
                                        className="chapter-card-status"
                                        href={`/pilgrimage/${matsu.id}`}
                                    >
                                        {unlocked
                                            ? "閱讀故事與探索小記"
                                            : next
                                              ? "查看本關任務"
                                              : "查看關卡資訊"}{" "}
                                        <span aria-hidden="true">→</span>
                                    </a>
                                </li>
                            );
                        })}
                    </ol>
                    <aside className="adventure-finale">
                        <span aria-hidden="true">✦</span>
                        <div>
                            <h3>終章 · 拼起你的巡禮記憶</h3>
                            <p>
                                集滿七塊碎片後，完成歷史問答，領取並分享你的巡禮證書。
                            </p>
                            <small>
                                {isAllCollected
                                    ? "七塊碎片已集滿，請在下方開始最終問答。"
                                    : `再收集 ${matsus.length - unlockedCount} 塊碎片，就能開啟終章。`}
                            </small>
                        </div>
                    </aside>
                </section>

                <details className="pilgrimage-memory">
                    <summary>回看最近收集的故事</summary>
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
                </details>
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
                        <button
                            className="journey-share"
                            type="button"
                            onClick={shareJourney}
                        >
                            ↗ 分享我的巡禮成果
                        </button>
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
                            <div
                                className="quiz-backdrop"
                                role="presentation"
                                onMouseDown={() => setQuizState("IDLE")}
                            >
                                <section
                                    className="quiz-dialog"
                                    role="dialog"
                                    aria-modal="true"
                                    aria-labelledby="quiz-title"
                                    onMouseDown={(event) =>
                                        event.stopPropagation()
                                    }
                                >
                                    <button
                                        className="quiz-close"
                                        aria-label="關閉歷史問答"
                                        onClick={() => setQuizState("IDLE")}
                                    >
                                        ×
                                    </button>
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
                                                    const saved = JSON.parse(
                                                        localStorage.getItem(
                                                            "matsu-1917-mvp",
                                                        ) ?? "{}",
                                                    );
                                                    localStorage.setItem(
                                                        "matsu-1917-mvp",
                                                        JSON.stringify({
                                                            ...saved,
                                                            pilgrimageQuizCompleted: true,
                                                        }),
                                                    );
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
                        {quizState === "IDLE" && hasCompletedQuiz && (
                            <div className="text-center w-full">
                                <h2
                                    style={{
                                        color: "#92400e",
                                        fontSize: "1.25rem",
                                        fontWeight: "bold",
                                        marginBottom: "8px",
                                    }}
                                >
                                    ✨ 歷史問答已完成
                                </h2>
                                <p
                                    style={{
                                        color: "#b45309",
                                        marginBottom: "16px",
                                    }}
                                >
                                    你已通過最終問答，完成證書已保存。
                                </p>
                                <button
                                    onClick={() => setShowCertificate(true)}
                                    style={{
                                        backgroundColor: "#f59e0b",
                                        color: "#fff",
                                        padding: "8px 24px",
                                        borderRadius: "999px",
                                        fontWeight: "bold",
                                    }}
                                >
                                    查看完成證書
                                </button>
                            </div>
                        )}

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
                                {certificate && (
                                    <section
                                        className="pilgrimage-certificate"
                                        aria-label="1917 七媽會完成證書"
                                    >
                                        <span>1917 七媽會・台中萬春宮</span>
                                        <h3>巡禮完成證書</h3>
                                        <p>茲證明</p>
                                        <b>{certificate?.name}</b>
                                        <p>
                                            已完成七站歷史碎片巡禮，並通過最終問答。
                                        </p>
                                        <small>
                                            發證日期
                                            {new Intl.DateTimeFormat("zh-TW", {
                                                dateStyle: "long",
                                                timeZone: "Asia/Taipei",
                                            }).format(
                                                new Date(
                                                    certificate?.issuedAt ?? 0,
                                                ),
                                            )}
                                        </small>
                                        <i>完成序號　{certificate?.number}</i>
                                        <div>
                                            <button onClick={shareCertificate}>
                                                分享證書 ↗
                                            </button>
                                            <button
                                                onClick={() => window.print()}
                                            >
                                                保存為 PDF
                                            </button>
                                        </div>
                                    </section>
                                )}

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
                {showCertificate && certificate && (
                    <div
                        className="certificate-backdrop"
                        role="presentation"
                        onMouseDown={() => setShowCertificate(false)}
                    >
                        <section
                            className="certificate-dialog"
                            role="dialog"
                            aria-modal="true"
                            aria-label="巡禮完成證書"
                            onMouseDown={(event) => event.stopPropagation()}
                        >
                            <button
                                className="quiz-close"
                                aria-label="關閉完成證書"
                                onClick={() => setShowCertificate(false)}
                            >
                                ×
                            </button>
                            <h2>🎉 解鎖隱藏故事！</h2>
                            <section
                                className="pilgrimage-certificate"
                                aria-label="1917 七媽會完成證書"
                            >
                                <span>1917 七媽會・台中萬春宮</span>
                                <h3>巡禮完成證書</h3>
                                <p>茲證明</p>
                                <b>{certificate.name}</b>
                                <p>已完成七站歷史碎片巡禮，並通過最終問答。</p>
                                <small>
                                    發證日期　
                                    {new Intl.DateTimeFormat("zh-TW", {
                                        dateStyle: "long",
                                        timeZone: "Asia/Taipei",
                                    }).format(new Date(certificate.issuedAt))}
                                </small>
                                <i>完成序號　{certificate.number}</i>
                                <div>
                                    <button onClick={shareCertificate}>
                                        分享證書 ↗
                                    </button>
                                    <button onClick={() => window.print()}>
                                        保存為 PDF
                                    </button>
                                </div>
                            </section>
                        </section>
                    </div>
                )}

                <p className="feature-note">
                    展示用代碼：QR01 ～
                    QR07。請依序輸入，才能體驗完整的巡禮解鎖流程。
                </p>

                {showRewardModal && rewardMatsu && (
                    <UnlockReveal
                        stopId={rewardMatsu.id}
                        collected={unlockedCount}
                        onDismiss={() => setShowRewardModal(false)}
                    />
                )}
            </div>
        </main>
    );
}
