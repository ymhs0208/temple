import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { taipeiDate } from "@/lib/taipei-date";
import { buildWeeklyFlex } from "@/lib/line-reminder";
import { weeklyLearning } from "@/lib/weekly-learning";

type Audience = "self" | "teacher" | "parent";
type RoleAction = "none" | "focus" | "review" | "encourage" | "checkin";
type SummaryRequest = { idToken?: string; audience?: Audience; roleAction?: RoleAction; action?: "preview" | "send"; fingerprint?: string; retryKey?: string };

const audienceLabel: Record<Audience, string> = { self: "本人學習版", teacher: "教師關懷版", parent: "家長陪伴版" };

const makeSummary = async (idToken: string, audience: Audience, roleAction: RoleAction) => {
  const identity = await verifyLineIdToken(idToken);
  const db = supabaseAdmin();
  const { data: user } = await db.from("users").select("id, line_user_id").eq("line_user_id", identity.userId).maybeSingle();
  if (!user?.line_user_id) throw new Error("No linked LINE account");
  const { data: plan } = await db.from("study_plans").select("id, weak_subject").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!plan) throw new Error("No study plan");
  const weekly = await weeklyLearning(user.id, taipeiDate());
  if (!weekly) throw new Error("本週尚無學習紀錄");
  const { minutes, rate } = weekly;
  const heading = audienceLabel[audience];
  const support = audience === "teacher"
    ? "建議：協助學生保留下一段完整專注時間，並以弱科的核心觀念做短回顧。"
    : audience === "parent"
      ? "陪伴提示：肯定已完成的投入，提醒今晚依原訂時間收尾休息即可。"
      : "下一步：先從最需要加強的科目開始一段完整專注，再決定後續安排。";
  const actionText = roleAction === "focus" ? "請協助安排一段弱科短回顧。" : roleAction === "review" ? "請提供下一次複習的方向。" : roleAction === "encourage" ? "請先肯定這週的投入，再陪我安排下一步。" : roleAction === "checkin" ? "請找時間問問我最近的學習狀態。" : "";
  const finalSupport = actionText ? `${support} ${actionText}` : support;
  const text = `⛩ 文昌同行｜本週關懷摘要（${heading}）\n\n完成率：${rate}%\n完成任務累積：${minutes} 分鐘\n最需要加強：${plan.weak_subject}\n\n${finalSupport}\n\n本摘要僅呈現學習趨勢，不含題目內容、答案或作答紀錄。`;
  return { user, weekly, rate, minutes, weakSubject: plan.weak_subject, heading, support: finalSupport, text };
};

export async function POST(request: Request) {
  try {
    const { idToken, audience = "self", roleAction = "none", action = "preview", fingerprint, retryKey } = (await request.json()) as SummaryRequest;
    if (!idToken || !["self", "teacher", "parent"].includes(audience) || !["preview", "send"].includes(action)) return Response.json({ error: "Invalid request" }, { status: 400 });
    const summary = await makeSummary(idToken, audience, roleAction);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ audience, roleAction, user: summary.user.id, weekly: summary.weekly, weak: summary.weakSubject, support: summary.support })));
    const version = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    const subjects = summary.weekly.subjects.slice(0, 4);
    if (action === "preview") return Response.json({ ok: true, ...summary, user: undefined, weekly: undefined, subjects, period: summary.weekly.period, fingerprint: version });
    if (fingerprint !== version) return Response.json({ error: "學習紀錄已更新，請重新預覽並確認內容。" }, { status: 409 });
    if (!retryKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(retryKey)) return Response.json({ error: "請重新預覽後再傳送。" }, { status: 400 });
    const accessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
    if (!accessToken) throw new Error("LINE Messaging API is not configured");
    const weekly = summary.weekly;
    if (!weekly) return Response.json({ error: "本週尚無學習紀錄" }, { status: 400 });
    const push = await fetch("https://api.line.me/v2/bot/message/push", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}`, "X-Line-Retry-Key": retryKey }, body: JSON.stringify({ to: summary.user.line_user_id, messages: [buildWeeklyFlex({ ...weekly, heading: summary.heading, subjects: [...subjects, `目前設定的待加強科目：${summary.weakSubject}`, summary.support] })] }) });
    if (!push.ok && !(push.status === 409 && push.headers.get("x-line-accepted-request-id"))) throw new Error(`LINE push failed: ${push.status}`);
    return Response.json({ ok: true, rate: summary.rate, minutes: summary.minutes, weakSubject: summary.weakSubject, text: summary.text });
  } catch (error) {
    console.error("weekly summary failed", error);
    const message = error instanceof Error ? error.message : "";
    if (message === "本週尚無學習紀錄" || message === "No study plan" || message === "No linked LINE account") {
      return Response.json({ error: "最近七天尚無可用的雲端紀錄，請先建立學習計畫並在今日頁同步任務。" }, { status: 404 });
    }
    return Response.json({ error: message === "LINE Messaging API is not configured" ? "LINE 傳送服務尚未啟用，預覽仍可使用。請聯絡管理者。" : "摘要暫時無法處理，請確認 LINE 登入、好友狀態與網路後重試。" }, { status: 500 });
  }
}
