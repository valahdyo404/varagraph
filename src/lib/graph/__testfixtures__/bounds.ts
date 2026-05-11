import type { RouteBounds } from "../orthogonalRouting"

export const smallBounds = (cx: number, cy: number): RouteBounds => ({
  center: { x: cx, y: cy },
  left: cx - 50, right: cx + 50, top: cy - 30, bottom: cy + 30,
})

export const wideBounds = (cx: number, cy: number): RouteBounds => ({
  center: { x: cx, y: cy },
  left: cx - 100, right: cx + 100, top: cy - 40, bottom: cy + 40,
})