import type { ChallengeComponent } from '@/challenges/types'
import C41ShoppingCheckout from './C41ShoppingCheckout'
import C42AccountRegistration from './C42AccountRegistration'
import C43TravelBooking from './C43TravelBooking'
import C44KanbanBoard from './C44KanbanBoard'
import C45DataTable from './C45DataTable'
import C46SettingsDashboard from './C46SettingsDashboard'
import C47EmailInterface from './C47EmailInterface'
import C48MultiPageWorkflow from './C48MultiPageWorkflow'

export const level6: Record<string, ChallengeComponent> = {
  c41: C41ShoppingCheckout,
  c42: C42AccountRegistration,
  c43: C43TravelBooking,
  c44: C44KanbanBoard,
  c45: C45DataTable,
  c46: C46SettingsDashboard,
  c47: C47EmailInterface,
  c48: C48MultiPageWorkflow,
}
