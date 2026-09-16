"use client";
import { useEffect, useState, type FormEvent } from "react";
import "./goal.css";
import { confirmAction } from "../../lib/confirm-action";
type Task = { subject: string; minutes: number; detail: string; done: boolean; color: string };
const colors = ["amber", "jade", "violet", "rose", "blue"];
function buildTasks(hours: number, weak: string): Task[] {
  const total = hours * 60;
  const others = ["國文", "英文", "數學", "自然", "社會"].filter(subject => subject !== weak);
  const first = Math.round(total * .45 / 5) * 5;
  const second = Math.round((total - first) * .55 / 5) * 5;
  return [
    { subject: weak, minutes: first, detail: "弱點複習與錯題整理", done: false, color: colors[0] },
    { subject: others[0], minutes: second, detail: "核心觀念與題型練習", done: false, color: colors[1] },
    { subject: others[1], minutes: total - first - second, detail: "輕量複習與重點回顧", done: false, color: colors[2] },
  ];
}
export default function GoalPage() {
  const [name, setName] = useState("學習挑戰");
  const [date, setDate] = useState("");
  const [hours, setHours] = useState(2);
  const [weak, setWeak] = useState("數學");
  const [goal, setGoal] = useState("穩定完成每日學習任務");
  const [tasks, setTasks] = useState<Task[]>(() => buildTasks(2, "數學"));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Hydrate device-local settings after SSR; never read localStorage during server rendering.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem("wenchang-mvp") ?? "{}");
      if (data && typeof data === "object") {
        setName(data.challengeName ?? "學習挑戰"); setDate(data.examDate ?? "");
        setHours([1,2,3,4].includes(data.hours) ? data.hours : 2); setWeak(data.weak ?? "數學");
        setGoal(data.goal ?? "穩定完成每日學習任務");
        if (Array.isArray(data.tasks) && data.tasks.length) setTasks(data.tasks);
      }
      setReady(true);
    } catch { setError("無法讀取原有計畫，請重新整理後再試，避免覆蓋紀錄。"); }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const total = tasks.reduce((sum, task) => sum + (Number(task.minutes) || 0), 0);
  const editTask = (index: number, key: "subject" | "minutes" | "detail", value: string) => setTasks(current => current.map((task, i) => i === index ? { ...task, [key]: key === "minutes" ? Number(value) : value } : task));
  const regenerate = async () => {
    if (!await confirmAction({ title: "重新安排今日任務？", message: "下方任務與已完成狀態會被新的安排取代。儲存後才會正式套用。", confirmLabel: "重新安排", cancelLabel: "保留原任務", danger: true })) return;
    setTasks(buildTasks(hours, weak)); setNotice("已依時間與優先科目重新安排，儲存後才會套用。");
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready) return;
    try {
      const old = JSON.parse(localStorage.getItem("wenchang-mvp") ?? "{}");
      if (!old || typeof old !== "object" || Array.isArray(old)) throw new Error("Invalid saved plan");
      localStorage.setItem("wenchang-mvp", JSON.stringify({ ...old, challengeName: name.trim() || "學習挑戰", examDate: date, hours, weak, goal: goal.trim() || "穩定完成每日學習任務", tasks: tasks.map(task => ({ ...task, subject:task.subject.trim(), detail:task.detail.trim() || "自主學習" })) }));
      localStorage.setItem("wenchang-cloud-sync-pending", "1");
      location.href = "/today";
    } catch { setError("儲存失敗，請確認瀏覽器允許儲存資料後再試。你的輸入仍保留在此頁。"); }
  };
  return <main id="study-plan-editor">
    <a className="plan-back" href="/today">← 返回今日</a>
    <header className="plan-heading"><p>我的學習設定</p><h1>設定你的學習計畫</h1><p>選好時間與科目，確認任務後就能開始。</p></header>
    <form onSubmit={save}>
      <div className="plan-columns">
        <section className="plan-panel" aria-labelledby="plan-basics"><div className="plan-section-title"><span>1</span><div><h2 id="plan-basics">你想怎麼學？</h2><p>先決定每天能投入多少時間。</p></div></div>
          <fieldset disabled={!ready}><legend>每天可讀時間</legend><div className="plan-time-options">{[1,2,3,4].map(value => <label key={value} className={hours === value ? "selected" : ""}><input type="radio" name="study-hours" value={value} checked={hours === value} onChange={() => setHours(value)}/><span>{value}<small> 小時</small></span></label>)}</div></fieldset>
          <label className="plan-field">優先加強哪一科？<select value={weak} onChange={e => setWeak(e.target.value)}>{[...new Set(["數學","英文","國文","自然","社會",weak])].map(subject => <option key={subject}>{subject}</option>)}</select></label>
          <label className="plan-field">目標日期<input type="date" required value={date} onChange={e => setDate(e.target.value)}/><small>例如段考、考試或想完成挑戰的日期。</small></label>
          <details className="plan-extra"><summary>計畫名稱與個人目標 <span>選填</span></summary><label className="plan-field">計畫名稱<input value={name} maxLength={20} onChange={e => setName(e.target.value)} placeholder="例如：我的段考準備"/></label><label className="plan-field">想達成的目標<input value={goal} maxLength={40} onChange={e => setGoal(e.target.value)}/></label></details>
          <button type="button" className="plan-arrange" onClick={regenerate} disabled={!ready}>依這些設定重新安排任務</button><p className="plan-help">調整時間或科目後，點這裡更新右方／下方任務。</p>
        </section>
        <section className="plan-panel" aria-labelledby="plan-tasks"><div className="plan-section-title"><span>2</span><div><h2 id="plan-tasks">今天要做這些事</h2><p>{tasks.length} 個任務，共 {total} 分鐘。可直接修改。</p></div></div>
          <div className="plan-task-list">{tasks.map((task,index) => <div className="plan-task" key={index}><div className="plan-task-heading"><b>任務 {index + 1}{task.done ? " · 已完成" : ""}</b><button type="button" aria-label={`移除任務 ${index+1}`} disabled={tasks.length <= 1 || !ready} onClick={() => setTasks(current => current.filter((_,i) => i !== index))}>移除</button></div><div className="plan-task-fields"><label className="plan-field">科目<input aria-label={`任務 ${index+1} 科目`} required maxLength={30} value={task.subject} onChange={e => editTask(index,"subject",e.target.value)}/></label><label className="plan-field">分鐘<input aria-label={`任務 ${index+1} 分鐘`} type="number" min={5} max={180} required value={task.minutes || ""} onChange={e => editTask(index,"minutes",e.target.value)}/></label></div><label className="plan-field plan-task-detail">學習內容<input aria-label={`任務 ${index+1} 學習內容`} maxLength={120} value={task.detail} onChange={e => editTask(index,"detail",e.target.value)}/></label></div>)}</div>
          <button type="button" className="plan-add" disabled={tasks.length >= 5 || !ready} onClick={() => setTasks(current => [...current,{subject:"自訂項目",minutes:15,detail:"",done:false,color:colors[current.length % colors.length]}])}>{tasks.length >= 5 ? "最多可安排 5 個任務" : "＋ 新增任務"}</button>
          <p className="plan-budget">{total === hours*60 ? `✓ 剛剛好！已安排 ${total} 分鐘。` : total > hours*60 ? `比預計多 ${total-hours*60} 分鐘，可以縮短任務或增加可讀時間。` : `還有 ${hours*60-total} 分鐘空檔，也可以留給休息。`}</p>
        </section>
      </div>
      {notice && <p className="plan-notice" role="status">{notice}</p>}{error && <p className="plan-error" role="alert">{error}</p>}
      <footer className="plan-save-bar"><div><strong>{tasks.length} 個任務 · {total} 分鐘</strong><p>儲存後套用至今日，保留未重排任務的完成狀態。</p></div><button type="submit" disabled={!ready}>儲存計畫，回到今日 →</button></footer>
    </form>
  </main>;
}
