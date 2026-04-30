export type ThresholdsCm = {
  siaga1: number
  siaga2: number
  siaga3: number
}

export type SnapshotRow = {
  id: number
  name: string
  location: string
  lat: number
  lng: number
  thresholdsCm: ThresholdsCm
  observedAt: Date
  levelCm: number
  prevLevelCm: number | null
  statusText: string
}

export type HistoryPoint = {
  at: Date
  cm: number
}

export type HistoryResponse = {
  points: HistoryPoint[]
  thresholdsCm: ThresholdsCm | null
}

export type UpstreamErrorKind = 'timeout' | 'network' | 'http' | 'parse'

export class UpstreamError extends Error {
  readonly kind: UpstreamErrorKind
  readonly status?: number
  constructor(kind: UpstreamErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'UpstreamError'
    this.kind = kind
    this.status = status
  }
}
