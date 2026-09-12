"use client";

import { useEffect, useMemo, useState } from "react";
import liff from "@line/liff";
import { pilgrimageCodes, pilgrimageStops } from "@/lib/pilgrimage-data";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2011050459-8bPHPFCw";

const mergeVisits = (...lists: unknown[]) =>
	[
		...new Set(
			lists
				.flatMap((list) => (Array.isArray(list) ? list : []))
				.map((code) => String(code).trim().toUpperCase()),
		),
	].filter((code) => pilgrimageCodes.includes(code));

export default function PilgrimageStoryClient({ stopId }: { stopId: string }) {
	const [visits, setVisits] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const stopIndex = pilgrimageStops.findIndex((item) => item.id === stopId);
	const stop = pilgrimageStops[stopIndex];
	const unlocked =
		stopIndex >= 0 && visits.includes(pilgrimageCodes[stopIndex]);
	const nextStop = useMemo(() => pilgrimageStops[stopIndex + 1], [stopIndex]);

	useEffect(() => {
		let active = true;
		let localVisits: string[] = [];
		try {
			localVisits = mergeVisits(
				JSON.parse(localStorage.getItem("matsu-1917-mvp") ?? "{}")
					.matsuVisits,
			);
			setVisits(localVisits);
		} catch {}

		liff.init({ liffId: LIFF_ID })
			.then(async () => {
				if (!liff.isLoggedIn()) return;
				const idToken = liff.getIDToken();
				if (!idToken) return;
				const response = await fetch("/api/visits", {
					headers: { "x-line-id-token": idToken },
				});
				if (!response.ok) return;
				const data = await response.json();
				if (!active) return;
				const merged = mergeVisits(localVisits, data.visits);
				setVisits(merged);
				const saved = JSON.parse(
					localStorage.getItem("matsu-1917-mvp") ?? "{}",
				);
				localStorage.setItem(
					"matsu-1917-mvp",
					JSON.stringify({ ...saved, matsuVisits: merged }),
				);
			})
			.catch(() => undefined)
			.finally(() => {
				if (active) setIsLoading(false);
			});

		return () => {
			active = false;
		};
	}, []);

	const navigate = () => {
		if (!stop) return;
		window.open(
			`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`,
			"_blank",
			"noopener,noreferrer",
		);
	};
	const share = async () => {
		if (!stop) return;
		const text = `我在「1917 七媽會・台中萬春宮」巡禮中解鎖了${stop.name}的百年故事。`;
		try {
			if (navigator.share)
				await navigator.share({ title: stop.name, text });
			else await navigator.clipboard.writeText(text);
		} catch {}
	};

	if (!stop)
		return (
			<main className="story-page">
				<section className="story-shell story-empty">
					<span>404</span>
					<h1>找不到這塊歷史碎片</h1>
					<button
						onClick={() => {
							location.href = "/pilgrimage";
						}}
					>
						返回巡禮地圖
					</button>
				</section>
			</main>
		);
	if (isLoading)
		return (
			<main className="story-page">
				<section className="story-shell story-empty">
					<span>✦</span>
					<p>正在確認巡禮進度</p>
					<h1>載入歷史碎片中…</h1>
				</section>
			</main>
		);
	if (!unlocked)
		return (
			<main className="story-page">
				<section className="story-shell story-locked">
					<span>✦</span>
					<p>第 {stopIndex + 1} 塊歷史碎片</p>
					<h1>這段故事尚未解鎖</h1>
					<small>
						請先依巡禮順序完成前一站掃碼，再回來閱讀 {stop.name}{" "}
						的故事。
					</small>
					<button
						onClick={() => {
							location.href = "/pilgrimage";
						}}
					>
						回到巡禮地圖
					</button>
				</section>
			</main>
		);

	return (
		<main className={`story-page story-${stop.color}`}>
			<section className="story-shell">
				{/* 換回跟其他頁面共用的 back-link 樣式 */}
				<button
					className="back-link"
					onClick={() => {
						location.href = "/pilgrimage";
					}}
				>
					← 返回
				</button>

				<header className="story-hero">
					<span>
						歷史碎片 {stopIndex + 1} / {pilgrimageStops.length}
					</span>
					<div className="story-mark">{stop.badge}</div>
					<p>{stop.district}</p>
					<h1>{stop.name}</h1>
					<strong>{stop.highlight}</strong>
				</header>

				<section className="story-reading">
					<span>百年故事</span>
					<p>{stop.story}</p>
					<blockquote>{stop.insight}</blockquote>
				</section>

				<section className="story-visit">
					<div>
						<span>參拜資訊</span>
						<b>{stop.address}</b>
						<small>{stop.openHours}</small>
					</div>
					<button onClick={navigate}>導航前往 ↗</button>
				</section>

				<section className="story-tip">
					<span>巡禮提示</span>
					<p>{stop.visitTip}</p>
				</section>

				<div className="story-actions">
					<button onClick={share}>分享這段故事</button>
					{nextStop ? (
						<button
							onClick={() => {
								location.href = "/pilgrimage";
							}}
						>
							前往下一站：{nextStop.name} →
						</button>
					) : (
						<button
							onClick={() => {
								location.href = "/pilgrimage";
							}}
						>
							回到主頁完成問答 →
						</button>
					)}
				</div>
			</section>
		</main>
	);
}
