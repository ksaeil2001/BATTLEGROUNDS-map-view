import TaegoMapShell from '@/components/TaegoMapShell';
import { loadDevOfficialPreviewDatasetConfigIfAvailable } from '@/data/dev-local-assets';
import { loadPublicBuildings } from '@/data/load-buildings';
import { loadPublicMapDatasetConfig } from '@/data/load-map-config';
import { loadPublicVehicles } from '@/data/load-vehicles';

export default function HomePage() {
  const taegoConfig = loadPublicMapDatasetConfig();
  const buildings = loadPublicBuildings(taegoConfig.assetMode);
  const vehicles = loadPublicVehicles(taegoConfig.assetMode);
  const devOfficialPreviewConfig =
    process.env.NODE_ENV === 'development'
      ? loadDevOfficialPreviewDatasetConfigIfAvailable()
      : null;

  return (
    <TaegoMapShell
      maps={[taegoConfig]}
      devOfficialPreviewConfig={devOfficialPreviewConfig}
      buildings={buildings}
      vehicles={vehicles}
    />
  );
}
