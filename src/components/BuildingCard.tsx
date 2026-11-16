'use client';

import type {
  BuildingRecord,
  RooftopAccessKind,
  VerifiableField,
} from '@/domain/types';

interface BuildingCardProps {
  building: BuildingRecord;
  zoneName?: string;
  onClose: () => void;
}

const ROOFTOP_ACCESS_LABELS: Record<RooftopAccessKind, string> = {
  'interior-stairs': '내부 계단',
  'exterior-climb': '외부 파쿠르/사다리',
  inaccessible: '접근 불가',
};

function renderAttributeValue<T>(
  field: VerifiableField<T>,
  formatVerified: (value: T) => string,
) {
  if (field.status === 'verified') {
    return formatVerified(field.value);
  }
  return <span className="taego-unverified-badge">미확인 (확인 중)</span>;
}

export default function BuildingCard({
  building,
  zoneName,
  onClose,
}: BuildingCardProps) {
  if (building.provenance.verificationStatus !== 'verified') {
    return null;
  }

  const { floors, rooftopAccess, entrances, exteriorImage } =
    building.attributes;

  return (
    <aside
      className="taego-building-card"
      data-testid="building-card"
      data-building-id={building.id}
      role="region"
      aria-label={`${building.buildingType} 건물 정보 카드`}
    >
      <header className="taego-building-card-header">
        <div className="taego-building-card-heading">
          <div className="taego-building-card-badges">
            {building.isPilotSlice ? (
              <span className="taego-badge">선행 검증 건물군 · Pilot Slice</span>
            ) : null}
            {zoneName ? (
              <span className="taego-zone-chip">{zoneName}</span>
            ) : null}
          </div>
          <h2 className="taego-building-card-title">{building.buildingType}</h2>
          <p className="taego-building-card-id">식별 ID: {building.id}</p>
        </div>

        <button
          type="button"
          className="taego-card-close-btn"
          data-testid="building-card-close-button"
          aria-label="건물 정보 카드 닫기"
          onClick={onClose}
        >
          ✕
        </button>
      </header>

      {exteriorImage.status === 'verified' ? (
        <figure className="taego-building-exterior-figure">
          <img
            src={exteriorImage.value.imagePath}
            alt={`${building.buildingType} 외관 이미지`}
            className="taego-building-exterior-img"
            data-testid="building-exterior-image"
          />
          <figcaption className="taego-building-exterior-caption">
            {exteriorImage.value.credit} · 패치{' '}
            {exteriorImage.value.capturedPatch}
          </figcaption>
        </figure>
      ) : (
        <div
          className="taego-building-exterior-unverified"
          data-testid="building-exterior-unverified"
        >
          <span className="taego-unverified-badge">
            미확인 (Unverified State)
          </span>
          <p className="taego-unverified-note">
            외관 이미지가 아직 확인되지 않았습니다.
          </p>
        </div>
      )}

      <dl className="taego-building-facts">
        <div className="taego-building-fact-row">
          <dt>층수</dt>
          <dd data-testid="building-floors-value">
            {renderAttributeValue(floors, (value) => `${value}층`)}
          </dd>
        </div>

        <div className="taego-building-fact-row">
          <dt>옥상 접근 방식</dt>
          <dd data-testid="building-rooftop-value">
            {renderAttributeValue(
              rooftopAccess,
              (value) =>
                `${ROOFTOP_ACCESS_LABELS[value.kind]} · ${value.summary}`,
            )}
          </dd>
        </div>

        <div className="taego-building-fact-row">
          <dt>출입구</dt>
          <dd data-testid="building-entrances-value">
            {renderAttributeValue(
              entrances,
              (value) => `${value.count}개 · ${value.directionsSummary}`,
            )}
          </dd>
        </div>
      </dl>

      <footer
        className="taego-building-provenance"
        data-testid="building-provenance"
      >
        <div>
          <span>검증 게임 패치</span>
          <strong>{building.provenance.verifiedGamePatch}</strong>
        </div>
        <div>
          <span>검증일</span>
          <strong>{building.provenance.verifiedAt}</strong>
        </div>
        <div>
          <span>지도 이미지 판본</span>
          <strong>{building.mapImageVersion}</strong>
        </div>
        <div className="taego-building-provenance-source">
          <span>검증 기록</span>
          <strong>{building.provenance.verificationSource}</strong>
        </div>
      </footer>
    </aside>
  );
}
