import { NextResponse } from "next/server";

export function proxy() {
  const response = NextResponse.next();
  // The HTML shell must always point at the current hashed JS/CSS assets.
  // Keep static assets cacheable; only prevent stale document responses.
  response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  return response;
}

export const config = {
  matcher: "/",
};
