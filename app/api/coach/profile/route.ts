import { coachUserData } from "@/lib/coach-user-data";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body?.idToken !== "string" || !body.idToken) return Response.json({ error: "請先登入 LINE。" }, { status: 401 });
    const profile = await coachUserData(body.idToken);
    return Response.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "個人資料讀取失敗，請重新登入或稍後重試。" }, { status: 503 });
  }
}
