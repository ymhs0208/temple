export type ReminderTask = { subject: string; minutes: number };
export type ReminderKind = "morning" | "evening";

export function learningUrl(path: "/today" | "/progress") {
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
function card(title: string, intro: string, lines: string[], label: string, path: "/today" | "/progress", color: string) {
  return {
    type: "flex" as const, altText: `${title}・${intro}`.slice(0, 400),
    contents: {
      type: "bubble",
      header: { type: "box", layout: "vertical", backgroundColor: color, paddingAll: "20px", contents: [
        text("文昌同行・學習陪伴", "xs", "#FFFFFF"),
        { ...text(title, "lg", "#FFFFFF"), weight: "bold", margin: "sm" },
      ] },
      body: { type: "box", layout: "vertical", paddingAll: "20px", spacing: "md", contents: [
        text(intro), ...lines.map(line => text(line)),
        text("依已同步的學習紀錄整理；開啟網站後再決定下一步。", "xs", "#66768A"),
      ] },
      footer: { type: "box", layout: "vertical", paddingAll: "16px", contents: [
        { type: "button", style: "primary", color, action: { type: "uri", label, uri: learningUrl(path) } },
      ] },
    },
  };
}
export function buildReminderFlex({ kind, displayName, tasks, pending, dayNumber }: {
  kind: ReminderKind; displayName?: string | null; tasks: ReminderTask[]; pending: ReminderTask[];
  dayNumber?: number; weakSubject?: string; completionRate?: number;
}) {
  const minutes = pending.reduce((sum, task) => sum + task.minutes, 0);
  return card(kind === "morning" ? "今天，從一件事開始" : "今天還有一點小進度",
    `${displayName || "同學"}，${dayNumber ? `Day ${dayNumber}・` : ""}還有 ${pending.length} 個任務，共 ${minutes} 分鐘。`,
    [`已完成 ${tasks.length - pending.length} / ${tasks.length} 項`,
      ...pending.slice(0, 5).map(task => `${task.subject} · ${task.minutes} 分鐘`),
      ...(pending.length > 5 ? ["其餘任務請至網站查看"] : [])],
    kind === "morning" ? "前往今日任務" : "繼續學習", "/today", kind === "morning" ? "#287C64" : "#526BA4");
}
export function buildWeeklyFlex({ minutes, rate, subjects, period, heading }: {
  minutes: number; rate: number; subjects: string[]; period: string; heading?: string;
}) {
  return card(heading || "這週的努力，一起回顧", period,
    [`完成任務累積 ${minutes} 分鐘`, `任務完成率 ${rate}%`, ...subjects.slice(0, 6)],
    "查看完整進度", "/progress", "#7661A8");
}
