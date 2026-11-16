import { describe, expect, it } from 'vitest';
import {
  NAVIGATION_COOLDOWN_MS,
  TOUCH_DRAG_THRESHOLD_PX,
  beginMapDrag,
  beginMapMove,
  beginMapZoom,
  createGestureGuardState,
  endMapDrag,
  endMapMove,
  endMapZoom,
  recordTouchEnd,
  recordTouchMove,
  recordTouchStart,
  recordWheelZoom,
  resetPendingUserNavigation,
  shouldSuppressSelectionClick,
} from '@/domain/gesture-guard';

describe('Navigation gesture guard (mobile drag, pinch, and post-gesture cooldown)', () => {
  it('allows a clean single-finger tap within the drag threshold without cooldown', () => {
    let state = createGestureGuardState();
    state = recordTouchStart(state, [[200, 300]], 1000);
    state = recordTouchMove(
      state,
      [[200 + TOUCH_DRAG_THRESHOLD_PX - 1, 300]],
      1020,
    );
    expect(shouldSuppressSelectionClick(state, 1020)).toBe(false);

    state = recordTouchEnd(state, 0, 1040);
    expect(shouldSuppressSelectionClick(state, 1040)).toBe(false);
    expect(shouldSuppressSelectionClick(state, 1045)).toBe(false);
  });

  it('suppresses selection during a single-finger drag and through the 160ms post-drag cooldown', () => {
    let state = createGestureGuardState();
    state = recordTouchStart(state, [[200, 300]], 1000);
    state = recordTouchMove(
      state,
      [[200 + TOUCH_DRAG_THRESHOLD_PX + 10, 300]],
      1030,
    );
    expect(shouldSuppressSelectionClick(state, 1030)).toBe(true);

    state = recordTouchEnd(state, 0, 1060);
    expect(shouldSuppressSelectionClick(state, 1060)).toBe(true);
    expect(
      shouldSuppressSelectionClick(state, 1060 + NAVIGATION_COOLDOWN_MS - 1),
    ).toBe(true);
    expect(
      shouldSuppressSelectionClick(state, 1060 + NAVIGATION_COOLDOWN_MS),
    ).toBe(false);
  });

  it('suppresses selection on two-finger pinch even with minimal finger travel until all touches end plus cooldown', () => {
    let state = createGestureGuardState();
    state = recordTouchStart(state, [[180, 320]], 2000);
    state = recordTouchStart(
      state,
      [
        [180, 320],
        [240, 360],
      ],
      2010,
    );
    expect(shouldSuppressSelectionClick(state, 2010)).toBe(true);

    // First finger lifts while second finger remains on screen
    state = recordTouchEnd(state, 1, 2050);
    expect(shouldSuppressSelectionClick(state, 2050)).toBe(true);

    // Final finger lifts -> cooldown begins
    state = recordTouchEnd(state, 0, 2080);
    expect(shouldSuppressSelectionClick(state, 2090)).toBe(true);
    expect(
      shouldSuppressSelectionClick(state, 2080 + NAVIGATION_COOLDOWN_MS - 1),
    ).toBe(true);
    expect(
      shouldSuppressSelectionClick(state, 2080 + NAVIGATION_COOLDOWN_MS),
    ).toBe(false);

    // Subsequent clean single tap works normally
    state = recordTouchStart(state, [[210, 340]], 2300);
    state = recordTouchEnd(state, 0, 2320);
    expect(shouldSuppressSelectionClick(state, 2320)).toBe(false);
  });

  it('guards inertial pan after dragend until moveend + cooldown and ignores programmatic camera moves/zooms', () => {
    // Programmatic zoom/move without prior user interaction does NOT suppress clicks
    let programmatic = createGestureGuardState();
    programmatic = beginMapZoom(programmatic);
    programmatic = beginMapMove(programmatic);
    expect(shouldSuppressSelectionClick(programmatic, 1000)).toBe(false);
    programmatic = endMapMove(programmatic, 1040);
    programmatic = endMapZoom(programmatic, 1050);
    expect(shouldSuppressSelectionClick(programmatic, 1055)).toBe(false);

    // User drag + inertial panning keeps suppressing past dragend until moveend + cooldown
    let dragged = beginMapDrag(createGestureGuardState());
    dragged = beginMapMove(dragged);
    dragged = endMapDrag(dragged, 2100);
    // Inertial coasting still running at 2350ms (> 160ms after dragend)
    expect(shouldSuppressSelectionClick(dragged, 2350)).toBe(true);
    dragged = endMapMove(dragged, 2400);
    expect(shouldSuppressSelectionClick(dragged, 2450)).toBe(true);
    expect(
      shouldSuppressSelectionClick(dragged, 2400 + NAVIGATION_COOLDOWN_MS),
    ).toBe(false);

    // Stale pendingUserZoom at zoom boundary can be cleared before programmatic camera jump
    let atMaxZoom = recordWheelZoom(createGestureGuardState(), 3000);
    atMaxZoom = resetPendingUserNavigation(atMaxZoom);
    atMaxZoom = beginMapZoom(atMaxZoom);
    expect(shouldSuppressSelectionClick(atMaxZoom, 3200)).toBe(false);
  });
});
