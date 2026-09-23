import { supabaseAdmin } from "./supabase-admin";

/** Read every page so older earned milestones aren't lost at the API row limit. */
export async function readAchievementRecords(lineUserId: string, kind: "stamps" | "study") {
  const db = supabaseAdmin();
  const { data: user, error } = await db.from("users").select("id").eq("line_user_id", lineUserId).maybeSingle();
  if (error) throw error;
  if (!user) return null;
  const values: string[] = [];
  for (let offset = 0; ; offset += 500) {
    if (kind === "stamps") {
      const result = await db.from("temple_visits").select("temple_code").eq("user_id", user.id).order("temple_code").range(offset, offset + 499);
      if (result.error) throw result.error;
      values.push(...result.data.map(row => row.temple_code));
      if (result.data.length < 500) break;
    } else {
      const result = await db.from("task_completions").select("completed_at, task_id").eq("user_id", user.id).order("completed_at").order("task_id").range(offset, offset + 499);
      if (result.error) throw result.error;
      values.push(...result.data.map(row => row.completed_at));
      if (result.data.length < 500) break;
    }
  }
  return values;
}
