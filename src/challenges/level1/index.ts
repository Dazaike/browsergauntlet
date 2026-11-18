import type { ChallengeComponent } from '@/challenges/types'
import C01ButtonClick from './C01ButtonClick'
import C02TextInput from './C02TextInput'
import C03Checkboxes from './C03Checkboxes'
import C04RadioButtons from './C04RadioButtons'
import C05Dropdown from './C05Dropdown'
import C06Toggles from './C06Toggles'
import C07FormSubmission from './C07FormSubmission'

export const level1: Record<string, ChallengeComponent> = {
  c01: C01ButtonClick,
  c02: C02TextInput,
  c03: C03Checkboxes,
  c04: C04RadioButtons,
  c05: C05Dropdown,
  c06: C06Toggles,
  c07: C07FormSubmission,
}
