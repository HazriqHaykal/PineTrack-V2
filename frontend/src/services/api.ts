import axios, { AxiosInstance } from 'axios'
import { authService } from './auth'
import {
  LoginResponse,
  Harvest,
  HarvestStats,
  QualityTargets,
  Transport,
  TransportEfficiency,
  Waste,
  WasteStats,
  WasteAnalysis,
  WasteAnalysisList,
  Schedule,
  AIHarvestPrediction,
  AIWastePrediction,
  AIMetrics,
  AILog,
  PaginatedResponse,
  User,
  SystemUser,
  UserStats,
  AIStatus,
  AIRecommendations,
  AnalyticsOverview,
  AppSettings,
  BatchDetails,
  BatchEventList,
  BatchSummary,
  GradeQuantities,
  MarketabilityPolicy,
  HistoricalYield,
  PlannerInput,
  PlannerResult,
  PlannerScenarioResult,
  WhatIfResult,
} from '../types'

/** What a client sends to create a batch; everything else is set by the backend */
export interface HarvestCreateInput {
  field_name: string
  harvest_date: string
  quantity_kg: number
  /** Grading breakdown in kg; leave out for a batch not graded yet */
  grades?: GradeQuantities
  /** Unsellable kg sorted out at harvest; part of quantity_kg, logged in Waste Management */
  non_marketable_kg?: number
  non_marketable_reason?: string
  ripeness_level?: number
  notes?: string
}

export interface HarvestUpdateInput {
  grades?: GradeQuantities
  /** Sent with grades: grades + this = harvested */
  non_marketable_kg?: number
  non_marketable_reason?: string
  ripeness_level?: number
  harvest_status?: Harvest['harvest_status']
  spoilage_kg?: number
  /** Total rejection: non-marketable at sorting plus anything rejected after grading */
  rejected_kg?: number
  notes?: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

class APIClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({ baseURL: API_BASE_URL })

    this.client.interceptors.request.use((config) => {
      const token = authService.getToken()
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    })

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // A rejected token means the session is over; a failed login attempt is not that
        const isLoginAttempt = error.config?.url?.includes('/auth/login')
        if (error.response?.status === 401 && !isLoginAttempt) {
          authService.logout()
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  // ── Auth ──────────────────────────────────────────────────────────────
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await this.client.post('/auth/login', { username, password })
    return res.data
  }

  async register(
    username: string,
    email: string,
    password: string,
    full_name: string
  ): Promise<LoginResponse> {
    const res = await this.client.post('/auth/register', { username, email, password, full_name })
    return res.data
  }

  // ── Harvest ───────────────────────────────────────────────────────────
  async listHarvests(skip = 0, limit = 100): Promise<PaginatedResponse<Harvest>> {
    const res = await this.client.get('/harvest', { params: { skip, limit } })
    return res.data
  }

  async createHarvest(data: HarvestCreateInput): Promise<Harvest> {
    const res = await this.client.post('/harvest', data)
    return res.data
  }

  async getHarvest(id: number): Promise<Harvest> {
    const res = await this.client.get(`/harvest/${id}`)
    return res.data
  }

  async updateHarvest(id: number, data: HarvestUpdateInput): Promise<Harvest> {
    const res = await this.client.patch(`/harvest/${id}`, data)
    return res.data
  }

  async deleteHarvest(id: number): Promise<void> {
    await this.client.delete(`/harvest/${id}`)
  }

  async getHarvestStats(): Promise<HarvestStats> {
    const res = await this.client.get('/harvest/statistics/summary')
    return res.data
  }

  // ── Marketability policy ──────────────────────────────────────────────
  async getMarketabilityPolicy(): Promise<MarketabilityPolicy> {
    const res = await this.client.get('/harvest/policy/marketability')
    return res.data
  }

  async listMarketabilityPolicies(): Promise<MarketabilityPolicy[]> {
    const res = await this.client.get('/harvest/policy/marketability/history')
    return res.data
  }

  async updateMarketabilityPolicy(data: { marketable_grades: string[]; note?: string }): Promise<MarketabilityPolicy> {
    const res = await this.client.put('/harvest/policy/marketability', data)
    return res.data
  }

  // ── Harvest & Profit Planner (admin) ──────────────────────────────────
  async calculatePlan(data: PlannerInput, signal?: AbortSignal): Promise<PlannerResult> {
    const res = await this.client.post('/planner/calculate', data, { signal })
    return res.data
  }

  async comparePlans(scenarios: { label: string; inputs: PlannerInput }[]): Promise<PlannerScenarioResult[]> {
    const res = await this.client.post('/planner/compare', { scenarios })
    return res.data.items
  }

  async getWhatIf(data: PlannerInput, signal?: AbortSignal): Promise<WhatIfResult> {
    const res = await this.client.post('/planner/what-if', data, { signal })
    return res.data
  }

  async getHistoricalYield(months = 12): Promise<HistoricalYield> {
    const res = await this.client.get('/planner/historical-yield', { params: { months } })
    return res.data
  }

  // ── Batch lifecycle & traceability ────────────────────────────────────
  async getBatchDetails(id: number): Promise<BatchDetails> {
    const res = await this.client.get(`/harvest/${id}/details`)
    return res.data
  }

  async getBatchEvents(id: number, eventType?: string): Promise<BatchEventList> {
    const res = await this.client.get(`/harvest/${id}/events`, { params: { event_type: eventType || undefined } })
    return res.data
  }

  async getBatchOverview(): Promise<BatchSummary[]> {
    const res = await this.client.get('/harvest/lifecycle/overview')
    return res.data.items
  }

  async getQualityTargets(): Promise<QualityTargets> {
    const res = await this.client.get('/harvest/targets/quality')
    return res.data
  }

  async updateQualityTargets(data: { max_spoilage_rate: number; max_rejection_rate: number }): Promise<QualityTargets> {
    const res = await this.client.put('/harvest/targets/quality', data)
    return res.data
  }

  // ── Transport ─────────────────────────────────────────────────────────
  async listTransports(skip = 0, limit = 100): Promise<PaginatedResponse<Transport>> {
    const res = await this.client.get('/transport', { params: { skip, limit } })
    return res.data
  }

  async getTransport(id: number): Promise<Transport> {
    const res = await this.client.get(`/transport/${id}`)
    return res.data
  }

  async createTransport(data: Partial<Transport>): Promise<Transport> {
    const res = await this.client.post('/transport', data)
    return res.data
  }

  async updateTransport(id: number, data: Partial<Transport>): Promise<Transport> {
    const res = await this.client.put(`/transport/${id}`, data)
    return res.data
  }

  async deleteTransport(id: number): Promise<void> {
    await this.client.delete(`/transport/${id}`)
  }

  async getTransportEfficiency(): Promise<TransportEfficiency> {
    const res = await this.client.get('/transport/efficiency')
    return res.data
  }

  // ── Waste ─────────────────────────────────────────────────────────────
  async listWaste(skip = 0, limit = 100): Promise<PaginatedResponse<Waste>> {
    const res = await this.client.get('/waste', { params: { skip, limit } })
    return res.data
  }

  async createWaste(data: Partial<Waste>): Promise<Waste> {
    const res = await this.client.post('/waste', data)
    return res.data
  }

  async updateWaste(id: number, data: Partial<Waste>): Promise<Waste> {
    const res = await this.client.put(`/waste/${id}`, data)
    return res.data
  }

  async deleteWaste(id: number): Promise<void> {
    await this.client.delete(`/waste/${id}`)
  }

  async getWasteAnalyses(): Promise<WasteAnalysisList> {
    const res = await this.client.get('/ai/waste-analysis')
    return res.data
  }

  /** PineTrack Agent analysis for up to 25 records per call */
  async analyseWaste(wasteIds: number[]): Promise<WasteAnalysis[]> {
    const res = await this.client.post('/ai/waste-analysis', { waste_ids: wasteIds })
    return res.data.items
  }

  async getWasteStats(): Promise<WasteStats> {
    const res = await this.client.get('/waste/stats')
    return res.data
  }

  // ── Schedule ──────────────────────────────────────────────────────────
  async listSchedules(skip = 0, limit = 100): Promise<PaginatedResponse<Schedule>> {
    const res = await this.client.get('/schedule', { params: { skip, limit } })
    return res.data
  }

  async createSchedule(data: Partial<Schedule>): Promise<Schedule> {
    const res = await this.client.post('/schedule', data)
    return res.data
  }

  async updateSchedule(id: number, data: Partial<Schedule>): Promise<Schedule> {
    const res = await this.client.put(`/schedule/${id}`, data)
    return res.data
  }

  async deleteSchedule(id: number): Promise<void> {
    await this.client.delete(`/schedule/${id}`)
  }

  async getMySchedule(): Promise<{ schedules: Schedule[]; count: number }> {
    const res = await this.client.get('/schedule/worker/my-schedule')
    return res.data
  }

  async updateScheduleStatus(id: number, status: Schedule['status']): Promise<Schedule> {
    const res = await this.client.patch(`/schedule/${id}/status`, null, { params: { new_status: status } })
    return res.data
  }

  async updateTransportStatus(id: number, status: Transport['status']): Promise<Transport> {
    const res = await this.client.patch(`/transport/${id}/status`, null, { params: { new_status: status } })
    return res.data
  }

  // ── Users ─────────────────────────────────────────────────────────────
  async listUsers(role?: string): Promise<PaginatedResponse<SystemUser>> {
    const res = await this.client.get('/users', { params: { role, limit: 500 } })
    return res.data
  }

  async createUser(data: {
    username: string
    email: string
    password: string
    full_name: string
    role: string
  }): Promise<User> {
    const res = await this.client.post('/users', data)
    return res.data
  }

  async updateUser(
    id: number,
    data: { role?: string; is_active?: boolean; full_name?: string; email?: string; password?: string }
  ): Promise<User> {
    const res = await this.client.patch(`/users/${id}`, data)
    return res.data
  }

  async getMe(): Promise<User> {
    const res = await this.client.get('/auth/me')
    return res.data
  }

  async updateMe(data: { full_name?: string; email?: string; password?: string }): Promise<User> {
    const res = await this.client.patch('/users/me', data)
    return res.data
  }

  async getMyStats(): Promise<UserStats> {
    const res = await this.client.get('/users/me/stats')
    return res.data
  }

  // ── Analytics & settings ──────────────────────────────────────────────
  async getAnalyticsOverview(months = 6): Promise<AnalyticsOverview> {
    const res = await this.client.get('/analytics/overview', { params: { months } })
    return res.data
  }

  async getSettings(): Promise<AppSettings> {
    const res = await this.client.get('/settings')
    return res.data
  }

  async updateSettings(data: AppSettings): Promise<AppSettings> {
    const res = await this.client.put('/settings', data)
    return res.data
  }

  async exportAllData(): Promise<Blob> {
    const res = await this.client.get('/export', { responseType: 'blob' })
    return res.data
  }

  // ── AI ────────────────────────────────────────────────────────────────
  async predictHarvestTiming(params: {
    harvest_id: number
    ripeness_level: number
    days_since_last_harvest: number
    field_condition_score: number
  }): Promise<AIHarvestPrediction> {
    const res = await this.client.post('/ai/predict/harvest-timing', null, { params })
    return res.data
  }

  async predictWasteClassification(params: {
    quality_grade: string
    damage_level: number
    age_days: number
  }): Promise<AIWastePrediction> {
    const res = await this.client.post('/ai/predict/waste-classification', null, { params })
    return res.data
  }

  async getAILogs(skip = 0, limit = 50): Promise<PaginatedResponse<AILog>> {
    const res = await this.client.get('/ai/logs', { params: { skip, limit } })
    return res.data
  }

  async getAIMetrics(): Promise<AIMetrics> {
    const res = await this.client.get('/ai/metrics')
    return res.data
  }

  async getAIStatus(): Promise<AIStatus> {
    const res = await this.client.get('/ai/status')
    return res.data
  }

  async getAIRecommendations(): Promise<AIRecommendations> {
    const res = await this.client.get('/ai/recommendations')
    return res.data
  }

  async refreshAIRecommendations(): Promise<AIRecommendations> {
    // Gemini can take a while to answer
    const res = await this.client.post('/ai/recommendations/refresh', null, { timeout: 60000 })
    return res.data
  }

  // ── Reports ───────────────────────────────────────────────────────────
  async downloadReport(type: string, days = 30): Promise<Blob> {
    const res = await this.client.get(`/reports/${type}`, { params: { days }, responseType: 'blob' })
    return res.data
  }
}

export const apiClient = new APIClient()

/** Best human-readable message from a failed API call */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { detail?: unknown } }; message?: string }
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg)
  if (!err?.response) return 'Cannot reach the server. Check that the backend is running.'
  return fallback
}

/** Save a downloaded file (e.g. a PDF report) to the user's computer */
export function saveBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}
