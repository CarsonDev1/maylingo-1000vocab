import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes: landing + Clerk auth pages. Everything else requires sign-in.
const isPublic = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|png|gif|svg|ico|webp|woff2?|ttf|otf|mp3|wav|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
