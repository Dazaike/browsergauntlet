import type { ChallengeComponent } from '@/challenges/types'
import C31ModalDialogs from './C31ModalDialogs'
import C32ToastNotifications from './C32ToastNotifications'
import C33InfiniteScroll from './C33InfiniteScroll'
import C34Pagination from './C34Pagination'
import C35SearchFilter from './C35SearchFilter'
import C36Accordion from './C36Accordion'
import C37Tabs from './C37Tabs'
import C38DelayedElements from './C38DelayedElements'
import C39DynamicContent from './C39DynamicContent'
import C40NestedScroll from './C40NestedScroll'

export const level5: Record<string, ChallengeComponent> = {
  c31: C31ModalDialogs,
  c32: C32ToastNotifications,
  c33: C33InfiniteScroll,
  c34: C34Pagination,
  c35: C35SearchFilter,
  c36: C36Accordion,
  c37: C37Tabs,
  c38: C38DelayedElements,
  c39: C39DynamicContent,
  c40: C40NestedScroll,
}
