export type LineIdentity = { userId: string; displayName: string | null };

export async function verifyLineIdToken(idToken: string): Promise<LineIdentity> {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) throw new Error("LINE Login 尚未設定");
  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });
  if (!response.ok) throw new Error("LINE 身分驗證失敗");
  const payload = await response.json() as { sub?: string; name?: string };
  if (!payload.sub) throw new Error("LINE 回傳的使用者資料不完整");
  return { userId: payload.sub, displayName: payload.name ?? null };
}
