import { User, LoginResponse } from '../types'

const TOKEN_KEY = 'pt_access_token'
const USER_KEY = 'pt_user'

export const authService = {
  setTokens(response: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, response.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(response.user))
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  },

  getUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },

  logout(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY)
  },

  isAdmin(): boolean {
    return this.getUser()?.role === 'admin'
  },

  isWorker(): boolean {
    const role = this.getUser()?.role
    return role === 'worker' || role === 'admin'
  },
}
