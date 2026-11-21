export default function UserProfileSkeleton() {
  return (
    <div className="border-t border-zinc-100 p-4 animate-pulse">
      <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-2.5 border border-zinc-200/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 shrink-0 rounded-full bg-zinc-300" />
          <div className="space-y-1.5">
            <div className="h-3 w-24 rounded bg-zinc-300" />
            <div className="h-2.5 w-32 rounded bg-zinc-200" />
          </div>
        </div>
        <div className="size-7 rounded-lg bg-zinc-200" />
      </div>
    </div>
  );
}
