import { supabaseAdmin } from "@/lib/supabase-admin";
import { taipeiDate } from "@/lib/taipei-date";
import { learningUrl } from "@/lib/line-reminder";

type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type?: string; text?: string };
  postback?: { data?: string };
};

type Task = { id: string; subject: string; minutes: number; task_type: string };
type QuickReply = { label: string; text?: string; data?: string };

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

async function replyTextWithQuickReplies(replyToken: string, text: string, items: QuickReply[]) {
  const accessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
  if (!accessToken) throw new Error("LINE Messaging API is not configured");
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text: text.slice(0, 4900), quickReply: { items: items.slice(0, 13).map((item) => ({ type: "action", action: item.data ? { type: "postback", label: item.label, data: item.data, displayText: item.label } : { type: "message", label: item.label, text: item.text ?? item.label } })) } }] }),
  });
}

async function replyFlex(replyToken: string, title: string, intro: string, tasks: Task[], quickReplies: QuickReply[] = [], allowCompletion = true) {
  const accessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
  if (!accessToken) throw new Error("LINE Messaging API is not configured");
  const bubble = {
    type: "bubble",
    header: { type: "box", layout: "vertical", backgroundColor: "#287C64", paddingAll: "18px", contents: [
      { type: "text", text: "文昌同行・AI 學習教練", size: "xs", color: "#DDF5E8" },
      { type: "text", text: title, size: "xl", weight: "bold", color: "#FFFFFF", margin: "sm" },
    ] },
    body: { type: "box", layout: "vertical", spacing: "md", paddingAll: "18px", contents: [
      { type: "text", text: intro, size: "sm", color: "#40536B", wrap: true },
      ...tasks.slice(0, 5).map((task) => ({ type: "box", layout: "horizontal", spacing: "sm", alignItems: "center", contents: [
        { type: "text", text: task.subject, flex: 1, size: "sm", color: "#243B53", wrap: true },
        { type: "text", text: `${task.minutes} 分鐘`, size: "xs", color: "#287C64", weight: "bold", align: "end" },
        ...(allowCompletion ? [{ type: "button", style: "link", height: "sm", action: { type: "postback", label: "完成", data: `action=complete&taskId=${task.id}`, displayText: `完成${task.subject}` } }] : []),
      ] })),
    ] },
    footer: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "14px", contents: [
      { type: "button", style: "primary", color: "#287C64", action: { type: "uri", label: "開始今天學習", uri: learningUrl("/today") } },
      { type: "button", style: "link", action: { type: "uri", label: "查看完整進度", uri: learningUrl("/progress") } },
    ] },
  };
  const message: Record<string, unknown> = { type: "flex", altText: `${title}・${intro}`.slice(0, 400), contents: bubble };
  if (quickReplies.length) message.quickReply = { items: quickReplies.slice(0, 13).map((item) => ({ type: "action", action: item.data ? { type: "postback", label: item.label, data: item.data, displayText: item.label } : { type: "message", label: item.label, text: item.text ?? item.label } })) };
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ replyToken, messages: [message] }),
  });
}

async function saveConversationState(userId: string | undefined, state: string, payload: Record<string, unknown> = {}) {
  if (!userId) return;
  try {
    await supabaseAdmin().from("line_conversation_states").upsert({ line_user_id: userId, state, payload, updated_at: new Date().toISOString() }, { onConflict: "line_user_id" });
  } catch (error) {
    console.warn("LINE conversation state was not saved", error);
  }
}

async function conversationState(userId: string | undefined) {
  if (!userId) return null;
  try {
    const { data } = await supabaseAdmin().from("line_conversation_states").select("state, payload").eq("line_user_id", userId).maybeSingle();
    return data as { state?: string; payload?: Record<string, unknown> } | null;
  } catch {
    return null;
  }
}

async function replyCompletion(replyToken: string, subject: string, completedCount: number, totalCount: number, completedMinutes: number, nextTask?: Task) {
  const finished = totalCount > 0 && completedCount >= totalCount;
  await replyFlex(replyToken, finished ? "今日學習完成證明" : "完成一項，繼續累積", finished
    ? `🎉 ${subject} 已完成！\n今日完成率 100%・累積 ${completedMinutes} 分鐘\n\n🏅 解鎖成就：今日全勤\n你已完成今天的學習承諾，明天再一起前進。`
    : `✅ ${subject} 已完成！\n今日完成 ${completedCount}/${totalCount} 項・累積 ${completedMinutes} 分鐘${nextTask ? `\n下一步建議：${nextTask.subject} ${nextTask.minutes} 分鐘` : ""}`,
    nextTask ? [nextTask] : [], [
    ...(nextTask ? [{ label: `開始${nextTask.subject}`, data: `action=start&taskId=${nextTask.id}` }] : []),
    { label: "休息一下", text: "休息一下" },
    { label: "查看成果", text: "查看進度" },
    { label: "今日祈福", text: "祈福" },
    { label: "開始巡禮", text: "巡禮" },
  ], false);
}

async function replyProgress(replyToken: string, doneCount: number, totalCount: number, minutes: number, nextTask?: Task) {
  const rate = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  await replyFlex(replyToken, "你的今日進度", `完成率 ${rate}%\n已完成 ${doneCount}/${totalCount} 項・累積 ${minutes} 分鐘${nextTask ? `\n下一步：${nextTask.subject} ${nextTask.minutes} 分鐘` : "\n今天任務已全部完成，辛苦了！"}`, nextTask ? [nextTask] : [], [
    ...(nextTask ? [{ label: `開始${nextTask.subject}`, data: `action=start&taskId=${nextTask.id}` }] : []),
    { label: "今天讀什麼", text: "今天讀什麼" },
    { label: "查看網站進度", text: "查看進度" },
  ], false);
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
  return "我是文昌同行學習軍師 ✦\n\n你可以直接傳：\n・今天讀什麼\n・完成英文\n・完成數學\n・我只有一小時\n・查看進度\n・給我一句鼓勵";
}

async function answer(event: LineEvent) {
  if (!event.replyToken) return;
  const postback = event.type === "postback" ? new URLSearchParams(event.postback?.data ?? "") : null;
  if (postback?.get("action") === "start") {
    await saveConversationState(event.source?.userId, "focus_started", { taskId: postback.get("taskId") });
    await reply(event.replyToken, "專注已準備好 ✦\n請在網站開啟倒數，完成後回到 LINE 點選完成任務。\n" + learningUrl("/today"));
    return;
  }
  if (event.type !== "message" || event.message?.type !== "text") {
    if (postback?.get("action") !== "complete") return;
  }
  const command = event.message?.text?.trim().replace(/\s+/g, "") ?? "";
  const context = await learningContext(event.source?.userId);
  if (!context || !context.plan) {
    await reply(event.replyToken, "歡迎來到文昌同行 ✦\n請先開啟 LIFF 建立學習計畫，之後我就能依你的任務提供建議。\n\n" + helpText());
    return;
  }
  const { tasks, completed, plan } = context;
	const state = await conversationState(event.source?.userId);
	const asksForTime = /幫我安排|幫我排|我只有幾分鐘|不知道讀什麼|怎麼安排/.test(command) && !/\d+\s*(小時|分鐘|分)/.test(command);
	if (asksForTime || state?.state === "awaiting_time") {
		await saveConversationState(event.source?.userId, "awaiting_time", { prompt: "請提供今天可用的學習時間" });
		await replyTextWithQuickReplies(event.replyToken, "可以，今天你有多少時間？我會依未完成任務幫你排好順序。", [
			{ label: "15 分鐘", text: "我有 15 分鐘" },
			{ label: "30 分鐘", text: "我有 30 分鐘" },
			{ label: "1 小時", text: "我有 1 小時" },
		]);
		return;
	}
	const completionMatch = postback?.get("action") === "complete" ? null : command.match(/^(?:我)?(?:已)?(?:完成|打卡)(.+)$/);
	const requestedTaskId = postback?.get("taskId");
	if (requestedTaskId || completionMatch) {
		const requestedSubject = completionMatch?.[1].replace(/(任務|作業|了|啦)$/g, "") ?? "";
		const target = tasks.find((task) => !completed.has(task.id) && (requestedTaskId ? task.id === requestedTaskId : task.subject.replace(/\s+/g, "").includes(requestedSubject)));
		if (!target) {
			await reply(event.replyToken, requestedTaskId ? "這項任務已完成或已經過期。傳「今天讀什麼」可查看最新任務。" : `找不到尚未完成的「${requestedSubject}」任務。\n\n傳「今天讀什麼」可查看目前任務。`);
			return;
		}
		const db = supabaseAdmin();
		const { error } = await db.from("task_completions").upsert({ task_id: target.id, user_id: context.user.id }, { onConflict: "task_id,user_id" });
		if (error) throw error;
		const completedCount = completed.size + 1;
		const completedMinutes = tasks.filter((task) => completed.has(task.id) || task.id === target.id).reduce((sum, task) => sum + task.minutes, 0);
		const nextTask = tasks.find((task) => !completed.has(task.id) && task.id !== target.id);
		await saveConversationState(event.source?.userId, "after_task_complete", { taskId: target.id, nextTaskId: nextTask?.id ?? null });
		await replyCompletion(event.replyToken, target.subject, completedCount, tasks.length, completedMinutes, nextTask);
		return;
	}
  if (command.includes("今天讀什麼") || command.includes("今日任務")) {
    await saveConversationState(event.source?.userId, "viewing_today_tasks");
    if (tasks.length) await replyFlex(event.replyToken, "今天，從一件事開始", `弱科優先：${plan.weak_subject}。先完成第一項就很棒！`, tasks.filter((task) => !completed.has(task.id)), [
      { label: "我有 15 分鐘", text: "我有 15 分鐘" },
      { label: "我有 30 分鐘", text: "我有 30 分鐘" },
      { label: "我只有一小時", text: "我只有一小時" },
      { label: "查看進度", text: "查看進度" },
    ]);
    else await reply(event.replyToken, "今天還沒有任務。請先在文昌同行建立或調整你的學習計畫。");
    return;
  }
  if (command.includes("只有") || command.includes("剩") || command.includes("小時") || command.includes("分鐘")) {
    await saveConversationState(event.source?.userId, "planning_time", { source: command });
    const selected = oneHourPlan(tasks, completed, command);
    await replyFlex(event.replyToken, "為你排好這段時間", "今天不用一次完成全部，先完成這份安排就好。完成後可直接點卡片下方的「完成」按鈕。", selected, [
      { label: "查看進度", text: "查看進度" },
      { label: "我有更多時間", text: "我有一小時" },
    ]);
    return;
  }
  if (command.includes("查看進度") || command.includes("我的進度") || command === "進度") {
    const done = tasks.filter((task) => completed.has(task.id));
    const minutes = done.reduce((sum, task) => sum + task.minutes, 0);
    const nextTask = tasks.find((task) => !completed.has(task.id));
    await saveConversationState(event.source?.userId, "viewing_progress", { completedCount: done.length });
    await replyProgress(event.replyToken, done.length, tasks.length, minutes, nextTask);
    return;
  }
  if (command.includes("祈福")) {
    await reply(event.replyToken, `🌸 今日祈福\n完成學習後，也可以留下一句祝福或抽一支學習籤。\n\n開啟祈福頁：${learningUrl("/prayer")}`);
    return;
  }
  if (command.includes("巡禮") || command.includes("宮廟")) {
    await reply(event.replyToken, `⛩ 文昌巡禮\n掃描現場 QR Code，解鎖宮廟故事與學習成就。\n\n開始巡禮：${learningUrl("/pilgrimage")}`);
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
