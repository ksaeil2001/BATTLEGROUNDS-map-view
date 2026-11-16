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

async function waitForStableBoundingBox(locator: Locator): Promise<BoxRect> {
  let previous: BoxRect | null = null;
  let stable: BoxRect | null = null;

  await expect
    .poll(async () => {
      const current = await locator.boundingBox();
      if (!current) {
        previous = null;
        return false;
      }
      const isSame =
        previous !== null &&
        Math.abs(current.x - previous.x) < 0.5 &&
        Math.abs(current.y - previous.y) < 0.5 &&
        Math.abs(current.width - previous.width) < 0.5 &&
        Math.abs(current.height - previous.height) < 0.5;
      previous = current;
      if (isSame) {
        stable = current;
      }
      return isSame;
    })
    .toBe(true);

  return stable ?? (await getBoundingBoxOrThrow(locator));
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
    await expect(highResOverlay).toHaveCSS('opacity', '0');

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

    // Jump to Target Zone: Palace centers the boundary in viewport and reveals high-res overlay
    await page.getByTestId('target-zone-jump-button').click();
    await expectTargetZoneFocused(page, initialZoneBox, viewport);
    await expect(highResOverlay).toHaveCSS('opacity', '1');

    // Reset back to full 8192x8192 view
    await page.getByTestId('reset-view-button').click();
    await expectFullMapReset(page, initialBaseBox);
    await expect(highResOverlay).toHaveCSS('opacity', '0');

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
      await waitForStableBoundingBox(baseOverlay);
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

async function canonicalToClientPoint(
  baseOverlay: Locator,
  [canonicalX, canonicalY]: readonly [number, number],
): Promise<{ x: number; y: number }> {
  const box = await getBoundingBoxOrThrow(baseOverlay);
  return {
    x: box.x + (canonicalX / 8192) * box.width,
    y: box.y + (canonicalY / 8192) * box.height,
  };
}

async function expectOnlySelectedFootprint(
  page: Page,
  expectedId: 'palace-01' | 'palace-02' | 'palace-03' | null,
): Promise<void> {
  const ids = ['palace-01', 'palace-02', 'palace-03'] as const;
  for (const id of ids) {
    const footprint = page.getByTestId(`roof-footprint-${id}`);
    await expect(footprint).toHaveCount(1);
    const shouldSelect = id === expectedId;
    await expect(footprint).toHaveAttribute(
      'data-selected',
      shouldSelect ? 'true' : 'false',
    );
    await expect(footprint).toHaveCSS(
      'stroke-opacity',
      shouldSelect ? '1' : '0',
    );
  }
}

test.describe('Pilot Slice roof footprint selection and Building Card', () => {
  test('desktop user selects each adjacent Pilot Slice roof, avoids concave/alley/unregistered mis-selection, and keeps alignment across zoom/pan/4096px swap', async ({
    page,
  }) => {
    const viewport = { width: 1280, height: 800 };
    await page.setViewportSize(viewport);
    const runtimeErrors = collectRuntimeErrors(page);

    await page.goto('/');
    await page.getByTestId('map-selection-card').click();

    const baseOverlay = page.locator('.taego-base-overlay');
    const highResOverlay = page.locator('.taego-highres-overlay');
    const zoneBoundary = page.locator('.taego-target-zone-boundary');
    await expect(baseOverlay).toBeVisible();
    const initialBaseBox = await getBoundingBoxOrThrow(baseOverlay);
    const initialZoneBox = await getBoundingBoxOrThrow(zoneBoundary);

    // Pinless UX: no permanent marker pins over buildings
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0);

    // Jump to Target Zone (Palace)
    await page.getByTestId('target-zone-jump-button').click();
    await expectTargetZoneFocused(page, initialZoneBox, viewport);
    await waitForStableBoundingBox(baseOverlay);
    await expect(highResOverlay).toHaveCSS('opacity', '1');
    await expectOnlySelectedFootprint(page, null);
    await expect(page.getByTestId('building-card')).toHaveCount(0);

    // 1) Click palace-01 (concave L-shaped wing)
    const p1Upper = await canonicalToClientPoint(baseOverlay, [3890, 2360]);
    await page.mouse.click(p1Upper.x, p1Upper.y);

    const card = page.getByTestId('building-card');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-building-id', 'palace-01');
    await expect(card).toContainText('서측 ㄱ자 행랑');
    await expect(page.getByTestId('building-floors-value')).toContainText('2층');
    await expect(page.getByTestId('building-rooftop-value')).toContainText(
      '내부 계단',
    );
    await expect(page.getByTestId('building-entrances-value')).toContainText(
      '3개',
    );
    await expect(page.getByTestId('building-provenance')).toContainText(
      'sample-v1',
    );
    const exteriorNaturalWidth = await page
      .getByTestId('building-exterior-image')
      .evaluate((img) => (img as HTMLImageElement).naturalWidth);
    expect(exteriorNaturalWidth).toBeGreaterThan(0);
    await expectOnlySelectedFootprint(page, 'palace-01');

    // 2) Click palace-02 (adjacent pavilion with mixed verified & unverified attributes)
    const p2Center = await canonicalToClientPoint(baseOverlay, [4080, 2395]);
    await page.mouse.click(p2Center.x, p2Center.y);

    await expect(card).toHaveAttribute('data-building-id', 'palace-02');
    await expect(card).toContainText('북동 정전');
    await expect(page.getByTestId('building-floors-value')).toContainText('2층');
    await expect(page.getByTestId('building-rooftop-value')).toContainText(
      '미확인',
    );
    await expect(page.getByTestId('building-exterior-unverified')).toBeVisible();
    await expect(page.getByTestId('building-exterior-image')).toHaveCount(0);
    await expect(card).not.toContainText('접근 불가');
    await expect(card).not.toContainText('없음');
    await expectOnlySelectedFootprint(page, 'palace-02');

    // 3) Click palace-03 (south-west hall with unverified entrances)
    const p3Center = await canonicalToClientPoint(baseOverlay, [3820, 2620]);
    await page.mouse.click(p3Center.x, p3Center.y);

    await expect(card).toHaveAttribute('data-building-id', 'palace-03');
    await expect(card).toContainText('남서 별당');
    await expect(page.getByTestId('building-rooftop-value')).toContainText(
      '외부 파쿠르/사다리',
    );
    await expect(page.getByTestId('building-entrances-value')).toContainText(
      '미확인',
    );
    await expectOnlySelectedFootprint(page, 'palace-03');

    // 4) Concave cutout of palace-01 ([3890, 2475]) must NOT select palace-01 and closes open card
    const p1Notch = await canonicalToClientPoint(baseOverlay, [3890, 2475]);
    await page.mouse.click(p1Notch.x, p1Notch.y);
    await expect(card).toHaveCount(0);
    await expectOnlySelectedFootprint(page, null);

    // 5) Re-select palace-01 lower wing, then click 20px alley ([3950, 2360]) -> closes card
    const p1Lower = await canonicalToClientPoint(baseOverlay, [3760, 2475]);
    await page.mouse.click(p1Lower.x, p1Lower.y);
    await expect(card).toHaveAttribute('data-building-id', 'palace-01');

    const alley = await canonicalToClientPoint(baseOverlay, [3950, 2360]);
    await page.mouse.click(alley.x, alley.y);
    await expect(card).toHaveCount(0);
    await expectOnlySelectedFootprint(page, null);

    // 6) Re-select palace-02, then click courtyard road ([4010, 2750]) -> closes card
    await page.mouse.click(p2Center.x, p2Center.y);
    await expect(card).toHaveAttribute('data-building-id', 'palace-02');
    const road = await canonicalToClientPoint(baseOverlay, [4010, 2750]);
    await page.mouse.click(road.x, road.y);
    await expect(card).toHaveCount(0);

    // 7) Re-select palace-03, then click unverified annex palace-04 ([4180, 2865]) -> closes card
    await page.mouse.click(p3Center.x, p3Center.y);
    await expect(card).toHaveAttribute('data-building-id', 'palace-03');
    const unverifiedAnnex = await canonicalToClientPoint(baseOverlay, [
      4180, 2865,
    ]);
    await page.mouse.click(unverifiedAnnex.x, unverifiedAnnex.y);
    await expect(card).toHaveCount(0);
    await expectOnlySelectedFootprint(page, null);

    // 8) Reset to full view and click Unregistered Area (NW) building -> closes card
    await page.mouse.click(p1Upper.x, p1Upper.y);
    await expect(card).toHaveAttribute('data-building-id', 'palace-01');

    await page.getByTestId('reset-view-button').click();
    await expectFullMapReset(page, initialBaseBox);
    const unregisteredBuilding = await canonicalToClientPoint(baseOverlay, [
      1610, 1600,
    ]);
    await page.mouse.click(unregisteredBuilding.x, unregisteredBuilding.y);
    await expect(card).toHaveCount(0);
    await expectOnlySelectedFootprint(page, null);

    // 9) Zoom in/out, drag pan, and swap base image to 4096x4096 -> alignment stays locked
    await page.getByTestId('target-zone-jump-button').click();
    await expectTargetZoneFocused(page, initialZoneBox, viewport);

    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, -300);
    await waitForStableBoundingBox(highResOverlay);
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(580, 360, { steps: 6 });
    await page.mouse.up();
    await page.mouse.wheel(0, 180);
    await waitForStableBoundingBox(highResOverlay);

    await baseOverlay.evaluate(async (img) => {
      const element = img as HTMLImageElement;
      const svg4k =
        '<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="4096" viewBox="0 0 8192 8192"><rect width="8192" height="8192" fill="%230b111c"/></svg>';
      await new Promise<void>((resolve, reject) => {
        element.addEventListener('load', () => resolve(), { once: true });
        element.addEventListener('error', () => reject(new Error('4k svg load failed')), {
          once: true,
        });
        element.src = `data:image/svg+xml;charset=utf-8,${svg4k}`;
      });
    });

    const swappedNaturalWidth = await baseOverlay.evaluate(
      (img) => (img as HTMLImageElement).naturalWidth,
    );
    expect(swappedNaturalWidth).toBe(4096);

    const overlayBoxAfterSwap = await waitForStableBoundingBox(highResOverlay);
    const p1BoxAfterSwap = await waitForStableBoundingBox(
      page.getByTestId('roof-footprint-palace-01'),
    );

    const relLeft =
      (p1BoxAfterSwap.x - overlayBoxAfterSwap.x) / overlayBoxAfterSwap.width;
    const relTop =
      (p1BoxAfterSwap.y - overlayBoxAfterSwap.y) / overlayBoxAfterSwap.height;
    const relWidth = p1BoxAfterSwap.width / overlayBoxAfterSwap.width;
    const relHeight = p1BoxAfterSwap.height / overlayBoxAfterSwap.height;

    expect(Math.abs(relLeft - 0.125)).toBeLessThan(0.01);
    expect(Math.abs(relTop - 0.125)).toBeLessThan(0.01);
    expect(Math.abs(relWidth - 0.3)).toBeLessThan(0.01);
    expect(Math.abs(relHeight - 0.275)).toBeLessThan(0.01);

    const p1UpperAfterSwap = await canonicalToClientPoint(baseOverlay, [
      3890, 2360,
    ]);
    await page.mouse.click(p1UpperAfterSwap.x, p1UpperAfterSwap.y);
    await expect(card).toHaveAttribute('data-building-id', 'palace-01');
    await expectOnlySelectedFootprint(page, 'palace-01');

    expect(runtimeErrors).toEqual([]);
  });

  test('mobile user (390x844) taps roof polygon to open bottom Building Card without hiding the roof and closes on road tap', async ({
    browser,
  }) => {
    const viewport = { width: 390, height: 844 };
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const runtimeErrors = collectRuntimeErrors(page);

    try {
      await page.goto('/');
      await page.getByTestId('map-selection-card').tap();

      const baseOverlay = page.locator('.taego-base-overlay');
      const zoneBoundary = page.locator('.taego-target-zone-boundary');
      const initialZoneBox = await getBoundingBoxOrThrow(zoneBoundary);

      await page.getByTestId('target-zone-jump-button').tap();
      await expectTargetZoneFocused(page, initialZoneBox, viewport);
      await waitForStableBoundingBox(baseOverlay);

      const p1Lower = await canonicalToClientPoint(baseOverlay, [3760, 2475]);
      await page.touchscreen.tap(p1Lower.x, p1Lower.y);

      const card = page.getByTestId('building-card');
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute('data-building-id', 'palace-01');
      await expectOnlySelectedFootprint(page, 'palace-01');

      const cardBox = await getBoundingBoxOrThrow(card);
      const roofBox = await getBoundingBoxOrThrow(
        page.getByTestId('roof-footprint-palace-01'),
      );
      expect(cardBox.y).toBeGreaterThan(viewport.height * 0.45);
      expect(cardBox.width).toBeGreaterThanOrEqual(350);
      expect(roofBox.y + roofBox.height).toBeLessThanOrEqual(cardBox.y + 4);

      const road = await canonicalToClientPoint(baseOverlay, [4010, 2750]);
      await page.touchscreen.tap(road.x, road.y);
      await expect(card).toHaveCount(0);
      await expectOnlySelectedFootprint(page, null);

      const p2Center = await canonicalToClientPoint(baseOverlay, [4080, 2395]);
      await page.touchscreen.tap(p2Center.x, p2Center.y);
      await expect(card).toHaveAttribute('data-building-id', 'palace-02');
      await page.getByTestId('building-card-close-button').tap();
      await expect(card).toHaveCount(0);

      expect(runtimeErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
