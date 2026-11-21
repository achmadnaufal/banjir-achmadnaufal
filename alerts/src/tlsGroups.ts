import tls from 'node:tls'

/**
 * Node 22.22 ships OpenSSL 3.5, whose default key-exchange groups add a large
 * post-quantum (ML-KEM) key share to every TLS handshake. Somewhere on the
 * route from the VPS to bpbd.jakarta.go.id that oversized ClientHello gets
 * reset after ~10 s, while the same request with classic groups answers in
 * well under a second (diagnosed 2026-11-22; host curl on older OpenSSL was
 * unaffected). Apple's and Google's push services accept these groups too.
 */
export const CLASSIC_TLS_GROUPS = 'X25519:prime256v1'

export function useClassicTlsGroups(target: { DEFAULT_ECDH_CURVE: string } = tls): void {
  target.DEFAULT_ECDH_CURVE = CLASSIC_TLS_GROUPS
}
