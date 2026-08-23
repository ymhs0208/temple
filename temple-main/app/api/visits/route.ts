import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function userForToken(idToken?: string) {
  if (!idToken) throw new Error("Missing identity");
  const identity = await verifyLineIdToken(idToken); const db = supabaseAdmin();
  const { data: user, error } = await db.from("users").upsert({ line_user_id: identity.userId, display_name: identity.displayName }, { onConflict: "line_user_id" }).select("id").single();
  if (error || !user) throw error ?? new Error("User unavailable"); return { db, userId: user.id };
}
export async function GET(request: Request) { try { const idToken = request.headers.get("x-line-id-token") ?? undefined; const { db, userId } = await userForToken(idToken); const { data, error } = await db.from("temple_visits").select("temple_code").eq("user_id", userId).order("visited_at"); if (error) throw error; return Response.json({ visits: data.map(row => row.temple_code) }); } catch { return Response.json({ error: "Temple visits unavailable" }, { status: 500 }); } }
export async function POST(request: Request) { try { const { idToken, code } = await request.json() as { idToken?: string; code?: string }; const templeCode = code?.trim().toUpperCase(); if (!templeCode || templeCode.length < 4) return Response.json({ error: "Invalid code" }, { status: 400 }); const { db, userId } = await userForToken(idToken); const { error } = await db.from("temple_visits").upsert({ user_id: userId, temple_code: templeCode }, { onConflict: "user_id,temple_code", ignoreDuplicates: true }); if (error) throw error; return Response.json({ ok: true }); } catch { return Response.json({ error: "Temple visits unavailable" }, { status: 500 }); } }
