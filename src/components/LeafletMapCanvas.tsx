'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import {
  findBuildingAtPoint,
  resolveBuildingFootprintPlacements,
} from '@/domain/buildings';
import {
  resolveMapLayerPlacement,
  toCanonicalPixel,
} from '@/domain/map-coordinates';
import type { BuildingRecord, MapDatasetConfig } from '@/domain/types';

export type MapCameraCommand =
  | { id: number; type: 'reset' }
  | { id: number; type: 'focus-zone'; zoneId: string };

interface LeafletMapCanvasProps {
  config: MapDatasetConfig;
  buildings: readonly BuildingRecord[];
  selectedBuildingId: string | null;
  onSelectBuilding: (buildingId: string | null) => void;
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

export default function LeafletMapCanvas({
  config,
  buildings,
  selectedBuildingId,
  onSelectBuilding,
  cameraCommand,
}: LeafletMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonLayersRef = useRef<Map<string, L.Polygon>>(new Map());
  const buildingsRef = useRef(buildings);
  const onSelectBuildingRef = useRef(onSelectBuilding);
  const selectedBuildingIdRef = useRef(selectedBuildingId);

  buildingsRef.current = buildings;
  onSelectBuildingRef.current = onSelectBuilding;
  selectedBuildingIdRef.current = selectedBuildingId;

  const placement = useMemo(() => resolveMapLayerPlacement(config), [config]);
  const footprintPlacements = useMemo(
    () => resolveBuildingFootprintPlacements(buildings, config.baseImage),
    [buildings, config.baseImage],
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
      const canonicalPoint = toCanonicalPixel([
        event.latlng.lat,
        event.latlng.lng,
      ]);
      const matched = findBuildingAtPoint(canonicalPoint, buildingsRef.current);
      onSelectBuildingRef.current(matched?.id ?? null);
    };

    map.on('zoomend', syncOverlayVisibility);
    map.on('click', handleMapClick);
    map.fitBounds(placement.baseBounds, { animate: false });
    syncOverlayVisibility();

    return () => {
      map.off('zoomend', syncOverlayVisibility);
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

    for (const footprint of footprintPlacements) {
      const isSelected = footprint.id === selectedBuildingIdRef.current;
      const polygon = L.polygon(footprint.latLngs, {
        ...(isSelected ? SELECTED_FOOTPRINT_STYLE : UNSELECTED_FOOTPRINT_STYLE),
        interactive: true,
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
    if (!map || !cameraCommand) {
      return;
    }

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
    <div
      ref={containerRef}
      className="taego-map-canvas"
      data-testid="leaflet-map-container"
    />
  );
}
