import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useShareStore } from './shareStore'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('shareStore', () => {
  beforeEach(() => {
    useShareStore.getState().reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ensureToken populates token and visibility on success', async () => {
    const diagramId = '550e8400-e29b-41d4-a716-446655440010'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: diagramId, title: 't', visibility: 'private', share_token: 'tok123' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await useShareStore.getState().ensureToken(diagramId)
    const state = useShareStore.getState()

    expect(state.token).toBe('tok123')
    expect(state.visibility).toBe('private')
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    expect(fetchMock.mock.calls[0][0]).toContain(`/diagrams/${diagramId}/share`)
  })

  it('setVisibility fires PATCH and updates state', async () => {
    const diagramId = '550e8400-e29b-41d4-a716-446655440011'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: diagramId, visibility: 'public', share_token: 'tok456' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await useShareStore.getState().setVisibility(diagramId, 'public')
    const state = useShareStore.getState()

    expect(state.visibility).toBe('public')
    expect(state.token).toBe('tok456')
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).visibility).toBe('public')
  })

  it('captures error message on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { code: 'FORBIDDEN', message: 'not owner' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await useShareStore.getState().ensureToken('550e8400-e29b-41d4-a716-446655440012')
    const state = useShareStore.getState()

    expect(state.error).toBe('not owner')
    expect(state.token).toBeNull()
  })

  it('UUID regex sanity', () => {
    expect(crypto.randomUUID()).toMatch(UUID_RE)
  })
})
