import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Test del API helper
// ---------------------------------------------------------------------------
// POR QUE: El wrapper de fetch es el unico punto de contacto entre el
// frontend y el backend. Si no parsea errores correctamente, los componentes
// reciben `undefined` en vez de un error limpio y crashean sin informacion.
// Si no anade el Content-Type, el backend rechaza con 415.

// Mock de fetch global
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Importar despues de stubGlobal para que el modulo use el mock
const { api } = await import('@/lib/api');

beforeEach(() => {
  mockFetch.mockReset();
});

describe('api() helper', () => {
  it('hace GET y parsea JSON correctamente', async () => {
    // POR QUE: El caso feliz. Si esto falla, nada funciona.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: 1 }], pagination: { total: 1 } }),
    });

    const result = await api('/api/asesorias');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/asesorias'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result).toEqual({ data: [{ id: 1 }], pagination: { total: 1 } });
  });

  it('lanza error con mensaje del backend en caso de 404', async () => {
    // POR QUE: Si el usuario navega a /asesorias/999, el backend devuelve
    // { error: "Asesoria no encontrada" }. El frontend debe mostrar ESE
    // mensaje, no un generico "fetch failed".
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Asesoria no encontrada' }),
    });

    await expect(api('/api/asesorias/999')).rejects.toThrow('Asesoria no encontrada');
  });

  it('lanza error generico cuando el body no tiene mensaje', async () => {
    // POR QUE: Si el backend devuelve 500 sin body JSON (ej: Nginx 502),
    // el helper no debe crashear — debe dar un mensaje generico util.
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(api('/api/broken')).rejects.toThrow('API error: 500');
  });

  it('construye URL con la base URL del entorno', async () => {
    // POR QUE: En Docker, NEXT_PUBLIC_API_URL = "http://api:3001".
    // En desarrollo, "http://localhost:3001". El helper debe respetar
    // la variable de entorno y anteponer la base URL al path.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await api('/api/test');

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/\/api\/test$/);
  });
});
