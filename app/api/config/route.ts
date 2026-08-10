export async function GET() {
  // A LIFF ID is designed to be public. Read it server-side so hosted runtime
  // configuration works even when the client bundle was built elsewhere.
  return Response.json({ liffId: process.env.NEXT_PUBLIC_LIFF_ID ?? null });
}
