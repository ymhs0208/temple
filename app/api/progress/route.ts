import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { taipeiDate } from "@/lib/taipei-date";

type IncomingTask = { subject: string; minutes: number; detail: string; done: boolean };

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
    const { error } = await supabaseAdmin().rpc("sync_learning_progress", {
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
    if (error) throw error;
    return Response.json({ ok: true, displayName: identity.displayName });
  } catch (error) {
    console.error("progress sync failed", error);
    return Response.json({ error: "同步失敗，請稍後再試" }, { status: 500 });
  }
}
