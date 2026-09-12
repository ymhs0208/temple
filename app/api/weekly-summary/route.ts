import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { taipeiDate } from "@/lib/taipei-date";

type Audience = "self" | "teacher" | "parent";

export async function POST(request: Request) {
	try {
		const { idToken, audience = "self" } = (await request.json()) as { idToken?: string; audience?: Audience };
		if (!idToken || !["self", "teacher", "parent"].includes(audience)) return Response.json({ error: "Invalid request" }, { status: 400 });
		const identity = await verifyLineIdToken(idToken);
		const db = supabaseAdmin();
		const { data: user } = await db.from("users").select("id, line_user_id").eq("line_user_id", identity.userId).maybeSingle();
		if (!user?.line_user_id) return Response.json({ error: "No linked LINE account" }, { status: 404 });
		const { data: plan } = await db.from("study_plans").select("id, weak_subject").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
		if (!plan) return Response.json({ error: "No study plan" }, { status: 404 });
		const start = new Date(`${taipeiDate()}T00:00:00.000Z`);
		start.setUTCDate(start.getUTCDate() - 6);
		const { data: tasks } = await db.from("daily_tasks").select("id, minutes").eq("plan_id", plan.id).gte("task_date", start.toISOString().slice(0, 10));
		const ids = (tasks ?? []).map((task) => task.id);
		const { data: completed } = ids.length ? await db.from("task_completions").select("task_id").eq("user_id", user.id).in("task_id", ids) : { data: [] };
		const done = new Set((completed ?? []).map((item) => item.task_id));
		const totalMinutes = (tasks ?? []).filter((task) => done.has(task.id)).reduce((sum, task) => sum + task.minutes, 0);
		const rate = tasks?.length ? Math.round((done.size / tasks.length) * 100) : 0;
		const heading = audience === "teacher" ? "教師關懷版" : audience === "parent" ? "家長關懷版" : "本人學習版";
		const text = `⛩ 文昌同行｜本週關懷摘要（${heading}）\n\n完成率：${rate}%\n完整專注：${totalMinutes} 分鐘\n最需要加強：${plan.weak_subject}\n\n本摘要僅呈現學習趨勢，不含題目內容或作答紀錄。`;
		const accessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
		if (!accessToken) throw new Error("LINE Messaging API is not configured");
		const push = await fetch("https://api.line.me/v2/bot/message/push", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ to: user.line_user_id, messages: [{ type: "text", text }] }) });
		if (!push.ok) throw new Error(`LINE push failed: ${push.status}`);
		return Response.json({ ok: true });
	} catch (error) {
		console.error("weekly summary failed", error);
		return Response.json({ error: "Unable to send weekly summary" }, { status: 500 });
	}
}
