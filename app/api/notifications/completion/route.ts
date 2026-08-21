import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { taipeiDate } from "@/lib/taipei-date";

type CompletionRequest = {
  idToken?: string;
  subject?: string;
  minutes?: number;
  completedCount?: number;
  totalCount?: number;
  taskIndex?: number;
};

function completionMessage(subject: string, minutes: number, completedCount: number, totalCount: number, displayName: string | null) {
  const name = displayName ? `${displayName}，` : "";
  if (completedCount >= totalCount) {
    return `🎉 ${name}${subject}也完成了！\n\n今天安排的 ${totalCount} 項任務已全部完成。把這份完成感留給自己，現在可以安心休息了。`;
  }
  const remaining = totalCount - completedCount;
  const encouragement = completedCount === 1
    ? "有開始就很不容易，今天已經踏出第一步。"
    : "穩穩完成一項又一項，你正在靠近自己的目標。";
  return `✅ ${name}${subject}完成了！\n這次專注了 ${minutes} 分鐘，今日進度 ${completedCount}/${totalCount}，還剩 ${remaining} 項。\n\n${encouragement}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CompletionRequest;
    if (!body.idToken || !body.subject || !Number.isInteger(body.minutes) || !Number.isInteger(body.completedCount) || !Number.isInteger(body.totalCount) || !Number.isInteger(body.taskIndex))
      return Response.json({ error: "Invalid completion data" }, { status: 400 });

    const identity = await verifyLineIdToken(body.idToken);
    const db = supabaseAdmin();
    const { data: user, error: userError } = await db
      .from("users")
      .select("id, display_name, line_user_id")
      .eq("line_user_id", identity.userId)
      .maybeSingle();
    if (userError) throw userError;
    if (!user?.line_user_id) return Response.json({ error: "No linked LINE account" }, { status: 404 });

    const { data: plan, error: planError } = await db
      .from("study_plans")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan) return Response.json({ error: "No study plan" }, { status: 404 });

    const { data: tasks, error: taskError } = await db
      .from("daily_tasks")
      .select("subject, minutes")
      .eq("plan_id", plan.id)
      .eq("task_date", taipeiDate())
      .order("sort_order");
    if (taskError) throw taskError;
    const storedTask = tasks?.[body.taskIndex];
    if (!storedTask || storedTask.subject !== body.subject || storedTask.minutes !== body.minutes || body.totalCount !== tasks?.length || body.completedCount < 1 || body.completedCount > body.totalCount)
      return Response.json({ error: "Completion does not match today's tasks" }, { status: 400 });

    const accessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
    if (!accessToken) throw new Error("LINE Messaging API is not configured");
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        to: user.line_user_id,
        messages: [{ type: "text", text: completionMessage(body.subject, body.minutes, body.completedCount, body.totalCount, user.display_name) }],
      }),
    });
    if (!response.ok) throw new Error(`LINE push failed: ${response.status}`);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("LINE completion notification failed", error);
    return Response.json({ error: "Unable to send completion notification" }, { status: 500 });
  }
}
