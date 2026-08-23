import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";

const colors = ["amber", "jade", "violet", "rose", "blue"];

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json() as { idToken?: string };
    if (!idToken) return Response.json({ error: "Missing identity" }, { status: 400 });
    const identity = await verifyLineIdToken(idToken); const db = supabaseAdmin();
    const { data: user } = await db.from("users").select("id").eq("line_user_id", identity.userId).maybeSingle();
    if (!user) return Response.json({ exists: false });
    const { data: plan } = await db.from("study_plans").select("id, exam_date, daily_hours, weak_subject, goal").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!plan) return Response.json({ exists: false });
    const taskDate = new Date().toISOString().slice(0, 10);
    const { data: rows, error } = await db.from("daily_tasks").select("id, subject, minutes, task_type, sort_order").eq("plan_id", plan.id).eq("task_date", taskDate).order("sort_order");
    if (error) throw error;
    const ids = rows?.map(row => row.id) ?? [];
    const { data: completions } = ids.length ? await db.from("task_completions").select("task_id").eq("user_id", user.id).in("task_id", ids) : { data: [] };
    const complete = new Set(completions?.map(row => row.task_id));
    const { data: energy } = await db.from("energy").select("current_energy, prayer_planks").eq("user_id", user.id).maybeSingle();
    const { data: visits } = await db.from("temple_visits").select("temple_code").eq("user_id", user.id).order("visited_at");
    return Response.json({ exists: true, plan: { examDate: plan.exam_date, hours: Number(plan.daily_hours), weak: plan.weak_subject, goal: plan.goal }, tasks: (rows ?? []).map((row, index) => ({ subject: row.subject, minutes: row.minutes, detail: row.task_type, done: complete.has(row.id), color: colors[index % colors.length] })), energy, visits: visits?.map(row => row.temple_code) ?? [] });
  } catch (error) { console.error("progress load failed", error); return Response.json({ error: "Unable to load progress" }, { status: 500 }); }
}
