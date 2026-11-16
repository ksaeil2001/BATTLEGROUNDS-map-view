import { expect, test, type Page } from '@playwright/test';

interface CameraReadout {
  zoom: number;
  centerX: number;
  centerY: number;
  activeTarget: string;
}

async function readCameraStatus(page: Page): Promise<CameraReadout> {
  const status = page.getByTestId('map-camera-status');
  await expect(status).toBeVisible();
  const [zoom, centerX, centerY, activeTarget] = await Promise.all([
    status.getAttribute('data-zoom'),
    status.getAttribute('data-center-x'),
    status.getAttribute('data-center-y'),
    status.getAttribute('data-active-target'),
  ]);

  return {
    zoom: Number(zoom),
    centerX: Number(centerX),
    centerY: Number(centerY),
    activeTarget: activeTarget ?? '',
  };
}

test.describe('Seam 2: Static Sample Taego Map Viewer E2E', () => {
  test('PC 1280x800: map selection -> full-screen canvas -> zoom, pan, target zone jump, reset, back', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        runtimeErrors.push(message.text());
      }
    });

    await page.goto('/');

    const card = page.getByTestId('map-selection-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('태이고 (Taego)');
    await expect(card).toContainText('샘플 지도');
    await expect(card).toContainText('궁전 (Palace)');
    await expect(page.locator('footer')).toContainText('비공식 팬 프로젝트');

    const previewNaturalWidth = await card
      .locator('.taego-map-preview')
      .evaluate((img) => (img as HTMLImageElement).naturalWidth);
    expect(previewNaturalWidth).toBeGreaterThan(0);

    await card.click();

    const viewerScreen = page.getByTestId('map-viewer-screen');
    const leafletContainer = page.locator('.leaflet-container');
    await expect(viewerScreen).toBeVisible();
    await expect(leafletContainer).toBeVisible();

    const box = await leafletContainer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(1280 * 0.9);
    expect(box!.height).toBeGreaterThanOrEqual(800 * 0.9);

    const baseOverlay = page.locator('.taego-base-overlay');
    const highResOverlay = page.locator('.taego-highres-overlay');
    await expect(baseOverlay).toHaveCount(1);
    await expect(highResOverlay).toHaveCount(1);
    await expect(page.locator('.taego-target-zone-boundary')).toHaveCount(1);

    await expect
      .poll(async () =>
        baseOverlay.evaluate(
          (img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
    await expect
      .poll(async () =>
        highResOverlay.evaluate(
          (img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);

    const initialCamera = await readCameraStatus(page);
    expect(initialCamera.centerX).toBeGreaterThanOrEqual(4080);
    expect(initialCamera.centerX).toBeLessThanOrEqual(4112);
    expect(initialCamera.centerY).toBeGreaterThanOrEqual(4080);
    expect(initialCamera.centerY).toBeLessThanOrEqual(4112);

    // Wheel zoom in
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, -360);
    await expect
      .poll(async () => (await readCameraStatus(page)).zoom)
      .toBeGreaterThan(initialCamera.zoom);

    const zoomedCamera = await readCameraStatus(page);

    // Drag pan across map
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(440, 250, { steps: 10 });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const current = await readCameraStatus(page);
        return (
          current.centerX !== zoomedCamera.centerX &&
          current.centerY !== zoomedCamera.centerY
        );
      })
      .toBe(true);

    const pannedCamera = await readCameraStatus(page);
    expect(pannedCamera.centerX).toBeGreaterThan(zoomedCamera.centerX);
    expect(pannedCamera.centerY).toBeGreaterThan(zoomedCamera.centerY);

    // Jump to Target Zone: Palace [[3600, 2200], [4400, 3000]] -> center (4000, 2600)
    await page.getByTestId('target-zone-jump-button').click();
    await expect
      .poll(async () => {
        const current = await readCameraStatus(page);
        return (
          current.activeTarget === 'zone:palace' &&
          current.centerX >= 3950 &&
          current.centerX <= 4050 &&
          current.centerY >= 2550 &&
          current.centerY <= 2650
        );
      })
      .toBe(true);

    // Reset back to full 8192x8192 view
    await page.getByTestId('reset-view-button').click();
    await expect
      .poll(async () => {
        const current = await readCameraStatus(page);
        return (
          current.activeTarget === 'full-map' &&
          current.centerX >= 4080 &&
          current.centerX <= 4112 &&
          current.centerY >= 4080 &&
          current.centerY <= 4112 &&
          current.zoom === initialCamera.zoom
        );
      })
      .toBe(true);

    // Return to map selection card
    await page.getByTestId('back-to-map-list-button').click();
    await expect(page.getByTestId('map-selection-card')).toBeVisible();

    expect(runtimeErrors).toEqual([]);
  });

  test('Mobile 390x844: responsive full-screen map navigation without horizontal overflow', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();

    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        runtimeErrors.push(message.text());
      }
    });

    try {
      await page.goto('/');

      const card = page.getByTestId('map-selection-card');
      await expect(card).toBeVisible();
      await card.tap();

      const leafletContainer = page.locator('.leaflet-container');
      await expect(leafletContainer).toBeVisible();

      const box = await leafletContainer.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(380);
      expect(box!.height).toBeGreaterThanOrEqual(780);

      const hasHorizontalOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);

      const initialCamera = await readCameraStatus(page);

      // Drag/pan across the mobile viewport
      await page.mouse.move(195, 422);
      await page.mouse.down();
      await page.mouse.move(120, 320, { steps: 10 });
      await page.mouse.up();

      await expect
        .poll(async () => {
          const current = await readCameraStatus(page);
          return (
            current.centerX !== initialCamera.centerX ||
            current.centerY !== initialCamera.centerY
          );
        })
        .toBe(true);

      // Jump to Target Zone
      await page.getByTestId('target-zone-jump-button').tap();
      await expect
        .poll(async () => {
          const current = await readCameraStatus(page);
          return (
            current.centerX >= 3950 &&
            current.centerX <= 4050 &&
            current.centerY >= 2550 &&
            current.centerY <= 2650
          );
        })
        .toBe(true);

      // Reset to full view
      await page.getByTestId('reset-view-button').tap();
      await expect
        .poll(async () => {
          const current = await readCameraStatus(page);
          return (
            current.centerX >= 4080 &&
            current.centerX <= 4112 &&
            current.centerY >= 4080 &&
            current.centerY <= 4112
          );
        })
        .toBe(true);

      expect(runtimeErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
