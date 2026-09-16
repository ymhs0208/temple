import { supabaseAdmin } from "./supabase-admin";

export async function weeklyLearning(userId: string, end: string) {
  const db = supabaseAdmin();
  const start = new Date(end + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() - 6);
  const first = start.toISOString().slice(0, 10);
  const { data: plans, error: planError } = await db.from("study_plans").select("id").eq("user_id", userId);
  if (planError) throw planError;
  if (!plans?.length) return null;
  const { data: tasks, error } = await db.from("daily_tasks").select("id, subject, minutes").in("plan_id", plans.map(p => p.id)).gte("task_date", first).lte("task_date", end);
  if (error) throw error;
  if (!tasks?.length) return null;
  const { data: completions, error: doneError } = await db.from("task_completions").select("task_id").eq("user_id", userId).in("task_id", tasks.map(t => t.id));
  if (doneError) throw doneError;
  const done = new Set((completions ?? []).map(c => c.task_id));
  const completed = tasks.filter(t => done.has(t.id));
  const subjects = [...new Set(tasks.map(t => t.subject))].map(subject => {
    const total = tasks.filter(t => t.subject === subject).length;
    return `${subject} · 完成 ${completed.filter(t => t.subject === subject).length}/${total} 項`;
  });
  return { minutes: completed.reduce((sum, t) => sum + t.minutes, 0),
    rate: Math.round(completed.length / tasks.length * 100), subjects, period: `${first} ～ ${end}` };
}
