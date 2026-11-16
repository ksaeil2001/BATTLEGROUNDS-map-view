'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import type { MapDatasetConfig } from '@/domain/types';
import type { CameraStatus, MapCameraCommand } from './LeafletMapCanvas';

const DynamicLeafletMapCanvas = dynamic(() => import('./LeafletMapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="taego-map-loading">샘플 지도 캔버스를 불러오는 중...</div>
  ),
});

interface TaegoMapShellProps {
  config: MapDatasetConfig;
}

export default function TaegoMapShell({ config }: TaegoMapShellProps) {
  const [selectedMap, setSelectedMap] = useState<'taego' | null>(null);
  const [cameraCommand, setCameraCommand] = useState<MapCameraCommand | null>(
    null,
  );
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>({
    zoom: -3,
    centerX: config.canonicalSize / 2,
    centerY: config.canonicalSize / 2,
    activeTarget: 'full-map',
  });

  const primaryZone = config.targetZones[0];

  const handleResetView = useCallback(() => {
    setCameraCommand((prev) => ({
      id: (prev?.id ?? 0) + 1,
      type: 'reset',
    }));
  }, []);

  const handleFocusTargetZone = useCallback(() => {
    if (!primaryZone) {
      return;
    }
    setCameraCommand((prev) => ({
      id: (prev?.id ?? 0) + 1,
      type: 'focus-zone',
      zoneId: primaryZone.id,
    }));
  }, [primaryZone]);

  if (selectedMap === null) {
    return (
      <main className="taego-selection-page">
        <div className="taego-selection-shell">
          <header className="taego-header">
            <span className="taego-eyebrow">BATTLEGROUNDS Map View · Slice 1</span>
            <h1 className="taego-title">전술 지도 선택</h1>
            <p className="taego-subtitle">
              지도를 선택해 8192 × 8192 Canonical Pixel Space 기반 전체 화면
              탐색 뷰어를 여세요.
            </p>
          </header>

          <section aria-label="지도 목록" className="taego-card-grid">
            <button
              type="button"
              className="taego-map-card"
              data-testid="map-selection-card"
              onClick={() => setSelectedMap('taego')}
            >
              <div className="taego-map-preview-wrap">
                <img
                  src={config.baseImage.imagePath}
                  alt="태이고 정적 샘플 지도 미리보기"
                  className="taego-map-preview"
                />
              </div>

              <div className="taego-map-card-body">
                <div>
                  <div className="taego-map-card-title-row">
                    <h2 className="taego-map-card-title">태이고 (Taego)</h2>
                    <span className="taego-badge">
                      샘플 지도 · {config.baseImage.mapImageVersion}
                    </span>
                  </div>
                  <ul className="taego-meta-list">
                    <li>
                      1차 등록 구역(Target Zone):{' '}
                      <strong>{primaryZone?.displayName ?? '미정'}</strong>
                    </li>
                    <li>
                      좌표 규격: Canonical Pixel Space{' '}
                      {config.canonicalSize} × {config.canonicalSize}
                    </li>
                    <li>
                      자산 상태: 자체 제작 정적 샘플 지도 (공개 배포 안전 자산)
                    </li>
                  </ul>
                </div>

                <span className="taego-card-cta">전체 화면 지도 열기 →</span>
              </div>
            </button>
          </section>

          <footer className="taego-notice-footer">
            비공식 팬 프로젝트이며 KRAFTON과 무관합니다. 현재 단계에서는 저작권
            확인 전 공개 배포에도 안전한 자체 제작 샘플 지도 자산(
            <code>assetMode: &apos;{config.assetMode}&apos;</code>)만 사용합니다.
          </footer>
        </div>
      </main>
    );
  }

  return (
    <main className="taego-viewer-screen" data-testid="map-viewer-screen">
      <div className="taego-map-controls" data-testid="map-controls">
        <button
          type="button"
          className="taego-control-btn"
          data-testid="back-to-map-list-button"
          onClick={() => {
            setSelectedMap(null);
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
          전체 보기
        </button>

        {primaryZone ? (
          <button
            type="button"
            className="taego-control-btn taego-control-btn-accent"
            data-testid="target-zone-jump-button"
            onClick={handleFocusTargetZone}
          >
            등록 구역: {primaryZone.displayName} · 이동
          </button>
        ) : null}
      </div>

      <DynamicLeafletMapCanvas
        config={config}
        cameraCommand={cameraCommand}
        onCameraChange={setCameraStatus}
      />

      <div
        className="taego-status-bar"
        data-testid="map-camera-status"
        data-zoom={cameraStatus.zoom}
        data-center-x={cameraStatus.centerX}
        data-center-y={cameraStatus.centerY}
        data-active-target={cameraStatus.activeTarget}
      >
        <span className="taego-status-coords">
          Canonical ({cameraStatus.centerX}, {cameraStatus.centerY}) · Zoom{' '}
          {cameraStatus.zoom}
        </span>
        <span>
          비공식 팬 프로젝트 · 샘플 지도 ({config.baseImage.mapImageVersion})
        </span>
      </div>
    </main>
  );
}
