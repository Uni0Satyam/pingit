import { Suspense } from "react";
import Image from "next/image";
import HomeContent from "./HomeContent";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main
          className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f7f5] px-6 py-16 text-zinc-950"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_42%,rgba(24,24,27,0.07),transparent_58%)]"
          />
          <div className="w-full max-w-md text-center">

            <div className="rounded-[28px] border px-7 py-10 sm:px-10 sm:py-12">
              <div className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-[30px] bg-zinc-900/5 animate-ping motion-reduce:animate-none"
                />
                <span className="relative flex h-[68px] w-[68px] items-center justify-center rounded-[22px] bg-zinc-900 shadow-lg shadow-zinc-900/15">
                  <Image
                    src="/icon.svg"
                    alt=""
                    width={68}
                    height={68}
                    priority
                    className="h-full w-full rounded-[22px] animate-pulse motion-reduce:animate-none"
                  />
                </span>
              </div>
            </div>
          </div>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
