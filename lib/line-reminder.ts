export type ReminderTask = { subject: string; minutes: number };
export type ReminderKind = "morning" | "evening";

export function learningUrl(path: "/today" | "/progress" | "/prayer" | "/pilgrimage") {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (base) {
    const url = new URL(path, base);
    if (url.protocol !== "https:") throw new Error("LINE links require a public HTTPS APP_URL");
    return url.toString();
  }
  const id = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!id) throw new Error("Configure NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_LIFF_ID");
  return `https://liff.line.me/${id}${path}`;
}
const text = (value: string, size = "sm", color = "#40536B") => ({ type: "text", text: value, size, color, wrap: true });
export function flexHeader(title: string, color: string, eyebrow = "你的學習陪伴") {
  return { type: "box", layout: "vertical", backgroundColor: color, paddingAll: "24px", spacing: "md", contents: [
    { ...text("文昌同行  /  " + eyebrow, "xs", "#E5EDE9"), weight: "bold" },
    { ...text(title, "xl", "#FFFFFF"), weight: "bold" },
    { type: "box", layout: "vertical", width: "32px", height: "3px", backgroundColor: "#D9BD81", contents: [] },
  ] };
}

export function flexTaskRow(task: ReminderTask, index: number, color: string) {
  return { type: "box", layout: "horizontal", spacing: "md", alignItems: "center", paddingAll: "14px", backgroundColor: "#F5F6F3", cornerRadius: "12px", contents: [
    { ...text(String(index + 1).padStart(2, "0"), "xs", color), flex: 0, weight: "bold" },
    { ...text(task.subject, "sm", "#253C35"), flex: 1, weight: "bold" },
    { ...text(`${task.minutes} 分鐘`, "xs", "#62726B"), flex: 0, align: "end" },
  ] };
}

function progressBar(rate: number, color: string) {
  const percent = Math.min(100, Math.max(0, Number.isFinite(rate) ? rate : 0));
  return { type: "box", layout: "horizontal", height: "6px", cornerRadius: "3px", backgroundColor: "#E9ECE7", contents: percent > 0 ? [
    { type: "box", layout: "vertical", width: `${percent}%`, height: "6px", backgroundColor: color, cornerRadius: "3px", contents: [] },
  ] : [] };
}

function card(title: string, intro: string, lines: string[], label: string, path: "/today" | "/progress", color: string, rate?: number, tasks: ReminderTask[] = []) {
  return {
    type: "flex" as const, altText: `${title}・${intro}`.slice(0, 400),
    contents: {
      type: "bubble",
      size: "mega",
      header: flexHeader(title, color),
      body: { type: "box", layout: "vertical", paddingAll: "24px", spacing: "lg", contents: [
        text(intro),
        { type: "box", layout: "vertical", paddingAll: "16px", backgroundColor: "#F5F6F3", cornerRadius: "12px", spacing: "md", contents: [
          { ...text(lines[0], "lg", color), weight: "bold" },
          ...(rate === undefined ? [] : [progressBar(rate, color)]),
        ] },
        ...lines.slice(1).map(line => text(line, "sm", "#53645D")),
        ...(tasks.length ? [text("接下來的小目標", "xs", "#7B857F"), ...tasks.slice(0, 5).map((task, index) => flexTaskRow(task, index, color))] : []),
        { type: "separator", color: "#E9ECE7" },
        text("依已同步的學習紀錄整理", "xxs", "#7B857F"),
      ] },
      footer: { type: "box", layout: "vertical", paddingAll: "24px", paddingTop: "0px", contents: [
        { type: "button", style: "primary", color, action: { type: "uri", label, uri: learningUrl(path) } },
      ] },
    },
  };
}
export function buildReminderFlex({ kind, displayName, tasks, pending, dayNumber, weakSubject, completionRate }: {
  kind: ReminderKind; displayName?: string | null; tasks: ReminderTask[]; pending: ReminderTask[];
  dayNumber?: number; weakSubject?: string; completionRate?: number;
}) {
  const minutes = pending.reduce((sum, task) => sum + task.minutes, 0);
  const coachHint = weakSubject
    ? `AI 教練建議：今天先從${weakSubject}開始，${completionRate && completionRate > 0 ? `你已完成 ${completionRate}%，保持節奏。` : "先完成一小段就算開始。"}`
    : "AI 教練建議：先完成列表中的第一項，降低開始的阻力。";
  return card(kind === "morning" ? "今天，從一件事開始" : "今天還有一點小進度",
    `${displayName || "同學"}，${dayNumber ? `Day ${dayNumber}・` : ""}還有 ${pending.length} 個任務，共 ${minutes} 分鐘。`,
    [`已完成 ${tasks.length - pending.length} / ${tasks.length} 項`,
      coachHint,
      ...(pending.length > 5 ? ["其餘任務請至網站查看"] : [])],
    kind === "morning" ? "前往今日任務" : "繼續學習", "/today", kind === "morning" ? "#245747" : "#394D70",
    tasks.length ? (tasks.length - pending.length) / tasks.length * 100 : 0, pending);
}
export function buildWeeklyFlex({ minutes, rate, subjects, period, heading }: {
  minutes: number; rate: number; subjects: string[]; period: string; heading?: string;
}) {
  return card(heading || "這週的努力，一起回顧", period,
    [`完成任務累積 ${minutes} 分鐘`, `任務完成率 ${rate}%`, ...subjects.slice(0, 6)],
    "查看完整進度", "/progress", "#625078", rate);
}

export function buildCompletionFlex({ subject, minutes, completedCount, totalCount, displayName }: {
  subject: string; minutes: number; completedCount: number; totalCount: number; displayName?: string | null;
}) {
  const finished = completedCount >= totalCount;
  return card(
    finished ? "今日學習完成" : "完成一項，繼續前進",
    finished ? `${displayName || "同學"}，今天的任務全部完成了。` : `${displayName || "同學"}，${subject} 已完成。`,
    [
      `本次專注 ${minutes} 分鐘`,
      `今日進度 ${completedCount}/${totalCount} 項`,
      finished ? "🏅 解鎖成就：今日全勤" : `還剩 ${Math.max(0, totalCount - completedCount)} 項任務`,
      finished ? "現在可以安心休息，明天再繼續。" : "回到今日頁，開始下一項任務。",
    ],
    finished ? "查看今日成果" : "開始下一項", "/progress", finished ? "#625078" : "#245747",
    totalCount ? completedCount / totalCount * 100 : 0,
  );
}
