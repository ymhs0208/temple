export type ReminderTask = { subject: string; minutes: number };
type ReminderKind = "morning" | "evening";

const liffUrl = () => {
  const id = process.env.NEXT_PUBLIC_LIFF_ID || "2011050459-8bPHPFCw";
  return process.env.NEXT_PUBLIC_APP_URL || `https://liff.line.me/${id}`;
};

export function buildReminderFlex({ kind, displayName, tasks, pending }: { kind: ReminderKind; displayName?: string | null; tasks: ReminderTask[]; pending: ReminderTask[] }) {
  const completed = tasks.length - pending.length;
  const next = pending[0];
  const isMorning = kind === "morning";
  const title = isMorning ? "早安，今天也一起前進" : pending.length ? "晚安前，留給自己一小步" : "今天任務圓滿完成";
  const intro = isMorning
    ? `${displayName ?? "同學"}，先完成第一項任務就很棒。`
    : pending.length ? `還有 ${pending.length} 項任務，不必一次做完。` : "穩定完成的你，值得好好休息。";
  const summary = tasks.length ? `今日進度 ${completed}/${tasks.length} 項` : "今天還沒有建立任務";
  const taskLine = next ? `${next.subject}・${next.minutes} 分鐘` : "明天再一起安排新的學習節奏";
  const buttons: Record<string, unknown>[] = [];
  if (next) buttons.push({ type: "button", style: "primary", color: "#a9513f", action: { type: "message", label: `完成${next.subject}`, text: `完成${next.subject}` } });
  buttons.push({ type: "button", style: "secondary", action: { type: "message", label: "查看進度", text: "查看進度" } });
  buttons.push({ type: "button", style: "link", action: { type: "uri", label: "開啟文昌同行", uri: liffUrl() } });
  return {
    type: "flex" as const,
    altText: `${isMorning ? "今日學習提醒" : "晚間學習提醒"}・${summary}`,
    contents: {
      type: "bubble",
      header: { type: "box", layout: "vertical", backgroundColor: isMorning ? "#2b6354" : "#42536b", paddingAll: "18px", contents: [
        { type: "text", text: isMorning ? "WENCHANG MORNING" : "WENCHANG EVENING", size: "xxs", color: "#F6D982", weight: "bold", letterSpacing: "2px" },
        { type: "text", text: title, margin: "sm", color: "#FFF9EA", size: "lg", weight: "bold", wrap: true },
      ] },
      body: { type: "box", layout: "vertical", paddingAll: "18px", spacing: "md", contents: [
        { type: "text", text: intro, color: "#776C59", size: "sm", wrap: true },
        { type: "box", layout: "vertical", backgroundColor: "#FFF6DD", cornerRadius: "12px", paddingAll: "12px", contents: [
          { type: "text", text: summary, color: "#9D7B40", size: "xs", weight: "bold" },
          { type: "text", text: taskLine, margin: "sm", color: "#594225", size: "md", weight: "bold", wrap: true },
        ] },
        { type: "text", text: "完成任務後，直接按按鈕同步到你的學習進度。", size: "xxs", color: "#9C927E", wrap: true },
      ] },
      footer: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "14px", contents: buttons },
    },
  };
}
