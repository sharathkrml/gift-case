import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { captureCredits } from "@/lib/credits";

function redirectTo(request: Request, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: Request) {
  const { userId } = await auth();
  const token = new URL(request.url).searchParams.get("token");

  if (!userId) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("redirect_url", request.url);
    return redirectTo(request, `${signIn.pathname}${signIn.search}`);
  }

  if (!token) {
    return redirectTo(request, "/credits/complete?error=missing");
  }

  try {
    const result = await captureCredits(userId, token);
    return redirectTo(
      request,
      `/credits/complete?added=${result.added}`,
    );
  } catch (error) {
    console.error("[api/credits/capture] capture failed", error);
    return redirectTo(request, "/credits/complete?error=capture");
  }
}
