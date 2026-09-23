import { pilgrimageCodes, pilgrimageStops } from "./pilgrimage-data";
import { learningUrl } from "./line-reminder";
import { taipeiDate } from "./taipei-date";

export const milestones = [
  { days: 3, name: "初萌之芽", mark: "芽", description: "三天的開始，讓努力生根。" },
  { days: 7, name: "七日成光", mark: "光", description: "一週的累積，照亮前行的路。" },
  { days: 30, name: "恆心之章", mark: "恆", description: "三十天的堅持，成為自己的力量。" },
];
const dayBefore = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
export function studyAchievement(completedAt: string[], now = new Date()) {
  const today = taipeiDate(now);
  const dates = [...new Set(completedAt.filter(value => Number.isFinite(Date.parse(value)) && Date.parse(value) <= now.getTime()).map(value => taipeiDate(new Date(value))))].sort();
  const days = new Set(dates);
  let current = 0;
  let cursor = days.has(today) ? today : dayBefore(today);
  while (days.has(cursor)) { current++; cursor = dayBefore(cursor); }
  let longest = 0, run = 0, previous = "";
  for (const day of dates) { run = previous === dayBefore(day) ? run + 1 : 1; longest = Math.max(longest, run); previous = day; }
  return { current, longest, todayDone: days.has(today), activeDays: dates.length, unlocked: milestones.filter(item => longest >= item.days).map(item => item.days) };
}

const ink = "#245747", paper = "#FAF7EF", gold = "#B39253", muted = "#788279", red = "#AA5146";
const text = (value: string, size = "sm", color = ink, extra = {}) => ({ type: "text", text: value, size, color, wrap: true, ...extra });
const button = (label: string, uri: string) => ({ type: "button", style: "primary", color: ink, action: { type: "uri", label, uri } });
const heading = (eyebrow: string, title: string) => ({ type: "box", layout: "vertical", backgroundColor: ink, paddingAll: "24px", spacing: "sm", contents: [text(eyebrow, "xxs", "#DBC998"), text(title, "xl", "#FFFFFF", { weight: "bold" })] });
const quickReply = { items: ["巡禮集章卡", "連續學習成就", "今天讀什麼"].map(label => ({ type: "action", action: { type: "message", label, text: label } })) };

export function buildStampFlex(codes: string[]) {
  const visited = new Set(codes);
  const count = pilgrimageCodes.filter(code => visited.has(code)).length;
  const next = pilgrimageStops.find((_, index) => !visited.has(pilgrimageCodes[index]));
  const stamps = pilgrimageStops.map((stop, index) => {
    const done = visited.has(pilgrimageCodes[index]);
    return { type: "box", layout: "vertical", flex: 1, spacing: "sm", alignItems: "center", contents: [
      { type: "box", layout: "vertical", width: "54px", height: "54px", cornerRadius: "27px", borderWidth: "2px", borderColor: done ? red : "#DCDDD4", backgroundColor: done ? "#F5E7DD" : "#F0EFE8", justifyContent: "center", contents: [text(stop.badge, "xl", done ? red : "#9B9F94", { align: "center", weight: "bold" })] },
      text(stop.name.split("・")[1], "xxs", done ? ink : muted, { align: "center" }),
      text(done ? "已集章" : "待探訪", "xxs", done ? red : muted, { align: "center" }),
    ] };
  });
  return { type: "flex", altText: `七媽巡禮集章卡・已收集 ${count}/7 枚印章`, quickReply, contents: {
    type: "bubble", size: "mega", header: heading("PILGRIMAGE PASSPORT · 七媽同行", "一站一印，步步有福"),
    body: { type: "box", layout: "vertical", paddingAll: "22px", backgroundColor: paper, spacing: "xl", contents: [
      { type: "box", layout: "baseline", contents: [text("我的巡禮印記", "sm"), text(`${count} / 7`, "xxl", red, { align: "end", weight: "bold" })] },
      { type: "box", layout: "horizontal", spacing: "xs", contents: pilgrimageCodes.map(code => ({ type: "box", layout: "vertical", height: "4px", flex: 1, backgroundColor: visited.has(code) ? red : "#E5E3D9", contents: [] })) },
      { type: "box", layout: "horizontal", spacing: "sm", contents: stamps.slice(0, 4) },
      { type: "box", layout: "horizontal", spacing: "sm", contents: [...stamps.slice(4), { type: "box", layout: "vertical", flex: 1, justifyContent: "center", contents: [text("七媽\n同行", "sm", gold, { align: "center" })] }] },
      { type: "separator", color: "#E5E0D2" },
      text(next ? `下一枚祝福｜${next.name}` : "七印齊聚・巡禮圓滿", "md", ink, { weight: "bold" }),
      text(next ? "到巡禮頁完成現場掃碼並同步，讓走過的路留下印記。" : "七站足跡已收齊。回到巡禮頁完成歷史問答，領取你的完成證書。", "xs", muted),
      text("依已同步的巡禮紀錄整理", "xxs", muted),
    ] },
    footer: { type: "box", layout: "vertical", paddingAll: "20px", backgroundColor: paper, contents: [button(next ? "繼續收集祝福" : "開啟我的巡禮", learningUrl("/pilgrimage"))] },
  } };
}

export function buildStudyAchievementFlex(completedAt: string[], now = new Date()) {
  const achievement = studyAchievement(completedAt, now);
  const next = milestones.find(item => !achievement.unlocked.includes(item.days));
  return { type: "flex", altText: `連續學習 ${achievement.current} 天・已解鎖 ${achievement.unlocked.length} 枚成就徽章`, quickReply, contents: {
    type: "bubble", size: "mega", header: heading("LITTLE STEPS · 每天一點光", "把努力，收藏成光"),
    body: { type: "box", layout: "vertical", paddingAll: "24px", backgroundColor: paper, spacing: "lg", contents: [
      text("目前連續學習", "xs", muted, { align: "center" }),
      text(String(achievement.current), "5xl", ink, { align: "center", weight: "bold" }),
      text(`天  ·  歷史最長 ${achievement.longest} 天`, "sm", gold, { align: "center" }),
      text(achievement.todayDone ? "今天的努力已記下，明天繼續同行。" : achievement.current ? "今天完成一項任務，就能接續這份累積。" : "今天完成第一項任務，點亮新的開始。", "xs", muted, { align: "center" }),
      { type: "separator", color: "#E5E0D2" },
      ...milestones.map(item => {
        const unlocked = achievement.unlocked.includes(item.days);
        return { type: "box", layout: "horizontal", spacing: "md", alignItems: "center", contents: [
          { type: "box", layout: "vertical", width: "52px", height: "52px", cornerRadius: "16px", borderWidth: "1px", borderColor: unlocked ? gold : "#DEDED3", backgroundColor: unlocked ? "#EEE4CA" : "#F0EFE8", justifyContent: "center", contents: [text(item.mark, "xl", unlocked ? ink : "#92998D", { align: "center", weight: "bold" })] },
          { type: "box", layout: "vertical", spacing: "xs", contents: [text(`${item.name} · ${item.days} 天`, "sm", unlocked ? ink : muted, { weight: "bold" }), text(unlocked ? item.description : `連續學習 ${item.days} 天解鎖`, "xxs", muted)] },
          text(unlocked ? "已獲得" : "待點亮", "xxs", unlocked ? gold : muted, { flex: 0 }),
        ] };
      }),
      text(next ? `下一枚「${next.name}」：本次連續還差 ${Math.max(0, next.days - achievement.current)} 天。` : "三枚徽章已集齊，你的堅持值得珍藏。", "xs", ink),
      text("以台灣日期計算，每天完成至少一項已同步任務。同日只計一次；徽章依歷史最長連續紀錄解鎖。", "xxs", muted),
    ] },
    footer: { type: "box", layout: "vertical", paddingAll: "20px", backgroundColor: paper, contents: [button("為今天添一點光", learningUrl("/today"))] },
  } };
}
