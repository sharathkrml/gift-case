import { clerkMiddleware } from "@clerk/nextjs/server";

const PUBLIC_PAGES = ["/sign-in", "/sign-up"];

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  // API routes return JSON 401s themselves.
  if (pathname.startsWith("/api")) return;
  if (
    PUBLIC_PAGES.some(
      (page) => pathname === page || pathname.startsWith(`${page}/`),
    )
  ) {
    return;
  }

  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
