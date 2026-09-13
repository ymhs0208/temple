type CoachTask = { subject?: string; minutes?: number; detail?: string; done?: boolean };
type CoachRequest = {
  message?: string;
  context?: {
    daysLeft?: number; weakSubject?: string; dailyHours?: number; goal?: string; tasks?: CoachTask[];
    weakQuestionCount?: number; dueWeakQuestionCount?: number; focusMinutes?: number; checkInDone?: boolean;
  };
};
type GeminiPayload = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
const clean = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";

const buildFallbackPlan = (profile: {
  daysLeft: number; weakSubject: string; tasks: Array<{ subject: string; minutes: number; detail: string; done: boolean }>;
  weakQuestionCount: number; dueWeakQuestionCount: number; focusMinutes: number; checkInDone: boolean;
}) => {
  const pending = profile.tasks.filter((task) => !task.done);
  const nextTask = pending.find((task) => task.subject === profile.weakSubject) ?? pending[0];
  const completedMinutes = profile.tasks.filter((task) => task.done).reduce((sum, task) => sum + task.minutes, 0);
  const urgency = profile.daysLeft <= 7 ? "考前時間有限，今天以校正弱點與穩住節奏為先。" : profile.daysLeft <= 21 ? "倒數已進入弱科加強期，先處理最會影響後續練習的卡點。" : "目前仍適合把弱點拆小並穩定累積。";
  const review = profile.dueWeakQuestionCount > 0
    ? `先訂正 ${profile.dueWeakQuestionCount} 題今天到期的回流錯題，寫下錯因與正確線索。`
    : profile.weakQuestionCount > 0
      ? `目前有 ${profile.weakQuestionCount} 題弱點等待後續回流，先用 ${profile.weakSubject} 的核心觀念做預防複習。`
      : "目前沒有到期回流錯題，可把時間放在下一個未完成任務。";
  const action = nextTask
    ? `現在就開始：先設 ${Math.min(15, Math.max(10, nextTask.minutes))} 分鐘計時，處理「${nextTask.subject}・${nextTask.detail || "重點複習"}」。`
    : "現在就開始：花 5 分鐘整理今天最有效的一個方法，然後停止複習、準備休息。";
  return `優先任務：${profile.dueWeakQuestionCount > 0 ? "回流錯題" : nextTask ? nextTask.subject : "今日回顧"}\n原因：${urgency}\n\n建議安排：\n1. ${review}\n2. ${nextTask ? `接著完成「${nextTask.subject}」${Math.min(nextTask.minutes, 45)} 分鐘；只做一個清楚的小目標。` : "今天的主要任務已完成，維持休息節奏。"}\n3. 最後用 5 分鐘寫下明天先做哪一科。\n\n今天已完成：${profile.tasks.filter((task) => task.done).length} 項、${completedMinutes} 分鐘完整專注${profile.checkInDone ? "，學習紀錄已留存" : ""}。\n\n${action}`;
};

export async function POST(request: Request) {
  let body: CoachRequest;
  try { body = (await request.json()) as CoachRequest; } catch { return Response.json({ error: "請重新輸入你的問題。" }, { status: 400 }); }
  const message = clean(body.message, 500) || "請根據我的今天學習資料，安排下一步。";
  const context = body.context ?? {};
  const tasks = Array.isArray(context.tasks) ? context.tasks.slice(0, 8).map((task) => ({
    subject: clean(task.subject, 30) || "未命名科目", minutes: Math.max(0, Math.min(360, Number(task.minutes) || 0)), detail: clean(task.detail, 80), done: Boolean(task.done),
  })) : [];
  const profile = {
    daysLeft: Math.max(0, Math.min(3650, Number(context.daysLeft) || 0)), weakSubject: clean(context.weakSubject, 30) || "未設定",
    dailyHours: Math.max(0.25, Math.min(16, Number(context.dailyHours) || 2)), goal: clean(context.goal, 160) || "穩定完成每日學習任務", tasks,
    weakQuestionCount: Math.max(0, Math.min(99, Number(context.weakQuestionCount) || 0)), dueWeakQuestionCount: Math.max(0, Math.min(99, Number(context.dueWeakQuestionCount) || 0)),
    focusMinutes: Math.max(0, Math.min(1440, Number(context.focusMinutes) || 0)), checkInDone: Boolean(context.checkInDone),
  };
  const fallback = buildFallbackPlan(profile);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ answer: fallback, source: "plan" });
  const input = JSON.stringify({ userRequest: message, learningProfile: profile });
  try {
    const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent", {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: `你是「文昌同行」AI 學習教練。以繁體中文、具體而簡潔地回答；只依據輸入資料，不要捏造成績或承諾結果。必須依序包含「優先任務」、「原因」、「建議安排」（2～3 個帶分鐘數的動作）與「現在就開始」。請明確使用考試倒數、弱科、待回流錯題、今天已完成任務這四種資訊；若其中一項沒有資料，要直接說明。不要只給鼓勵、不要醫療或心理診斷、不要宣稱已修改計畫。\n\n${input}` }] }], generationConfig: { maxOutputTokens: 500, temperature: 0.45 } }),
    });
    if (!upstream.ok) return Response.json({ answer: fallback, source: "plan" });
    const payload = (await upstream.json()) as GeminiPayload;
    const answer = (payload.candidates ?? []).flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text ?? "").join("\n").trim();
    return Response.json({ answer: answer || fallback, source: answer ? "ai" : "plan" });
  } catch (error) {
    console.error("Coach request failed", error);
    return Response.json({ answer: fallback, source: "plan" });
  }
}
