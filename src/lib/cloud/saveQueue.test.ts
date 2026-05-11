import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveQueue } from './saveQueue'
import { apiClient } from './apiClient'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('saveQueue autosave integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('skips enqueue for non-UUID ids', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    saveQueue.enqueue('1778287233783-i90pu1v', { lanes: [], nodes: [], edges: [] }, '')
    await vi.advanceTimersByTimeAsync(3000)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fires PUT with UUID path when id is a valid UUID', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: uuid, title: 'ok' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    saveQueue.enqueue(uuid, { lanes: [], nodes: [], edges: [] }, 'graph TD')
    await vi.advanceTimersByTimeAsync(3000)

    expect(fetchMock).toHaveBeenCalled()
    const call = fetchMock.mock.calls[0]
    expect(call[0]).toMatch(new RegExp(`/diagrams/${uuid}$`))
    expect(call[1].method).toBe('PUT')
  })

  it('generated UUIDs pass backend validation format', () => {
    const id = crypto.randomUUID()
    expect(id).toMatch(UUID_RE)
  })

  it('apiClient.createDiagram forwards client id in body', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440001'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: uuid, title: 'new' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await apiClient.createDiagram('new', { graph: { lanes: [], nodes: [], edges: [] } }, uuid)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.id).toBe(uuid)
    expect(body.title).toBe('new')
  })

  it('self-heals on 404 by creating diagram then retrying PUT', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440002'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { code: 'NOT_FOUND', message: 'diagram not found' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: uuid, title: 'Untitled' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: uuid, title: 'Untitled' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    saveQueue.enqueue(uuid, { lanes: [], nodes: [], edges: [] }, 'graph TD')
    await vi.advanceTimersByTimeAsync(3000)
    await vi.runAllTimersAsync()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
    expect(fetchMock.mock.calls[1][1].method).toBe('POST')
    expect(fetchMock.mock.calls[2][1].method).toBe('PUT')
    const createBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(createBody.id).toBe(uuid)
  })
})
