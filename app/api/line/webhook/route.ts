import { buildStampFlex, buildStudyAchievementFlex } from "@/lib/line-achievements";
import { readAchievementRecords } from "@/lib/achievement-records";
import { buildPilgrimageFlex, isPilgrimageCommand } from "@/lib/line-pilgrimage";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { taipeiDate } from "@/lib/taipei-date";
import { learningUrl, flexHeader, flexTaskRow } from "@/lib/line-reminder";

type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: { userId?: string; type?: string };
  message?: { type?: string; text?: string };
  postback?: { data?: string };
};

type Task = { id: string; subject: string; minutes: number; task_type: string };
type QuickReply = { label: string; text?: string; data?: string };

const today = () => taipeiDate();

async function updateReminderChoice(lineUserId: string | undefined, action: "snooze" | "pause", minutes = 30, kind: "morning" | "evening" = "morning") {
  if (!lineUserId) return false;
  const db = supabaseAdmin();
  const { data: user } = await db.from("users").select("id").eq("line_user_id", lineUserId).maybeSingle();
  if (!user) return false;
  const values = action === "pause"
    ? { reminders_paused_until: today(), reminder_snoozed_until: null, reminder_snoozed_kind: null }
    : { reminder_snoozed_until: new Date(Date.now() + minutes * 60_000).toISOString(), reminders_paused_until: null, reminder_snoozed_kind: kind };
  const { error } = await db.from("user_preferences").upsert({ user_id: user.id, ...values }, { onConflict: "user_id" });
  if (error) throw error;
  return true;
}

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

function parseNewTaskCommand(command: string) {
  const match = command.match(/^(?:新增|加入|建立)(?:任務)?(.+?)(\d{1,3})(?:分鐘|分|min)$/i);
  if (!match) return null;
  const subject = match[1].replace(/^(?:今天|今日)/, "").trim();
  const minutes = Number(match[2]);
  if (!subject || !Number.isInteger(minutes) || minutes < 1 || minutes > 180) return null;
  return { subject: subject.slice(0, 40), minutes };
}

async function replyNewTaskConfirmation(replyToken: string, subject: string, minutes: number) {
  const accessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
  if (!accessToken) throw new Error("LINE Messaging API is not configured");
  const message = {
    type: "flex", altText: `確認新增任務：${subject} ${minutes} 分鐘`,
    contents: {
      type: "bubble", size: "mega",
      header: flexHeader("新增一小步", "#245747", "今日學習安排"),
      body: { type: "box", layout: "vertical", spacing: "md", paddingAll: "24px", contents: [
        { type: "text", text: "要把這件事放進今天的學習清單嗎？", size: "sm", color: "#53645D", wrap: true },
        { type: "box", layout: "vertical", spacing: "xs", margin: "lg", paddingAll: "16px", backgroundColor: "#F5F1E8", cornerRadius: "12px", contents: [
          { type: "text", text: subject, size: "xl", weight: "bold", color: "#245747", wrap: true },
          { type: "text", text: `${minutes} 分鐘・今天`, size: "sm", color: "#AA5146" },
        ] },
        { type: "text", text: "確認後會新增到今日任務最後一項，不會覆蓋原本安排。", size: "xs", color: "#788279", wrap: true, margin: "lg" },
      ] },
      footer: { type: "box", layout: "horizontal", spacing: "sm", paddingAll: "24px", paddingTop: "0px", contents: [
        { type: "button", style: "primary", color: "#245747", flex: 2, action: { type: "postback", label: "確認新增", data: `action=add_task_confirm&subject=${encodeURIComponent(subject)}&minutes=${minutes}`, displayText: "確認新增任務" } },
        { type: "button", style: "secondary", color: "#EEE9DF", flex: 1, action: { type: "postback", label: "取消", data: "action=add_task_cancel", displayText: "取消新增" } },
      ] },
    },
  };
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ replyToken, messages: [message] }),
  });
}

async function replyFlex(replyToken: string, title: string, intro: string, tasks: Task[], quickReplies: QuickReply[] = [], allowCompletion = true) {
  const accessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
  if (!accessToken) throw new Error("LINE Messaging API is not configured");
  const bubble = {
    type: "bubble",
    size: "mega",
    header: flexHeader(title, "#245747", "AI 學習教練"),
    body: { type: "box", layout: "vertical", spacing: "md", paddingAll: "24px", contents: [
      { type: "text", text: intro, size: "sm", color: "#53645D", wrap: true },
      ...tasks.slice(0, 5).map((task, index) => ({ type: "box", layout: "vertical", spacing: "sm", contents: [
        flexTaskRow(task, index, "#245747"),
        ...(allowCompletion ? [{ type: "button", style: "link", color: "#245747", height: "sm", action: { type: "postback", label: `完成第 ${index + 1} 項`, data: `action=complete&taskId=${task.id}`, displayText: `完成${task.subject}` } }] : []),
      ] })),
      ...(tasks.length > 5 ? [{ type: "text", text: "更多任務請至今日學習查看", size: "xs", color: "#7B857F", wrap: true }] : []),
    ] },
    footer: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "24px", paddingTop: "0px", contents: [
      { type: "button", style: "primary", color: "#245747", action: { type: "uri", label: "開始今天學習", uri: learningUrl("/today") } },
      { type: "button", style: "link", color: "#62726B", height: "sm", action: { type: "uri", label: "查看完整進度", uri: learningUrl("/progress") } },
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
    { label: "學習成就", text: "連續學習成就" },
    { label: "集章卡", text: "巡禮集章卡" },
    { label: "新增任務", text: "新增任務" },
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
    { label: "學習成就", text: "連續學習成就" },
    { label: "新增任務", text: "新增任務" },
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
  return "我是文昌同行學習軍師 ✦\n\n你可以直接傳：\n・今天讀什麼\n・新增英文 30 分鐘\n・完成英文\n・我只有一小時\n・查看進度\n・給我一句鼓勵\n・七媽巡禮（七關地點與導航）\n・巡禮集章卡\n・連續學習成就";
}

const menuReplies: QuickReply[] = [
  { label: "今天讀什麼", text: "今天讀什麼" },
  { label: "新增任務", text: "新增任務" },
  { label: "查看進度", text: "查看進度" },
  { label: "我有 30 分鐘", text: "我有 30 分鐘" },
  { label: "學習成就", text: "連續學習成就" },
  { label: "巡禮集章卡", text: "巡禮集章卡" },
];

async function answer(event: LineEvent) {
  if (!event.replyToken) return;
  const postback = event.type === "postback" ? new URLSearchParams(event.postback?.data ?? "") : null;
  if (postback?.get("action") === "add_task_cancel") {
    await replyTextWithQuickReplies(event.replyToken, "已取消，今天的學習安排沒有變動。", [
      { label: "今天讀什麼", text: "今天讀什麼" },
      { label: "新增任務", text: "新增任務" },
    ]);
    return;
  }
  if (postback?.get("action") === "snooze_reminder" || postback?.get("action") === "pause_reminders") {
    try {
      const paused = postback.get("action") === "pause_reminders";
      const reminderKind = postback.get("kind") === "evening" ? "evening" : "morning";
      const updated = await updateReminderChoice(event.source?.userId, paused ? "pause" : "snooze", Number(postback.get("minutes")) || 30, reminderKind);
      await reply(event.replyToken, updated
        ? (paused ? "今天的提醒已暫停 🌙\n明天會自動恢復，不影響你的學習紀錄。" : "好的，提醒會在 30 分鐘後再回來 ✦\n今天的學習安排不會變動。")
        : "找不到已連結的學習帳號，請先從 LIFF 登入並同步一次。");
    } catch (error) {
      console.error("Unable to update reminder choice", error);
      await reply(event.replyToken, "提醒設定暫時無法更新，請稍後再試。你原本的提醒設定沒有被清除。");
    }
    return;
  }
  if (postback?.get("action") === "start") {
    await saveConversationState(event.source?.userId, "focus_started", { taskId: postback.get("taskId") });
    await reply(event.replyToken, "專注已準備好 ✦\n請在網站開啟倒數，完成後回到 LINE 點選完成任務。\n" + learningUrl("/today"));
    return;
  }
  if (event.type !== "message" || event.message?.type !== "text") {
    if (postback?.get("action") !== "complete") return;
  }
  const originalCommand = event.message?.text?.trim() ?? "";
  const command = originalCommand.replace(/\s+/g, "");
  const achievementKind = /集章|印章|巡禮卡/.test(command) ? "stamps" : /連續學習|學習成就|我的成就|學習徽章/.test(command) ? "study" : null;
  if (achievementKind) {
    if (!event.source?.userId || (event.source.type && event.source.type !== "user")) {
      await reply(event.replyToken, "請在與官方帳號的一對一聊天室查看個人成就。");
      return;
    }
    try {
      const records = await readAchievementRecords(event.source.userId, achievementKind);
      if (!records) {
        await reply(event.replyToken, "先登入並同步紀錄，就能開啟你的專屬收藏卡。\n" + learningUrl(achievementKind === "stamps" ? "/pilgrimage" : "/today"));
        return;
      }
      const accessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
      if (!accessToken) throw new Error("LINE Messaging API is not configured");
      const response = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ replyToken: event.replyToken, messages: [achievementKind === "stamps" ? buildStampFlex(records) : buildStudyAchievementFlex(records)] }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Achievement reply failed: ${response.status}`);
    } catch (error) {
      console.error("Achievement card unavailable", error);
      await reply(event.replyToken, "收藏卡暫時無法載入，請稍後再試。你的紀錄不受影響。");
    }
    return;
  }
  if (isPilgrimageCommand(command)) {
    const accessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
    if (!accessToken) throw new Error("LINE Messaging API is not configured");
    const response = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ replyToken: event.replyToken, messages: [buildPilgrimageFlex()] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Pilgrimage reply failed: ${response.status}`);
    return;
  }
  const context = await learningContext(event.source?.userId);
  if (!context || !context.plan) {
    await reply(event.replyToken, "歡迎來到文昌同行 ✦\n請先開啟 LIFF 建立學習計畫，之後我就能依你的任務提供建議。\n\n" + helpText());
    return;
  }
  const { tasks, completed, plan } = context;
	const state = await conversationState(event.source?.userId);
	const addTask = parseNewTaskCommand(command);
	if (postback?.get("action") === "add_task_confirm") {
		const subject = postback.get("subject")?.trim() ?? "";
		const minutes = Number(postback.get("minutes"));
		if (!subject || !Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
			await reply(event.replyToken, "這筆新增任務資料已失效，請重新傳「新增英文 30 分鐘」。");
			return;
		}
		const sortOrder = tasks.reduce((max, task) => Math.max(max, Number((task as Task & { sort_order?: number }).sort_order ?? -1)), -1) + 1;
		const { data: inserted, error } = await supabaseAdmin().from("daily_tasks").insert({
			plan_id: plan.id, task_date: today(), subject, minutes, task_type: "LINE 新增", sort_order: sortOrder,
		}).select("id, subject, minutes, task_type").single();
		if (error || !inserted) {
			console.error("LINE task creation failed", error);
			await reply(event.replyToken, "任務暫時無法新增，請稍後再試；原本的安排沒有變動。");
			return;
		}
		await saveConversationState(event.source?.userId, "task_added", { taskId: inserted.id });
		await replyFlex(event.replyToken, "任務已加入今天", `已把「${subject}」放進今日清單，完成後可直接在 LINE 打卡。`, [inserted], [
			{ label: "查看今日任務", text: "今天讀什麼" },
			{ label: "查看進度", text: "查看進度" },
		], false);
		return;
	}
	if (addTask) {
		await saveConversationState(event.source?.userId, "confirming_task_add", addTask);
		await replyNewTaskConfirmation(event.replyToken, addTask.subject, addTask.minutes);
		return;
	}
	if (/^(?:新增|加入|建立)(?:任務)?$/.test(command)) {
		await saveConversationState(event.source?.userId, "awaiting_task_details");
		await replyTextWithQuickReplies(event.replyToken, "請用這個格式告訴我：新增科目＋分鐘\n例如：新增英文 30 分鐘", [
			{ label: "新增英文 30 分鐘", text: "新增英文 30 分鐘" },
			{ label: "新增數學 45 分鐘", text: "新增數學 45 分鐘" },
		]);
		return;
	}
	const asksForTime = /幫我安排|幫我排|我只有幾分鐘|不知道讀什麼|怎麼安排/.test(command) && !/\d+(?:\.\d+)?\s*(小時|分鐘|分)/.test(command);
	if (asksForTime) {
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
  if (/今天讀什麼|今日任務|今天安排|今日安排|待辦/.test(command)) {
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
  if (/查看進度|我的進度|完成幾項|完成率|進度/.test(command)) {
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
  if (/鼓勵|籤|加油|打氣|累了|好累/.test(command)) {
    const done = tasks.filter((task) => completed.has(task.id)).length;
    const message = done === tasks.length && tasks.length ? "今日任務已完成。穩定累積的你，正在靠近目標。" : done ? "你已經開始前進了；把下一個小任務完成，就是今天最踏實的進步。" : `先從 ${plan.weak_subject} 的 15 分鐘開始。積跬步以至千里，今天的努力會留下力量。`;
    await reply(event.replyToken, `🌕 今日鼓勵\n${message}`);
    return;
  }
  await replyTextWithQuickReplies(event.replyToken, `我收到「${originalCommand.slice(0, 80)}」，目前可以幫你安排學習、查看進度或管理巡禮。\n\n${helpText()}`, menuReplies);
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
