import TaegoMapShell from '@/components/TaegoMapShell';
import { loadPublicBuildings } from '@/data/load-buildings';
import { loadPublicMapDatasetConfig } from '@/data/load-map-config';
import { loadPublicVehicles } from '@/data/load-vehicles';

export default function HomePage() {
  const taegoConfig = loadPublicMapDatasetConfig();
  const buildings = loadPublicBuildings();
  const vehicles = loadPublicVehicles(taegoConfig.assetMode);

  return (
    <TaegoMapShell
      maps={[taegoConfig]}
      buildings={buildings}
      vehicles={vehicles}
    />
  );
}
