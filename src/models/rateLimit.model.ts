import mongoose, { model, Schema } from "mongoose";

interface IChatRateLimit {
  key: string;
  windowStart: Date;
  expiresAt: Date;
  count: number;
}

const chatRateLimitSchema = new Schema<IChatRateLimit>(
  {
    key: { type: String, required: true },
    windowStart: { type: Date, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    count: { type: Number, required: true, min: 0 },
  },
  { versionKey: false },
);

chatRateLimitSchema.index({ key: 1, windowStart: 1 }, { unique: true });

const ChatRateLimit =
  mongoose.models.ChatRateLimit ||
  model<IChatRateLimit>("ChatRateLimit", chatRateLimitSchema);

function readLimit(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function consumeWindow(key: string, limit: number, now: Date) {
  const windowMilliseconds = 60_000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds);
  const expiresAt = new Date(windowStart.getTime() + 2 * windowMilliseconds);
  try {
    const result = await ChatRateLimit.findOneAndUpdate(
      { key, windowStart },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return (result?.count ?? limit + 1) <= limit;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      const result = await ChatRateLimit.findOneAndUpdate(
        { key, windowStart },
        { $inc: { count: 1 } },
        { new: true },
      );
      return (result?.count ?? limit + 1) <= limit;
    }
    throw error;
  }
}

export async function checkChatRateLimit(ipKey: string, sessionKey: string) {
  const now = new Date();
  const [ipAllowed, sessionAllowed] = await Promise.all([
    consumeWindow(`ip:${ipKey}`, readLimit("CHAT_RATE_LIMIT_IP_PER_MINUTE", 30), now),
    consumeWindow(
      `session:${sessionKey}`,
      readLimit("CHAT_RATE_LIMIT_SESSION_PER_MINUTE", 12),
      now,
    ),
  ]);
  return { allowed: ipAllowed && sessionAllowed };
}

export default ChatRateLimit;
