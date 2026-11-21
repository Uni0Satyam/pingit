import mongoose, { model, Schema, Types } from "mongoose";

export type UsageUnit = "request" | "token";

export interface IUsageRecord {
  userId: Types.ObjectId;
  chatbotId: Types.ObjectId;
  units: number;
  unitType: UsageUnit;
  creditsCharged: number;
  occurredAt: Date;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costAmount?: number;
  costCurrency?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const usageRecordSchema = new Schema<IUsageRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    chatbotId: {
      type: Schema.Types.ObjectId,
      ref: "Chatbot",
      required: true,
      index: true,
    },
    units: {
      type: Number,
      required: true,
      min: 0,
    },
    unitType: {
      type: String,
      enum: ["request", "token"],
      required: true,
    },
    creditsCharged: {
      type: Number,
      required: true,
      min: 0,
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    provider: {
      type: String,
      trim: true,
    },
    model: {
      type: String,
      trim: true,
    },
    inputTokens: {
      type: Number,
      min: 0,
    },
    outputTokens: {
      type: Number,
      min: 0,
    },
    costAmount: {
      type: Number,
      min: 0,
    },
    costCurrency: {
      type: String,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    metadata: {
      type: Map,
      of: String,
    },
  },
  { timestamps: true },
);

usageRecordSchema.index({ userId: 1, occurredAt: -1 });
usageRecordSchema.index({ chatbotId: 1, occurredAt: -1 });

const UsageRecord =
  mongoose.models.UsageRecord ||
  model<IUsageRecord>("UsageRecord", usageRecordSchema);

export default UsageRecord;
