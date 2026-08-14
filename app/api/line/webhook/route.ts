import { supabaseAdmin } from "@/lib/supabase-admin";
import { taipeiDate } from "@/lib/taipei-date";

type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type?: string; text?: string };
};

const today = () => taipeiDate();

async function signatureIsValid(body: string, receivedSignature: string | null) {
  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
  if (!secret || !receivedSignature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const expected = Array.from(signature, (byte) => String.fromCharCode(byte)).join("");
  const encoded = btoa(expected);
  if (encoded.length !== receivedSignature.length) return false;
  let difference = 0;
  for (let index = 0; index < encoded.length; index += 1) difference |= encoded.charCodeAt(index) ^ receivedSignature.charCodeAt(index);
  return difference === 0;
}

async function reply(replyToken: string, text: string) {
  const accessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
  if (!accessToken) throw new Error("LINE Messaging API is not configured");
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
  });
}

async function learningContext(lineUserId?: string) {
  if (!lineUserId) return null;
  const db = supabaseAdmin();
  const { data: user } = await db.from("users").select("id, display_name").eq("line_user_id", lineUserId).maybeSingle();
  if (!user) return null;
  const { data: plan } = await db.from("study_plans").select("id, weak_subject, exam_date, goal").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!plan) return { user, plan: null, tasks: [], completed: new Set<string>() };
  const { data: tasks } = await db.from("daily_tasks").select("id, subject, minutes, task_type, sort_order").eq("plan_id", plan.id).eq("task_date", today()).order("sort_order");
  const taskList = tasks ?? [];
  const { data: completions } = taskList.length ? await db.from("task_completions").select("task_id").eq("user_id", user.id).in("task_id", taskList.map((task) => task.id)) : { data: [] };
  return { user, plan, tasks: taskList, completed: new Set((completions ?? []).map((row) => row.task_id)) };
}

function taskLines(tasks: { subject: string; minutes: number; task_type: string; id: string }[], completed: Set<string>) {
  return tasks.map((task, index) => `${completed.has(task.id) ? "✓" : `${index + 1}.`} ${task.subject} ${task.minutes} 分鐘｜${task.task_type}`).join("\n");
}

function oneHourPlan(tasks: { subject: string; minutes: number; task_type: string; id: string }[], completed: Set<string>, source: string) {
  const match = source.match(/(\d+(?:\.\d+)?)\s*(小時|分鐘|分)/);
  const capacity = match ? Math.max(15, Math.round(Number(match[1]) * (match[2] === "小時" ? 60 : 1))) : 60;
  let remaining = capacity;
  const selected = tasks.filter((task) => !completed.has(task.id)).flatMap((task) => {
    if (remaining <= 0) return [];
    const minutes = Math.min(task.minutes, remaining);
    remaining -= minutes;
    return [{ ...task, minutes }];
  });
  return selected.length ? selected : tasks.slice(0, 1).map((task) => ({ ...task, minutes: Math.min(task.minutes, capacity) }));
}

function helpText() {
  return "我是文昌同行學習軍師 ✦\n\n你可以直接傳：\n・今天讀什麼\n・我完成數學了\n・查看進度\n・我只有一小時\n・給我一句鼓勵";
}

function completionText(subject: string, minutes: number, completedCount: number, totalCount: number, displayName: string | null) {
  const name = displayName ? `${displayName}，` : "";
  if (completedCount === totalCount) return `🎉 ${name}${subject}也完成了！\n\n今天的 ${totalCount} 項任務已全部完成。現在可以好好休息，明天再繼續前進。`;
  return `✅ ${name}${subject}完成了！\n今天進度 ${completedCount}/${totalCount}，還有 ${totalCount - completedCount} 項。一步一步來，你做得很好。`;
}

async function answer(event: LineEvent) {
  if (event.type !== "message" || event.message?.type !== "text" || !event.replyToken) return;
  const command = event.message.text?.trim().replace(/\s+/g, "") ?? "";
  const context = await learningContext(event.source?.userId);
  if (!context || !context.plan) {
    await reply(event.replyToken, "歡迎來到文昌同行 ✦\n請先開啟 LIFF 建立學習計畫，之後我就能依你的任務提供建議。\n\n" + helpText());
    return;
  }
  const { tasks, completed, plan } = context;
  const isCompletionCommand = /(完成|讀完|寫完|做完|結束|打卡)/.test(command);
  const matchingTask = isCompletionCommand ? tasks.find((task) => command.includes(task.subject)) : undefined;
  if (matchingTask) {
    if (completed.has(matchingTask.id)) {
      await reply(event.replyToken, `「${matchingTask.subject}」今天已經標記完成囉！想查看整體進度，可以傳「進度」。`);
      return;
    }
    const db = supabaseAdmin();
    const { error } = await db.from("task_completions").insert({ task_id: matchingTask.id, user_id: context.user.id });
    if (error) throw error;
    const completedCount = completed.size + 1;
    await db.from("energy").upsert({ user_id: context.user.id, current_energy: Math.min(100, 42 + completedCount * 10), prayer_planks: 10 + completedCount, updated_at: new Date().toISOString() });
    await reply(event.replyToken, completionText(matchingTask.subject, matchingTask.minutes, completedCount, tasks.length, context.user.display_name));
    return;
  }
  if (command.includes("今天讀什麼") || command.includes("今日任務")) {
    await reply(event.replyToken, tasks.length ? `📚 今天推薦\n${taskLines(tasks, completed)}\n\n弱科優先：${plan.weak_subject}。先完成第一項就很棒！` : "今天還沒有任務。請先在文昌同行建立或調整你的學習計畫。");
    return;
  }
  if (command.includes("只有") || command.includes("剩") || command.includes("小時") || command.includes("分鐘")) {
    const selected = oneHourPlan(tasks, completed, command);
    await reply(event.replyToken, `⏱ 精簡版安排\n${selected.map((task, index) => `${index + 1}. ${task.subject} ${task.minutes} 分鐘｜${task.task_type}`).join("\n")}\n\n今天不用一次完成全部，先完成這份安排就好。`);
    return;
  }
  if (command.includes("查看進度") || command.includes("我的進度") || command === "進度") {
    const done = tasks.filter((task) => completed.has(task.id));
    const minutes = done.reduce((sum, task) => sum + task.minutes, 0);
    const nextStep = done.length === tasks.length && tasks.length ? "今天的任務已圓滿完成，記得好好休息！" : `下一步：${tasks.find((task) => !completed.has(task.id))?.subject ?? "保持節奏"}`;
    await reply(event.replyToken, `📈 今日進度\n完成 ${done.length}/${tasks.length} 項任務・累積 ${minutes} 分鐘\n\n${nextStep}`);
    return;
  }
  if (command.includes("鼓勵") || command.includes("籤") || command.includes("加油")) {
    const done = tasks.filter((task) => completed.has(task.id)).length;
    const message = done === tasks.length && tasks.length ? "今日任務已完成。穩定累積的你，正在靠近目標。" : done ? "你已經開始前進了；把下一個小任務完成，就是今天最踏實的進步。" : `先從 ${plan.weak_subject} 的 15 分鐘開始。積跬步以至千里，今天的努力會留下力量。`;
    await reply(event.replyToken, `🌕 今日鼓勵\n${message}`);
    return;
  }
  await reply(event.replyToken, helpText());
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!(await signatureIsValid(rawBody, request.headers.get("x-line-signature")))) return new Response("Unauthorized", { status: 401 });
  try {
    const body = JSON.parse(rawBody) as { events?: LineEvent[] };
    await Promise.all((body.events ?? []).map((event) => answer(event)));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("LINE webhook failed", error);
    return Response.json({ ok: true });
  }
}
