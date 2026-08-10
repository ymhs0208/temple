import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";

type IncomingTask = { subject: string; minutes: number; detail: string; done: boolean };

export async function POST(request: Request) {
  try {
    const body = await request.json() as { idToken?: string; hours?: number; weak?: string; goal?: string; tasks?: IncomingTask[] };
    if (!body.idToken || !body.hours || !body.weak || !body.tasks?.length) return Response.json({ error: "資料不完整" }, { status: 400 });
    if (body.tasks.length > 5 || body.tasks.some((task) => !task.subject || task.minutes < 1 || task.minutes > 180)) return Response.json({ error: "任務格式不正確" }, { status: 400 });
    const identity = await verifyLineIdToken(body.idToken);
    const db = supabaseAdmin();
    const { data: user, error: userError } = await db.from("users").upsert({ line_user_id: identity.userId, display_name: identity.displayName }, { onConflict: "line_user_id" }).select("id").single();
    if (userError || !user) throw userError ?? new Error("無法建立使用者");
    const { data: existing } = await db.from("study_plans").select("id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const examDate = new Date(Date.now() + 29 * 86400000).toISOString().slice(0, 10);
    const planData = { user_id: user.id, exam_date: examDate, daily_hours: body.hours, weak_subject: body.weak, goal: body.goal?.slice(0, 30) ?? null };
    const { data: plan, error: planError } = existing ? await db.from("study_plans").update(planData).eq("id", existing.id).select("id").single() : await db.from("study_plans").insert(planData).select("id").single();
    if (planError || !plan) throw planError ?? new Error("無法儲存計畫");
    const taskDate = new Date().toISOString().slice(0, 10);
    await db.from("daily_tasks").delete().eq("plan_id", plan.id).eq("task_date", taskDate);
    const { data: storedTasks, error: taskError } = await db.from("daily_tasks").insert(body.tasks.map((task, index) => ({ plan_id: plan.id, task_date: taskDate, subject: task.subject, minutes: task.minutes, task_type: task.detail, sort_order: index }))).select("id, sort_order");
    if (taskError || !storedTasks) throw taskError ?? new Error("無法儲存任務");
    const completedIds = storedTasks.filter((stored) => body.tasks?.[stored.sort_order]?.done).map((stored) => ({ task_id: stored.id, user_id: user.id }));
    if (completedIds.length) await db.from("task_completions").upsert(completedIds, { onConflict: "task_id,user_id" });
    const energy = Math.min(100, 42 + completedIds.length * 10);
    await db.from("energy").upsert({ user_id: user.id, current_energy: energy, prayer_planks: 10 + completedIds.length, updated_at: new Date().toISOString() });
    return Response.json({ ok: true, displayName: identity.displayName });
  } catch (error) {
    console.error("progress sync failed", error);
    return Response.json({ error: "同步失敗，請稍後再試" }, { status: 500 });
  }
}
