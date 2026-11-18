import type { ChallengeComponent } from '@/challenges/types'
import { level1 } from '@/challenges/level1'
import { level2 } from '@/challenges/level2'
import { level3 } from '@/challenges/level3'
import { level4 } from '@/challenges/level4'
import { level5 } from '@/challenges/level5'
import { level6 } from '@/challenges/level6'
import { level7 } from '@/challenges/level7'

/** id ("c01") -> component. Each levelN.ts barrel is owned by that level's author. */
export const COMPONENTS: Record<string, ChallengeComponent> = {
  ...level1, ...level2, ...level3, ...level4, ...level5, ...level6, ...level7,
}
