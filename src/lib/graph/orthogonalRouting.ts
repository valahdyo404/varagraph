import type { DiagramNodeVariant } from '../../types/graph'

export type RoutePoint = {
  x: number
  y: number
}

export type RouteBounds = {
  center: RoutePoint
  left: number
  right: number
  top: number
  bottom: number
}

export type AnchorDirection = 'left' | 'right' | 'top' | 'bottom'

type RouteAxis = 'horizontal' | 'vertical'

const lateralCrossLaneDeltaLimit = 140

type RouteMetrics = {
  blockedBoundsCount: number
  blockedSegmentCount: number
  totalLength: number
}

export type OrthogonalRoute = {
  points: RoutePoint[]
  isClear: boolean
  blockedBoundsCount: number
  blockedSegmentCount: number
  candidateKind: RouteAxis
  endpointAlignment: number
}

export const defaultRoutePadding = 22

const pushRoutePoint = (points: RoutePoint[], point: RoutePoint) => {
  const previous = points.at(-1)
  if (previous && Math.abs(previous.x - point.x) < 0.5 && Math.abs(previous.y - point.y) < 0.5) return
  points.push(point)
}

const uniqueNumbers = (values: number[]): number[] => {
  const result: number[] = []
  values.forEach((value) => {
    if (result.some((item) => Math.abs(item - value) < 0.5)) return
    result.push(value)
  })
  return result
}

export const simplifyOrthogonalPoints = (points: RoutePoint[]): RoutePoint[] => {
  const deduped = points.reduce<RoutePoint[]>((accumulator, point) => {
    pushRoutePoint(accumulator, point)
    return accumulator
  }, [])

  return deduped.reduce<RoutePoint[]>((accumulator, point) => {
    const first = accumulator.at(-2)
    const second = accumulator.at(-1)
    if (!first || !second) {
      accumulator.push(point)
      return accumulator
    }

    const sameVertical = Math.abs(first.x - second.x) < 0.5 && Math.abs(second.x - point.x) < 0.5
    const sameHorizontal = Math.abs(first.y - second.y) < 0.5 && Math.abs(second.y - point.y) < 0.5
    if (sameVertical || sameHorizontal) {
      accumulator[accumulator.length - 1] = point
      return accumulator
    }

    accumulator.push(point)
    return accumulator
  }, [])
}

export const directionFromHandle = (handle?: string | null): AnchorDirection | undefined => {
  if (!handle) return undefined
  if (handle.startsWith('left')) return 'left'
  if (handle.startsWith('right')) return 'right'
  if (handle.startsWith('top')) return 'top'
  if (handle.startsWith('bottom')) return 'bottom'
  return undefined
}

export const anchorForDirection = (bounds: RouteBounds, direction: AnchorDirection): RoutePoint => {
  switch (direction) {
    case 'left':
      return { x: bounds.left, y: bounds.center.y }
    case 'right':
      return { x: bounds.right, y: bounds.center.y }
    case 'top':
      return { x: bounds.center.x, y: bounds.top }
    case 'bottom':
    default:
      return { x: bounds.center.x, y: bounds.bottom }
  }
}

export const segmentIntersectsBounds = (from: RoutePoint, to: RoutePoint, bounds: RouteBounds, routePadding = defaultRoutePadding): boolean => {
  const left = bounds.left - routePadding
  const right = bounds.right + routePadding
  const top = bounds.top - routePadding
  const bottom = bounds.bottom + routePadding

  if (Math.abs(from.x - to.x) < 0.5) {
    const minY = Math.min(from.y, to.y)
    const maxY = Math.max(from.y, to.y)
    return from.x >= left && from.x <= right && maxY >= top && minY <= bottom
  }

  if (Math.abs(from.y - to.y) < 0.5) {
    const minX = Math.min(from.x, to.x)
    const maxX = Math.max(from.x, to.x)
    return from.y >= top && from.y <= bottom && maxX >= left && minX <= right
  }

  return false
}

export const pathIntersectsBounds = (points: RoutePoint[], bounds: RouteBounds, routePadding = defaultRoutePadding): boolean =>
  points.slice(1).some((point, index) => segmentIntersectsBounds(points[index], point, bounds, routePadding))

const pathMetrics = (points: RoutePoint[], blockedBounds: RouteBounds[], routePadding: number): RouteMetrics => {
  let blockedBoundsCount = 0
  let blockedSegmentCount = 0

  blockedBounds.forEach((bounds) => {
    let intersects = false
    points.slice(1).forEach((point, index) => {
      if (!segmentIntersectsBounds(points[index], point, bounds, routePadding)) return
      blockedSegmentCount += 1
      intersects = true
    })
    if (intersects) blockedBoundsCount += 1
  })

  return {
    blockedBoundsCount,
    blockedSegmentCount,
    totalLength: points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0),
  }
}

const buildPath = (points: RoutePoint[]): RoutePoint[] => simplifyOrthogonalPoints(points)

const minimumExitDistance = (routePadding: number) => Math.max(routePadding + 14, 36)

const alignSourceExit = (points: RoutePoint[], source: RoutePoint, sourceDirection: AnchorDirection, routePadding: number): RoutePoint[] => {
  const simplified = buildPath(points)
  if (simplified.length < 2) return simplified

  const next = simplified[1]
  const corner = simplified[2] ?? simplified.at(-1) ?? next
  const firstAxis = segmentAxis(source, next)
  const desiredAxis = axisForDirection(sourceDirection)
  const approachDistance = minimumExitDistance(routePadding)

  if (desiredAxis === 'vertical') {
    const direction = sourceDirection === 'top' ? -1 : 1
    const approachY = source.y + direction * approachDistance
    const clearsSource = firstAxis === 'vertical' && (direction < 0 ? next.y <= approachY + 0.5 : next.y >= approachY - 0.5)
    if (clearsSource) return simplified
    return firstAxis === 'vertical'
      ? buildPath([source, { x: source.x, y: approachY }, { x: corner.x, y: approachY }, ...simplified.slice(3)])
      : buildPath([source, { x: source.x, y: approachY }, { x: next.x, y: approachY }, ...simplified.slice(1)])
  }

  const direction = sourceDirection === 'left' ? -1 : 1
  const approachX = source.x + direction * approachDistance
  const clearsSource = firstAxis === 'horizontal' && (direction < 0 ? next.x <= approachX + 0.5 : next.x >= approachX - 0.5)
  if (clearsSource) return simplified
  return firstAxis === 'horizontal'
    ? buildPath([source, { x: approachX, y: source.y }, { x: approachX, y: corner.y }, ...simplified.slice(3)])
    : buildPath([source, { x: approachX, y: source.y }, { x: approachX, y: next.y }, ...simplified.slice(1)])
}

const alignTargetEntry = (points: RoutePoint[], target: RoutePoint, targetDirection: AnchorDirection, routePadding: number): RoutePoint[] => {
  const simplified = buildPath(points)
  if (simplified.length < 2) return simplified

  const previous = simplified[simplified.length - 2]
  const lastAxis = segmentAxis(previous, target)
  const desiredAxis = axisForDirection(targetDirection)
  if (lastAxis === desiredAxis) return simplified

  const approachDistance = Math.max(routePadding, 24)
  if (desiredAxis === 'vertical') {
    const approachY = target.y + (targetDirection === 'top' ? -approachDistance : approachDistance)
    return buildPath([...simplified.slice(0, -1), { x: previous.x, y: approachY }, { x: target.x, y: approachY }, target])
  }

  const approachX = target.x + (targetDirection === 'left' ? -approachDistance : approachDistance)
  return buildPath([...simplified.slice(0, -1), { x: approachX, y: previous.y }, { x: approachX, y: target.y }, target])
}

const axisForDirection = (direction: AnchorDirection): RouteAxis =>
  direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical'

const segmentAxis = (from: RoutePoint, to: RoutePoint): RouteAxis | undefined => {
  if (Math.abs(from.x - to.x) < 0.5 && Math.abs(from.y - to.y) >= 0.5) return 'vertical'
  if (Math.abs(from.y - to.y) < 0.5 && Math.abs(from.x - to.x) >= 0.5) return 'horizontal'
  return undefined
}

const endpointAlignment = (points: RoutePoint[], sourceDirection: AnchorDirection, targetDirection: AnchorDirection): number => {
  const firstAxis = points.length > 1 ? segmentAxis(points[0], points[1]) : undefined
  const lastAxis = points.length > 1 ? segmentAxis(points[points.length - 2], points[points.length - 1]) : undefined
  let aligned = 0
  if (firstAxis === axisForDirection(sourceDirection)) aligned += 1
  if (lastAxis === axisForDirection(targetDirection)) aligned += 1
  return aligned
}

const scoreRoute = (
  points: RoutePoint[],
  blockedBounds: RouteBounds[],
  routePadding: number,
  candidateKind: RouteAxis,
  sourceDirection: AnchorDirection,
  targetDirection: AnchorDirection,
): OrthogonalRoute => {
  const metrics = pathMetrics(points, blockedBounds, routePadding)
  return {
    points,
    isClear: metrics.blockedBoundsCount === 0,
    blockedBoundsCount: metrics.blockedBoundsCount,
    blockedSegmentCount: metrics.blockedSegmentCount,
    candidateKind,
    endpointAlignment: endpointAlignment(points, sourceDirection, targetDirection),
  }
}

const compareRoutes = (left: OrthogonalRoute, right: OrthogonalRoute, preferredKind: RouteAxis): number => {
  if (left.isClear !== right.isClear) return left.isClear ? -1 : 1
  if (left.blockedBoundsCount !== right.blockedBoundsCount) return left.blockedBoundsCount - right.blockedBoundsCount
  if (left.blockedSegmentCount !== right.blockedSegmentCount) return left.blockedSegmentCount - right.blockedSegmentCount
  if (left.endpointAlignment !== right.endpointAlignment) return right.endpointAlignment - left.endpointAlignment
  if (left.candidateKind !== right.candidateKind) {
    if (left.candidateKind === preferredKind) return -1
    if (right.candidateKind === preferredKind) return 1
  }
  const leftLength = left.points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - left.points[index].x) + Math.abs(point.y - left.points[index].y), 0)
  const rightLength = right.points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - right.points[index].x) + Math.abs(point.y - right.points[index].y), 0)
  return leftLength - rightLength
}

const relevantHorizontalBlockers = (source: RoutePoint, target: RoutePoint, blockedBounds: RouteBounds[], routePadding: number): RouteBounds[] => {
  const minY = Math.min(source.y, target.y) - routePadding
  const maxY = Math.max(source.y, target.y) + routePadding
  return blockedBounds.filter((bounds) => bounds.bottom >= minY && bounds.top <= maxY)
}

const relevantVerticalBlockers = (source: RoutePoint, target: RoutePoint, blockedBounds: RouteBounds[], routePadding: number): RouteBounds[] => {
  const minX = Math.min(source.x, target.x) - routePadding
  const maxX = Math.max(source.x, target.x) + routePadding
  return blockedBounds.filter((bounds) => bounds.right >= minX && bounds.left <= maxX)
}

const horizontalCandidates = (source: RoutePoint, target: RoutePoint, blockedBounds: RouteBounds[], offset: number, routePadding: number): RoutePoint[][] => {
  const candidates: RoutePoint[][] = []
  const straightHorizontal = Math.abs(source.y - target.y) < 0.5 && Math.abs(offset) > 0
  const baseY = source.y + offset
  if (straightHorizontal) {
    candidates.push(buildPath([source, { x: source.x, y: baseY }, { x: target.x, y: baseY }, target]))
  }

  const offsetMagnitude = Math.abs(offset)
  const blockers = relevantHorizontalBlockers(source, target, blockedBounds, routePadding)
  const baseX = (source.x + target.x) / 2 + offset
  const candidateXs = uniqueNumbers([
    baseX,
    ...blockers.flatMap((bounds) => [bounds.left - routePadding - offsetMagnitude, bounds.right + routePadding + offsetMagnitude]),
  ])

  candidateXs.forEach((middleX) => {
    candidates.push(buildPath([source, { x: middleX, y: source.y }, { x: middleX, y: target.y }, target]))
  })

  blockers.forEach((bounds) => {
    const detourX = Math.abs(source.x - bounds.left) <= Math.abs(source.x - bounds.right)
      ? bounds.left - routePadding - offsetMagnitude
      : bounds.right + routePadding + offsetMagnitude
    const detourY = target.y >= source.y ? bounds.bottom + routePadding + offsetMagnitude : bounds.top - routePadding - offsetMagnitude
    candidates.push(buildPath([source, { x: detourX, y: source.y }, { x: detourX, y: detourY }, { x: target.x, y: detourY }, target]))
  })

  return candidates
}

const verticalCandidates = (source: RoutePoint, target: RoutePoint, blockedBounds: RouteBounds[], offset: number, routePadding: number): RoutePoint[][] => {
  const candidates: RoutePoint[][] = []
  const straightVertical = Math.abs(source.x - target.x) < 0.5 && Math.abs(offset) > 0
  const baseX = source.x + offset
  if (straightVertical) {
    candidates.push(buildPath([source, { x: baseX, y: source.y }, { x: baseX, y: target.y }, target]))
  }

  const offsetMagnitude = Math.abs(offset)
  const blockers = relevantVerticalBlockers(source, target, blockedBounds, routePadding)
  const baseY = (source.y + target.y) / 2 + offset
  const candidateYs = uniqueNumbers([
    baseY,
    ...blockers.flatMap((bounds) => [bounds.top - routePadding - offsetMagnitude, bounds.bottom + routePadding + offsetMagnitude]),
  ])

  candidateYs.forEach((middleY) => {
    candidates.push(buildPath([source, { x: source.x, y: middleY }, { x: target.x, y: middleY }, target]))
  })

  blockers.forEach((bounds) => {
    const detourX = Math.abs(source.x - bounds.left) <= Math.abs(source.x - bounds.right)
      ? bounds.left - routePadding - offsetMagnitude
      : bounds.right + routePadding + offsetMagnitude
    const detourY = target.y >= source.y ? bounds.bottom + routePadding + offsetMagnitude : bounds.top - routePadding - offsetMagnitude
    candidates.push(buildPath([source, { x: source.x, y: detourY }, { x: detourX, y: detourY }, { x: detourX, y: target.y }, target]))
  })

  return candidates
}

export const isLateralCrossLane = (sourceBounds: RouteBounds, targetBounds: RouteBounds, sameLane: boolean): boolean =>
  !sameLane && Math.abs(sourceBounds.center.y - targetBounds.center.y) <= lateralCrossLaneDeltaLimit

export const lateralSideTargetCorridorIsBlocked = (sourceBounds: RouteBounds, targetBounds: RouteBounds, blockedBounds: RouteBounds[], sameLane: boolean): boolean => {
  if (!isLateralCrossLane(sourceBounds, targetBounds, sameLane)) return false
  const targetIsLeft = targetBounds.center.x < sourceBounds.center.x
  const sourceDirection: AnchorDirection = targetIsLeft ? 'left' : 'right'
  const targetDirection: AnchorDirection = targetIsLeft ? 'right' : 'left'
  const source = anchorForDirection(sourceBounds, sourceDirection)
  const target = anchorForDirection(targetBounds, targetDirection)
  const middleX = (source.x + target.x) / 2
  const points = buildPath([
    source,
    { x: middleX, y: source.y },
    { x: middleX, y: target.y },
    target,
  ])

  return blockedBounds.some((bounds) => pathIntersectsBounds(points, bounds))
}

export const preferRouteAxis = (sourceDirection: AnchorDirection, targetDirection: AnchorDirection): RouteAxis =>
  sourceDirection === 'left' || sourceDirection === 'right' || targetDirection === 'left' || targetDirection === 'right'
    ? 'horizontal'
    : 'vertical'

export const buildOrthogonalRoute = ({
  sourceBounds,
  targetBounds,
  blockedBounds,
  sourceDirection,
  targetDirection,
  offset = 0,
  prefer,
  routePadding = defaultRoutePadding,
}: {
  sourceBounds: RouteBounds
  targetBounds: RouteBounds
  blockedBounds: RouteBounds[]
  sourceDirection: AnchorDirection
  targetDirection: AnchorDirection
  offset?: number
  prefer: RouteAxis
  routePadding?: number
}): OrthogonalRoute => {
  const source = anchorForDirection(sourceBounds, sourceDirection)
  const target = anchorForDirection(targetBounds, targetDirection)
  const primaryKind: RouteAxis = prefer
  const secondaryKind: RouteAxis = prefer === 'horizontal' ? 'vertical' : 'horizontal'
  const candidates = [
    ...((primaryKind === 'horizontal' ? horizontalCandidates : verticalCandidates)(source, target, blockedBounds, offset, routePadding).map((points) =>
      scoreRoute(alignTargetEntry(alignSourceExit(points, source, sourceDirection, routePadding), target, targetDirection, routePadding), blockedBounds, routePadding, primaryKind, sourceDirection, targetDirection),
    )),
    ...((secondaryKind === 'horizontal' ? horizontalCandidates : verticalCandidates)(source, target, blockedBounds, offset, routePadding).map((points) =>
      scoreRoute(alignTargetEntry(alignSourceExit(points, source, sourceDirection, routePadding), target, targetDirection, routePadding), blockedBounds, routePadding, secondaryKind, sourceDirection, targetDirection),
    )),
  ].sort((left, right) => compareRoutes(left, right, prefer))

  return candidates[0] ?? scoreRoute(alignTargetEntry(alignSourceExit(buildPath([source, target]), source, sourceDirection, routePadding), target, targetDirection, routePadding), blockedBounds, routePadding, prefer, sourceDirection, targetDirection)
}

export const inferEdgeHandles = (sourceBounds: RouteBounds, targetBounds: RouteBounds, sameLane: boolean) => {
  const targetIsLeft = targetBounds.center.x < sourceBounds.center.x
  const targetIsAbove = targetBounds.center.y < sourceBounds.center.y

  return {
    sourceHandle: sameLane ? (targetIsAbove ? 'top-source' : 'bottom-source') : targetIsLeft ? 'left-source' : 'right-source',
    targetHandle: sameLane ? (targetIsAbove ? 'bottom-gap-target' : 'top-gap-target') : targetIsLeft ? 'right-target' : 'left-target',
  }
}

const sourceHandleForDirection = (direction: AnchorDirection): string => `${direction}-source`

const targetHandleForDirection = (direction: AnchorDirection, sameLane: boolean): string =>
  sameLane && (direction === 'top' || direction === 'bottom') ? `${direction}-gap-target` : `${direction}-target`

const sourceFallbackDirections = (preferredDirection: AnchorDirection, sourceBounds: RouteBounds, targetBounds: RouteBounds): AnchorDirection[] => {
  const horizontalDirections: AnchorDirection[] = targetBounds.center.x >= sourceBounds.center.x ? ['right', 'left'] : ['left', 'right']
  const verticalDirections: AnchorDirection[] = targetBounds.center.y >= sourceBounds.center.y ? ['bottom', 'top'] : ['top', 'bottom']

  switch (preferredDirection) {
    case 'top':
      return ['top', ...horizontalDirections, 'bottom']
    case 'bottom':
      return ['bottom', ...horizontalDirections, 'top']
    case 'left':
      return ['left', ...verticalDirections, 'right']
    case 'right':
    default:
      return ['right', ...verticalDirections, 'left']
  }
}

export const maxOutgoingEdgesForSource = (variant: DiagramNodeVariant): number => (variant === 'decision' ? 2 : 1)

export const resolveSourceHandle = ({
  sourceBounds,
  targetBounds,
  sameLane,
  requestedHandle,
  usedSourceDirections,
  occupiedDirections,
  sourceVariant,
}: {
  sourceBounds: RouteBounds
  targetBounds: RouteBounds
  sameLane: boolean
  requestedHandle?: string | null
  usedSourceDirections: Set<AnchorDirection>
  occupiedDirections: Set<AnchorDirection>
  sourceVariant: DiagramNodeVariant
}): string | undefined => {
  const inferredHandle = inferEdgeHandles(sourceBounds, targetBounds, sameLane).sourceHandle
  const preferredDirection = directionFromHandle(requestedHandle) ?? directionFromHandle(inferredHandle) ?? 'bottom'
  const maxOutgoing = maxOutgoingEdgesForSource(sourceVariant)
  const fallbackDirections = sourceFallbackDirections(preferredDirection, sourceBounds, targetBounds)
  const nextDirection = fallbackDirections.find(
    (direction, index) => !occupiedDirections.has(direction) && (index === 0 || usedSourceDirections.size < maxOutgoing),
  )
  return nextDirection ? sourceHandleForDirection(nextDirection) : sourceHandleForDirection(preferredDirection)
}

export const resolveTargetHandle = ({
  sourceBounds,
  targetBounds,
  sameLane,
  requestedHandle,
  occupiedDirections,
}: {
  sourceBounds: RouteBounds
  targetBounds: RouteBounds
  sameLane: boolean
  requestedHandle?: string | null
  occupiedDirections: Set<AnchorDirection>
}): string | undefined => {
  const inferredHandle = inferEdgeHandles(sourceBounds, targetBounds, sameLane).targetHandle
  const preferredDirection = directionFromHandle(requestedHandle) ?? directionFromHandle(inferredHandle) ?? 'top'
  const fallbackDirections = sourceFallbackDirections(preferredDirection, targetBounds, sourceBounds)
  const nextDirection = fallbackDirections.find((direction) => !occupiedDirections.has(direction))
  return nextDirection ? targetHandleForDirection(nextDirection, sameLane) : targetHandleForDirection(preferredDirection, sameLane)
}

export const resolveEdgeHandles = ({
  sourceBounds,
  targetBounds,
  sameLane,
  requestedSourceHandle,
  requestedTargetHandle,
  usedSourceDirections,
  sourceOccupiedDirections,
  targetOccupiedDirections,
  sourceVariant,
}: {
  sourceBounds: RouteBounds
  targetBounds: RouteBounds
  sameLane: boolean
  requestedSourceHandle?: string | null
  requestedTargetHandle?: string | null
  usedSourceDirections: Set<AnchorDirection>
  sourceOccupiedDirections: Set<AnchorDirection>
  targetOccupiedDirections: Set<AnchorDirection>
  sourceVariant: DiagramNodeVariant
}) => {
  const targetHandle = resolveTargetHandle({
    sourceBounds,
    targetBounds,
    sameLane,
    requestedHandle: requestedTargetHandle,
    occupiedDirections: targetOccupiedDirections,
  })
  const sourceHandle = resolveSourceHandle({
    sourceBounds,
    targetBounds,
    sameLane,
    requestedHandle: requestedSourceHandle,
    usedSourceDirections,
    occupiedDirections: sourceOccupiedDirections,
    sourceVariant,
  })

  return { sourceHandle, targetHandle }
}
