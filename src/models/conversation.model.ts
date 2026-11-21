import mongoose, { model, Schema, Types } from "mongoose";

export type ConversationStatus = "open" | "closed";

export interface IConversation {
  userId: Types.ObjectId;
  chatbotId: Types.ObjectId;
  visitorId: string;
  visitorEmail?: string;
  status: ConversationStatus;
  startedAt: Date;
  lastMessageAt: Date;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
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
    visitorId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    visitorEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
      required: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    metadata: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

conversationSchema.index({ chatbotId: 1, lastMessageAt: -1 });
conversationSchema.index({ userId: 1, lastMessageAt: -1 });
conversationSchema.index({ chatbotId: 1, visitorId: 1, status: 1 });

conversationSchema.virtual("messages", {
  ref: "Message",
  localField: "_id",
  foreignField: "conversationId",
});

const Conversation =
  mongoose.models.Conversation ||
  model<IConversation>("Conversation", conversationSchema);

export default Conversation;
