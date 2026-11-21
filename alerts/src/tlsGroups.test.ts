import { describe, expect, it } from 'vitest'
import { CLASSIC_TLS_GROUPS, useClassicTlsGroups } from './tlsGroups'

describe('useClassicTlsGroups', () => {
  it('offers only X25519 and P-256, dropping the post-quantum key share', () => {
    // OpenSSL 3.5's default ('auto') adds a large ML-KEM key share; the route
    // from the VPS to BPBD resets that handshake after ~10 s (2026-11-22).
    const fakeTls = { DEFAULT_ECDH_CURVE: 'auto' }
    useClassicTlsGroups(fakeTls)
    expect(fakeTls.DEFAULT_ECDH_CURVE).toBe('X25519:prime256v1')
    expect(CLASSIC_TLS_GROUPS).toBe('X25519:prime256v1')
  })
})
