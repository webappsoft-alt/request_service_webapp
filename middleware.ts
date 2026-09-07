import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth lives in Redux Persist (`userData`) — not readable on the Edge.
 * Protected pages enforce access after client rehydrate.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|api|.*\\..*).*)",
  ],
};
