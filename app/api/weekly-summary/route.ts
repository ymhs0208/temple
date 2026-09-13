import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { taipeiDate } from "@/lib/taipei-date";

type Audience = "self" | "teacher" | "parent";
type SummaryRequest = { idToken?: string; audience?: Audience; action?: "preview" | "send" };

const audienceLabel: Record<Audience, string> = { self: "本人學習版", teacher: "教師關懷版", parent: "家長陪伴版" };

const makeSummary = async (idToken: string, audience: Audience) => {
  const identity = await verifyLineIdToken(idToken);
  const db = supabaseAdmin();
  const { data: user } = await db.from("users").select("id, line_user_id").eq("line_user_id", identity.userId).maybeSingle();
  if (!user?.line_user_id) throw new Error("No linked LINE account");
  const { data: plan } = await db.from("study_plans").select("id, weak_subject").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!plan) throw new Error("No study plan");
  const start = new Date(`${taipeiDate()}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  const { data: tasks } = await db.from("daily_tasks").select("id, minutes").eq("plan_id", plan.id).gte("task_date", start.toISOString().slice(0, 10));
  const ids = (tasks ?? []).map((task) => task.id);
  const { data: completed } = ids.length ? await db.from("task_completions").select("task_id").eq("user_id", user.id).in("task_id", ids) : { data: [] };
  const done = new Set((completed ?? []).map((item) => item.task_id));
  const minutes = (tasks ?? []).filter((task) => done.has(task.id)).reduce((sum, task) => sum + task.minutes, 0);
  const rate = tasks?.length ? Math.round((done.size / tasks.length) * 100) : 0;
  const heading = audienceLabel[audience];
  const support = audience === "teacher"
    ? "建議：協助學生保留下一段完整專注時間，並以弱科的核心觀念做短回顧。"
    : audience === "parent"
      ? "陪伴提示：肯定已完成的投入，提醒今晚依原訂時間收尾休息即可。"
      : "下一步：先從最需要加強的科目開始一段完整專注，再決定後續安排。";
  const text = `⛩ 文昌同行｜本週關懷摘要（${heading}）\n\n完成率：${rate}%\n完整專注：${minutes} 分鐘\n最需要加強：${plan.weak_subject}\n\n${support}\n\n本摘要僅呈現學習趨勢，不含題目內容、答案或作答紀錄。`;
  return { user, rate, minutes, weakSubject: plan.weak_subject, heading, support, text };
};

export async function POST(request: Request) {
  try {
    const { idToken, audience = "self", action = "send" } = (await request.json()) as SummaryRequest;
    if (!idToken || !["self", "teacher", "parent"].includes(audience) || !["preview", "send"].includes(action)) return Response.json({ error: "Invalid request" }, { status: 400 });
    const summary = await makeSummary(idToken, audience);
    if (action === "preview") return Response.json({ ok: true, ...summary, user: undefined });
    const accessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
    if (!accessToken) throw new Error("LINE Messaging API is not configured");
    const push = await fetch("https://api.line.me/v2/bot/message/push", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ to: summary.user.line_user_id, messages: [{ type: "text", text: summary.text }] }) });
    if (!push.ok) throw new Error(`LINE push failed: ${push.status}`);
    return Response.json({ ok: true, rate: summary.rate, minutes: summary.minutes, weakSubject: summary.weakSubject, text: summary.text });
  } catch (error) {
    console.error("weekly summary failed", error);
    return Response.json({ error: "Unable to prepare weekly summary" }, { status: 500 });
  }
}
