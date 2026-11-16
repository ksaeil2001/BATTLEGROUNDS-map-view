'use client';

import './dev-picker.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
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
  type PickerMode,
  type PickerState,
} from '@/domain/coordinate-picker';
import { toLeafletLatLng } from '@/domain/map-coordinates';

interface DevCoordinatePickerProps {
  map: L.Map | null;
  onActiveChange: (active: boolean) => void;
}

export default function DevCoordinatePicker({
  map,
  onActiveChange,
}: DevCoordinatePickerProps) {
  const [pickerState, setPickerState] = useState<PickerState>(() =>
    createInitialPickerState(),
  );
  const [copiedJson, setCopiedJson] = useState<string | null>(null);

  const updateState = (updater: (prev: PickerState) => PickerState) => {
    setCopiedJson(null);
    setPickerState(updater);
  };

  useEffect(() => {
    return () => {
      onActiveChange(false);
    };
  }, [onActiveChange]);

  useEffect(() => {
    if (!map || !pickerState.active) {
      return;
    }

    const handleMapClick = (event: L.LeafletMouseEvent) => {
      const point = toCanonicalIntegerPoint([
        event.latlng.lat,
        event.latlng.lng,
      ]);
      updateState((prev) => addPickerPoint(prev, point));
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, pickerState.active]);

  useEffect(() => {
    if (!map || !pickerState.active || pickerState.points.length === 0) {
      return;
    }

    const previewGroup = L.layerGroup().addTo(map);
    const latLngs = pickerState.points.map(toLeafletLatLng);

    if (pickerState.mode === 'polygon' && latLngs.length >= 2) {
      const previewPolygon = L.polygon(latLngs, {
        color: '#38bdf8',
        weight: 2,
        dashArray: '5 4',
        fillColor: '#38bdf8',
        fillOpacity: 0.2,
        interactive: false,
        className: 'taego-dev-picker-polygon',
      }).addTo(previewGroup);

      const element = previewPolygon.getElement();
      if (element) {
        element.setAttribute('data-testid', 'dev-picker-polygon-preview');
        element.setAttribute(
          'data-point-count',
          String(pickerState.points.length),
        );
      }
    }

    pickerState.points.forEach((point, index) => {
      const marker = L.marker(latLngs[index]!, {
        interactive: false,
        icon: L.divIcon({
          className: 'taego-dev-picker-vertex',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
          html: `<span class="taego-dev-picker-vertex-dot">${index + 1}</span>`,
        }),
      }).addTo(previewGroup);

      const element = marker.getElement();
      if (element) {
        element.setAttribute('data-testid', `dev-picker-vertex-${index}`);
        element.setAttribute('data-canonical-coord', `${point[0]},${point[1]}`);
      }
    });

    return () => {
      previewGroup.remove();
    };
  }, [map, pickerState.active, pickerState.mode, pickerState.points]);

  const jsonOutput = formatPickerJson(pickerState);

  const handleToggleActive = () => {
    const nextState = pickerState.active
      ? deactivatePicker(pickerState)
      : activatePicker(pickerState);
    onActiveChange(nextState.active);
    setCopiedJson(null);
    setPickerState(nextState);
  };

  const handleSelectMode = (mode: PickerMode) => {
    updateState((prev) => setPickerMode(prev, mode));
  };

  const handleCopyJson = async () => {
    if (pickerState.points.length === 0) {
      return;
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(jsonOutput);
      setCopiedJson(jsonOutput);
    }
  };

  return (
    <section
      className="taego-dev-picker-toolbar"
      data-testid="dev-picker-toolbar"
      data-active={pickerState.active ? 'true' : 'false'}
      aria-label="개발 전용 좌표 추출 도구"
    >
      <button
        type="button"
        className="taego-control-btn taego-dev-picker-toggle"
        data-testid="dev-picker-toggle-button"
        aria-pressed={pickerState.active}
        onClick={handleToggleActive}
      >
        {pickerState.active
          ? '좌표 추출기 ON (편집 중)'
          : '좌표 추출기 OFF (DEV)'}
      </button>

      {pickerState.active ? (
        <>
          <div className="taego-dev-picker-modes">
            <button
              type="button"
              className="taego-dev-picker-btn"
              data-testid="dev-picker-mode-polygon"
              aria-pressed={pickerState.mode === 'polygon'}
              onClick={() => handleSelectMode('polygon')}
            >
              다각형 (Roof Footprint)
            </button>
            <button
              type="button"
              className="taego-dev-picker-btn"
              data-testid="dev-picker-mode-vehicle"
              aria-pressed={pickerState.mode === 'vehicle'}
              onClick={() => handleSelectMode('vehicle')}
            >
              고정 차량 출현 지점 (Single Point)
            </button>
          </div>

          <div className="taego-dev-picker-actions">
            <button
              type="button"
              className="taego-dev-picker-btn"
              data-testid="dev-picker-undo-button"
              disabled={pickerState.points.length === 0}
              onClick={() => updateState(undoPickerPoint)}
            >
              점 되돌리기 (Undo)
            </button>
            <button
              type="button"
              className="taego-dev-picker-btn"
              data-testid="dev-picker-cancel-button"
              disabled={pickerState.points.length === 0}
              onClick={() => updateState(clearPickerPoints)}
            >
              취소 (Cancel)
            </button>
            <button
              type="button"
              className="taego-dev-picker-btn"
              data-testid="dev-picker-copy-button"
              disabled={pickerState.points.length === 0}
              onClick={handleCopyJson}
            >
              JSON 복사 (Copy JSON)
            </button>
          </div>

          <div className="taego-dev-picker-meta">
            <span data-testid="dev-picker-point-count">
              {pickerState.points.length}개 점
            </span>
            {copiedJson ? (
              <span
                className="taego-dev-picker-copy-status"
                data-testid="dev-picker-copy-status"
                data-copied-json={copiedJson}
              >
                복사 완료
              </span>
            ) : null}
          </div>

          <pre
            className="taego-dev-picker-json"
            data-testid="dev-picker-json-output"
          >
            {jsonOutput}
          </pre>
        </>
      ) : null}
    </section>
  );
}
