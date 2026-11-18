import type { ChallengeComponent } from '@/challenges/types'
import C08Slider from './C08Slider'
import C09ClickHold from './C09ClickHold'
import C10DragDrop from './C10DragDrop'
import C11Sorting from './C11Sorting'
import C12DoubleClick from './C12DoubleClick'
import C13RightClick from './C13RightClick'
import C14HoverMenu from './C14HoverMenu'
import C15Resize from './C15Resize'
import C16Drawing from './C16Drawing'

export const level2: Record<string, ChallengeComponent> = {
  c08: C08Slider,
  c09: C09ClickHold,
  c10: C10DragDrop,
  c11: C11Sorting,
  c12: C12DoubleClick,
  c13: C13RightClick,
  c14: C14HoverMenu,
  c15: C15Resize,
  c16: C16Drawing,
}
