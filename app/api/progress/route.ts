import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { taipeiDate } from "@/lib/taipei-date";

type IncomingTask = { subject: string; minutes: number; detail: string; done: boolean };

async function legacySync(
  db: ReturnType<typeof supabaseAdmin>,
  identity: { userId: string; displayName: string | null },
  body: { hours: number; weak: string; goal?: string; examDate?: string; tasks: IncomingTask[] },
  examDate: string,
) {
  const { data: user, error: userError } = await db.from("users").upsert({ line_user_id: identity.userId, display_name: identity.displayName }, { onConflict: "line_user_id" }).select("id").single();
  if (userError || !user) throw userError ?? new Error("User unavailable");
  const { data: existing, error: existingError } = await db.from("study_plans").select("id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existingError) throw existingError;
  const planData = { user_id: user.id, exam_date: examDate, daily_hours: body.hours, weak_subject: body.weak.slice(0, 30), goal: body.goal?.slice(0, 30) ?? null };
  const { data: plan, error: planError } = existing ? await db.from("study_plans").update(planData).eq("id", existing.id).select("id").single() : await db.from("study_plans").insert(planData).select("id").single();
  if (planError || !plan) throw planError ?? new Error("Plan unavailable");
  const taskDate = taipeiDate();
  const { error: deleteError } = await db.from("daily_tasks").delete().eq("plan_id", plan.id).eq("task_date", taskDate);
  if (deleteError) throw deleteError;
  const { data: storedTasks, error: taskError } = await db.from("daily_tasks").insert(body.tasks.map((task, index) => ({ plan_id: plan.id, task_date: taskDate, subject: task.subject, minutes: task.minutes, task_type: task.detail, sort_order: index }))).select("id, sort_order");
  if (taskError || !storedTasks) throw taskError ?? new Error("Task unavailable");
  const completed = storedTasks.filter((task) => body.tasks[task.sort_order]?.done).map((task) => ({ task_id: task.id, user_id: user.id }));
  if (completed.length) {
    const { error: completionError } = await db.from("task_completions").upsert(completed, { onConflict: "task_id,user_id" });
    if (completionError) throw completionError;
  }
  const { error: energyError } = await db.from("energy").upsert({ user_id: user.id, current_energy: Math.min(100, 42 + completed.length * 10), prayer_planks: 10 + completed.length, updated_at: new Date().toISOString() });
  if (energyError) throw energyError;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      idToken?: string; hours?: number; weak?: string; goal?: string;
      challengeName?: string; wishes?: string[]; examDate?: string; tasks?: IncomingTask[];
    };
    if (!body.idToken || !body.hours || !body.weak || !body.tasks?.length)
      return Response.json({ error: "缺少必要資料" }, { status: 400 });
    if (body.tasks.length > 5 || body.tasks.some((task) => !task.subject || !task.detail || task.minutes < 1 || task.minutes > 180))
      return Response.json({ error: "任務資料不正確" }, { status: 400 });

    const identity = await verifyLineIdToken(body.idToken);
    const examDate = /^\d{4}-\d{2}-\d{2}$/.test(body.examDate ?? "")
      ? body.examDate!
      : taipeiDate(new Date(Date.now() + 29 * 86400000));
    const db = supabaseAdmin();
    const { error } = await db.rpc("sync_learning_progress", {
      p_line_user_id: identity.userId,
      p_display_name: identity.displayName,
      p_exam_date: examDate,
      p_daily_hours: body.hours,
      p_weak_subject: body.weak.slice(0, 30),
      p_goal: body.goal?.slice(0, 30) ?? null,
      p_challenge_name: body.challengeName?.slice(0, 20) ?? null,
      p_wishes: (body.wishes ?? []).filter((wish) => typeof wish === "string").map((wish) => wish.slice(0, 120)).slice(0, 20),
      p_task_date: taipeiDate(),
      p_tasks: body.tasks,
    });
    if (error) {
      const functionMissing = error.code === "PGRST202" || error.message.includes("sync_learning_progress");
      if (!functionMissing) throw error;
      await legacySync(db, identity, { hours: body.hours, weak: body.weak, goal: body.goal, examDate: body.examDate, tasks: body.tasks }, examDate);
    }
    return Response.json({ ok: true, displayName: identity.displayName });
  } catch (error) {
    console.error("progress sync failed", error);
    return Response.json({ error: "同步失敗，請稍後再試" }, { status: 500 });
  }
}
