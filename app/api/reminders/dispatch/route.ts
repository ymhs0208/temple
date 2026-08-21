import { supabaseAdmin } from "@/lib/supabase-admin";
import { taipeiDate } from "@/lib/taipei-date";
import { buildReminderFlex } from "@/lib/line-reminder";

type Preference = {
  user_id: string;
  morning_time: string;
  evening_time: string;
  timezone: string;
};

const timeAt = (timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (kind: "hour" | "minute") =>
    parts.find((part) => part.type === kind)?.value ?? "00";
  return `${value("hour")}:${value("minute")}`;
};

const dateAt = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());

export async function POST(request: Request) {
  const accessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
  if (!accessToken || request.headers.get("authorization") !== `Bearer ${accessToken}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = supabaseAdmin();
    const { data: preferences, error } = await db
      .from("user_preferences")
      .select("user_id, morning_time, evening_time, timezone")
      .eq("notifications_enabled", true);
    if (error) throw error;

    let sent = 0;
    for (const preference of (preferences ?? []) as Preference[]) {
      const timezone = preference.timezone || "Asia/Taipei";
      const now = timeAt(timezone);
      const kind = preference.morning_time.slice(0, 5) === now
        ? "morning"
        : preference.evening_time.slice(0, 5) === now
          ? "evening"
          : null;
      if (!kind) continue;

      const { data: user, error: userError } = await db
        .from("users")
        .select("id, line_user_id, display_name")
        .eq("id", preference.user_id)
        .maybeSingle();
      if (userError || !user?.line_user_id) continue;

      const { data: plan } = await db.from("study_plans").select("id").eq("user_id", preference.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!plan) continue;
      const { data: tasks } = await db.from("daily_tasks").select("id, subject, minutes, sort_order").eq("plan_id", plan.id).eq("task_date", taipeiDate()).order("sort_order");
      if (!tasks?.length) continue;
      const { data: completions } = await db.from("task_completions").select("task_id").eq("user_id", preference.user_id).in("task_id", tasks.map((task) => task.id));
      const done = new Set((completions ?? []).map((item) => item.task_id));
      const pending = tasks.filter((task) => !done.has(task.id));

      const { data: delivery, error: deliveryError } = await db
        .from("line_notification_deliveries")
        .insert({ user_id: preference.user_id, reminder_kind: kind, scheduled_for: dateAt(timezone) })
        .select("id")
        .maybeSingle();
      if (deliveryError || !delivery) continue;

      const response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ to: user.line_user_id, messages: [buildReminderFlex({ kind, displayName: user.display_name, tasks, pending })] }),
      });
      if (response.ok) sent += 1;
      else await db.from("line_notification_deliveries").delete().eq("id", delivery.id);
    }
    return Response.json({ ok: true, sent });
  } catch (error) {
    console.error("Scheduled LINE reminder failed", error);
    return Response.json({ error: "Dispatch failed" }, { status: 500 });
  }
}
