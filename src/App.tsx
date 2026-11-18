import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppShell } from '@/components/layout/AppShell'
import { ActivityPage } from '@/pages/ActivityPage'
import { ChallengePage } from '@/pages/ChallengePage'
import { ChallengesPage } from '@/pages/ChallengesPage'
import { Dashboard } from '@/pages/Dashboard'
import { ModesPage } from '@/pages/ModesPage'
import { ReportPage } from '@/pages/ReportPage'
import { ResultsPage } from '@/pages/ResultsPage'

export function App() {
  return (
    <TooltipProvider delayDuration={150}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="challenges" element={<ChallengesPage />} />
          <Route path="challenge/:slug/*" element={<ChallengePage />} />
          <Route path="modes" element={<ModesPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="report" element={<ReportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
