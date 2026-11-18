import type { ChallengeComponent } from '@/challenges/types'
import C23MultiStepForm from './C23MultiStepForm'
import C24DatePicker from './C24DatePicker'
import C25TimePicker from './C25TimePicker'
import C26ConditionalFields from './C26ConditionalFields'
import C27FieldValidation from './C27FieldValidation'
import C28DynamicDropdowns from './C28DynamicDropdowns'
import C29FileUpload from './C29FileUpload'
import C30RichText from './C30RichText'

export const level4: Record<string, ChallengeComponent> = {
  c23: C23MultiStepForm,
  c24: C24DatePicker,
  c25: C25TimePicker,
  c26: C26ConditionalFields,
  c27: C27FieldValidation,
  c28: C28DynamicDropdowns,
  c29: C29FileUpload,
  c30: C30RichText,
}
