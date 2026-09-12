"use client";
import { useEffect, useState } from "react";
import liff from "@line/liff";
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
  const load = () =>
    fetch("/api/prayer-wall")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        setPosts(data.posts ?? []);
        setFeatured(data.featured ?? null);
      })
      .catch(() => setNotice("祈福牆暫時無法載入"));
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
    if (!idToken) {
      if (!liff.isLoggedIn()) liff.login();
      return;
    }
    const response = await fetch("/api/prayer-wall", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post", idToken, message, anonymous }),
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(
        data.error === "Please wait before posting again"
          ? "請稍候一分鐘再發送下一則祈願。"
          : "祈願發送失敗，請確認內容後再試。",
      );
      return;
    }
    setMessage("");
    setNotice(
      data.pending
        ? "你的祈願已送出，正在等待內容審核。"
        : "祈願已公開在祈福牆，願你今日順利。",
    );
    if (!data.pending) load();
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
          <h1>
            把祈願留在牆上，
            <br />
            <em>讓努力彼此照亮。</em>
          </h1>
          <p>
            每則公開內容都會經過基本安全檢查；你可匿名發文，也能協助檢舉不當內容。
          </p>
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
              <b>寫下今日祈願</b>
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
            <button onClick={post}>送出祈願</button>
          </div>
          {notice && <p className="unlock-notice">{notice}</p>}
        </section>
        <section className="wall-list">
          <div className="wall-list-title">
            <b>大家的祈願</b>
            <span>公開內容</span>
          </div>
          {posts.length ? (
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
                  onClick={() => {
                    if (
                      window.confirm(
                        "確定要檢舉這則祈願嗎？\n累積三次檢舉後，內容將自動隱藏。",
                      )
                    )
                      report(post.id);
                  }}
                >
                  檢舉
                </button>
              </article>
            ))
          ) : (
            <div className="empty-wall">
              還沒有公開祈願。成為第一個留下祝福的人吧。
            </div>
          )}
        </section>
        <p className="feature-note">
          系統會先過濾連結與敏感字詞；可疑內容會進入待審，不會公開顯示。
        </p>
      </div>
    </main>
  );
}
