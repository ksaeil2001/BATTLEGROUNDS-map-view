import { readDevLocalAssetFile } from '@/data/dev-local-assets';

export const dynamic = 'force-dynamic';

/**
 * Serve local-only Taego 31.2 preview PNGs exclusively in development mode.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ asset: string }> },
): Promise<Response> {
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not Found', { status: 404 });
  }

  const { asset } = await context.params;
  const fileBuffer = readDevLocalAssetFile(asset);
  if (!fileBuffer) {
    return new Response('Not Found', { status: 404 });
  }

  return new Response(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    },
  });
}
