import TaegoMapShell from '@/components/TaegoMapShell';
import { loadPublicMapDatasetConfig } from '@/data/load-map-config';

export default function HomePage() {
  const taegoConfig = loadPublicMapDatasetConfig();

  return <TaegoMapShell maps={[taegoConfig]} />;
}
