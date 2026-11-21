import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginForm from "@/app/login/LoginForm";
import { getSession } from "@/app/utils/getSession";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <Suspense
      fallback={
        <main
          className="flex min-h-screen items-center justify-center bg-[#f7f7f5] px-6 text-sm text-zinc-500"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          Loading sign in…
        </main>
      }
    >
      <LoginPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginPageContent({ searchParams }: LoginPageProps) {
  if (await getSession()) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const authError =
    params.error === "confirmation" || params.error === "oauth"
      ? params.error
      : undefined;

  return <LoginForm authError={authError} />;
}
