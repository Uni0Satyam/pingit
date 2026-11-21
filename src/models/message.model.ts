import mongoose, { model, Schema, Types } from "mongoose";

export type MessageRole = "visitor" | "assistant" | "system";

export interface IMessage {
  conversationId: Types.ObjectId;
  role: MessageRole;
  content: string;
  sentAt: Date;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    role: {
      type: String,
      enum: ["visitor", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    metadata: {
      type: Map,
      of: String,
    },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, sentAt: 1 });

const Message =
  mongoose.models.Message || model<IMessage>("Message", messageSchema);

export default Message;
