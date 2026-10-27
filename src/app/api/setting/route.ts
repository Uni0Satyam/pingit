import { ApiResponse } from "@/lib/apiResponse";
import connectDB from "@/lib/db";
import Setting from "@/models/setting.model";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { userId, businessName, businessEmail, knowledge } = await req.json();

    if (!userId) {
      return ApiResponse.error("Owner ID is required", 400);
    }

    await connectDB();

    const setting = await Setting.findOneAndUpdate(
      { userId },
      { businessName, businessEmail, knowledge },
      { new: true, upsert: true },
    );

    return ApiResponse.success(
      setting,
      200,
      "Settings synchronized successfully",
    );
  } catch (error: any) {
    console.error("API Route Error [/api/setting]:", error);
    return ApiResponse.error(
      "An unexpected server error occurred while updating settings.",
      500,
      process.env.NODE_ENV === "development" ? error.message : undefined,
    );
  }
}
