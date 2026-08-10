export interface User {
  id: number
  username: string
  email: string
  full_name: string
  role: 'admin' | 'worker' | 'user'
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

export interface Harvest {
  id: number
  batch_number: string
  field_name: string
  harvest_date: string
  quantity_kg: number
  quality_grade: 'A' | 'B' | 'C' | 'D'
  ripeness_level?: number
  harvest_status: HarvestStatus
  spoilage_kg: number
  rejected_kg: number
  marketable_yield_kg: number
  marketable_yield_percent: number
  spoilage_rate_percent: number
  rejection_rate_percent: number
  notes?: string
  worker_id: number
  created_at: string
  updated_at: string
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
}

export interface QualityTargets {
  id: number
  max_spoilage_rate: number
  max_rejection_rate: number
  updated_at: string
}

export interface Transport {
  id: number
  batch_id?: number
  harvest_id?: number
  destination: string
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled'
  scheduled_date: string
  actual_delivery?: string
  driver_name: string
  vehicle_number: string
  cargo_weight_kg?: number
  notes?: string
  created_at: string
}

export interface TransportEfficiency {
  total_transports: number
  delivered: number
  in_transit: number
  pending: number
  delivery_rate_percent: number
  avg_delivery_days?: number
}

export interface Waste {
  id: number
  harvest_id?: number
  waste_type: 'rotten' | 'damaged' | 'overripe' | 'unused_parts' | 'other'
  quantity_kg: number
  classification: 'compostable' | 'recyclable' | 'non-recyclable'
  disposal_method?: string
  notes?: string
  recorded_by?: number
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
  task_type: 'harvest' | 'transport' | 'inspection' | 'maintenance' | 'other'
  assigned_date: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  details?: string
  priority?: 'low' | 'medium' | 'high'
  created_at: string
}

export interface AIHarvestPrediction {
  recommendation: string
  quality_prediction: string
  transport_priority: string
  confidence_score: number
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
  confidence_score: number
  model_version: string
  created_at: string
}
