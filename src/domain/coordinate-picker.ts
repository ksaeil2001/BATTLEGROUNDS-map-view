import { toCanonicalPixel } from './map-coordinates';
import {
  CANONICAL_MAP_SIZE,
  type CanonicalPoint,
  type LeafletLatLngTuple,
} from './types';

export type PickerMode = 'polygon' | 'vehicle';

export interface PickerState {
  active: boolean;
  mode: PickerMode;
  points: readonly CanonicalPoint[];
}

function clampCanonicalInteger(value: number): number {
  const rounded = Math.round(value);
  const clamped = Math.min(CANONICAL_MAP_SIZE, Math.max(0, rounded));
  return clamped === 0 ? 0 : clamped;
}

/**
 * Convert a Leaflet CRS.Simple coordinate tuple [lat, lng] into rounded
 * integer Canonical Pixel Space coordinates clamped to 0..8192.
 */
export function toCanonicalIntegerPoint(
  latLng: LeafletLatLngTuple,
): CanonicalPoint {
  const [x, y] = toCanonicalPixel(latLng);
  return [clampCanonicalInteger(x), clampCanonicalInteger(y)];
}

export function createInitialPickerState(): PickerState {
  return {
    active: false,
    mode: 'polygon',
    points: [],
  };
}

export function activatePicker(state: PickerState): PickerState {
  return {
    ...state,
    active: true,
  };
}

export function deactivatePicker(state: PickerState): PickerState {
  return {
    ...state,
    active: false,
    points: [],
  };
}

export function setPickerMode(
  state: PickerState,
  mode: PickerMode,
): PickerState {
  if (state.mode === mode) {
    return state;
  }
  return {
    ...state,
    mode,
    points: [],
  };
}

export function addPickerPoint(
  state: PickerState,
  point: CanonicalPoint,
): PickerState {
  if (!state.active) {
    return state;
  }

  if (state.mode === 'vehicle') {
    return {
      ...state,
      points: [point],
    };
  }

  return {
    ...state,
    points: [...state.points, point],
  };
}

export function undoPickerPoint(state: PickerState): PickerState {
  if (state.points.length === 0) {
    return state;
  }
  return {
    ...state,
    points: state.points.slice(0, -1),
  };
}

export function clearPickerPoints(state: PickerState): PickerState {
  if (state.points.length === 0) {
    return state;
  }
  return {
    ...state,
    points: [],
  };
}

export function formatPickerJson(state: PickerState): string {
  if (state.mode === 'vehicle' && state.points.length === 1) {
    return JSON.stringify(state.points[0]);
  }
  return JSON.stringify(state.points);
}
