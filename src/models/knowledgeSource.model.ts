import mongoose, { model, Schema, Types } from "mongoose";

export type KnowledgeSourceType = "website_url" | "document" | "text";
export type KnowledgeProcessingStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed";

export interface IKnowledgeSource {
  userId: Types.ObjectId;
  chatbotId: Types.ObjectId;
  type: KnowledgeSourceType;
  name: string;
  url?: string;
  fileName?: string;
  storageKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  contentHash?: string;
  textContent?: string;
  processingStatus: KnowledgeProcessingStatus;
  indexedAt?: Date;
  processingError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeSourceSchema = new Schema<IKnowledgeSource>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    chatbotId: {
      type: Schema.Types.ObjectId,
      ref: "Chatbot",
      required: true,
    },
    type: {
      type: String,
      enum: ["website_url", "document", "text"],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    url: {
      type: String,
      trim: true,
    },
    fileName: {
      type: String,
      trim: true,
    },
    storageKey: {
      type: String,
      trim: true,
    },
    mimeType: {
      type: String,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      min: 0,
    },
    contentHash: {
      type: String,
      trim: true,
    },
    textContent: String,
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "ready", "failed"],
      default: "pending",
      required: true,
    },
    indexedAt: Date,
    processingError: {
      type: String,
      maxlength: 2000,
    },
  },
  { timestamps: true },
);

knowledgeSourceSchema.index({ chatbotId: 1, createdAt: -1 });
knowledgeSourceSchema.index({ userId: 1, processingStatus: 1 });
knowledgeSourceSchema.index(
  { chatbotId: 1, contentHash: 1 },
  { sparse: true },
);

const KnowledgeSource =
  mongoose.models.KnowledgeSource ||
  model<IKnowledgeSource>("KnowledgeSource", knowledgeSourceSchema);

export default KnowledgeSource;
