import GuidePopover from '../ui/GuidePopover'
import { GRADES, GRADE_META, MIXED_META } from './GradeBadge'
import { STAGES } from './LifecycleBadge'

/** Explains the grade and lifecycle badge colours used on harvest batches */
export default function StatusGuide() {
  return (
    <GuidePopover
      sections={[
        {
          heading: 'Quality grade',
          items: [
            ...GRADES.map((g) => ({ key: g, dot: GRADE_META[g].dot, label: `Grade ${g}`, meaning: GRADE_META[g].meaning })),
            { key: 'mixed', dot: MIXED_META.dot, label: 'Mixed Grades', meaning: 'Batch split into several grades; hover to see the kg of each' },
            { key: 'legacy', dot: 'bg-gray-300', label: 'Legacy', meaning: 'One overall grade, recorded before grade quantities were introduced' },
          ],
        },
        {
          heading: 'Lifecycle',
          items: STAGES.map((s) => ({ key: s.stage, dot: s.dot, label: s.label, meaning: s.meaning })),
        },
      ]}
    />
  )
}
