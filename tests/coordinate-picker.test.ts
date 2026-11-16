import { describe, expect, it } from 'vitest';
import {
  activatePicker,
  addPickerPoint,
  clearPickerPoints,
  createInitialPickerState,
  deactivatePicker,
  formatPickerJson,
  setPickerMode,
  toCanonicalIntegerPoint,
  undoPickerPoint,
} from '@/domain/coordinate-picker';

describe('Coordinate Picker pure domain logic (Canonical Pixel Space)', () => {
  it('converts Leaflet CRS.Simple [lat, lng] into rounded integer CanonicalPoint tuples clamped to 0..8192', () => {
    expect([
      toCanonicalIntegerPoint([5891.6, 3700.4]),
      toCanonicalIntegerPoint([8192, 0]),
      toCanonicalIntegerPoint([0, 8192]),
      toCanonicalIntegerPoint([9000, -150]),
      toCanonicalIntegerPoint([-50, 9500]),
    ]).toEqual([
      [3700, 2300],
      [0, 0],
      [8192, 8192],
      [0, 0],
      [8192, 8192],
    ]);
  });

  it('starts inactive in polygon mode and clears points on mode switch or deactivation', () => {
    const initial = createInitialPickerState();
    expect(initial).toEqual({
      active: false,
      mode: 'polygon',
      points: [],
    });

    const active = activatePicker(initial);
    const withPoints = addPickerPoint(
      addPickerPoint(active, [3700, 2300]),
      [3940, 2300],
    );
    expect(withPoints.points).toEqual([
      [3700, 2300],
      [3940, 2300],
    ]);

    const switched = setPickerMode(withPoints, 'vehicle');
    expect(switched).toEqual({
      active: true,
      mode: 'vehicle',
      points: [],
    });

    const vehicleWithPoint = addPickerPoint(switched, [4260, 2600]);
    const deactivated = deactivatePicker(vehicleWithPoint);
    expect(deactivated).toEqual({
      active: false,
      mode: 'vehicle',
      points: [],
    });
  });

  it('ignores clicks while inactive and handles polygon append, single-point vehicle replace, undo, and cancel', () => {
    const inactive = createInitialPickerState();
    expect(addPickerPoint(inactive, [3700, 2300]).points).toEqual([]);

    let polygonState = activatePicker(inactive);
    polygonState = addPickerPoint(polygonState, [3700, 2300]);
    polygonState = addPickerPoint(polygonState, [3940, 2300]);
    polygonState = addPickerPoint(polygonState, [3940, 2430]);
    expect(polygonState.points).toEqual([
      [3700, 2300],
      [3940, 2300],
      [3940, 2430],
    ]);

    const afterUndo = undoPickerPoint(polygonState);
    expect(afterUndo.points).toEqual([
      [3700, 2300],
      [3940, 2300],
    ]);

    const afterCancel = clearPickerPoints(afterUndo);
    expect(afterCancel).toEqual({
      active: true,
      mode: 'polygon',
      points: [],
    });

    let vehicleState = setPickerMode(afterCancel, 'vehicle');
    vehicleState = addPickerPoint(vehicleState, [4000, 2500]);
    vehicleState = addPickerPoint(vehicleState, [4260, 2600]);
    expect(vehicleState.points).toEqual([[4260, 2600]]);

    expect(undoPickerPoint(vehicleState).points).toEqual([]);
  });

  it('serializes polygon vertices as CanonicalPoint[] JSON and single vehicle point as CanonicalPoint JSON', () => {
    let polygonState = activatePicker(createInitialPickerState());
    polygonState = addPickerPoint(polygonState, [3700, 2300]);
    polygonState = addPickerPoint(polygonState, [3940, 2300]);
    polygonState = addPickerPoint(polygonState, [3940, 2430]);

    expect(JSON.parse(formatPickerJson(polygonState))).toEqual([
      [3700, 2300],
      [3940, 2300],
      [3940, 2430],
    ]);

    const emptyVehicle = setPickerMode(polygonState, 'vehicle');
    expect(JSON.parse(formatPickerJson(emptyVehicle))).toEqual([]);

    const singleVehicle = addPickerPoint(emptyVehicle, [4260, 2600]);
    expect(JSON.parse(formatPickerJson(singleVehicle))).toEqual([4260, 2600]);
  });
});
