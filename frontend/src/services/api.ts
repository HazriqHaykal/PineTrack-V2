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
        if (error.response?.status === 401) {
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

  async createTransport(data: Omit<Transport, 'id' | 'created_at'>): Promise<Transport> {
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

  async createWaste(data: Omit<Waste, 'id' | 'created_at'>): Promise<Waste> {
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

  async createSchedule(data: Omit<Schedule, 'id' | 'created_at'>): Promise<Schedule> {
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

  // ── Reports ───────────────────────────────────────────────────────────
  async downloadReport(type: string): Promise<Blob> {
    const res = await this.client.get(`/reports/${type}`, { responseType: 'blob' })
    return res.data
  }
}

export const apiClient = new APIClient()
