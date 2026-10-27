import { ApiResponse } from "@/lib/apiResponse";
import connectDB from "@/lib/db";
import Setting from "@/models/setting.model";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return ApiResponse.error("Owner ID is required", 400);
    }

    await connectDB();

    const setting = await Setting.findOne({ userId });

    return ApiResponse.success(setting, 200, "Setting fetched successfully");
  } catch (error: any) {
    console.error("API Route Error [/api/setting/get]:", error);
    return ApiResponse.error(
      "An unexpected server error occurred while fetching settings.",
      500,
      process.env.NODE_ENV === "development" ? error.message : undefined,
    );
  }
}
