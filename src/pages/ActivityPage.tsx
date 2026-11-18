import { ActivityLog } from '@/components/ActivityLog'

export function ActivityPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity log</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every event below was produced by real application state changes: interactions, validations, scoring and system events.</p>
      </div>
      <ActivityLog height={560} title="All activity" />
    </div>
  )
}
