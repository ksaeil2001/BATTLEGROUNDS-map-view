'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import {
  findBuildingAtPoint,
  resolveBuildingFootprintPlacements,
} from '@/domain/buildings';
import {
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
  type GestureGuardState,
  type TouchSamplePoint,
} from '@/domain/gesture-guard';
import {
  resolveMapLayerPlacement,
  toCanonicalPixel,
} from '@/domain/map-coordinates';
import type {
  BuildingRecord,
  FixedVehicleSpawnRecord,
  MapDatasetConfig,
  VehicleSpawnType,
} from '@/domain/types';
import { resolveVehicleSpawnPlacements } from '@/domain/vehicles';

const DevCoordinatePickerLazy =
  process.env.NODE_ENV === 'development'
    ? lazy(() => import('./dev/DevCoordinatePicker'))
    : null;

export type MapCameraCommand =
  | { id: number; type: 'reset' }
  | { id: number; type: 'focus-zone'; zoneId: string };

export type MapSelection =
  | { kind: 'building'; id: string }
  | { kind: 'vehicle'; id: string }
  | null;

interface LeafletMapCanvasProps {
  config: MapDatasetConfig;
  buildings: readonly BuildingRecord[];
  vehicles: readonly FixedVehicleSpawnRecord[];
  isVehicleLayerVisible: boolean;
  selection: MapSelection;
  onSelect: (selection: MapSelection) => void;
  cameraCommand: MapCameraCommand | null;
}

const UNSELECTED_FOOTPRINT_STYLE: L.PathOptions = {
  color: '#fbbf24',
  weight: 2,
  opacity: 0,
  fillColor: '#f59e0b',
  fillOpacity: 0,
};

const SELECTED_FOOTPRINT_STYLE: L.PathOptions = {
  color: '#fbbf24',
  weight: 3,
  opacity: 1,
  fillColor: '#f59e0b',
  fillOpacity: 0.24,
};

function applyFootprintSelectionState(
  polygon: L.Polygon,
  isSelected: boolean,
): void {
  polygon.setStyle(
    isSelected ? SELECTED_FOOTPRINT_STYLE : UNSELECTED_FOOTPRINT_STYLE,
  );
  const element = polygon.getElement();
  if (element) {
    element.setAttribute('data-selected', isSelected ? 'true' : 'false');
  }
}

function createVehicleDivIcon(spawnType: VehicleSpawnType): L.DivIcon {
  const glyph =
    spawnType === 'garage'
      ? '<rect x="5" y="7" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 17v-5h8v5" fill="none" stroke="currentColor" stroke-width="1.6"/>'
      : '<circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2" fill="currentColor"/>';

  return L.divIcon({
    className: 'taego-vehicle-marker-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<span class="taego-vehicle-marker-badge"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">${glyph}</svg></span>`,
  });
}

function extractTouchPoints(event: TouchEvent): TouchSamplePoint[] {
  return Array.from(
    event.touches,
    (touch) => [touch.clientX, touch.clientY] as const,
  );
}

function bindNavigationGestureGuard(
  container: HTMLDivElement,
  map: L.Map,
  gestureGuardRef: MutableRefObject<GestureGuardState>,
  onZoomEnd: () => void,
): () => void {
  gestureGuardRef.current = createGestureGuardState();

  const handleTouchStart = (event: TouchEvent) => {
    gestureGuardRef.current = recordTouchStart(
      gestureGuardRef.current,
      extractTouchPoints(event),
      performance.now(),
    );
  };
  const handleTouchMove = (event: TouchEvent) => {
    gestureGuardRef.current = recordTouchMove(
      gestureGuardRef.current,
      extractTouchPoints(event),
      performance.now(),
    );
  };
  const handleTouchEnd = (event: TouchEvent) => {
    gestureGuardRef.current = recordTouchEnd(
      gestureGuardRef.current,
      event.touches.length,
      performance.now(),
    );
  };
  const handleWheel = () => {
    gestureGuardRef.current = recordWheelZoom(
      gestureGuardRef.current,
      performance.now(),
    );
  };
  const handleDragStart = () => {
    gestureGuardRef.current = beginMapDrag(gestureGuardRef.current);
  };
  const handleDragEnd = () => {
    gestureGuardRef.current = endMapDrag(
      gestureGuardRef.current,
      performance.now(),
    );
  };
  const handleMoveStart = () => {
    gestureGuardRef.current = beginMapMove(gestureGuardRef.current);
  };
  const handleMoveEnd = () => {
    gestureGuardRef.current = endMapMove(
      gestureGuardRef.current,
      performance.now(),
    );
  };
  const handleZoomStart = () => {
    gestureGuardRef.current = beginMapZoom(gestureGuardRef.current);
  };
  const handleZoomEnd = () => {
    onZoomEnd();
    gestureGuardRef.current = endMapZoom(
      gestureGuardRef.current,
      performance.now(),
    );
  };

  const passiveCapture = { passive: true, capture: true } as const;
  container.addEventListener('touchstart', handleTouchStart, passiveCapture);
  container.addEventListener('touchmove', handleTouchMove, passiveCapture);
  container.addEventListener('touchend', handleTouchEnd, passiveCapture);
  container.addEventListener('touchcancel', handleTouchEnd, passiveCapture);
  container.addEventListener('wheel', handleWheel, passiveCapture);

  map.on('dragstart', handleDragStart);
  map.on('dragend', handleDragEnd);
  map.on('movestart', handleMoveStart);
  map.on('moveend', handleMoveEnd);
  map.on('zoomstart', handleZoomStart);
  map.on('zoomend', handleZoomEnd);

  return () => {
    container.removeEventListener('touchstart', handleTouchStart, true);
    container.removeEventListener('touchmove', handleTouchMove, true);
    container.removeEventListener('touchend', handleTouchEnd, true);
    container.removeEventListener('touchcancel', handleTouchEnd, true);
    container.removeEventListener('wheel', handleWheel, true);

    map.off('dragstart', handleDragStart);
    map.off('dragend', handleDragEnd);
    map.off('movestart', handleMoveStart);
    map.off('moveend', handleMoveEnd);
    map.off('zoomstart', handleZoomStart);
    map.off('zoomend', handleZoomEnd);
  };
}

export default function LeafletMapCanvas({
  config,
  buildings,
  vehicles,
  isVehicleLayerVisible,
  selection,
  onSelect,
  cameraCommand,
}: LeafletMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonLayersRef = useRef<Map<string, L.Polygon>>(new Map());
  const vehicleMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const buildingsRef = useRef(buildings);
  const selectionRef = useRef(selection);
  const onSelectRef = useRef(onSelect);
  const isPickerSuppressedRef = useRef(false);
  const gestureGuardRef = useRef(createGestureGuardState());
  const [devMapInstance, setDevMapInstance] = useState<L.Map | null>(null);

  buildingsRef.current = buildings;
  selectionRef.current = selection;
  onSelectRef.current = onSelect;

  const isSelectionSuppressed = () => {
    if (
      process.env.NODE_ENV === 'development' &&
      isPickerSuppressedRef.current
    ) {
      return true;
    }
    return shouldSuppressSelectionClick(
      gestureGuardRef.current,
      performance.now(),
    );
  };

  const handlePickerActiveChange = useCallback((active: boolean) => {
    isPickerSuppressedRef.current = active;
    if (active) {
      onSelectRef.current(null);
    }
  }, []);

  const selectedBuildingId =
    selection?.kind === 'building' ? selection.id : null;
  const selectedVehicleId =
    selection?.kind === 'vehicle' ? selection.id : null;

  const placement = useMemo(() => resolveMapLayerPlacement(config), [config]);
  const footprintPlacements = useMemo(
    () => resolveBuildingFootprintPlacements(buildings, config.baseImage),
    [buildings, config.baseImage],
  );
  const vehiclePlacements = useMemo(
    () => resolveVehicleSpawnPlacements(vehicles, config.baseImage),
    [vehicles, config.baseImage],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const map = L.map(container, {
      crs: L.CRS.Simple,
      minZoom: -5,
      maxZoom: 3,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 60,
      attributionControl: false,
      zoomControl: false,
      doubleClickZoom: false,
      maxBounds: placement.paddedMaxBounds,
      maxBoundsViscosity: 0.5,
    });

    mapRef.current = map;

    L.imageOverlay(placement.baseImagePath, placement.baseBounds, {
      className: 'taego-base-overlay',
      interactive: false,
    }).addTo(map);

    const conditionalOverlays: Array<{
      layer: L.ImageOverlay;
      minDisplayZoom: number;
    }> = [];

    for (const overlay of placement.overlays) {
      const layer = L.imageOverlay(overlay.imagePath, overlay.bounds, {
        className: 'taego-highres-overlay',
        interactive: false,
      }).addTo(map);

      if (overlay.minDisplayZoom !== undefined) {
        conditionalOverlays.push({
          layer,
          minDisplayZoom: overlay.minDisplayZoom,
        });
      }
    }

    for (const zone of placement.targetZones) {
      L.rectangle(zone.bounds, {
        color: '#f59e0b',
        weight: 2,
        dashArray: '8 6',
        fillColor: '#f59e0b',
        fillOpacity: 0.08,
        interactive: false,
        className: 'taego-target-zone-boundary',
      }).addTo(map);
    }

    const syncOverlayVisibility = () => {
      const currentZoom = map.getZoom();
      for (const item of conditionalOverlays) {
        item.layer.setOpacity(currentZoom >= item.minDisplayZoom ? 1 : 0);
      }
    };

    const handleMapClick = (event: L.LeafletMouseEvent) => {
      if (isSelectionSuppressed()) {
        return;
      }
      const canonicalPoint = toCanonicalPixel([
        event.latlng.lat,
        event.latlng.lng,
      ]);
      const matched = findBuildingAtPoint(canonicalPoint, buildingsRef.current);
      onSelectRef.current(
        matched ? { kind: 'building', id: matched.id } : null,
      );
    };

    const unbindNavigationGuard = bindNavigationGestureGuard(
      container,
      map,
      gestureGuardRef,
      syncOverlayVisibility,
    );

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize({ pan: false });
      });
      resizeObserver.observe(container);
    }

    map.on('click', handleMapClick);
    map.fitBounds(placement.baseBounds, { animate: false });
    syncOverlayVisibility();
    if (process.env.NODE_ENV === 'development') {
      setDevMapInstance(map);
    }

    return () => {
      if (process.env.NODE_ENV === 'development') {
        isPickerSuppressedRef.current = false;
        setDevMapInstance(null);
      }
      resizeObserver?.disconnect();
      unbindNavigationGuard();
      map.off('click', handleMapClick);
      map.remove();
      mapRef.current = null;
    };
  }, [placement]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const footprintGroup = L.layerGroup().addTo(map);
    const layerMap = polygonLayersRef.current;
    layerMap.clear();

    const currentBuildingId =
      selectionRef.current?.kind === 'building'
        ? selectionRef.current.id
        : null;

    for (const footprint of footprintPlacements) {
      const isSelected = footprint.id === currentBuildingId;
      const polygon = L.polygon(footprint.latLngs, {
        ...(isSelected ? SELECTED_FOOTPRINT_STYLE : UNSELECTED_FOOTPRINT_STYLE),
        interactive: true,
        noClip: true,
        className: 'taego-roof-footprint',
      }).addTo(footprintGroup);

      const element = polygon.getElement();
      if (element) {
        element.setAttribute('data-testid', `roof-footprint-${footprint.id}`);
        element.setAttribute('data-building-id', footprint.id);
        element.setAttribute('data-selected', isSelected ? 'true' : 'false');
      }

      layerMap.set(footprint.id, polygon);
    }

    return () => {
      layerMap.clear();
      footprintGroup.remove();
    };
  }, [placement, footprintPlacements]);

  useEffect(() => {
    for (const [id, polygon] of polygonLayersRef.current.entries()) {
      applyFootprintSelectionState(polygon, id === selectedBuildingId);
    }
  }, [selectedBuildingId, placement, footprintPlacements]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isVehicleLayerVisible) {
      return;
    }

    const vehicleGroup = L.layerGroup().addTo(map);
    const markerMap = vehicleMarkersRef.current;
    markerMap.clear();

    const currentVehicleId =
      selectionRef.current?.kind === 'vehicle'
        ? selectionRef.current.id
        : null;

    for (const vehicle of vehiclePlacements) {
      const isSelected = vehicle.id === currentVehicleId;
      const marker = L.marker(vehicle.latLng, {
        icon: createVehicleDivIcon(vehicle.spawnType),
        bubblingMouseEvents: process.env.NODE_ENV === 'development',
      }).addTo(vehicleGroup);

      const element = marker.getElement();
      if (element) {
        element.setAttribute('data-testid', `vehicle-marker-${vehicle.id}`);
        element.setAttribute('data-vehicle-id', vehicle.id);
        element.setAttribute('data-spawn-type', vehicle.spawnType);
        element.setAttribute('data-selected', isSelected ? 'true' : 'false');
        element.setAttribute('aria-label', `${vehicle.id} 고정 차량 출현 지점`);
      }

      marker.on('click', (event) => {
        if (isSelectionSuppressed()) {
          return;
        }
        L.DomEvent.stopPropagation(event);
        onSelectRef.current({ kind: 'vehicle', id: vehicle.id });
      });

      markerMap.set(vehicle.id, marker);
    }

    return () => {
      markerMap.clear();
      vehicleGroup.remove();
    };
  }, [placement, vehiclePlacements, isVehicleLayerVisible]);

  useEffect(() => {
    for (const [id, marker] of vehicleMarkersRef.current.entries()) {
      const element = marker.getElement();
      if (element) {
        element.setAttribute(
          'data-selected',
          id === selectedVehicleId ? 'true' : 'false',
        );
      }
    }
  }, [selectedVehicleId, isVehicleLayerVisible, placement, vehiclePlacements]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cameraCommand) {
      return;
    }

    gestureGuardRef.current = resetPendingUserNavigation(
      gestureGuardRef.current,
    );

    if (cameraCommand.type === 'reset') {
      map.fitBounds(placement.baseBounds, { animate: false });
      return;
    }

    const zone = placement.targetZones.find(
      (candidate) => candidate.id === cameraCommand.zoneId,
    );
    if (!zone) {
      return;
    }

    map.flyToBounds(zone.bounds, { duration: 0.25, padding: [24, 24] });
  }, [cameraCommand, placement]);

  return (
    <>
      <div
        ref={containerRef}
        className="taego-map-canvas"
        data-testid="leaflet-map-container"
      />
      {process.env.NODE_ENV === 'development' && DevCoordinatePickerLazy ? (
        <Suspense fallback={null}>
          <DevCoordinatePickerLazy
            map={devMapInstance}
            onActiveChange={handlePickerActiveChange}
          />
        </Suspense>
      ) : null}
    </>
  );
}
