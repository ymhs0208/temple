import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const { idToken, enabled } = await request.json() as { idToken?: string; enabled?: boolean };
    if (!idToken || typeof enabled !== "boolean") return Response.json({ error: "Invalid preference" }, { status: 400 });
    const identity = await verifyLineIdToken(idToken); const db = supabaseAdmin();
    const { data: user, error } = await db.from("users").upsert({ line_user_id: identity.userId, display_name: identity.displayName }, { onConflict: "line_user_id" }).select("id").single();
    if (error || !user) throw error ?? new Error("User unavailable");
    const { error: preferenceError } = await db.from("user_preferences").upsert({ user_id: user.id, notifications_enabled: enabled, updated_at: new Date().toISOString() });
    if (preferenceError) throw preferenceError;
    return Response.json({ ok: true, enabled });
  } catch { return Response.json({ error: "Unable to save preference" }, { status: 500 }); }
}
