import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import { ApiResponse } from "@/lib/apiResponse";
import Chatbot from "@/models/chatbot.model";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return ApiResponse.error("Authentication required", 401);
  }

  try {
    await connectDB();
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await Chatbot.updateMany(
      {
        status: "active",
        $or: [
          { lastTrafficAt: { $lte: cutoff } },
          { lastTrafficAt: { $exists: false }, createdAt: { $lte: cutoff } },
        ],
      },
      { $set: { status: "paused" } },
    );
    return ApiResponse.success(
      { paused: result.modifiedCount },
      200,
      "Inactive chatbots paused; no chatbot data was deleted",
    );
  } catch (error: unknown) {
    console.error("API Route Error [GET /api/maintenance/pause-idle-bots]:", error);
    return ApiResponse.error("Could not pause inactive chatbots", 500);
  }
}
