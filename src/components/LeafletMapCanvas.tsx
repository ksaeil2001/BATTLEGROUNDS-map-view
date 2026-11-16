'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import {
  resolveMapLayerPlacement,
  toCanonicalPixel,
} from '@/domain/map-coordinates';
import type { MapDatasetConfig } from '@/domain/types';

export interface CameraStatus {
  zoom: number;
  centerX: number;
  centerY: number;
}

export type MapCameraCommand =
  | { id: number; type: 'reset' }
  | { id: number; type: 'focus-zone'; zoneId: string };

interface LeafletMapCanvasProps {
  config: MapDatasetConfig;
  cameraCommand: MapCameraCommand | null;
  onCameraChange: (status: CameraStatus) => void;
}

export default function LeafletMapCanvas({
  config,
  cameraCommand,
  onCameraChange,
}: LeafletMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;

  const placement = useMemo(() => resolveMapLayerPlacement(config), [config]);

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

    const emitCameraStatus = () => {
      syncOverlayVisibility();
      const center = map.getCenter();
      const [centerX, centerY] = toCanonicalPixel([center.lat, center.lng]);
      onCameraChangeRef.current({
        zoom: Number(map.getZoom().toFixed(2)),
        centerX: Math.round(centerX),
        centerY: Math.round(centerY),
      });
    };

    map.on('moveend zoomend', emitCameraStatus);
    map.fitBounds(placement.baseBounds, { animate: false });
    emitCameraStatus();

    return () => {
      map.off('moveend zoomend', emitCameraStatus);
      map.remove();
      mapRef.current = null;
    };
  }, [placement]);

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
