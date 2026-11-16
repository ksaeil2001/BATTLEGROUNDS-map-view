import TaegoMapShell from '@/components/TaegoMapShell';
import { loadPublicMapDatasetConfig } from '@/data/load-map-config';

export default function HomePage() {
  const config = loadPublicMapDatasetConfig();

  return <TaegoMapShell config={config} />;
}
