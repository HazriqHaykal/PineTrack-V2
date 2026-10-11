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
} from '../types'

type HarvestServerFields =
  | 'id' | 'worker_id' | 'created_at' | 'updated_at'
  | 'batch_number' | 'harvest_status'
  | 'spoilage_kg' | 'rejected_kg'
  | 'marketable_yield_kg' | 'marketable_yield_percent'
  | 'spoilage_rate_percent' | 'rejection_rate_percent'

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

  async createHarvest(data: Omit<Harvest, HarvestServerFields>): Promise<Harvest> {
    const res = await this.client.post('/harvest', data)
    return res.data
  }

  async getHarvest(id: number): Promise<Harvest> {
    const res = await this.client.get(`/harvest/${id}`)
    return res.data
  }

  async updateHarvest(id: number, data: Partial<Harvest>): Promise<Harvest> {
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
