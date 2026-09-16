import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildReminderFlex, buildWeeklyFlex } from "@/lib/line-reminder";
import { weeklyLearning } from "@/lib/weekly-learning";

type Preference = {
  user_id: string;
  morning_time: string;
  evening_time: string;
  timezone: string;
  morning_enabled: boolean;
  evening_enabled: boolean;
  weekly_enabled: boolean;
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
      .select("user_id, morning_time, evening_time, timezone, morning_enabled, evening_enabled, weekly_enabled")
      .eq("notifications_enabled", true);
    if (error) throw error;

    let sent = 0;
    for (const preference of (preferences ?? []) as Preference[]) {
      const timezone = preference.timezone || "Asia/Taipei";
      const now = timeAt(timezone);
      const weekly = preference.weekly_enabled && new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(new Date()) === "Sun";
      const kind = preference.morning_enabled && preference.morning_time.slice(0, 5) === now
        ? "morning"
        : (preference.evening_enabled || weekly) && preference.evening_time.slice(0, 5) === now
          ? "evening"
          : null;
      if (!kind) continue;

      const { data: user, error: userError } = await db
        .from("users")
        .select("id, line_user_id, display_name")
        .eq("id", preference.user_id)
        .maybeSingle();
      if (userError || !user?.line_user_id) continue;

      const { data: plan } = await db.from("study_plans").select("id, weak_subject, created_at").eq("user_id", preference.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!plan) continue;
      const summary = kind === "evening" && weekly ? await weeklyLearning(preference.user_id, dateAt(timezone)) : null;
      const { data: tasks, error: tasksError } = await db.from("daily_tasks").select("id, subject, minutes, sort_order").eq("plan_id", plan.id).eq("task_date", dateAt(timezone)).order("sort_order");
      if (tasksError) throw tasksError;
      if (!tasks?.length && !summary) continue;
      const todayTasks = tasks ?? [];
      const { data: completions, error: completionsError } = todayTasks.length ? await db.from("task_completions").select("task_id").eq("user_id", preference.user_id).in("task_id", todayTasks.map((task) => task.id)) : { data: [], error: null };
      if (completionsError) throw completionsError;
      const done = new Set((completions ?? []).map((item) => item.task_id));
      const pending = todayTasks.filter((task) => !done.has(task.id));
      if (!summary && (kind === "evening" && (!preference.evening_enabled || !pending.length))) continue;
      const dayNumber = plan.created_at ? Math.max(1, Math.floor((Date.now() - new Date(plan.created_at).getTime()) / 86400000) + 1) : undefined;
      const completionRate = todayTasks.length ? Math.round((done.size / todayTasks.length) * 100) : 0;
      const message = summary ? buildWeeklyFlex(summary) : buildReminderFlex({ kind, displayName: user.display_name, tasks: todayTasks, pending, dayNumber, completionRate });

      const { data: delivery, error: deliveryError } = await db
        .from("line_notification_deliveries")
        .insert({ user_id: preference.user_id, reminder_kind: kind, scheduled_for: dateAt(timezone) })
        .select("id")
        .maybeSingle();
      if (deliveryError || !delivery) continue;

      const response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}`, "X-Line-Retry-Key": delivery.id },
        body: JSON.stringify({ to: user.line_user_id, messages: [message] }),
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
