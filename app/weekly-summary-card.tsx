"use client";
import { useRef, useState } from "react";
import "./weekly-summary-card.css";
type Audience = "self" | "teacher" | "parent";
type RoleAction = "none" | "focus" | "review" | "encourage" | "checkin";
type Preview = { heading: string; period: string; minutes: number; rate: number; weakSubject: string; support: string; subjects: string[]; fingerprint: string };
const versions = [
  { id: "self", label: "本人版", detail: "看進度，安排下一步" },
  { id: "teacher", label: "教師版", detail: "了解學習與協助方向" },
  { id: "parent", label: "家長版", detail: "肯定努力，溫柔陪伴" },
] as const;
export function WeeklySummaryCard({ idToken, login }: { idToken: string | null; login: () => Promise<unknown> }) {
  const [audience, setAudience] = useState<Audience>("self");
  const [roleAction, setRoleAction] = useState<RoleAction>("none");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"preview" | "send" | "login" | null>(null);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const lock = useRef(false);
  const retryKey = useRef<string | null>(null);
  async function run(action: "preview" | "send") {
    if (lock.current || (action === "send" && (!preview || sent))) return;
    lock.current = true; setMessage("");
    if (!idToken) {
      setBusy("login");
      try { await login(); } catch { setMessage("登入未完成，請再試一次。"); }
      finally { setBusy(null); lock.current = false; }
      return;
    }
    setBusy(action);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      if (action === "send" && !retryKey.current) retryKey.current = crypto.randomUUID();
      const response = await fetch("/api/weekly-summary", { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ idToken, audience, roleAction, action, fingerprint: preview?.fingerprint, retryKey: retryKey.current }) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) { setPreview(null); retryKey.current = null; }
        throw new Error(result.error || "目前無法取得摘要，請稍後再試。");
      }
      if (action === "preview") {
        setPreview(result); setSent(false); retryKey.current = null;
        setMessage("預覽已準備好，尚未傳送。");
      } else { setSent(true); setMessage("LINE 已接受傳送請求。請查看你與官方帳號的聊天室；不會直接傳給老師或家長。"); }
    } catch (error) {
      setMessage(error instanceof Error && error.name !== "AbortError" ? error.message : action === "send" ? "暫時無法確認傳送結果，請先查看 LINE；重試會沿用同一次傳送識別。" : "連線逾時，請重新載入預覽。");
    } finally { window.clearTimeout(timeout); setBusy(null); lock.current = false; }
  }
  return <section className="weekly-summary-panel" aria-labelledby="weekly-summary-heading">
    <header><span>最近七天 · 依已同步紀錄整理</span><h2 id="weekly-summary-heading">每週學習摘要</h2><p>先確認內容，再傳送到自己的 LINE。</p></header>
    <fieldset disabled={!!busy}><legend>1. 選擇摘要版本</legend><div className="weekly-version-options">
      {versions.map(version => <label key={version.id} htmlFor={`weekly-version-${version.id}`} aria-label={version.label} className={audience === version.id ? "selected" : ""}>
        <input id={`weekly-version-${version.id}`} type="radio" name="weekly-version" value={version.id} checked={audience === version.id} onChange={() => { setAudience(version.id); setRoleAction("none"); setPreview(null); setSent(false); setMessage(""); retryKey.current = null; }} />
        <span><b>{version.label}</b><small>{version.detail}</small></span>
      </label>)}
    </div></fieldset>
    {audience !== "self" && <fieldset className="weekly-role-actions" disabled={!!busy}><legend>選擇希望對方怎麼協助</legend><div>
      {(audience === "teacher" ? [["focus", "安排短回顧"], ["review", "提供錯題方向"]] : [["encourage", "給我一句鼓勵"], ["checkin", "提醒我關心近況"]]).map(([value, label]) => <label key={value}><input type="radio" name="role-action" checked={roleAction === value} onChange={() => { setRoleAction(value as RoleAction); setPreview(null); setSent(false); retryKey.current = null; }} /><span>{label}</span></label>)}
    </div></fieldset>}
    <p className="weekly-privacy">{audience === "self" ? "只有你會收到這份摘要。" : "這是給老師／家長閱讀的版本，仍先傳到你的 LINE，再由你決定是否轉傳。"} 不包含題目、答案或私人願望。</p>
    <button className="weekly-preview-button" disabled={!!busy} onClick={() => run("preview")}>{busy === "login" ? "正在登入…" : busy === "preview" ? "正在整理紀錄…" : !idToken ? "登入 LINE，預覽我的摘要" : preview ? "重新整理預覽" : "2. 預覽本週摘要"}</button>
    {!idToken && <p className="weekly-hint">登入不會自動發送通知。完成登入後，請再點選預覽。</p>}
    {preview && <article className="weekly-real-preview" aria-label="本次傳送內容預覽">
      <header><span>內容預覽 · {preview.period}</span><h3>{preview.heading}</h3></header>
      <dl><div><dt>任務完成率</dt><dd>{preview.rate}%</dd></div><div><dt>完成任務累積</dt><dd>{preview.minutes}<small> 分鐘</small></dd></div></dl>
      <p>目前設定的待加強科目：{preview.weakSubject}</p>
      <ul>{preview.subjects.map(subject => <li key={subject}>{subject}</li>)}</ul>
      <p>{preview.support}</p><small>分鐘為已完成任務的排定時間，不等於實際專注計時。卡片會附上「查看完整進度」入口。</small>
    </article>}
    {preview && <button className="weekly-confirm-button" onClick={() => run("send")} disabled={!!busy || sent}>{busy === "send" ? "正在傳送，請稍候…" : sent ? "本次摘要已提交 LINE" : "3. 確認傳送到我的 LINE"}</button>}
    <p role="status" className="weekly-status">{message}</p>
    <small className="weekly-hint">需先加入官方帳號好友。沒有資料時，請先在今日頁完成任務並同步；這是手動傳送，不會更動自動週報設定。</small>
  </section>;
}
