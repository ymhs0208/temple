import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };
    if (!idToken)
      return Response.json({ error: "Missing identity" }, { status: 400 });
    const identity = await verifyLineIdToken(idToken);
    const db = supabaseAdmin();
    const { data: user } = await db
      .from("users")
      .select("id")
      .eq("line_user_id", identity.userId)
      .maybeSingle();
    if (!user)
      return Response.json({ weeklyMinutes: 0, streakDays: 0, activeDays: 0, days: [] });
    const { data: plan } = await db
      .from("study_plans")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!plan)
      return Response.json({ weeklyMinutes: 0, streakDays: 0, activeDays: 0, days: [] });
    const today = new Date();
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 89);
    const { data: tasks, error } = await db
      .from("daily_tasks")
      .select("id, minutes, task_date")
      .eq("plan_id", plan.id)
      .gte("task_date", isoDate(start))
      .lte("task_date", isoDate(today));
    if (error || !tasks?.length)
      return Response.json({ weeklyMinutes: 0, streakDays: 0, activeDays: 0, days: [] });
    const { data: completions } = await db
      .from("task_completions")
      .select("task_id")
      .eq("user_id", user.id)
      .in(
        "task_id",
        tasks.map((task) => task.id),
      );
    const completed = new Set(completions?.map((row) => row.task_id));
    const byDay = new Map<string, number>();
    tasks
      .filter((task) => completed.has(task.id))
      .forEach((task) =>
        byDay.set(
          task.task_date,
          (byDay.get(task.task_date) ?? 0) + task.minutes,
        ),
      );
    const weekStart = new Date(today);
    weekStart.setUTCDate(
      weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7),
    );
    let weeklyMinutes = 0;
    for (const [date, minutes] of byDay)
      if (date >= isoDate(weekStart)) weeklyMinutes += minutes;
    let streakDays = 0;
    const cursor = new Date(today);
    while (byDay.has(isoDate(cursor))) {
      streakDays += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    const days = [...byDay.entries()]
      .map(([date, minutes]) => ({ date, minutes }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return Response.json({ weeklyMinutes, streakDays, activeDays: byDay.size, days });
  } catch (error) {
    console.error("stats failed", error);
    return Response.json({ error: "Unable to load stats" }, { status: 500 });
  }
}
