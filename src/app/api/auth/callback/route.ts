import { NextRequest, NextResponse } from "next/server";
import { scalekit } from "@/lib/scalekit";

const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ message: "Code not found" }, { status: 400 });
  }

  const authResult = await scalekit.authenticateWithCode(code, redirectUrl);

  const response = NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}`,
  )

  response.cookies.set("access_token", authResult.accessToken, {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}
