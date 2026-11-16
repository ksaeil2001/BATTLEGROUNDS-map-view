export const NAVIGATION_COOLDOWN_MS = 160;
export const TOUCH_DRAG_THRESHOLD_PX = 6;

export type TouchSamplePoint = readonly [x: number, y: number];

export interface GestureGuardState {
  activeTouchCount: number;
  anchorTouch: TouchSamplePoint | null;
  movedBeyondTap: boolean;
  hadMultiTouch: boolean;
  pendingUserZoom: boolean;
  pendingUserMove: boolean;
  mapDragging: boolean;
  mapMoving: boolean;
  mapZooming: boolean;
  suppressUntil: number;
}

export function createGestureGuardState(): GestureGuardState {
  return {
    activeTouchCount: 0,
    anchorTouch: null,
    movedBeyondTap: false,
    hadMultiTouch: false,
    pendingUserZoom: false,
    pendingUserMove: false,
    mapDragging: false,
    mapMoving: false,
    mapZooming: false,
    suppressUntil: 0,
  };
}

function exceedsDragThreshold(
  anchor: TouchSamplePoint | null,
  current: TouchSamplePoint | undefined,
): boolean {
  if (!anchor || !current) {
    return false;
  }
  const dx = current[0] - anchor[0];
  const dy = current[1] - anchor[1];
  return Math.hypot(dx, dy) > TOUCH_DRAG_THRESHOLD_PX;
}

function withCooldown(
  suppressUntil: number,
  shouldApply: boolean,
  now: number,
): number {
  return shouldApply
    ? Math.max(suppressUntil, now + NAVIGATION_COOLDOWN_MS)
    : suppressUntil;
}

function applyTouchUpdate(
  state: GestureGuardState,
  touches: readonly TouchSamplePoint[],
  anchorTouch: TouchSamplePoint | null,
  movedBeyondTap: boolean,
  now: number,
): GestureGuardState {
  const hadMultiTouch = state.hadMultiTouch || touches.length >= 2;
  const shouldSuppress = hadMultiTouch || movedBeyondTap;

  return {
    ...state,
    activeTouchCount: touches.length,
    anchorTouch,
    movedBeyondTap,
    hadMultiTouch,
    pendingUserZoom: state.pendingUserZoom || hadMultiTouch,
    suppressUntil: withCooldown(state.suppressUntil, shouldSuppress, now),
  };
}

export function recordTouchStart(
  state: GestureGuardState,
  touches: readonly TouchSamplePoint[],
  now: number,
): GestureGuardState {
  return applyTouchUpdate(
    state,
    touches,
    state.anchorTouch ?? touches[0] ?? null,
    state.movedBeyondTap,
    now,
  );
}

export function recordTouchMove(
  state: GestureGuardState,
  touches: readonly TouchSamplePoint[],
  now: number,
): GestureGuardState {
  const movedBeyondTap =
    state.movedBeyondTap || exceedsDragThreshold(state.anchorTouch, touches[0]);
  return applyTouchUpdate(
    state,
    touches,
    state.anchorTouch,
    movedBeyondTap,
    now,
  );
}

export function recordTouchEnd(
  state: GestureGuardState,
  remainingTouchCount: number,
  now: number,
): GestureGuardState {
  const wasNavigationGesture = state.hadMultiTouch || state.movedBeyondTap;
  const suppressUntil = withCooldown(
    state.suppressUntil,
    wasNavigationGesture,
    now,
  );

  if (remainingTouchCount > 0) {
    return {
      ...state,
      activeTouchCount: remainingTouchCount,
      suppressUntil,
    };
  }

  return {
    ...state,
    activeTouchCount: 0,
    anchorTouch: null,
    movedBeyondTap: false,
    hadMultiTouch: false,
    suppressUntil,
  };
}

export function recordWheelZoom(
  state: GestureGuardState,
  now: number,
): GestureGuardState {
  return {
    ...state,
    pendingUserZoom: true,
    suppressUntil: withCooldown(state.suppressUntil, true, now),
  };
}

export function beginMapDrag(state: GestureGuardState): GestureGuardState {
  return {
    ...state,
    pendingUserMove: true,
    mapDragging: true,
  };
}

export function endMapDrag(
  state: GestureGuardState,
  now: number,
): GestureGuardState {
  return {
    ...state,
    mapDragging: false,
    suppressUntil: withCooldown(state.suppressUntil, true, now),
  };
}

export function beginMapMove(state: GestureGuardState): GestureGuardState {
  if (!state.pendingUserMove) {
    return state;
  }
  return {
    ...state,
    mapMoving: true,
  };
}

export function endMapMove(
  state: GestureGuardState,
  now: number,
): GestureGuardState {
  if (!state.pendingUserMove && !state.mapMoving) {
    return state;
  }
  return {
    ...state,
    pendingUserMove: false,
    mapMoving: false,
    suppressUntil: withCooldown(state.suppressUntil, true, now),
  };
}

export function beginMapZoom(state: GestureGuardState): GestureGuardState {
  if (!state.pendingUserZoom) {
    return state;
  }
  return {
    ...state,
    mapZooming: true,
  };
}

export function endMapZoom(
  state: GestureGuardState,
  now: number,
): GestureGuardState {
  if (!state.pendingUserZoom && !state.mapZooming) {
    return state;
  }
  return {
    ...state,
    pendingUserZoom: false,
    mapZooming: false,
    suppressUntil: withCooldown(state.suppressUntil, true, now),
  };
}

export function resetPendingUserNavigation(
  state: GestureGuardState,
): GestureGuardState {
  return {
    ...state,
    pendingUserZoom: false,
    pendingUserMove: false,
    mapZooming: false,
    mapMoving: false,
  };
}

/**
 * Mark an active map navigation gesture (drag, pan, or zoom) across unified handlers.
 */
export function beginMapNavigation(state: GestureGuardState): GestureGuardState {
  return {
    ...state,
    pendingUserMove: true,
    mapMoving: true,
  };
}

/**
 * End an active map navigation gesture and start the post-gesture click cooldown.
 */
export function endMapNavigation(
  state: GestureGuardState,
  now: number,
): GestureGuardState {
  return {
    ...state,
    pendingUserMove: false,
    pendingUserZoom: false,
    mapDragging: false,
    mapMoving: false,
    mapZooming: false,
    suppressUntil: withCooldown(state.suppressUntil, true, now),
  };
}

export function shouldSuppressSelectionClick(
  state: GestureGuardState,
  now: number,
): boolean {
  if (state.mapDragging || state.mapMoving || state.mapZooming) {
    return true;
  }
  if (
    state.activeTouchCount > 0 &&
    (state.hadMultiTouch || state.movedBeyondTap)
  ) {
    return true;
  }
  return now < state.suppressUntil;
}
