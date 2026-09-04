import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const normalizeTime = (value: string | null | undefined, fallback: string) =>
  value?.slice(0, 5) || fallback;

async function resolveUser(idToken: string) {
  const identity = await verifyLineIdToken(idToken);
  const db = supabaseAdmin();
  const { data: user, error } = await db
    .from("users")
    .upsert(
      { line_user_id: identity.userId, display_name: identity.displayName },
      { onConflict: "line_user_id" },
    )
    .select("id")
    .single();
  if (error || !user) throw error ?? new Error("User unavailable");
  return { db, user };
}

export async function GET(request: Request) {
  try {
    const idToken = request.headers.get("x-line-id-token");
    if (!idToken)
      return Response.json({ error: "Missing identity" }, { status: 400 });
    const { db, user } = await resolveUser(idToken);
    const { data, error } = await db
      .from("user_preferences")
      .select("notifications_enabled, morning_time, evening_time, timezone")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return Response.json({
      enabled: data?.notifications_enabled ?? true,
      morningTime: normalizeTime(data?.morning_time, "08:00"),
      eveningTime: normalizeTime(data?.evening_time, "20:30"),
      timezone: data?.timezone ?? "Asia/Taipei",
    });
  } catch {
    return Response.json(
      { error: "Unable to load preference" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { idToken, enabled, morningTime, eveningTime } =
      (await request.json()) as {
        idToken?: string;
        enabled?: boolean;
        morningTime?: string;
        eveningTime?: string;
      };
    if (
      !idToken ||
      typeof enabled !== "boolean" ||
      !timePattern.test(morningTime ?? "") ||
      !timePattern.test(eveningTime ?? "")
    )
      return Response.json({ error: "Invalid preference" }, { status: 400 });
    const { db, user } = await resolveUser(idToken);
    const { error: preferenceError } = await db
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        notifications_enabled: enabled,
        morning_time: normalizeTime(morningTime, "08:00"),
        evening_time: normalizeTime(eveningTime, "20:30"),
        timezone: "Asia/Taipei",
        updated_at: new Date().toISOString(),
      });
    if (preferenceError) throw preferenceError;
    return Response.json({ ok: true, enabled, morningTime, eveningTime });
  } catch (error) {
    console.error("Unable to save LINE notification preference", error);
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.includes("LINE")
          ? "LINE 登入資訊已失效，請重新從 LIFF 開啟並登入。"
          : "通知偏好暫時無法儲存，請稍後再試。",
      },
      { status: 500 },
    );
  }
}
