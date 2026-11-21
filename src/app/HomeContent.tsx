import HomeClient from "@/components/HomeClient";
import { getSession } from "./utils/getSession";

/**
 * Async server component that fetches the Supabase Auth session.
 * Wrapped in <Suspense> by page.tsx so the static shell renders instantly.
 */
export default async function HomeContent() {
  const session = await getSession();

  const userProfile = session
    ? { id: session.user.id, ...session.user.userProfile }
    : undefined;

  return <HomeClient userProfile={userProfile} />;
}

