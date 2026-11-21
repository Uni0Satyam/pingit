import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function proxy(req: NextRequest) {
  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();

  if (!data.user && req.nextUrl.pathname.startsWith("/dashboard")) {
    const loginResponse = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.getAll().forEach((cookie) =>
      loginResponse.cookies.set(cookie),
    );
    return loginResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/api/auth/:path*",
    "/api/account/:path*",
    "/api/billing/:path*",
    "/api/chatbot/:path*",
    "/api/conversations/:path*",
    "/api/usage-record/:path*",
  ],
};
