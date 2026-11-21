import { describe, expect, it } from 'vitest'
import { loadConfig } from './config'

const REQUIRED = {
  VAPID_PUBLIC_KEY: 'BPUBLIC',
  VAPID_PRIVATE_KEY: 'private-key-value',
  OWNER_TOKEN: 'owner-token-value',
}

describe('loadConfig', () => {
  it('applies the defaults', () => {
    expect(loadConfig(REQUIRED)).toEqual({
      vapidPublicKey: 'BPUBLIC',
      vapidPrivateKey: 'private-key-value',
      vapidSubject: 'https://banjir.achmadnaufal.com',
      ownerToken: 'owner-token-value',
      dbPath: '/data/alerts.sqlite3',
      port: 8080,
      allowedOrigins: ['https://banjir.achmadnaufal.com'],
    })
  })

  it('reads overrides, with a comma-separated origin list', () => {
    const c = loadConfig({
      ...REQUIRED,
      DB_PATH: '/tmp/a.sqlite3',
      PORT: '8099',
      ALLOWED_ORIGINS: 'https://banjir.achmadnaufal.com, http://localhost:5173',
    })
    expect(c).toMatchObject({
      dbPath: '/tmp/a.sqlite3',
      port: 8099,
      allowedOrigins: ['https://banjir.achmadnaufal.com', 'http://localhost:5173'],
    })
  })

  it('names every missing variable', () => {
    expect(() => loadConfig({})).toThrow('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, OWNER_TOKEN')
  })

  it('never puts a secret value in an error', () => {
    try {
      loadConfig({ ...REQUIRED, PORT: 'eighty' })
      expect.unreachable()
    } catch (err) {
      const message = String((err as Error).message)
      expect(message).toContain('PORT')
      expect(message).not.toContain('private-key-value')
      expect(message).not.toContain('owner-token-value')
    }
  })
})
