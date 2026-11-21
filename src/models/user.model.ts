import mongoose, { model, Schema } from "mongoose";

interface IUser {
  /** Stable account ID used by existing widget embeds and API ownership checks. */
  userId: string;
  authUserId?: string;
  name?: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}


const userSchema = new Schema<IUser>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    authUserId: {
      type: String,
      unique: true,
      sparse: true,
    },

    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

userSchema.virtual("chatbots", {
  ref: "Chatbot",
  localField: "_id",
  foreignField: "userId",
});
userSchema.virtual("subscriptions", {
  ref: "Subscription",
  localField: "_id",
  foreignField: "userId",
});
userSchema.virtual("usageRecords", {
  ref: "UsageRecord",
  localField: "_id",
  foreignField: "userId",
});
userSchema.virtual("conversations", {
  ref: "Conversation",
  localField: "_id",
  foreignField: "userId",
});
userSchema.virtual("knowledgeSources", {
  ref: "KnowledgeSource",
  localField: "_id",
  foreignField: "userId",
});

const User = mongoose.models.User || model<IUser>("User", userSchema);
export default User;
