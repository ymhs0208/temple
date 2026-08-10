type CoachTask = {
  subject?: string;
  minutes?: number;
  detail?: string;
  done?: boolean;
};

type CoachRequest = {
  message?: string;
  context?: {
    daysLeft?: number;
    weakSubject?: string;
    dailyHours?: number;
    goal?: string;
    tasks?: CoachTask[];
  };
};

type GeminiPayload = { output_text?: string };

const clean = (value: unknown, limit: number) =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "AI 學習軍師尚未完成服務設定，請稍後再試。" },
      { status: 503 },
    );
  }

  let body: CoachRequest;
  try {
    body = (await request.json()) as CoachRequest;
  } catch {
    return Response.json({ error: "請重新輸入你的問題。" }, { status: 400 });
  }

  const message = clean(body.message, 500);
  if (!message) {
    return Response.json({ error: "請先告訴軍師你現在需要什麼幫助。" }, { status: 400 });
  }

  const context = body.context ?? {};
  const tasks = Array.isArray(context.tasks)
    ? context.tasks.slice(0, 8).map((task) => ({
        subject: clean(task.subject, 30) || "未命名科目",
        minutes: Math.max(0, Math.min(360, Number(task.minutes) || 0)),
        detail: clean(task.detail, 80),
        done: Boolean(task.done),
      }))
    : [];
  const profile = {
    daysLeft: Math.max(0, Math.min(3650, Number(context.daysLeft) || 0)),
    weakSubject: clean(context.weakSubject, 30) || "未設定",
    dailyHours: Math.max(0.25, Math.min(16, Number(context.dailyHours) || 2)),
    goal: clean(context.goal, 160) || "穩定完成每日學習任務",
    tasks,
  };

  const input = JSON.stringify({ userRequest: message, learningProfile: profile });
  try {
    const upstream = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite",
        store: false,
        generation_config: { max_output_tokens: 500, temperature: 0.55 },
        system_instruction:
          "你是『文昌同行』的 AI 學習軍師。以繁體中文回答，語氣溫和、務實、具體。只依據輸入的學習資料提出建議，不要捏造成績或承諾考試結果。給出一個可立即開始的下一步，並以條列列出短時段安排。若使用者焦慮，先肯定感受，再提供不超過 15 分鐘的起步行動。建議僅限學習規劃與鼓勵，不進行醫療、心理診斷或預言。不要嘗試修改任何資料或宣稱已修改計畫。",
        input,
      }),
      },
    );
    if (!upstream.ok) {
      console.error("Coach API failed", upstream.status);
      return Response.json(
        { error: "AI 軍師暫時忙碌，請稍後再試。" },
        { status: 502 },
      );
    }
    const payload = (await upstream.json()) as GeminiPayload;
    const answer = payload.output_text?.trim();
    if (!answer) throw new Error("Empty AI response");
    return Response.json({ answer });
  } catch (error) {
    console.error("Coach request failed", error);
    return Response.json(
      { error: "AI 軍師暫時無法回覆，請稍後再試。" },
      { status: 502 },
    );
  }
}
