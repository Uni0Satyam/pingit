import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const destination = new URL("/dashboard", req.url);
  const errorDestination = new URL("/login", req.url);
  const code = req.nextUrl.searchParams.get("code");
  const providerError = req.nextUrl.searchParams.get("error");

  if (providerError) {
    errorDestination.searchParams.set("error", "oauth");
    return NextResponse.redirect(errorDestination);
  }

  if (!code) {
    errorDestination.searchParams.set("error", "confirmation");
    return NextResponse.redirect(errorDestination);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    errorDestination.searchParams.set("error", "oauth");
    return NextResponse.redirect(errorDestination);
  }

  return NextResponse.redirect(destination);
}
