import L from 'leaflet'

/**
 * A canvas pinned to a lat/lng box. Unlike L.imageOverlay it can be redrawn
 * in place every animation tick — swapping image URLs 30 times a second
 * flickers while each new image decodes.
 */
export class RainCanvasLayer extends L.Layer {
  private readonly box: L.LatLngBounds
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D | null

  constructor(box: L.LatLngBounds, width: number, height: number) {
    super()
    this.box = box
    this.canvas = L.DomUtil.create('canvas', 'rain-overlay leaflet-zoom-hide')
    this.canvas.width = width
    this.canvas.height = height
    this.canvas.style.position = 'absolute'
    this.canvas.style.pointerEvents = 'none'
    this.ctx = this.canvas.getContext('2d')
  }

  onAdd(map: L.Map): this {
    map.getPane('overlayPane')?.appendChild(this.canvas)
    map.on('viewreset zoomend moveend resize', this.place, this)
    this.place()
    return this
  }

  onRemove(map: L.Map): this {
    map.off('viewreset zoomend moveend resize', this.place, this)
    this.canvas.remove()
    return this
  }

  draw(pixels: Uint8ClampedArray<ArrayBuffer>): void {
    if (!this.ctx) return
    this.ctx.putImageData(new ImageData(pixels, this.canvas.width, this.canvas.height), 0, 0)
  }

  private place(): void {
    if (!this._map) return
    const topLeft = this._map.latLngToLayerPoint(this.box.getNorthWest())
    const bottomRight = this._map.latLngToLayerPoint(this.box.getSouthEast())
    L.DomUtil.setPosition(this.canvas, topLeft)
    this.canvas.style.width = `${bottomRight.x - topLeft.x}px`
    this.canvas.style.height = `${bottomRight.y - topLeft.y}px`
  }
}
