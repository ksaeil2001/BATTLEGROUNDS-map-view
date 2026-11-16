import TaegoMapShell from '@/components/TaegoMapShell';
import { loadPublicBuildings } from '@/data/load-buildings';
import { loadPublicMapDatasetConfig } from '@/data/load-map-config';

export default function HomePage() {
  const taegoConfig = loadPublicMapDatasetConfig();
  const buildings = loadPublicBuildings();

  return <TaegoMapShell maps={[taegoConfig]} buildings={buildings} />;
}
