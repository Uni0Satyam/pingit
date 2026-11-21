import { createClient } from "@/lib/supabase/server";
import connectDB from "@/lib/db";
import { ensureFreeSubscription } from "@/models/subscription.model";
import User from "@/models/user.model";

interface SessionUser {
  id: string;
  email: string;
  userProfile: { firstName: string; lastName: string };
}

export interface AuthSession {
  user: SessionUser;
}

export async function getSession(): Promise<AuthSession | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const authUser = data.user;
  const email = authUser?.email?.trim().toLowerCase();

  if (error || !authUser || !email || !authUser.email_confirmed_at) {
    return null;
  }

  const metadataName = authUser.user_metadata.full_name;
  const fullName =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : email.split("@")[0];

  await connectDB();
  let account = await User.findOne({ authUserId: authUser.id });

  if (!account) {
    const priorAccount = await User.findOne({ email });
    account = priorAccount
      ? await User.findOneAndUpdate(
          { _id: priorAccount._id },
          { $set: { authUserId: authUser.id, email } },
          { new: true, runValidators: true },
        )
      : await User.findOneAndUpdate(
          { authUserId: authUser.id },
          {
            $setOnInsert: {
              userId: authUser.id,
              authUserId: authUser.id,
              email,
              name: fullName,
            },
          },
          {
            upsert: true,
            new: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          },
        );
  } else if (account.email !== email) {
    account = await User.findOneAndUpdate(
      { _id: account._id },
      { $set: { email } },
      { new: true, runValidators: true },
    );
  }

  if (!account) return null;

  if (!account.name && fullName) {
    account.name = fullName;
    await account.save();
  }

  await ensureFreeSubscription(account._id);

  const [firstName = "", ...lastNameParts] = (account.name || fullName).split(/\s+/);
  return {
    user: {
      id: account.userId,
      email,
      userProfile: { firstName, lastName: lastNameParts.join(" ") },
    },
  };
}
