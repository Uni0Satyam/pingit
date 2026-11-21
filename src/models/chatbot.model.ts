import mongoose, { model, Schema, Types } from "mongoose";

export interface IChatbotSettings {
  welcomeMessage: string;
  primaryColor: string;
  systemPrompt: string;
  chatMode: "standard" | "smart";
}

export interface IChatbot {
  userId: Types.ObjectId;
  name: string;
  businessName: string;
  businessEmail: string;
  knowledgeBase: string;
  allowedDomains: string[];
  status: "draft" | "active" | "disabled" | "paused";
  settings: IChatbotSettings;
  lastTrafficAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}


const chatbotSchema = new Schema<IChatbot>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    businessName: {
      type: String,
      required: true,
      trim: true,
    },

    businessEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    knowledgeBase: {
      type: String,
      default: "",
    },

    allowedDomains: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: ["draft", "active", "disabled", "paused"],
      default: "draft",
    },

    settings: {
      welcomeMessage: {
        type: String,
        default: "Hi! How can I help you?",
      },

      primaryColor: {
        type: String,
        default: "#2563eb",
      },

      systemPrompt: {
        type: String,
        default: "",
      },

      chatMode: {
        type: String,
        enum: ["standard", "smart"],
        default: "standard",
      },
    },
    lastTrafficAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

chatbotSchema.index({ userId: 1, createdAt: -1 });

chatbotSchema.virtual("usageRecords", {
  ref: "UsageRecord",
  localField: "_id",
  foreignField: "chatbotId",
});
chatbotSchema.virtual("conversations", {
  ref: "Conversation",
  localField: "_id",
  foreignField: "chatbotId",
});
chatbotSchema.virtual("knowledgeSources", {
  ref: "KnowledgeSource",
  localField: "_id",
  foreignField: "chatbotId",
});

const Chatbot = mongoose.models.Chatbot || model("Chatbot", chatbotSchema);
export default Chatbot;
