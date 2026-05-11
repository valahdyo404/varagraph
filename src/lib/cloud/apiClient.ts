const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082/api/v1'

class ApiClient {
  private token: string | null = null

  setToken(token: string | null): void {
    this.token = token
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    })

    if (res.status === 401) {
      const refreshRes = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      })
      if (refreshRes.ok) {
        return fetch(`${BASE}${path}`, {
          ...options,
          headers,
          credentials: 'include',
        }).then((r) => r.json())
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('varagraph:auth:expired'))
      }
      return null
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: { code: 'UNKNOWN', message: res.statusText } }))
      throw error
    }

    if (res.status === 204) return null
    return res.json()
  }

  async register(email: string, password: string): Promise<{ user: { id: string; email: string } }> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async login(email: string, password: string): Promise<{ user: { id: string; email: string } }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' })
  }

  async me(): Promise<{ user: { id: string; email: string } }> {
    return this.request('/auth/me')
  }

  async listDiagrams(): Promise<Array<{ id: string; title: string; updatedAt: string }>> {
    const data = await this.request('/diagrams')
    return data.diagrams || []
  }

  async getDiagram(id: string): Promise<any> {
    return this.request(`/diagrams/${id}`)
  }

  async createDiagram(title: string, graphData?: any, id?: string): Promise<{ id: string; title: string }> {
    return this.request('/diagrams', {
      method: 'POST',
      body: JSON.stringify({ id, title, graph_data: graphData }),
    })
  }

  async updateDiagram(id: string, data: any): Promise<any> {
    return this.request(`/diagrams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteDiagram(id: string): Promise<void> {
    await this.request(`/diagrams/${id}`, {
      method: 'DELETE',
    })
  }

  async ensureShareToken(id: string): Promise<{ id: string; share_token: string; visibility: string; title: string }> {
    return this.request(`/diagrams/${id}/share`, { method: 'POST' })
  }

  async setVisibility(id: string, visibility: 'public' | 'private'): Promise<{ id: string; share_token: string; visibility: string }> {
    return this.request(`/diagrams/${id}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility }),
    })
  }

  async getShared(token: string): Promise<{ diagram: any; lanes: any[]; nodes: any[]; edges: any[]; editable: boolean }> {
    return this.request(`/share/${token}`)
  }
}

export const apiClient = new ApiClient()