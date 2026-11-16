'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import {
  toCanonicalPixel,
  toLeafletBounds,
} from '@/domain/map-coordinates';
import type { MapDatasetConfig } from '@/domain/types';

export interface CameraStatus {
  zoom: number;
  centerX: number;
  centerY: number;
  activeTarget: string;
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
  const activeTargetRef = useRef<string>('full-map');
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;

  const fullLeafletBounds = useMemo<L.LatLngBoundsExpression>(
    () =>
      toLeafletBounds([
        [0, 0],
        [config.canonicalSize, config.canonicalSize],
      ]) as unknown as L.LatLngBoundsExpression,
    [config.canonicalSize],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const paddedMaxBounds = toLeafletBounds([
      [-2048, -2048],
      [config.canonicalSize + 2048, config.canonicalSize + 2048],
    ]) as unknown as L.LatLngBoundsExpression;

    const map = L.map(container, {
      crs: L.CRS.Simple,
      minZoom: -5,
      maxZoom: 3,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 60,
      attributionControl: false,
      zoomControl: false,
      maxBounds: paddedMaxBounds,
      maxBoundsViscosity: 0.5,
    });

    mapRef.current = map;

    L.imageOverlay(config.baseImage.imagePath, fullLeafletBounds, {
      className: 'taego-base-overlay',
      interactive: false,
    }).addTo(map);

    for (const overlay of config.highResOverlays) {
      const overlayBounds = toLeafletBounds(
        overlay.bounds,
      ) as unknown as L.LatLngBoundsExpression;
      L.imageOverlay(overlay.imagePath, overlayBounds, {
        className: 'taego-highres-overlay',
        interactive: false,
      }).addTo(map);
    }

    for (const zone of config.targetZones) {
      const zoneBounds = toLeafletBounds(
        zone.bounds,
      ) as unknown as L.LatLngBoundsExpression;
      L.rectangle(zoneBounds, {
        color: '#f59e0b',
        weight: 2,
        dashArray: '8 6',
        fillColor: '#f59e0b',
        fillOpacity: 0.08,
        interactive: false,
        className: 'taego-target-zone-boundary',
      }).addTo(map);
    }

    const emitCameraStatus = () => {
      const center = map.getCenter();
      const [centerX, centerY] = toCanonicalPixel([center.lat, center.lng]);
      onCameraChangeRef.current({
        zoom: Number(map.getZoom().toFixed(2)),
        centerX: Math.round(centerX),
        centerY: Math.round(centerY),
        activeTarget: activeTargetRef.current,
      });
    };

    map.on('moveend zoomend', emitCameraStatus);
    map.fitBounds(fullLeafletBounds, { animate: false });
    activeTargetRef.current = 'full-map';
    emitCameraStatus();

    return () => {
      map.off('moveend zoomend', emitCameraStatus);
      map.remove();
      mapRef.current = null;
    };
  }, [config, fullLeafletBounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cameraCommand) {
      return;
    }

    if (cameraCommand.type === 'reset') {
      activeTargetRef.current = 'full-map';
      map.fitBounds(fullLeafletBounds, { animate: false });
      return;
    }

    const zone = config.targetZones.find(
      (candidate) => candidate.id === cameraCommand.zoneId,
    );
    if (!zone) {
      return;
    }

    activeTargetRef.current = `zone:${zone.id}`;
    const zoneBounds = toLeafletBounds(
      zone.bounds,
    ) as unknown as L.LatLngBoundsExpression;
    map.flyToBounds(zoneBounds, { duration: 0.25, padding: [24, 24] });
  }, [cameraCommand, config.targetZones, fullLeafletBounds]);

  return (
    <div
      ref={containerRef}
      className="taego-map-canvas"
      data-testid="leaflet-map-container"
    />
  );
}
