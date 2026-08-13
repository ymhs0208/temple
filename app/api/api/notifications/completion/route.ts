import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      idToken?: string;
      subject?: string;
      minutes?: number;
      completedCount?: number;
      totalCount?: number;
    };
    if (!body.idToken || !body.subject)
      return Response.json({ error: "資料不完整" }, { status: 400 });

    const accessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
    if (!accessToken) throw new Error("LINE OA 尚未設定");

    const identity = await verifyLineIdToken(body.idToken);
    const db = supabaseAdmin();
    const { data: user, error: userError } = await db
      .from("users")
      .select("id")
      .eq("line_user_id", identity.userId)
      .maybeSingle();
    if (userError) throw userError;
    if (!user)
      return Response.json({ error: "請先建立學習計畫" }, { status: 404 });

    const { data: preference, error: preferenceError } = await db
      .from("user_preferences")
      .select("notifications_enabled")
      .eq("user_id", user.id)
      .maybeSingle();
    if (preferenceError) throw preferenceError;
    if (preference && !preference.notifications_enabled)
      return Response.json({ ok: false, skipped: true, reason: "disabled" });

    const completedCount = Math.max(1, Number(body.completedCount) || 1);
    const totalCount = Math.max(completedCount, Number(body.totalCount) || completedCount);
    const minutes = Math.max(0, Number(body.minutes) || 0);
    const displayName = identity.displayName ?? "同學";
    const text = `恭喜你，${displayName}！🎉\n\n今天完成了「${body.subject}」${minutes ? ` ${minutes} 分鐘` : ""}的專注任務。\n目前已完成 ${completedCount}/${totalCount} 項任務。\n\n每一次專注都算數，繼續穩穩前進！`;

    const push = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: identity.userId,
        messages: [{ type: "text", text }],
      }),
    });
    if (!push.ok) throw new Error("LINE OA 推播失敗");

    return Response.json({ ok: true });
  } catch (error) {
    console.error("completion notification failed", error);
    return Response.json(
      { error: "完成通知發送失敗，請確認已加 OA 好友。" },
      { status: 500 },
    );
  }
}
