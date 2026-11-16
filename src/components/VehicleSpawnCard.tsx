'use client';

import type {
  FixedVehicleSpawnRecord,
  MapAssetMode,
  VehicleGameMode,
  VehicleSpawnType,
} from '@/domain/types';

interface VehicleSpawnCardProps {
  vehicle: FixedVehicleSpawnRecord;
  assetMode: MapAssetMode;
  zoneName?: string;
  onClose: () => void;
}

const GAME_MODE_LABELS: Record<VehicleGameMode, string> = {
  normal: '일반 매치 (normal)',
  ranked: '경쟁전 (ranked)',
  esports: '이스포츠 (esports)',
  'all-verified': '일반 · 경쟁전 공통 (all-verified)',
};

const SPAWN_TYPE_LABELS: Record<VehicleSpawnType, string> = {
  garage: '차고지 (garage)',
  'fixed-spot': '고정 스팟 (fixed-spot)',
};

const SPAWN_TYPE_TITLES: Record<VehicleSpawnType, string> = {
  garage: '차고지 고정 스폰',
  'fixed-spot': '지정 고정 스팟',
};

export default function VehicleSpawnCard({
  vehicle,
  assetMode,
  zoneName,
  onClose,
}: VehicleSpawnCardProps) {
  if (vehicle.provenance.verificationStatus !== 'verified') {
    return null;
  }

  const scopeLabel =
    vehicle.zoneId === 'taego-wide'
      ? '태이고 전역 (taego-wide)'
      : (zoneName ?? vehicle.zoneId);

  return (
    <aside
      className="taego-building-card taego-vehicle-spawn-card"
      data-testid="vehicle-spawn-card"
      data-vehicle-id={vehicle.id}
      role="region"
      aria-label={`${SPAWN_TYPE_TITLES[vehicle.spawnType]} 정보 카드`}
    >
      <header className="taego-building-card-header">
        <div className="taego-building-card-heading">
          <div className="taego-building-card-badges">
            <span className="taego-badge">
              {assetMode === 'sample'
                ? '샘플 검증 데이터 · 고정 차량 출현 지점'
                : '고정 차량 출현 지점'}
            </span>
            <span className="taego-zone-chip">{scopeLabel}</span>
          </div>
          <h2 className="taego-building-card-title">
            {SPAWN_TYPE_TITLES[vehicle.spawnType]}
          </h2>
          <p className="taego-building-card-id">식별 ID: {vehicle.id}</p>
        </div>

        <button
          type="button"
          className="taego-card-close-btn"
          data-testid="vehicle-card-close-button"
          aria-label="차량 출현 정보 카드 닫기"
          onClick={onClose}
        >
          ✕
        </button>
      </header>

      <dl className="taego-building-facts">
        <div className="taego-building-fact-row">
          <dt>게임 모드</dt>
          <dd data-testid="vehicle-game-mode-value">
            {GAME_MODE_LABELS[vehicle.gameMode]}
          </dd>
        </div>

        <div className="taego-building-fact-row">
          <dt>스폰 유형</dt>
          <dd data-testid="vehicle-spawn-type-value">
            {SPAWN_TYPE_LABELS[vehicle.spawnType]}
          </dd>
        </div>

        <div className="taego-building-fact-row">
          <dt>출현 차종</dt>
          <dd data-testid="vehicle-types-value">
            {vehicle.vehicleTypes.join(', ')}
          </dd>
        </div>

        <div className="taego-building-fact-row">
          <dt>안내</dt>
          <dd className="taego-vehicle-notice">
            {vehicle.notes ? <span>{vehicle.notes}</span> : null}
            <span className="taego-unverified-note">
              지정된 고정 차량 출현 지점이며 매 경기 출현이 보장되지는 않습니다.
            </span>
          </dd>
        </div>
      </dl>

      <footer
        className="taego-building-provenance"
        data-testid="vehicle-provenance"
      >
        <div>
          <span>검증 게임 패치</span>
          <strong>{vehicle.provenance.verifiedGamePatch}</strong>
        </div>
        <div>
          <span>검증일</span>
          <strong>{vehicle.provenance.verifiedAt}</strong>
        </div>
        <div>
          <span>지도 이미지 판본</span>
          <strong>{vehicle.mapImageVersion}</strong>
        </div>
        <div className="taego-building-provenance-source">
          <span>검증 기록</span>
          <strong>{vehicle.provenance.verificationSource}</strong>
        </div>
      </footer>
    </aside>
  );
}
