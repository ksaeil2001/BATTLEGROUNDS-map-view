import { expect, test, type Locator, type Page } from '@playwright/test';

interface BoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function collectRuntimeErrors(page: Page): string[] {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(message.text());
    }
  });
  return runtimeErrors;
}

async function getBoundingBoxOrThrow(locator: Locator): Promise<BoxRect> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function expectTargetZoneFocused(
  page: Page,
  initialZoneBox: BoxRect,
  viewport: { width: number; height: number },
): Promise<void> {
  const zoneBoundary = page.locator('.taego-target-zone-boundary');
  await expect
    .poll(async () => {
      const box = await zoneBoundary.boundingBox();
      if (!box) {
        return false;
      }
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      return (
        box.width > initialZoneBox.width * 2 &&
        Math.abs(centerX - viewport.width / 2) <= 40 &&
        Math.abs(centerY - viewport.height / 2) <= 40
      );
    })
    .toBe(true);
}

async function expectFullMapReset(
  page: Page,
  initialBaseBox: BoxRect,
): Promise<void> {
  const baseOverlay = page.locator('.taego-base-overlay');
  await expect
    .poll(async () => {
      const box = await baseOverlay.boundingBox();
      if (!box) {
        return false;
      }
      return (
        Math.abs(box.width - initialBaseBox.width) <= 2 &&
        Math.abs(box.x - initialBaseBox.x) <= 2 &&
        Math.abs(box.y - initialBaseBox.y) <= 2
      );
    })
    .toBe(true);
}

test.describe('Static sample Taego map viewer', () => {
  test('desktop user can select map, zoom, drag pan, jump to Target Zone, reset view, and return to list', async ({
    page,
  }) => {
    const viewport = { width: 1280, height: 800 };
    await page.setViewportSize(viewport);
    const runtimeErrors = collectRuntimeErrors(page);

    await page.goto('/');

    const card = page.getByTestId('map-selection-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('태이고 (Taego)');
    await expect(card).toContainText('샘플 지도');
    await expect(card).toContainText('궁전 (Palace)');
    await expect(card).toContainText('비공식 팬 프로젝트');

    const previewNaturalWidth = await card
      .getByRole('img', { name: /미리보기/ })
      .evaluate((img) => (img as HTMLImageElement).naturalWidth);
    expect(previewNaturalWidth).toBeGreaterThan(0);

    await card.click();

    const viewerScreen = page.getByTestId('map-viewer-screen');
    const leafletContainer = page.locator('.leaflet-container');
    await expect(viewerScreen).toBeVisible();
    await expect(leafletContainer).toBeVisible();

    const containerBox = await getBoundingBoxOrThrow(leafletContainer);
    expect(containerBox.width).toBeGreaterThanOrEqual(viewport.width * 0.9);
    expect(containerBox.height).toBeGreaterThanOrEqual(viewport.height * 0.9);

    const baseOverlay = page.locator('.taego-base-overlay');
    const highResOverlay = page.locator('.taego-highres-overlay');
    const zoneBoundary = page.locator('.taego-target-zone-boundary');
    await expect(baseOverlay).toHaveCount(1);
    await expect(highResOverlay).toHaveCount(1);
    await expect(zoneBoundary).toHaveCount(1);

    await expect
      .poll(async () =>
        baseOverlay.evaluate(
          (img) =>
            (img as HTMLImageElement).complete &&
            (img as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
    await expect
      .poll(async () =>
        highResOverlay.evaluate(
          (img) =>
            (img as HTMLImageElement).complete &&
            (img as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);

    const initialBaseBox = await getBoundingBoxOrThrow(baseOverlay);
    const initialZoneBox = await getBoundingBoxOrThrow(zoneBoundary);

    // Wheel zoom in enlarges the rendered map overlay
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, -360);
    await expect
      .poll(async () => {
        const zoomedBox = await baseOverlay.boundingBox();
        return zoomedBox ? zoomedBox.width > initialBaseBox.width * 1.15 : false;
      })
      .toBe(true);

    const beforeDragBox = await getBoundingBoxOrThrow(baseOverlay);

    // Drag pan shifts the rendered map overlay in the drag direction
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(440, 250, { steps: 10 });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const afterDragBox = await baseOverlay.boundingBox();
        return afterDragBox
          ? afterDragBox.x < beforeDragBox.x - 50 &&
              afterDragBox.y < beforeDragBox.y - 50
          : false;
      })
      .toBe(true);

    // Jump to Target Zone: Palace centers the boundary in viewport and zooms in
    await page.getByTestId('target-zone-jump-button').click();
    await expectTargetZoneFocused(page, initialZoneBox, viewport);

    // Reset back to full 8192x8192 view
    await page.getByTestId('reset-view-button').click();
    await expectFullMapReset(page, initialBaseBox);

    // Return to map selection card
    await page.getByTestId('back-to-map-list-button').click();
    await expect(page.getByTestId('map-selection-card')).toBeVisible();

    expect(runtimeErrors).toEqual([]);
  });

  test('mobile user (390x844) can pan via touch drag, jump to Target Zone, and reset view without overflow', async ({
    browser,
  }) => {
    const viewport = { width: 390, height: 844 };
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const runtimeErrors = collectRuntimeErrors(page);

    try {
      await page.goto('/');

      const card = page.getByTestId('map-selection-card');
      await expect(card).toBeVisible();
      await card.tap();

      const leafletContainer = page.locator('.leaflet-container');
      await expect(leafletContainer).toBeVisible();

      const containerBox = await getBoundingBoxOrThrow(leafletContainer);
      expect(containerBox.width).toBeGreaterThanOrEqual(380);
      expect(containerBox.height).toBeGreaterThanOrEqual(780);

      const hasHorizontalOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);

      const baseOverlay = page.locator('.taego-base-overlay');
      const highResOverlay = page.locator('.taego-highres-overlay');
      const zoneBoundary = page.locator('.taego-target-zone-boundary');
      const initialBaseBox = await getBoundingBoxOrThrow(baseOverlay);
      const initialZoneBox = await getBoundingBoxOrThrow(zoneBoundary);

      // Single-finger touch drag pan via CDP touch events
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: 220, y: 440, id: 1 }],
      });
      for (let step = 1; step <= 6; step += 1) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            { x: 220 - step * 16, y: 440 - step * 14, id: 1 },
          ],
        });
      }
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });

      await expect
        .poll(async () => {
          const afterTouchBox = await baseOverlay.boundingBox();
          return afterTouchBox
            ? afterTouchBox.x < initialBaseBox.x - 30 &&
                afterTouchBox.y < initialBaseBox.y - 30
            : false;
        })
        .toBe(true);

      // Jump to Target Zone (also crosses minDisplayZoom: -4 so high-res overlay shows)
      await page.getByTestId('target-zone-jump-button').tap();
      await expectTargetZoneFocused(page, initialZoneBox, viewport);
      await expect
        .poll(async () =>
          highResOverlay.evaluate((el) => getComputedStyle(el).opacity),
        )
        .toBe('1');

      // Reset to full view
      await page.getByTestId('reset-view-button').tap();
      await expectFullMapReset(page, initialBaseBox);

      expect(runtimeErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
