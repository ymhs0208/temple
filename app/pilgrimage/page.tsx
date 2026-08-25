"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import liff from "@line/liff";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2011050459-8bPHPFCw";
const STORE = "matsu-1917-mvp";
const matsus = [
  { code: "QR01", seal: "萬", name: "台中媽", temple: "萬春宮", region: "臺中州・主辦方", color: "vermillion", clue: "回到七媽會的起點，在廟埕與活動指示牌旁尋找海棠形印記。", story: "萬春宮是 1917 年七媽會的主辦方之一，迎接各地媽祖駐駕，讓信仰與城市記憶在此交會。" },
  { code: "QR02", seal: "樂", name: "旱溪媽", temple: "樂成宮", region: "臺中州・東區", color: "coral", clue: "沿著舊城往東，留意水紋與朱紅色的線索牌。", story: "旱溪媽祖以慈悲庇佑地方，當年也一同駐駕市區，為來往信眾賜福。" },
  { code: "QR03", seal: "奉", name: "新港媽", temple: "奉天宮", region: "嘉義廳・遠道而來", color: "gold", clue: "想像列車載著香火，找找月台、車票或鐵道意象。", story: "新港媽遠道而來，為當年的台中帶來熱鬧與安定，也留下信仰隨交通流動的記憶。" },
  { code: "QR04", seal: "朝", name: "北港媽", temple: "朝天宮", region: "嘉義廳・香火鼎盛", color: "jade", clue: "在人潮與雲紋之間，找尋第四枚金色印記。", story: "北港朝天宮香火鼎盛，參與七媽會時更是轟動全台，見證萬人共聚的盛況。" },
  { code: "QR05", seal: "南", name: "南瑤媽", temple: "南瑤宮", region: "彰化・跨境護佑", color: "violet", clue: "跨過縣市的是同一份守護；紫花與橋梁圖樣就在附近。", story: "彰化南瑤宮媽祖是七媽會的重要貴賓，共同守護中部子民，讓香路成為彼此相連的線。" },
  { code: "QR06", seal: "天", name: "鹿港媽", temple: "天后宮", region: "彰化・古城香路", color: "indigo", clue: "聽見鑼鼓與陣頭的節奏了嗎？沿著旗幟圖樣尋找。", story: "鹿港天后宮歷史悠久，當年其陣頭與儀仗為七媽會增添無數光彩。" },
  { code: "QR07", seal: "元", name: "梧棲媽", temple: "朝元宮", region: "臺中州・山海相會", color: "azure", clue: "讓海風把故事送到山城；波浪與船影旁藏著最後印記。", story: "海線的梧棲媽祖也受邀來到山線，促成山海媽祖齊聚一堂的佳話。" }
] as const;
type Matsu = typeof matsus[number];
function clean(value: string) { try { return new URL(value).searchParams.get("code")?.toUpperCase() || value.trim().toUpperCase(); } catch { return value.trim().toUpperCase(); } }

export default function Pilgrimage() {
  const [visits, setVisits] = useState<string[]>([]);
  const [selected, setSelected] = useState<Matsu>(matsus[0]);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [reward, setReward] = useState<Matsu | null>(null);
  const [camera, setCamera] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [finalStep, setFinalStep] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const count = useMemo(() => matsus.filter((item) => visits.includes(item.code)).length, [visits]);
  const found = visits.includes(selected.code);

  useEffect(() => {
    try { setVisits(JSON.parse(localStorage.getItem(STORE) || "{}").matsuVisits || []); } catch {}
    liff.init({ liffId: LIFF_ID }).then(() => { if (liff.isLoggedIn()) setToken(liff.getIDToken()); }).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!token) return;
    fetch("/api/visits", { headers: { "x-line-id-token": token } }).then((res) => res.ok ? res.json() : Promise.reject()).then((data) => Array.isArray(data.visits) && setVisits(data.visits.map(clean))).catch(() => setNotice("LINE 同步暫時無法使用，進度仍保留在此裝置。"));
  }, [token]);
  useEffect(() => {
    if (!camera) return;
    let stopped = false;
    const stop = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };
    const start = async () => {
      const Detector = (window as Window & { BarcodeDetector?: new (options?: { formats: string[] }) => { detect: (video: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (!Detector) { setNotice("此瀏覽器尚未支援相機掃碼，請改用代碼輸入。"); setCamera(false); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream; await videoRef.current.play();
        const detector = new Detector({ formats: ["qr_code"] });
        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try { const result = await detector.detect(videoRef.current); if (result[0]?.rawValue) { setCode(clean(result[0].rawValue)); setNotice("已讀取代碼，按「收下印記」完成集章。"); setCamera(false); return; } } catch {}
          requestAnimationFrame(scan);
        };
        void scan();
      } catch { setNotice("無法開啟相機，請確認權限後再試，或改用代碼輸入。"); setCamera(false); }
    };
    void start();
    return () => { stopped = true; stop(); };
  }, [camera]);
  const collect = async () => {
    const match = matsus.find((item) => item.code === clean(code));
    if (!match) { setNotice("這不是本次活動的印記代碼，請確認現場 QR Code 後再試。"); return; }
    setSelected(match);
    if (visits.includes(match.code)) { setNotice("這枚印記已在你的集章冊中。"); setCode(""); return; }
    const next = visits.concat(match.code); setVisits(next); setCode(""); setReward(match);
    try { const saved = JSON.parse(localStorage.getItem(STORE) || "{}"); localStorage.setItem(STORE, JSON.stringify({ ...saved, matsuVisits: next })); } catch {}
    if (token) { const response = await fetch("/api/visits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: token, code: match.code }) }); setNotice(response.ok ? "印記已收下，並同步到你的 LINE 帳號。" : "印記已收下，目前只保存在此裝置。"); }
    else setNotice("印記已收下；登入 LINE 後可跨裝置保存。");
  };

  return <main className="pilgrimage-page"><div className="pilgrimage-shell">
    <header className="pilgrimage-topbar"><button onClick={() => location.href = "/"}>← 返回文昌同行</button><span>1917 七媽會・數位巡禮</span></header>
    <section className="pilgrimage-hero"><div><p>一場跨越百年的相遇</p><h1>尋找七媽蹤跡</h1><h2>在城市裡，收集信仰留下的光。</h2><small>掃描現場印記，解鎖七位媽祖與七媽會的故事。</small></div><aside><i>七</i><b>媽會</b><em>1917</em></aside></section>
    <section className="pilgrimage-progress"><div><span>你的巡禮集章冊</span><strong>{count}<small> / 7 枚印記</small></strong></div><i><b style={{ width: (count / 7 * 100) + "%" }} /></i><p>{count === 7 ? "七枚印記已齊，百年故事完整呈現。" : count ? "已走過 " + count + " 站，下一段故事正在等你。" : "從第一站開始，跟著線索走進百年前的相遇。"}</p></section>
    <section className="trail-card"><header><span>巡禮地圖</span><h2>七枚印記，七段相逢</h2><p>點選印記，查看每一站的故事與尋找提示。</p></header><div className="trail-map"><i className="map-line" />{matsus.map((item, index) => { const has = visits.includes(item.code); return <button key={item.code} className={"map-stop " + item.color + (has ? " found" : "") + (selected.code === item.code ? " selected" : "")} onClick={() => setSelected(item)}><i>{has ? item.seal : "?"}</i><span>0{index + 1}</span><b>{has ? item.name : "待尋印記"}</b><small>{has ? item.temple : "尚未解鎖"}</small></button>; })}</div></section>
    <section className={"story-card " + selected.color}><i>{found ? selected.seal : "?"}</i><div><span>{found ? selected.region + "・已收集" : "尚待尋找的印記"}</span><h2>{found ? selected.name + "・" + selected.temple : "一枚尚未揭曉的印記"}</h2><p>{found ? selected.story : selected.clue}</p><aside><b>尋找提示</b><small>{selected.clue}</small></aside></div></section>
    <section className="scanner-card"><header><span>收下印記</span><h2>掃描現場 QR Code</h2><p>每組代碼對應一尊媽祖，已收集的印記不會重複計入。</p></header><div className="scan-controls"><button className="camera-button" onClick={() => setCamera(!camera)}>{camera ? "關閉相機" : "開啟相機掃碼"} <b>⌁</b></button><div><input value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && collect()} placeholder="輸入活動代碼，例如 QR01" /><button onClick={collect}>收下印記</button></div></div>{camera && <div className="camera-frame"><video ref={videoRef} muted playsInline /><i /><span>請將 QR Code 置於框內</span></div>}{notice && <p className="scan-notice">{notice}</p>}</section>
    <section className="stamp-book"><header><span>集章冊</span><h2>你已收下的祝福</h2></header><div>{matsus.map((item) => <button key={item.code} className={"stamp " + (visits.includes(item.code) ? item.color : "empty")} onClick={() => setSelected(item)}><i>{visits.includes(item.code) ? item.seal : "○"}</i><span>{visits.includes(item.code) ? item.temple : "等待相遇"}</span></button>)}</div></section>
    {count === 7 && <section className="completion-card"><span>七印齊聚</span><h2>你已完成一場百年巡禮</h2><p>七位媽祖從不同地方相會，留下的不只是盛典，更是一座城市共同記得的溫暖。</p>{finalStep === 0 && <button onClick={() => setFinalStep(1)}>開啟最後一頁故事 →</button>}{finalStep === 1 && <div className="history-quiz"><b>小小問答：七媽會的故事，與哪一種交通記憶相連？</b><button onClick={() => setFinalStep(1)}>高鐵</button><button onClick={() => setFinalStep(2)}>鐵道</button><button onClick={() => setFinalStep(1)}>捷運</button><small>選對答案，就能看見最後的故事。</small></div>}{finalStep === 2 && <div className="final-story"><b>鐵道讓遠方的香火相聚</b><p>謝謝你把散落在城市裡的故事一一拾起。這趟巡禮，現在也成為你的記憶。</p></div>}</section>}
    <p className="pilgrimage-footnote">展示測試代碼：QR01 ～ QR07。實際活動請掃描現場專屬印記。</p>
  </div>{reward && <div className="reward-backdrop"><div className={"reward-dialog " + reward.color}><button onClick={() => setReward(null)}>×</button><span>成功收下印記</span><i>{reward.seal}</i><h2>{reward.name}・{reward.temple}</h2><p>{reward.story}</p><button onClick={() => setReward(null)}>收下祝福，繼續尋找</button></div></div>}</main>;
}
