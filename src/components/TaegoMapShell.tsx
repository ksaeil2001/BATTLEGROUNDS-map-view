'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';
import { getPublicBuildings } from '@/domain/buildings';
import type {
  BuildingRecord,
  FixedVehicleSpawnRecord,
  MapAssetMode,
  MapDatasetConfig,
} from '@/domain/types';
import { getPublicVehicles } from '@/domain/vehicles';
import BuildingCard from './BuildingCard';
import type { MapCameraCommand, MapSelection } from './LeafletMapCanvas';
import VehicleSpawnCard from './VehicleSpawnCard';

const DynamicLeafletMapCanvas = dynamic(() => import('./LeafletMapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="taego-map-loading">지도 캔버스를 불러오는 중...</div>
  ),
});

interface TaegoMapShellProps {
  maps: readonly MapDatasetConfig[];
  buildings: readonly BuildingRecord[];
  vehicles: readonly FixedVehicleSpawnRecord[];
}

const ASSET_MODE_COPY: Record<
  MapAssetMode,
  { badge: string; assetSummary: string; notice: string }
> = {
  sample: {
    badge: '샘플 지도',
    assetSummary: '자체 제작 정적 샘플 지도 (공개 배포 안전 자산)',
    notice:
      '비공식 팬 프로젝트 · KRAFTON과 무관하며 자체 제작 샘플 지도를 사용합니다.',
  },
  official: {
    badge: '공식 지도',
    assetSummary: 'KRAFTON IP 확인 지도 자산',
    notice: '비공식 팬 프로젝트 · 지도 이미지 권리 © KRAFTON, Inc.',
  },
};

export default function TaegoMapShell({
  maps,
  buildings,
  vehicles,
}: TaegoMapShellProps) {
  const [selectedMapId, setSelectedMapId] = useState<
    MapDatasetConfig['mapId'] | null
  >(null);
  const [selection, setSelection] = useState<MapSelection>(null);
  const [isVehicleLayerVisible, setIsVehicleLayerVisible] = useState(false);
  const [cameraCommand, setCameraCommand] = useState<MapCameraCommand | null>(
    null,
  );

  const publicBuildings = useMemo(
    () => getPublicBuildings(buildings),
    [buildings],
  );
  const publicVehicles = useMemo(
    () => getPublicVehicles(vehicles),
    [vehicles],
  );
  const activeConfig =
    maps.find((candidate) => candidate.mapId === selectedMapId) ?? null;
  const activePrimaryZone = activeConfig?.targetZones[0];

  const resolveZoneName = useCallback(
    (zoneId: string) =>
      activeConfig?.targetZones.find((zone) => zone.id === zoneId)?.displayName,
    [activeConfig],
  );

  const selectedBuilding = useMemo(
    () =>
      selection?.kind === 'building'
        ? (publicBuildings.find((building) => building.id === selection.id) ??
          null)
        : null,
    [publicBuildings, selection],
  );
  const selectedVehicle = useMemo(
    () =>
      isVehicleLayerVisible && selection?.kind === 'vehicle'
        ? (publicVehicles.find((vehicle) => vehicle.id === selection.id) ??
          null)
        : null,
    [isVehicleLayerVisible, publicVehicles, selection],
  );

  const handleToggleVehicleLayer = useCallback(() => {
    setIsVehicleLayerVisible((prev) => {
      const next = !prev;
      if (!next) {
        setSelection((current) =>
          current?.kind === 'vehicle' ? null : current,
        );
      }
      return next;
    });
  }, []);

  const handleResetView = useCallback(() => {
    setCameraCommand((prev) => ({
      id: (prev?.id ?? 0) + 1,
      type: 'reset',
    }));
  }, []);

  const handleFocusTargetZone = useCallback(() => {
    if (!activePrimaryZone) {
      return;
    }
    setCameraCommand((prev) => ({
      id: (prev?.id ?? 0) + 1,
      type: 'focus-zone',
      zoneId: activePrimaryZone.id,
    }));
  }, [activePrimaryZone]);

  if (activeConfig === null) {
    return (
      <main className="taego-selection-page">
        <div className="taego-selection-shell">
          <header className="taego-header">
            <span className="taego-eyebrow">BATTLEGROUNDS Map View</span>
            <h1 className="taego-title">전술 지도 선택</h1>
            <p className="taego-subtitle">
              지도를 선택해 Canonical Pixel Space 기반 전체 화면 탐색 뷰어를
              여세요.
            </p>
          </header>

          <section aria-label="지도 목록" className="taego-card-grid">
            {maps.map((mapConfig) => {
              const primaryZone = mapConfig.targetZones[0];
              const assetCopy = ASSET_MODE_COPY[mapConfig.assetMode];

              return (
                <button
                  key={mapConfig.mapId}
                  type="button"
                  className="taego-map-card"
                  data-testid="map-selection-card"
                  onClick={() => setSelectedMapId(mapConfig.mapId)}
                >
                  <div className="taego-map-preview-wrap">
                    <img
                      src={mapConfig.baseImage.imagePath}
                      alt={`${mapConfig.displayName} ${assetCopy.badge} 미리보기`}
                      className="taego-map-preview"
                    />
                  </div>

                  <div className="taego-map-card-body">
                    <div>
                      <div className="taego-map-card-title-row">
                        <h2 className="taego-map-card-title">
                          {mapConfig.displayName}
                        </h2>
                        <span className="taego-badge">
                          {assetCopy.badge} ·{' '}
                          {mapConfig.baseImage.mapImageVersion}
                        </span>
                      </div>
                      <ul className="taego-meta-list">
                        <li>
                          등록 구역(Target Zone):{' '}
                          <strong>
                            {primaryZone?.displayName ?? '미확인'}
                          </strong>
                          {primaryZone?.pilotReady
                            ? ' · 검증된 건물 및 고정 차량 출현 지점 제공'
                            : ` · ${assetCopy.badge} 탐색 전용 (검증 데이터 등록 준비 중)`}
                        </li>
                        <li>
                          좌표 규격: Canonical Pixel Space{' '}
                          {mapConfig.canonicalSize} × {mapConfig.canonicalSize}
                        </li>
                        <li>자산 상태: {assetCopy.assetSummary}</li>
                        <li>{assetCopy.notice}</li>
                      </ul>
                    </div>

                    <span className="taego-card-cta">전체 화면 지도 열기 →</span>
                  </div>
                </button>
              );
            })}
          </section>
        </div>
      </main>
    );
  }

  const activeAssetCopy = ASSET_MODE_COPY[activeConfig.assetMode];

  return (
    <main className="taego-viewer-screen" data-testid="map-viewer-screen">
      <div className="taego-map-controls" data-testid="map-controls">
        <button
          type="button"
          className="taego-control-btn"
          data-testid="back-to-map-list-button"
          onClick={() => {
            setSelectedMapId(null);
            setSelection(null);
            setIsVehicleLayerVisible(false);
            setCameraCommand(null);
          }}
        >
          ← 맵 목록
        </button>

        <button
          type="button"
          className="taego-control-btn"
          data-testid="reset-view-button"
          onClick={handleResetView}
        >
          전체 보기(Reset)
        </button>

        {activePrimaryZone ? (
          <button
            type="button"
            className="taego-control-btn taego-control-btn-accent"
            data-testid="target-zone-jump-button"
            onClick={handleFocusTargetZone}
          >
            등록 구역: {activePrimaryZone.displayName} · 이동
          </button>
        ) : null}
      </div>

      <div className="taego-layer-controls" data-testid="map-layer-controls">
        <button
          type="button"
          className={`taego-control-btn ${isVehicleLayerVisible ? 'taego-control-btn-active' : ''}`}
          data-testid="vehicle-layer-toggle-button"
          aria-label="고정 차량 출현 지점 레이어 표시 전환"
          aria-pressed={isVehicleLayerVisible}
          onClick={handleToggleVehicleLayer}
        >
          {isVehicleLayerVisible ? '차량 위치 ON' : '차량 위치 OFF'}
        </button>
      </div>

      <DynamicLeafletMapCanvas
        config={activeConfig}
        buildings={publicBuildings}
        vehicles={publicVehicles}
        isVehicleLayerVisible={isVehicleLayerVisible}
        selection={selection}
        onSelect={setSelection}
        cameraCommand={cameraCommand}
      />

      {selectedBuilding ? (
        <BuildingCard
          building={selectedBuilding}
          zoneName={resolveZoneName(selectedBuilding.zoneId)}
          onClose={() => setSelection(null)}
        />
      ) : null}

      {selectedVehicle ? (
        <VehicleSpawnCard
          vehicle={selectedVehicle}
          assetMode={activeConfig.assetMode}
          zoneName={resolveZoneName(selectedVehicle.zoneId)}
          onClose={() => setSelection(null)}
        />
      ) : null}

      <footer className="taego-status-bar" data-testid="map-status-bar">
        <span>{activeAssetCopy.notice}</span>
        <span>
          {activeAssetCopy.badge} ({activeConfig.baseImage.mapImageVersion})
        </span>
      </footer>
    </main>
  );
}
