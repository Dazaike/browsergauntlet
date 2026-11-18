import type { ChallengeComponent } from '@/challenges/types'
import C17KeyboardShortcuts from './C17KeyboardShortcuts'
import C18TabNavigation from './C18TabNavigation'
import C19TypingAccuracy from './C19TypingAccuracy'
import C20Autocomplete from './C20Autocomplete'
import C21OtpCode from './C21OtpCode'
import C22KeyboardMenu from './C22KeyboardMenu'

export const level3: Record<string, ChallengeComponent> = {
  c17: C17KeyboardShortcuts,
  c18: C18TabNavigation,
  c19: C19TypingAccuracy,
  c20: C20Autocomplete,
  c21: C21OtpCode,
  c22: C22KeyboardMenu,
}
