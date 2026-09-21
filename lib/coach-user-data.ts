import { verifyLineIdToken } from "./line";
import { supabaseAdmin } from "./supabase-admin";
import { taipeiDate } from "./taipei-date";
import { weeklyLearning } from "./weekly-learning";

export async function coachUserData(idToken: string) {
  const identity = await verifyLineIdToken(idToken);
  const db = supabaseAdmin();
  const today = taipeiDate();
  const { data: user, error } = await db.from("users").select("id").eq("line_user_id", identity.userId).maybeSingle();
  if (error) throw error;
  if (!user) return null;
  const { data: plan, error: planError } = await db.from("study_plans").select("id, exam_date, daily_hours, weak_subject, goal").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (planError) throw planError;
  if (!plan) return null;
  const results = await Promise.allSettled([
    db.from("daily_tasks").select("id, subject, minutes, task_type").eq("plan_id", plan.id).eq("task_date", today).order("sort_order"),
    db.from("user_companion_states").select("daily_fortune_task").eq("user_id", user.id).maybeSingle(),
    weeklyLearning(user.id, today),
  ]);
  const [taskResult, companionResult, weekResult] = results;
  if (taskResult.status === "rejected") throw taskResult.reason;
  if (taskResult.value.error) throw taskResult.value.error;
  const rows = taskResult.value.data ?? [];
  const { data: completions, error: doneError } = rows.length ? await db.from("task_completions").select("task_id").eq("user_id", user.id).in("task_id", rows.map(row => row.id)) : { data: [], error: null };
  if (doneError) throw doneError;
  const done = new Set((completions ?? []).map(row => row.task_id));
  const fortune = companionResult.status === "fulfilled" && !companionResult.value.error ? companionResult.value.data?.daily_fortune_task : null;
  const questions = Array.isArray(fortune?.weakQuestions) ? fortune.weakQuestions : null;
  const daysLeft = plan.exam_date ? Math.max(0, Math.ceil((Date.parse(`${plan.exam_date}T00:00:00+08:00`) - Date.parse(`${today}T00:00:00+08:00`)) / 86400000)) : null;
  return {
    daysLeft, examDate: plan.exam_date, weakSubject: plan.weak_subject, dailyHours: Number(plan.daily_hours), goal: plan.goal,
    tasks: rows.map(row => ({ subject: row.subject, minutes: row.minutes, detail: row.task_type, done: done.has(row.id) })),
    weakQuestionCount: questions ? questions.length : null,
    dueWeakQuestionCount: questions ? questions.filter((q: { nextReviewDate?: string }) => q?.nextReviewDate && q.nextReviewDate <= today).length : null,
    checkInDone: fortune?.date === today && Boolean(fortune?.done),
    weekly: weekResult.status === "fulfilled" ? weekResult.value : null,
    dataSource: "cloud" as const, updatedAt: new Date().toISOString(),
  };
}
