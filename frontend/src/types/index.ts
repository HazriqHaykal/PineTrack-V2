export interface User {
  id: number
  username: string
  email: string
  full_name: string
  role: 'admin' | 'worker' | 'user'
  is_active?: boolean
  created_at?: string
}

export interface SystemUser extends User {
  is_active: boolean
  created_at: string
  tasks_total: number
  tasks_completed: number
}

export interface UserStats {
  member_since: string
  harvest_count: number
  harvest_kg_total: number
  harvest_kg_this_month: number
  waste_count: number
  waste_kg_this_month: number
  transport_count: number
  deliveries_completed: number
  deliveries_on_time: number
  tasks_total: number
  tasks_completed: number
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  skip: number
  limit: number
}

export type HarvestStatus = 'pending' | 'graded' | 'processed' | 'rejected'

export type GradeLetter = 'A' | 'B' | 'C' | 'D'

/** kg per grade as entered by the farmer; grades left out count as 0 kg */
export type GradeQuantities = Partial<Record<GradeLetter, number>>

/**
 * grade_based: a grading breakdown is recorded (FR08)
 * legacy:      one overall grade, recorded before breakdowns existed
 * ungraded:    not graded yet
 */
export type GradingBasis = 'grade_based' | 'legacy' | 'ungraded'

export interface Harvest {
  id: number
  batch_number: string
  field_name: string
  harvest_date: string
  quantity_kg: number
  /** A-D, "mixed" for a breakdown with several grades, or "ungraded" */
  quality_grade: string
  /** Sent when creating or re-grading a batch */
  grades?: GradeQuantities
  ripeness_level?: number
  harvest_status: HarvestStatus
  spoilage_kg: number
  rejected_kg: number
  marketable_yield_kg: number
  marketable_yield_percent: number
  spoilage_rate_percent: number
  rejection_rate_percent: number
  grading_basis: GradingBasis
  grade_quantities: Record<GradeLetter, number> | null
  marketable_grades: GradeLetter[] | null
  graded_marketable_kg: number | null
  /** Grades the marketability policy excludes */
  non_marketable_kg: number | null
  /** Non-marketable kg sorted out at harvest (part of rejected_kg, logged as waste) */
  rejected_at_sorting_kg: number | null
  rejected_after_grading_kg: number | null
  grading_yield_percent: number | null
  grading_policy_version: number | null
  notes?: string
  worker_id: number
  created_at: string
  updated_at: string
}

/** Quantity-weighted yield over grade-based batches; legacy and ungraded batches are counted apart */
export interface FarmYield {
  graded_batches: number
  harvested_kg: number
  marketable_kg: number
  graded_marketable_kg: number
  non_marketable_kg: number
  spoilage_kg: number
  rejected_kg: number
  marketable_yield_percent: number | null
  grading_yield_percent: number | null
  grade_kg: Record<GradeLetter, number>
  grade_percent: Record<GradeLetter, number>
  legacy_batches: number
  legacy_kg: number
  ungraded_batches: number
  ungraded_kg: number
}

export interface MarketabilityPolicy {
  version: number
  marketable_grades: GradeLetter[]
  non_marketable_grades: GradeLetter[]
  note?: string | null
  created_at: string
  created_by?: string | null
  is_current: boolean
  explanation: string
}

export interface BatchGrading {
  basis: GradingBasis
  grades: { grade: GradeLetter; quantity_kg: number; percent: number; is_marketable: boolean }[]
  harvested_kg: number
  graded_marketable_kg: number | null
  non_marketable_kg: number | null
  rejected_at_sorting_kg: number | null
  rejected_after_grading_kg: number | null
  spoilage_kg: number
  rejected_kg: number
  marketable_kg: number
  marketable_yield_percent: number
  grading_yield_percent: number | null
  marketable_grades: GradeLetter[] | null
  policy_version: number | null
  current_policy_version: number | null
  legacy_grade: string | null
  policy_explanation: string
}

export interface HarvestStats {
  total_harvests: number
  total_quantity_kg: number
  average_quantity_kg: number
  by_grade: Record<string, number>
  this_month: number
  total_spoilage_kg?: number
  total_rejected_kg?: number
  total_marketable_yield_kg?: number
  spoilage_rate_percent?: number
  rejection_rate_percent?: number
  marketable_yield_percent?: number
  grading?: FarmYield
}

export interface QualityTargets {
  id: number
  max_spoilage_rate: number
  max_rejection_rate: number
  updated_at: string
}

export interface Transport {
  id: number
  harvest_id?: number | null
  batch_number?: string | null
  driver_id?: number | null
  destination: string
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled'
  scheduled_date: string
  actual_delivery?: string | null
  driver_name: string
  vehicle_number: string
  cargo_weight_kg?: number | null
  notes?: string | null
  user_id?: number
  created_at: string
  updated_at?: string
}

export interface TransportEfficiency {
  total_transports: number
  delivered: number
  in_transit: number
  pending: number
  delivery_rate_percent: number
  on_time_rate_percent?: number
  avg_delivery_days?: number
}

export interface Waste {
  id: number
  harvest_id?: number | null
  batch_number?: string | null
  waste_type: 'rotten' | 'damaged' | 'overripe' | 'unused_parts' | 'other'
  quantity_kg: number
  classification: 'compostable' | 'recyclable' | 'non-recyclable'
  disposal_method?: string | null
  notes?: string | null
  recorded_by?: number
  waste_date?: string
  created_at: string
}

export interface WasteStats {
  total_records: number
  total_waste_kg: number
  by_type: Record<string, number>
  by_classification: Record<string, number>
}

export interface Schedule {
  id: number
  worker_id: number
  worker_name?: string
  task_type:
    | 'inspection' | 'sorting_grading' | 'packaging' | 'transport_preparation' | 'transport' | 'waste_handling'
    | 'harvest' | 'maintenance' | 'other'
  assigned_date: string
  scheduled_time?: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  details?: string | null
  priority?: 'low' | 'medium' | 'high'
  created_at: string
  updated_at?: string
}

export interface AIHarvestPrediction {
  recommendation: string
  quality_prediction: string
  transport_priority: string
  confidence_score: number
  explanation?: string
  source?: 'gemini' | 'rules'
  model_version?: string
  reasoning: {
    ripeness_level: number
    days_since_harvest: number
    field_condition: number
    total_score: number
  }
}

export interface AIWastePrediction {
  waste_type: string
  disposal_method: string
  confidence_score: number
  explanation?: string
  source?: 'gemini' | 'rules'
  model_version?: string
  quality_grade: string
  damage_level: number
  age_days: number
}

export interface AIMetrics {
  total_predictions: number
  average_confidence: number
  by_prediction_type: Record<string, number>
  by_model_version: Record<string, number>
}

export interface AILog {
  id: number
  harvest_id?: number
  prediction_type: string
  input_data: Record<string, unknown>
  prediction_result: string
  confidence_score: number | null
  model_version: string
  created_at: string
}

export interface AIStatus {
  provider: 'gemini' | 'rules'
  model: string
  gemini_configured: boolean
}

export interface AIRecommendation {
  id: number
  type: 'harvest' | 'waste' | 'transport' | 'schedule' | 'sulur'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  confidence: number
  impact: string
  action: string
}

export interface AIRecommendations {
  items: AIRecommendation[]
  source: 'gemini' | 'rules'
  model_version: string
  generated_at: string
  /** Which module(s) this set analysed; older cached sets have none (post-harvest) */
  scope?: AnalysisScope
  /** The data the agent was given for this set */
  snapshot?: FarmSnapshot | SulurOnlySnapshot | null
}

/** Shared intelligence scope: both modules, or one of them */
export type AnalysisScope = 'all' | 'post_harvest' | 'sulur'

/** Sulur Inventory data sent to the agent (backend SulurInsightsService.build_snapshot). Quantities are pieces. */
export interface SulurSnapshot {
  unit: string
  period_days: number
  date: string
  storage_days_limit: number
  batches: number
  certified_batches: number
  totals: { available: number; reserved: number; planted: number; sold: number; damaged: number }
  by_variety: {
    variety: string; batches: number; available: number; reserved: number; planted: number
    sold: number; damaged: number; min_stock_threshold: number; below_threshold: boolean
  }[]
  aging_batches: { batch_code: string; variety: string; days_stored: number; treatment_status: string; available: number }[]
  uncertified_batches: { batch_code: string; variety: string; available: number }[]
  uncertified_count: number
  movements_in_period: Record<string, number>
}

export interface SulurOnlySnapshot {
  scope: 'sulur'
  period_days: number
  date: string
  sulur: SulurSnapshot
}

/** GET /analytics/sulur. Quantities are sulur pieces, never kg. */
export interface SulurPeriodKpis { stock_in: number; planted: number; sold: number; damaged: number; movements: number }
export interface SulurAnalytics {
  generated_at: string
  unit: string
  has_data: boolean
  batches: number
  certified_batches: number
  totals: SulurSnapshot['totals']
  by_variety: SulurSnapshot['by_variety']
  by_grade: { name: string; batches: number; available: number }[]
  by_treatment: { name: string; batches: number; available: number }[]
  movement_trend: { month: string; stock_in: number; plant: number; sell: number; damage: number }[]
  kpis: { current: SulurPeriodKpis; previous: SulurPeriodKpis; period_days: number }
  alerts: { below_threshold: number; aging_batches: number; uncertified_batches: number }
}

/** Aggregated farm data sent to the agent (backend AIService.build_farm_snapshot) */
export interface FarmSnapshot {
  period_days: number
  date: string
  targets: { max_spoilage_rate_percent: number; max_rejection_rate_percent: number }
  harvest: {
    batches: number
    total_kg: number
    spoilage_rate_percent: number
    rejection_rate_percent: number
    grade_counts: Record<string, number>
    ungraded_pending_batches: number
    by_field: { field: string; batches: number; kg: number; loss_rate_percent: number; avg_ripeness: number | null }[]
  }
  waste: { records: number; total_kg: number; waste_rate_percent: number; by_type_kg: Record<string, number> }
  transport: {
    total: number; pending: number; in_transit: number; delivered: number; delivered_late: number
    overdue_not_delivered: { destination: string; scheduled_date: string; status: string }[]
  }
  tasks: { open: number; overdue: number; high_priority_open: number; completed: number }
  scope?: AnalysisScope
  /** Present when the scope is "all" */
  sulur?: SulurSnapshot
}

export interface PeriodKpis {
  marketable_yield_percent: number | null
  marketable_kg: number
  graded_batches: number
  harvest_volume_kg: number
  harvest_batches: number
  avg_batch_kg: number
  grade_a_percent: number
  waste_kg: number
  waste_rate_percent: number
  on_time_rate_percent: number
  avg_delivery_delay_days: number
}

export interface AnalyticsOverview {
  generated_at: string
  kpis: { current: PeriodKpis; previous: PeriodKpis; period_days: number }
  harvest_trend: { month: string; kg: number; batches: number }[]
  grade_distribution: { grade: string; count: number; percent: number }[]
  grading: FarmYield
  yield_trend: { month: string; graded_batches: number; harvested_kg: number; marketable_kg: number; marketable_yield_percent: number | null }[]
  waste_by_type: { type: string; kg: number }[]
  transport_trend: { month: string; delivered: number; delayed: number }[]
  worker_performance: { worker_id: number; name: string; tasks: number; completed: number }[]
  recent_harvests: { id: number; batch_number: string; field: string; date: string; kg: number; grade: string; worker: string }[]
  alerts: { level: 'warning' | 'info' | 'success'; msg: string; link: string | null }[]
  workers: { active: number; on_field_today: number }
  ai: { total_predictions: number; predictions_this_month: number; average_confidence: number }
}

export interface AppSettings {
  farm_name: string
  timezone: string
  language: string
  notifications: Record<string, boolean>
  security: Record<string, boolean>
}

// ── Batch lifecycle & traceability ───────────────────────────────────────────

export type LifecycleStatus =
  | 'awaiting_inspection'
  | 'ready_for_dispatch'
  | 'partially_allocated'
  | 'fully_allocated'
  | 'in_transit'
  | 'partially_delivered'
  | 'delivered'
  | 'closed'

export interface BatchLifecycle {
  code: LifecycleStatus
  label: string
  reason: string
}

/** All quantities in kg, calculated by the backend */
export interface BatchQuantities {
  unit: 'kg'
  grading_basis: GradingBasis
  marketable_yield_percent: number
  harvested_kg: number
  spoilage_kg: number
  rejected_kg: number
  /** Grades the marketability policy excludes (none by default) */
  non_marketable_kg: number
  rejected_at_sorting_kg: number
  marketable_kg: number
  pending_kg: number
  in_transit_kg: number
  reserved_kg: number
  delivered_kg: number
  dispatched_kg: number
  available_kg: number
  withheld_kg: number
  over_allocated_kg: number
  unquantified_transports: number
  waste_recorded_kg: number
  recorded_losses_kg: number
  unclassified_losses_kg: number
  waste_exceeds_losses_kg: number
  waste_policy: string
}

export interface BatchEvent {
  id: number
  batch_id: number
  event_type: string
  actor_user_id?: number | null
  actor_name: string
  related_module: 'harvest' | 'transport' | 'waste'
  related_record_id?: number | null
  description: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface BatchEventList extends PaginatedResponse<BatchEvent> {
  event_types: string[]
  history_complete: boolean
  history_note?: string | null
}

export interface BatchDetails {
  batch: Harvest
  created_by?: string | null
  lifecycle: BatchLifecycle
  quantities: BatchQuantities
  grading: BatchGrading
  transports: { items: Transport[]; hidden_count: number }
  waste: { items: Waste[]; hidden_count: number }
  history_complete: boolean
  history_note?: string | null
}

export interface BatchSummary {
  harvest_id: number
  lifecycle_status: LifecycleStatus
  lifecycle_label: string
  marketable_kg: number
  reserved_kg: number
  delivered_kg: number
  available_kg: number
}

// ── Waste analysis (PineTrack Agent) ─────────────────────────────────────────

export type RecoveryRoute = 'processing' | 'low_grade' | 'feed' | 'compost' | 'dispose' | 'review'

/** Assumed RM/kg range for a handling route; null when no value is estimated */
export interface RecoveryRate {
  route: RecoveryRoute
  label: string
  low: number | null
  high: number | null
  basis: string
}

export interface WasteAnalysis {
  waste_id: number
  route: RecoveryRoute
  route_label: string
  action: string
  explanation: string
  alternatives: string[]
  warning: string
  suitable_for_reuse: boolean
  confidence: number
  /** quantity x assumed rate, calculated by the backend (never by the model) */
  value_low: number | null
  value_high: number | null
  rate_low: number | null
  rate_high: number | null
  source: 'gemini' | 'rules'
  model_version: string
  analysed_at: string
  /** The record changed after this analysis ran */
  stale: boolean
}

export interface WasteAnalysisList {
  items: WasteAnalysis[]
  rates: RecoveryRate[]
  agent_available: boolean
}

// ── Harvest & Profit Planner (FR12) ──────────────────────────────────────────

export type PlannerMode = 'target_profit' | 'forecast'

/** Money in RM, quantities in kg, land in ha; variable cost is per marketable kg */
export interface PlannerInput {
  mode: PlannerMode
  selling_price_per_kg: number
  variable_cost_per_kg: number
  fixed_cost: number
  marketable_yield_percent: number
  productivity_kg_per_ha: number
  target_profit?: number
  planned_harvest_kg?: number
  land_area_ha?: number
}

export interface PlannerResult {
  mode: PlannerMode
  calculation_version: string
  harvest_kg: number
  marketable_kg: number
  land_ha: number
  revenue: number
  variable_cost: number
  fixed_cost: number
  total_cost: number
  profit: number
  profit_margin_percent: number | null
  contribution_per_kg: number
  break_even_marketable_kg: number | null
  harvest_source: 'required' | 'planned_harvest' | 'land_area'
  assumptions: Record<string, number | string | null>
  notes: string[]
  disclaimer: string
  steps: { label: string; formula: string; working: string }[]
}

export interface PlannerScenarioResult {
  label: string
  result: PlannerResult | null
  error: string | null
}

export interface WhatIfResult {
  scenarios: { label: string; inputs: Record<string, number>; result: PlannerResult | null; error: string | null }[]
  rules: { field: string; label: string; unit: string; conservative: string; optimistic: string }[]
  note: string
}

export interface HistoricalYield {
  available: boolean
  marketable_yield_percent: number | null
  period_start: string
  period_end: string
  months: number
  included_batches: number
  harvested_kg: number
  marketable_kg: number
  excluded_legacy_batches: number
  excluded_ungraded_batches: number
  min_batches: number
  rules: string
  message: string | null
}
