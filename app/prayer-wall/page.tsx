"use client";
import { useEffect, useState } from "react";
import liff from "@line/liff";
import { confirmAction } from "../../lib/confirm-action";
import "./prayer-wall.css";
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2011050459-8bPHPFCw";
type Post = {
  id: string;
  display_name: string;
  message: string;
  is_anonymous: boolean;
  created_at: string;
};
export default function PrayerWall() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [featured, setFeatured] = useState<Post | null>(null);
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [sentCelebration, setSentCelebration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const load = () => {
    setLoading(true);
    setLoadError(false);
    return fetch("/api/prayer-wall")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        setPosts(data.posts ?? []);
        setFeatured(data.featured ?? null);
      })
      .catch(() => { setLoadError(true); setNotice("祈福牆暫時無法載入"); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    liff
      .init({ liffId: LIFF_ID })
      .then(() => {
        if (liff.isLoggedIn()) setIdToken(liff.getIDToken());
      })
      .catch(() => undefined);
  }, []);
  const post = async () => {
    if (sending || !message.trim()) return;
    if (!idToken) {
      if (!liff.isLoggedIn()) liff.login();
      return;
    }
    setSending(true);
    setSentCelebration(false);
    try {
      const response = await fetch("/api/prayer-wall", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", idToken, message, anonymous }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice(data.error === "Please wait before posting again" ? "請稍候一分鐘再發送下一則祈願。" : "祈願發送失敗，請確認內容後再試。");
        return;
      }
      setMessage("");
      setSentCelebration(true);
      setNotice(data.pending ? "你的祈願已送出，正在等待內容審核。" : "祈願已公開在祈福牆，願你今日順利。");
      if (!data.pending) load();
      window.setTimeout(() => setSentCelebration(false), 3200);
    } catch {
      setNotice("祈願發送失敗，請確認網路連線後再試。");
    } finally {
      setSending(false);
    }
  };
  const report = async (postId: string) => {
    if (!idToken) {
      setNotice("請先登入 LINE 後再檢舉內容。");
      return;
    }
    const response = await fetch("/api/prayer-wall", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "report", idToken, postId }),
    });
    if (response.ok) {
      setNotice("已收到檢舉；累積三次檢舉的內容會自動隱藏。");
      load();
    }
  };
  return (
    <main className="feature-page">
      <div className="feature-shell wall-shell">
        <button className="back-link" onClick={() => (location.href = "/")}>
          ← 返回
        </button>
        <section className="feature-hero wall-hero">
          <span className="feature-kicker">WENCHANG PRAYER WALL</span>
          <h1>寫下今天的祈願</h1>
          <p>
            留下一句祝福，也看看其他學習夥伴正在努力什麼。你可以選擇匿名發布。
          </p>
          <small className="wall-privacy-note">
            為保護自己，請不要填寫姓名、電話、地址、社群帳號或其他個人資料。
          </small>
      </section>
      {featured && (
        <section className="daily-feature" aria-label="每日精選正向祈願">
          <div className="daily-feature-heading">
            <span>✦</span>
            <div>
              <b>每日精選正向祈願</b>
              <small>來自公開祈福牆的溫暖鼓勵</small>
            </div>
          </div>
          <p>「{featured.message}」</p>
          <div className="daily-feature-footer">
            <span>{featured.display_name}</span>
            <span>今日與你同行</span>
          </div>
        </section>
      )}
      <section className="wall-compose">
          <div className="card-title">
            <span>✦</span>
            <div>
              <b>新增一則祈願</b>
              <small>2–120 字；每位使用者每分鐘可發送一則</small>
            </div>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={120}
            placeholder="例如：希望今天能穩定完成英文閱讀練習。"
          />
          <div className="compose-actions">
            <label>
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
              />{" "}
              匿名發佈
            </label>
          <button onClick={post} disabled={sending || !message.trim()}>{sending ? "正在傳送祈願…" : idToken ? "發布祈願" : "登入 LINE 後發布"}</button>
          </div>
          {notice && <p className="unlock-notice">{notice}</p>}
          {sentCelebration && <div className="prayer-send-celebration" role="status" aria-live="polite"><div className="prayer-send-sparkles" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i><i>·</i><i>✧</i></div><div className="prayer-send-seal">✓</div><b>祈願已送出</b><span>願這份心意被溫柔接住</span></div>}
        </section>
        <section className="wall-list">
          <div className="wall-list-title">
            <b>大家的祈願</b>
            <span>公開內容</span>
          </div>
          {loading ? (
            <div className="wall-loading-list" aria-label="正在載入祈願"><i /><i /><i /></div>
          ) : loadError ? (
            <div className="wall-state"><b>目前無法載入祈福牆</b><p>請確認網路連線後再試一次。</p><button onClick={load}>重新載入</button></div>
          ) : posts.length ? (
            posts.map((post) => (
              <article key={post.id}>
                <div>
                  <b>{post.display_name}</b>
                  <small>
                    {new Date(post.created_at).toLocaleDateString("zh-TW")}
                  </small>
                </div>
                <p>{post.message}</p>
                <button
                  onClick={async () => {
                    if (
                      await confirmAction({ title: "檢舉這則祈願？", message: "請確認內容確實不適當。累積三次檢舉後，內容將自動隱藏。", confirmLabel: "確認檢舉", cancelLabel: "取消", danger: true })
                    )
                      report(post.id);
                  }}
                >
                  檢舉
                </button>
              </article>
            ))
          ) : (
            <div className="wall-state empty-wall"><b>還沒有公開祈願</b><p>成為第一個留下祝福的人吧。</p></div>
          )}
        </section>
        <p className="feature-note">
          系統會先過濾連結與敏感字詞；可疑內容會進入待審，不會公開顯示。
        </p>
      </div>
    </main>
  );
}
