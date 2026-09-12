import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { taipeiDate } from "@/lib/taipei-date";

type IncomingTask = { subject: string; minutes: number; detail: string; done: boolean };
type CompanionState = {
  oracleTickets?: number; oraclePlanksSpent?: number; oracleResultId?: number | null;
  dailyFortuneTask?: unknown; focusRewardMinutes?: number; wishReflections?: unknown;
};

function safeCompanionState(input: CompanionState | undefined) {
  const number = (value: unknown, maximum = 100000) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maximum ? value : 0;
  const oracleResultId = typeof input?.oracleResultId === "number" && Number.isInteger(input.oracleResultId) && input.oracleResultId >= 0 && input.oracleResultId <= 5 ? input.oracleResultId : null;
  const dailyFortuneTask = input?.dailyFortuneTask && typeof input.dailyFortuneTask === "object" && !Array.isArray(input.dailyFortuneTask) ? input.dailyFortuneTask : {};
  const wishReflections = Array.isArray(input?.wishReflections) ? input.wishReflections.slice(0, 20) : [];
  return { oracle_tickets: number(input?.oracleTickets, 100), oracle_planks_spent: number(input?.oraclePlanksSpent, 100000), oracle_result_id: oracleResultId, daily_fortune_task: dailyFortuneTask, focus_reward_minutes: number(input?.focusRewardMinutes), wish_reflections: wishReflections, updated_at: new Date().toISOString() };
}

async function legacySync(
  db: ReturnType<typeof supabaseAdmin>,
  identity: { userId: string; displayName: string | null },
  body: { hours: number; weak: string; goal?: string; tasks: IncomingTask[] },
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
  let stage = "request";
  try {
    const body = (await request.json()) as { idToken?: string; hours?: number; weak?: string; goal?: string; challengeName?: string; wishes?: string[]; examDate?: string; tasks?: IncomingTask[]; companionState?: CompanionState };
    if (!body.idToken || !body.hours || !body.weak || !body.tasks?.length)
      return Response.json({ error: "Missing required progress data", code: "SYNC_REQUEST" }, { status: 400 });
    if (body.tasks.length > 5 || body.tasks.some((task) => !task.subject || !task.detail || task.minutes < 1 || task.minutes > 180))
      return Response.json({ error: "Invalid task data", code: "SYNC_REQUEST" }, { status: 400 });

    stage = "line_identity";
    const identity = await verifyLineIdToken(body.idToken);
    const examDate = /^\d{4}-\d{2}-\d{2}$/.test(body.examDate ?? "") ? body.examDate! : taipeiDate(new Date(Date.now() + 29 * 86400000));
    stage = "supabase_connection";
    const db = supabaseAdmin();
    stage = "atomic_sync";
    const { error } = await db.rpc("sync_learning_progress", {
      p_line_user_id: identity.userId, p_display_name: identity.displayName,
      p_exam_date: examDate, p_daily_hours: body.hours, p_weak_subject: body.weak.slice(0, 30),
      p_goal: body.goal?.slice(0, 30) ?? null, p_challenge_name: body.challengeName?.slice(0, 20) ?? null,
      p_wishes: (body.wishes ?? []).filter((wish) => typeof wish === "string").map((wish) => wish.slice(0, 120)).slice(0, 20),
      p_task_date: taipeiDate(), p_tasks: body.tasks,
    });
    if (error) {
      console.error("atomic progress sync failed; using legacy fallback", error);
      stage = "legacy_sync";
      await legacySync(db, identity, { hours: body.hours, weak: body.weak, goal: body.goal, tasks: body.tasks }, examDate);
    }
    const { data: user, error: userError } = await db.from("users").select("id").eq("line_user_id", identity.userId).single();
    if (userError || !user) throw userError ?? new Error("User unavailable");
    const { error: companionError } = await db.from("user_companion_states").upsert({ user_id: user.id, ...safeCompanionState(body.companionState) }, { onConflict: "user_id" });
    if (companionError) throw companionError;
    return Response.json({ ok: true, displayName: identity.displayName });
  } catch (error) {
    console.error("progress sync failed", { stage, error });
    return Response.json({ error: "Progress sync unavailable", code: `SYNC_${stage.toUpperCase()}` }, { status: 500 });
  }
}
