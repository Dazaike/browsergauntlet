import { useMemo } from 'react'
import { Download, FileJson } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildReport, download, reportToCSV, stamp } from '@/lib/report'
import { useStore } from '@/lib/store'

export function ReportPage() {
  const records = useStore((s) => s.records)
  const log = useStore((s) => s.log)
  const run = useStore((s) => s.run)
  const settings = useStore((s) => s.settings)
  const mode = useStore((s) => s.mode)

  // Rebuilt whenever any source slice changes; read-only snapshot of real state.
  const json = useMemo(() => JSON.stringify(buildReport(), null, 2), [records, log, run, settings, mode])

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">JSON report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only snapshot for automation harnesses. Also available in the page as <code className="font-mono text-xs">window.browserGauntlet.getReport()</code> and via the element <code className="font-mono text-xs">#report-json</code>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button id="report-download-json" variant="outline" size="sm" onClick={() => download(`browsergauntlet-${stamp()}.json`, json, 'application/json')}><FileJson /> Download JSON</Button>
          <Button id="report-download-csv" variant="outline" size="sm" onClick={() => download(`browsergauntlet-${stamp()}.csv`, reportToCSV(JSON.parse(json)), 'text/csv')}><Download /> Download CSV</Button>
        </div>
      </div>
      <pre id="report-json" data-testid="report-json" tabIndex={0} aria-label="Report JSON" className="thin-scroll max-h-[70vh] overflow-auto rounded-lg border border-border bg-zinc-950 p-4 font-mono text-xs leading-5 text-zinc-200">{json}</pre>
    </div>
  )
}
