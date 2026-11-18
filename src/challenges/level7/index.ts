import type { ChallengeComponent } from '@/challenges/types'
import C49MovingTargets from './C49MovingTargets'
import C50HoldWindow from './C50HoldWindow'
import C51NestedHoverMenu from './C51NestedHoverMenu'
import C52HorizontalScroll from './C52HorizontalScroll'
import C53StaggeredReveal from './C53StaggeredReveal'
import C54MultiSelect from './C54MultiSelect'
import C55Tooltips from './C55Tooltips'
import C56StickyFloating from './C56StickyFloating'
import C57CustomScrollbar from './C57CustomScrollbar'
import C58Iframe from './C58Iframe'
import C59ShadowDom from './C59ShadowDom'
import C60NetworkRequests from './C60NetworkRequests'
import C61KeyboardOnly from './C61KeyboardOnly'

export const level7: Record<string, ChallengeComponent> = {
  c56: C56StickyFloating,
  c49: C49MovingTargets,
  c50: C50HoldWindow,
  c51: C51NestedHoverMenu,
  c52: C52HorizontalScroll,
  c53: C53StaggeredReveal,
  c54: C54MultiSelect,
  c55: C55Tooltips,
  c57: C57CustomScrollbar,
  c58: C58Iframe,
  c59: C59ShadowDom,
  c60: C60NetworkRequests,
  c61: C61KeyboardOnly,
}
