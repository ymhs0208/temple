import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { taipeiDate } from "@/lib/taipei-date";

const colors = ["amber", "jade", "violet", "rose", "blue"];

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };
    if (!idToken) return Response.json({ error: "Missing identity" }, { status: 400 });
    const identity = await verifyLineIdToken(idToken);
    const db = supabaseAdmin();
    const { data: user, error: userError } = await db.from("users").select("id").eq("line_user_id", identity.userId).maybeSingle();
    if (userError) throw userError;
    if (!user) return Response.json({ exists: false });
    const { data: plan, error: planError } = await db.from("study_plans").select("id, exam_date, daily_hours, weak_subject, goal").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (planError) throw planError;
    if (!plan) return Response.json({ exists: false });
    const { data: extendedPlan } = await db.from("study_plans").select("challenge_name, wishes").eq("id", plan.id).maybeSingle();
    const { data: rows, error } = await db.from("daily_tasks").select("id, subject, minutes, task_type, sort_order").eq("plan_id", plan.id).eq("task_date", taipeiDate()).order("sort_order");
    if (error) throw error;
    const ids = rows?.map((row) => row.id) ?? [];
    const { data: completions, error: completionError } = ids.length ? await db.from("task_completions").select("task_id").eq("user_id", user.id).in("task_id", ids) : { data: [], error: null };
    if (completionError) throw completionError;
    const { data: energy, error: energyError } = await db.from("energy").select("current_energy, prayer_planks").eq("user_id", user.id).maybeSingle();
    if (energyError) throw energyError;
    const { data: visits, error: visitsError } = await db.from("temple_visits").select("temple_code").eq("user_id", user.id).order("visited_at");
    if (visitsError) throw visitsError;
    const complete = new Set(completions?.map((row) => row.task_id));
    return Response.json({ exists: true, plan: { challengeName: extendedPlan?.challenge_name, examDate: plan.exam_date, hours: Number(plan.daily_hours), weak: plan.weak_subject, goal: plan.goal, wishes: Array.isArray(extendedPlan?.wishes) ? extendedPlan.wishes : [] }, tasks: (rows ?? []).map((row, index) => ({ subject: row.subject, minutes: row.minutes, detail: row.task_type, done: complete.has(row.id), color: colors[index % colors.length] })), energy, visits: visits?.map((row) => row.temple_code) ?? [] });
  } catch (error) {
    console.error("progress load failed", error);
    return Response.json({ error: "Unable to load progress" }, { status: 500 });
  }
}
