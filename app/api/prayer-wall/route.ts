import { verifyLineIdToken } from "@/lib/line";
import { supabaseAdmin } from "@/lib/supabase-admin";

const prohibited = ["髒話", "詐騙", "自殺", "色情", "暴力", "仇恨"];
const clean = (value: string) => value.replace(/\s+/g, " ").trim();

async function userForToken(idToken?: string) {
  if (!idToken) throw new Error("Missing identity");
  const identity = await verifyLineIdToken(idToken);
  const db = supabaseAdmin();
  const { data: user, error } = await db
    .from("users")
    .upsert({ line_user_id: identity.userId, display_name: identity.displayName }, { onConflict: "line_user_id" })
    .select("id")
    .single();
  if (error || !user) throw error ?? new Error("User unavailable");
  return { db, userId: user.id, displayName: identity.displayName ?? "匿名祈願者" };
}

export async function GET() {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.from("prayer_wall_posts").select("id, display_name, message, is_anonymous, created_at").eq("moderation_status", "published").order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    const posts = data ?? [];
    const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
    const seed = [...dayKey].reduce((total, character) => total + character.charCodeAt(0), 0);
    return Response.json({ posts, featured: posts.length ? posts[seed % posts.length] : null, featuredDate: dayKey });
  } catch {
    return Response.json({ error: "Prayer wall unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action?: "post" | "report"; idToken?: string; message?: string; anonymous?: boolean; postId?: string };
    const { db, userId, displayName } = await userForToken(body.idToken);
    if (body.action === "report") {
      if (!body.postId) return Response.json({ error: "Missing post" }, { status: 400 });
      const { data, error } = await db.rpc("report_prayer_wall_post", { p_post_id: body.postId, p_user_id: userId });
      if (error) {
        if (error.message.includes("post unavailable")) return Response.json({ error: "Post unavailable" }, { status: 404 });
        throw error;
      }
      const report = Array.isArray(data) ? data[0] : data;
      return Response.json({ ok: true, hidden: report?.moderation_status === "hidden", alreadyReported: report?.new_report === false });
    }

    const message = clean(body.message ?? "");
    if (message.length < 2 || message.length > 120)
      return Response.json({ error: "Message must be 2–120 characters" }, { status: 400 });
    const { data: recent, error: recentError } = await db.from("prayer_wall_posts").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (recentError) throw recentError;
    if (recent && Date.now() - new Date(recent.created_at).getTime() < 60000)
      return Response.json({ error: "Please wait before posting again" }, { status: 429 });
    const needsReview = prohibited.some((word) => message.includes(word)) || /https?:\/\//i.test(message);
    const { error } = await db.from("prayer_wall_posts").insert({ user_id: userId, display_name: body.anonymous !== false ? "匿名祈願者" : displayName.slice(0, 20), message, is_anonymous: body.anonymous !== false, moderation_status: needsReview ? "pending" : "published" });
    if (error) throw error;
    return Response.json({ ok: true, pending: needsReview });
  } catch (error) {
    console.error("prayer wall failed", error);
    return Response.json({ error: "Prayer wall unavailable" }, { status: 500 });
  }
}
