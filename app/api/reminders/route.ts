import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { taipeiDate } from "@/lib/taipei-date";
import { buildReminderFlex } from "@/lib/line-reminder";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      idToken?: string;
      kind?: "morning" | "evening";
    };
    if (!body.idToken || !["morning", "evening"].includes(body.kind ?? ""))
      return Response.json({ error: "資料不完整" }, { status: 400 });
    const accessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
    if (!accessToken) throw new Error("LINE OA 尚未設定");
    const identity = await verifyLineIdToken(body.idToken);
    const db = supabaseAdmin();
    const { data: user } = await db
      .from("users")
      .select("id")
      .eq("line_user_id", identity.userId)
      .maybeSingle();
    if (!user)
      return Response.json({ error: "請先建立學習計畫" }, { status: 404 });
    const { data: preference } = await db
      .from("user_preferences")
      .select("notifications_enabled")
      .eq("user_id", user.id)
      .maybeSingle();
    if (preference && !preference.notifications_enabled) {
      return Response.json({ error: "Notifications are disabled" }, { status: 403 });
    }
    const { data: plan } = await db
      .from("study_plans")
      .select("id, weak_subject, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!plan)
      return Response.json({ error: "找不到學習計畫" }, { status: 404 });
    const date = taipeiDate();
    const { data: tasks } = await db
      .from("daily_tasks")
      .select("id, subject, minutes, sort_order")
      .eq("plan_id", plan.id)
      .eq("task_date", date)
      .order("sort_order");
    if (!tasks?.length)
      return Response.json({ error: "今天尚未建立任務" }, { status: 404 });
    const { data: completions } = await db
      .from("task_completions")
      .select("task_id")
      .eq("user_id", user.id)
      .in(
        "task_id",
        tasks.map((task) => task.id),
      );
    const done = new Set(completions?.map((item) => item.task_id));
    const pending = tasks.filter((task) => !done.has(task.id));
    if (body.kind === "evening" && !pending.length) return Response.json({ ok: true, skipped: true });
    const dayNumber = plan.created_at ? Math.max(1, Math.floor((Date.now() - new Date(plan.created_at).getTime()) / 86400000) + 1) : undefined;
    const completionRate = tasks.length ? Math.round((done.size / tasks.length) * 100) : 0;
    const push = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: identity.userId,
        messages: [buildReminderFlex({ kind: body.kind!, displayName: identity.displayName, tasks, pending, dayNumber, weakSubject: plan.weak_subject, completionRate })],
      }),
    });
    if (!push.ok) throw new Error("LINE OA 推播失敗");
    return Response.json({ ok: true });
  } catch (error) {
    console.error("reminder failed", error);
    return Response.json(
      { error: "提醒發送失敗，請確認已加 OA 好友。" },
      { status: 500 },
    );
  }
}
