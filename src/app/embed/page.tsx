import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";

type EmbedPageProps = {
  searchParams: Promise<{ chatbotId?: string }>;
};

export default async function EmbedPage({ searchParams }: EmbedPageProps) {
  return (
    <Suspense fallback={null}>
      <EmbedRedirect searchParams={searchParams} />
    </Suspense>
  );
}

async function EmbedRedirect({
  searchParams,
}: EmbedPageProps): Promise<never> {
  await connection();
  const { chatbotId } = await searchParams;
  if (!chatbotId) {
    redirect("/dashboard?tab=embed");
  }
  redirect(`/dashboard?tab=embed&chatbotId=${encodeURIComponent(chatbotId)}`);
}
