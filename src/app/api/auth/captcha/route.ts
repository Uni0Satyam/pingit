import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/apiResponse";

export async function POST(request: NextRequest) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return ApiResponse.error("Signup verification is not configured", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error("Invalid verification request", 400);
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("token" in body) ||
    typeof body.token !== "string" ||
    !body.token.trim() ||
    body.token.length > 2_048
  ) {
    return ApiResponse.error("Complete the security check before continuing", 400);
  }

  try {
    const form = new URLSearchParams({ secret, response: body.token });
    const remoteIp = request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
    if (remoteIp) form.set("remoteip", remoteIp);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });
    const result: unknown = await response.json();
    if (
      !response.ok ||
      typeof result !== "object" ||
      result === null ||
      !("success" in result) ||
      result.success !== true
    ) {
      return ApiResponse.error("Security check failed. Please try again.", 400);
    }
    return ApiResponse.success({ verified: true }, 200, "Signup verification passed");
  } catch (error: unknown) {
    console.error("API Route Error [POST /api/auth/captcha]:", error);
    return ApiResponse.error("Could not verify the security challenge", 502);
  }
}
