import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  expect,
  test,
  type CDPSession,
  type Locator,
  type Page,
} from '@playwright/test';

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

async function expectZoneLocatorFocused(
  zoneBoundary: Locator,
  initialZoneBox: BoxRect,
  viewport: { width: number; height: number },
): Promise<void> {
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

async function expectTargetZoneFocused(
  page: Page,
  initialZoneBox: BoxRect,
  viewport: { width: number; height: number },
): Promise<void> {
  await expectZoneLocatorFocused(
    page.locator('.taego-target-zone-boundary'),
    initialZoneBox,
    viewport,
  );
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

function getRelativeCenterOffset(
  targetBox: BoxRect,
  containerBox: BoxRect,
): { relX: number; relY: number } {
  return {
    relX: (targetBox.x + targetBox.width / 2 - containerBox.x) / containerBox.width,
    relY:
      (targetBox.y + targetBox.height / 2 - containerBox.y) / containerBox.height,
  };
}

test.describe('Fixed Vehicle Spawn Point layer toggle and detail card', () => {
  test('desktop user toggles vehicle layer ON/OFF, inspects verified vehicle details without probabilities, and avoids roof/marker click collision', async ({
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
    const initialZoneBox = await getBoundingBoxOrThrow(zoneBoundary);

    await page.getByTestId('target-zone-jump-button').click();
    await expectTargetZoneFocused(page, initialZoneBox, viewport);
    await waitForStableBoundingBox(baseOverlay);

    // 1) Initial state: vehicle layer OFF, zero markers rendered
    const toggleBtn = page.getByTestId('vehicle-layer-toggle-button');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(toggleBtn).toContainText('차량 위치 OFF');
    await expect(page.locator('.taego-vehicle-marker-icon')).toHaveCount(0);
    await expect(
      page.getByTestId('vehicle-marker-palace-vehicle-unverified-01'),
    ).toHaveCount(0);

    // 2) Toggle ON: only verified markers render at exact Canonical Pixel Space coordinates
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(toggleBtn).toContainText('차량 위치 ON');

    const palaceVehicle = page.getByTestId('vehicle-marker-palace-vehicle-01');
    const taegoWideVehicle = page.getByTestId(
      'vehicle-marker-taego-wide-vehicle-01',
    );
    await expect(palaceVehicle).toHaveCount(1);
    await expect(taegoWideVehicle).toHaveCount(1);
    await expect(
      page.getByTestId('vehicle-marker-palace-vehicle-unverified-01'),
    ).toHaveCount(0);

    const overlayBox = await waitForStableBoundingBox(highResOverlay);
    const palaceVehicleBox = await getBoundingBoxOrThrow(palaceVehicle);
    const taegoWideBox = await getBoundingBoxOrThrow(taegoWideVehicle);

    const palaceRel = getRelativeCenterOffset(palaceVehicleBox, overlayBox);
    expect(Math.abs(palaceRel.relX - 0.825)).toBeLessThan(0.01);
    expect(Math.abs(palaceRel.relY - 0.5)).toBeLessThan(0.01);

    const wideRel = getRelativeCenterOffset(taegoWideBox, overlayBox);
    expect(Math.abs(wideRel.relX - 0.1)).toBeLessThan(0.01);
    expect(Math.abs(wideRel.relY - 0.6875)).toBeLessThan(0.01);

    // 3) Click verified garage marker -> opens VehicleSpawnCard without probability or 100% guarantee claims
    await palaceVehicle.click();
    const vehicleCard = page.getByTestId('vehicle-spawn-card');
    await expect(vehicleCard).toBeVisible();
    await expect(vehicleCard).toHaveAttribute(
      'data-vehicle-id',
      'palace-vehicle-01',
    );
    await expect(palaceVehicle).toHaveAttribute('data-selected', 'true');
    await expect(taegoWideVehicle).toHaveAttribute('data-selected', 'false');

    await expect(vehicleCard).toContainText('샘플');
    await expect(page.getByTestId('vehicle-game-mode-value')).toContainText(
      'all-verified',
    );
    await expect(page.getByTestId('vehicle-spawn-type-value')).toContainText(
      'garage',
    );
    await expect(page.getByTestId('vehicle-types-value')).toContainText(
      '포니 쿠페, 사륜 차량',
    );
    await expect(page.getByTestId('vehicle-provenance')).toContainText(
      'sample-v1',
    );
    await expect(page.getByTestId('vehicle-provenance')).toContainText(
      '자체 제작 샘플 지도(sample-v1) 차량 레이어 검증 기준',
    );
    await expect(vehicleCard).not.toContainText('%');
    await expect(vehicleCard).not.toContainText('확정 출현');

    // 4) Click building roof while VehicleSpawnCard is open -> closes VehicleSpawnCard, opens BuildingCard
    const p1Upper = await canonicalToClientPoint(baseOverlay, [3890, 2360]);
    await page.mouse.click(p1Upper.x, p1Upper.y);
    const buildingCard = page.getByTestId('building-card');
    await expect(buildingCard).toHaveAttribute('data-building-id', 'palace-01');
    await expect(vehicleCard).toHaveCount(0);
    await expect(palaceVehicle).toHaveAttribute('data-selected', 'false');

    // 5) Click taego-wide vehicle marker while BuildingCard is open -> closes BuildingCard, opens VehicleSpawnCard
    await taegoWideVehicle.click();
    await expect(vehicleCard).toHaveAttribute(
      'data-vehicle-id',
      'taego-wide-vehicle-01',
    );
    await expect(buildingCard).toHaveCount(0);
    await expectOnlySelectedFootprint(page, null);
    await expect(vehicleCard).toContainText('taego-wide');
    await expect(page.getByTestId('vehicle-game-mode-value')).toContainText(
      'normal',
    );
    await expect(page.getByTestId('vehicle-spawn-type-value')).toContainText(
      'fixed-spot',
    );
    await expect(page.getByTestId('vehicle-types-value')).toContainText(
      '포터, 다시야',
    );
    await expect(page.getByTestId('vehicle-provenance')).toContainText(
      'sample-v1',
    );
    await expect(page.getByTestId('vehicle-provenance')).toContainText(
      '자체 제작 샘플 지도(sample-v1) 전역 도로 스폰 검증 기준',
    );

    // 6) Clicking road closes VehicleSpawnCard
    const road = await canonicalToClientPoint(baseOverlay, [4010, 2750]);
    await page.mouse.click(road.x, road.y);
    await expect(vehicleCard).toHaveCount(0);

    // 7) Re-open VehicleSpawnCard, then toggle OFF -> clears markers, closes card, and keeps roof clicks working
    await palaceVehicle.click();
    await expect(vehicleCard).toBeVisible();
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.taego-vehicle-marker-icon')).toHaveCount(0);
    await expect(vehicleCard).toHaveCount(0);

    await page.mouse.click(p1Upper.x, p1Upper.y);
    await expect(buildingCard).toHaveAttribute('data-building-id', 'palace-01');
    await expectOnlySelectedFootprint(page, 'palace-01');

    expect(runtimeErrors).toEqual([]);
  });

  test('mobile user (390x844) toggles vehicle layer ON without overflow, opens bottom detail card, and toggles OFF', async ({
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

      const toggleBtn = page.getByTestId('vehicle-layer-toggle-button');
      await expect(toggleBtn).toBeVisible();
      await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');

      const hasHorizontalOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);

      await toggleBtn.tap();
      await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');

      const palaceVehicle = page.getByTestId(
        'vehicle-marker-palace-vehicle-01',
      );
      await expect(palaceVehicle).toBeVisible();
      await palaceVehicle.tap();

      const vehicleCard = page.getByTestId('vehicle-spawn-card');
      await expect(vehicleCard).toBeVisible();
      await expect(vehicleCard).toHaveAttribute(
        'data-vehicle-id',
        'palace-vehicle-01',
      );
      const cardBox = await getBoundingBoxOrThrow(vehicleCard);
      expect(cardBox.y).toBeGreaterThan(viewport.height * 0.45);
      expect(cardBox.width).toBeGreaterThanOrEqual(350);

      await toggleBtn.tap();
      await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('.taego-vehicle-marker-icon')).toHaveCount(0);
      await expect(vehicleCard).toHaveCount(0);

      expect(runtimeErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

function collectFilesRecursively(rootDir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursively(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

async function waitForHttpReady(url: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

function stopChildProcess(child: ChildProcess): void {
  if (child.pid && process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
      return;
    } catch {
      // Fall through to standard kill
    }
  }
  child.kill();
}

async function expectPickerAbsent(page: Page): Promise<void> {
  await expect(page.getByTestId('dev-picker-toolbar')).toHaveCount(0);
  await expect(page.getByTestId('dev-picker-toggle-button')).toHaveCount(0);
  await expect(
    page.getByTestId('dev-official-preview-toggle-button'),
  ).toHaveCount(0);
}

test.describe('Development-only Polygon & Coordinate Picker (Seam 3)', () => {
  test('dev user extracts polygon vertices and single vehicle coordinates, uses Undo/Cancel/Copy JSON, and suppresses normal selection clicks', async ({
    browser,
  }) => {
    const viewport = { width: 1280, height: 800 };
    const context = await browser.newContext({ viewport });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    const runtimeErrors = collectRuntimeErrors(page);

    try {
      await page.goto('/');
      await page.getByTestId('map-selection-card').click();

      const baseOverlay = page.locator('.taego-base-overlay');
      const zoneBoundary = page.locator('.taego-target-zone-boundary');
      const initialZoneBox = await getBoundingBoxOrThrow(zoneBoundary);

      await page.getByTestId('target-zone-jump-button').click();
      await expectTargetZoneFocused(page, initialZoneBox, viewport);
      await waitForStableBoundingBox(baseOverlay);

      const pickerToolbar = page.getByTestId('dev-picker-toolbar');
      const pickerToggle = page.getByTestId('dev-picker-toggle-button');
      await expect(pickerToolbar).toBeVisible();
      await expect(pickerToggle).toHaveAttribute('aria-pressed', 'false');

      // Enable vehicle layer and open palace-01 first so we verify Picker closes cards and suppresses both building & vehicle clicks
      await page.getByTestId('vehicle-layer-toggle-button').click();
      const p1Click = await canonicalToClientPoint(baseOverlay, [3890, 2360]);
      await page.mouse.click(p1Click.x, p1Click.y);
      await expect(page.getByTestId('building-card')).toBeVisible();

      // Activate Picker -> existing BuildingCard closes immediately
      await pickerToggle.click();
      await expect(pickerToggle).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('building-card')).toHaveCount(0);
      await expect(page.getByTestId('dev-picker-mode-polygon')).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      // Click 3 points directly over registered roofs (palace-01, palace-02, palace-03) -> BuildingCard stays closed
      const p2Click = await canonicalToClientPoint(baseOverlay, [4080, 2395]);
      const p3Click = await canonicalToClientPoint(baseOverlay, [3820, 2620]);
      await page.mouse.click(p1Click.x, p1Click.y);
      await page.mouse.click(p2Click.x, p2Click.y);
      await page.mouse.click(p3Click.x, p3Click.y);

      await expect(page.getByTestId('building-card')).toHaveCount(0);
      await expectOnlySelectedFootprint(page, null);
      await expect(page.getByTestId('dev-picker-point-count')).toContainText(
        '3개 점',
      );
      await expect(page.getByTestId('dev-picker-vertex-0')).toHaveCount(1);
      await expect(page.getByTestId('dev-picker-vertex-1')).toHaveCount(1);
      await expect(page.getByTestId('dev-picker-vertex-2')).toHaveCount(1);
      await expect(
        page.getByTestId('dev-picker-polygon-preview'),
      ).toHaveAttribute('data-point-count', '3');

      // Undo removes only the last vertex
      await page.getByTestId('dev-picker-undo-button').click();
      await expect(page.getByTestId('dev-picker-point-count')).toContainText(
        '2개 점',
      );
      await expect(page.getByTestId('dev-picker-vertex-2')).toHaveCount(0);
      await expect(page.getByTestId('dev-picker-vertex-1')).toHaveCount(1);

      // Copy JSON copies valid integer CanonicalPoint[] array to clipboard
      await page.getByTestId('dev-picker-copy-button').click();
      await expect(page.getByTestId('dev-picker-copy-status')).toBeVisible();
      const copiedPolygonText = await page.evaluate(() =>
        navigator.clipboard.readText(),
      );
      const parsedPolygon = JSON.parse(copiedPolygonText) as [number, number][];
      expect(parsedPolygon).toHaveLength(2);
      expect(Number.isInteger(parsedPolygon[0]![0])).toBe(true);
      expect(Number.isInteger(parsedPolygon[0]![1])).toBe(true);
      expect(Math.abs(parsedPolygon[0]![0] - 3890)).toBeLessThanOrEqual(5);
      expect(Math.abs(parsedPolygon[0]![1] - 2360)).toBeLessThanOrEqual(5);
      expect(Math.abs(parsedPolygon[1]![0] - 4080)).toBeLessThanOrEqual(5);
      expect(Math.abs(parsedPolygon[1]![1] - 2395)).toBeLessThanOrEqual(5);

      // Switch to vehicle single-point mode and click directly on vehicle marker -> suppresses VehicleSpawnCard
      await page.getByTestId('dev-picker-mode-vehicle').click();
      await expect(page.getByTestId('dev-picker-point-count')).toContainText(
        '0개 점',
      );
      const vehicleMarker = page.getByTestId('vehicle-marker-palace-vehicle-01');
      await vehicleMarker.click();
      await expect(page.getByTestId('vehicle-spawn-card')).toHaveCount(0);
      await expect(page.getByTestId('dev-picker-point-count')).toContainText(
        '1개 점',
      );

      await page.getByTestId('dev-picker-copy-button').click();
      const copiedVehicleText = await page.evaluate(() =>
        navigator.clipboard.readText(),
      );
      const parsedVehicle = JSON.parse(copiedVehicleText) as [number, number];
      expect(parsedVehicle).toHaveLength(2);
      expect(Number.isInteger(parsedVehicle[0])).toBe(true);
      expect(Number.isInteger(parsedVehicle[1])).toBe(true);
      expect(Math.abs(parsedVehicle[0] - 4260)).toBeLessThanOrEqual(5);
      expect(Math.abs(parsedVehicle[1] - 2600)).toBeLessThanOrEqual(5);

      // Cancel clears points while keeping editing active
      await page.getByTestId('dev-picker-cancel-button').click();
      await expect(page.getByTestId('dev-picker-point-count')).toContainText(
        '0개 점',
      );
      await expect(page.getByTestId('dev-picker-vertex-0')).toHaveCount(0);
      await expect(page.getByTestId('dev-picker-json-output')).toHaveText('[]');

      // Deactivate Picker -> normal building & vehicle clicks resume
      await pickerToggle.click();
      await expect(pickerToggle).toHaveAttribute('aria-pressed', 'false');
      await page.mouse.click(p1Click.x, p1Click.y);
      await expect(page.getByTestId('building-card')).toHaveAttribute(
        'data-building-id',
        'palace-01',
      );

      expect(runtimeErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('dev user switches to local 31.2 official map preview, verifies Palace/Terminal overlay alignment without sample leakage, and extracts roof vertices via Picker', async ({
    browser,
  }) => {
    const localAssetDir = path.join(
      process.cwd(),
      '.local-assets',
      'taego-31.2',
    );
    const hasLocalOfficialAssets = [
      'taego-31.2-base-preview.png',
      'palace-31.2-highres-crop.png',
      'terminal-31.2-highres-crop.png',
    ].every((fileName) => fs.existsSync(path.join(localAssetDir, fileName)));
    test.skip(
      !hasLocalOfficialAssets,
      'Local-only 31.2 assets are absent outside developer workstation.',
    );

    const viewport = { width: 1280, height: 800 };
    const context = await browser.newContext({ viewport });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    const runtimeErrors = collectRuntimeErrors(page);

    try {
      await page.goto('/');
      await page.getByTestId('map-selection-card').click();

      const devPreviewToggle = page.getByTestId(
        'dev-official-preview-toggle-button',
      );
      await expect(devPreviewToggle).toBeVisible();
      await expect(devPreviewToggle).toHaveAttribute('aria-pressed', 'false');
      await expect(devPreviewToggle).toContainText('로컬 31.2 지도 OFF (DEV)');

      // Enable local-only 31.2 official map preview
      await devPreviewToggle.click();
      await expect(devPreviewToggle).toHaveAttribute('aria-pressed', 'true');
      await expect(devPreviewToggle).toContainText('로컬 31.2 지도 ON (DEV)');
      await expect(page.getByTestId('map-status-bar')).toContainText('31.2');
      await expect(page.getByTestId('map-status-bar')).toContainText(
        '공개 배포 권리 미확인',
      );

      // Verify official base preview (2048x2048) and both Palace/Terminal crops (600x550, 650x480) load cleanly
      const baseOverlay = page.locator('.taego-base-overlay');
      const palaceCrop = page.locator(
        'img.taego-highres-overlay[src*="palace-31.2-highres-crop.png"]',
      );
      const terminalCrop = page.locator(
        'img.taego-highres-overlay[src*="terminal-31.2-highres-crop.png"]',
      );

      await expect(baseOverlay).toHaveCount(1);
      await expect(palaceCrop).toHaveCount(1);
      await expect(terminalCrop).toHaveCount(1);

      await expect
        .poll(async () =>
          baseOverlay.evaluate((img) => {
            const el = img as HTMLImageElement;
            return el.complete && el.naturalWidth === 2048 && el.naturalHeight === 2048;
          }),
        )
        .toBe(true);
      await expect
        .poll(async () =>
          palaceCrop.evaluate((img) => {
            const el = img as HTMLImageElement;
            return el.complete && el.naturalWidth === 600 && el.naturalHeight === 550;
          }),
        )
        .toBe(true);
      await expect
        .poll(async () =>
          terminalCrop.evaluate((img) => {
            const el = img as HTMLImageElement;
            return el.complete && el.naturalWidth === 650 && el.naturalHeight === 480;
          }),
        )
        .toBe(true);

      // Sample buildings and sample vehicles must NOT appear on the 31.2 preview
      await expect(page.locator('.taego-roof-footprint')).toHaveCount(0);
      await page.getByTestId('vehicle-layer-toggle-button').click();
      await expect(page.locator('.taego-vehicle-marker-icon')).toHaveCount(0);
      await page.getByTestId('vehicle-layer-toggle-button').click();

      const palaceZoneBoundary = page
        .locator('.taego-target-zone-boundary')
        .nth(0);
      const terminalZoneBoundary = page
        .locator('.taego-target-zone-boundary')
        .nth(1);
      const initialPalaceZoneBox =
        await getBoundingBoxOrThrow(palaceZoneBoundary);
      const initialTerminalZoneBox =
        await getBoundingBoxOrThrow(terminalZoneBoundary);

      // 1) Jump to Palace [[2750, 3400], [3350, 3950]] and verify high-res overlay canonical alignment
      await page.getByTestId('target-zone-jump-button').click();
      await expectZoneLocatorFocused(
        palaceZoneBoundary,
        initialPalaceZoneBox,
        viewport,
      );
      await waitForStableBoundingBox(baseOverlay);
      await expect(palaceCrop).toHaveCSS('opacity', '1');

      const baseBoxAtPalace = await waitForStableBoundingBox(baseOverlay);
      const palaceBox = await waitForStableBoundingBox(palaceCrop);
      expect(
        Math.abs((palaceBox.x - baseBoxAtPalace.x) / baseBoxAtPalace.width - 2750 / 8192),
      ).toBeLessThan(0.005);
      expect(
        Math.abs((palaceBox.y - baseBoxAtPalace.y) / baseBoxAtPalace.height - 3400 / 8192),
      ).toBeLessThan(0.005);
      expect(
        Math.abs(palaceBox.width / baseBoxAtPalace.width - 600 / 8192),
      ).toBeLessThan(0.005);
      expect(
        Math.abs(palaceBox.height / baseBoxAtPalace.height - 550 / 8192),
      ).toBeLessThan(0.005);

      // 2) Use DevCoordinatePicker over 3 adjacent Palace candidate roofs to verify integer canonical extraction
      const pickerToggle = page.getByTestId('dev-picker-toggle-button');
      await pickerToggle.click();
      await expect(pickerToggle).toHaveAttribute('aria-pressed', 'true');

      const adjacentPalaceCandidates: readonly (readonly [number, number][])[] = [
        // 중앙 정전
        [
          [3049, 3602],
          [3084, 3602],
          [3084, 3635],
          [3049, 3635],
        ],
        // 서측 ㅏ자 내행랑 (오목 다각형 일부 꼭짓점)
        [
          [3006, 3569],
          [3016, 3569],
          [3016, 3582],
          [3053, 3582],
        ],
        // 북측 내전
        [
          [3056, 3541],
          [3081, 3541],
          [3081, 3565],
          [3056, 3565],
        ],
      ];

      for (const candidateVertices of adjacentPalaceCandidates) {
        for (const vertex of candidateVertices) {
          const pt = await canonicalToClientPoint(baseOverlay, vertex);
          await page.mouse.click(pt.x, pt.y);
        }

        await expect(page.getByTestId('dev-picker-point-count')).toContainText(
          `${candidateVertices.length}개 점`,
        );
        await page.getByTestId('dev-picker-copy-button').click();
        const copiedText = await page.evaluate(() =>
          navigator.clipboard.readText(),
        );
        const parsed = JSON.parse(copiedText) as [number, number][];
        expect(parsed).toHaveLength(candidateVertices.length);
        candidateVertices.forEach(([expectedX, expectedY], idx) => {
          expect(Number.isInteger(parsed[idx]![0])).toBe(true);
          expect(Number.isInteger(parsed[idx]![1])).toBe(true);
          expect(Math.abs(parsed[idx]![0] - expectedX)).toBeLessThanOrEqual(5);
          expect(Math.abs(parsed[idx]![1] - expectedY)).toBeLessThanOrEqual(5);
        });

        await page.getByTestId('dev-picker-cancel-button').click();
      }

      await pickerToggle.click();

      // 3) Jump to Terminal [[4300, 3400], [4950, 3880]] and verify high-res overlay canonical alignment
      await page.getByTestId('target-zone-jump-button-terminal').click();
      await expectZoneLocatorFocused(
        terminalZoneBoundary,
        initialTerminalZoneBox,
        viewport,
      );
      await waitForStableBoundingBox(baseOverlay);
      await expect(terminalCrop).toHaveCSS('opacity', '1');

      const baseBoxAtTerminal = await waitForStableBoundingBox(baseOverlay);
      const terminalBox = await waitForStableBoundingBox(terminalCrop);
      expect(
        Math.abs((terminalBox.x - baseBoxAtTerminal.x) / baseBoxAtTerminal.width - 4300 / 8192),
      ).toBeLessThan(0.005);
      expect(
        Math.abs((terminalBox.y - baseBoxAtTerminal.y) / baseBoxAtTerminal.height - 3400 / 8192),
      ).toBeLessThan(0.005);
      expect(
        Math.abs(terminalBox.width / baseBoxAtTerminal.width - 650 / 8192),
      ).toBeLessThan(0.005);
      expect(
        Math.abs(terminalBox.height / baseBoxAtTerminal.height - 480 / 8192),
      ).toBeLessThan(0.005);

      // 4) Switch back to sample mode cleanly
      await devPreviewToggle.click();
      await expect(devPreviewToggle).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('.taego-roof-footprint')).toHaveCount(3);

      // 5) Mobile (390x844) navigation check on local 31.2 official map preview
      const mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      try {
        const mobilePage = await mobileContext.newPage();
        const mobileCdp = await mobileContext.newCDPSession(mobilePage);
        await mobilePage.goto('/');
        await mobilePage.getByTestId('map-selection-card').tap();
        await mobilePage.getByTestId('dev-official-preview-toggle-button').tap();
        await expect(
          mobilePage.getByTestId('dev-official-preview-toggle-button'),
        ).toHaveAttribute('aria-pressed', 'true');

        const hasOverflow = await mobilePage.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        );
        expect(hasOverflow).toBe(false);

        const mobileBase = mobilePage.locator('.taego-base-overlay');
        await expect
          .poll(async () =>
            mobileBase.evaluate(
              (img) => (img as HTMLImageElement).naturalWidth === 2048,
            ),
          )
          .toBe(true);

        const initialMobileBaseBox = await getBoundingBoxOrThrow(mobileBase);
        await dispatchTouchDrag(mobileCdp, { x: 220, y: 440 }, { x: -16, y: -14 }, 6);
        await expect
          .poll(async () => {
            const afterBox = await mobileBase.boundingBox();
            return afterBox
              ? afterBox.x < initialMobileBaseBox.x - 30 &&
                  afterBox.y < initialMobileBaseBox.y - 30
              : false;
          })
          .toBe(true);

        const mobilePalaceZone = mobilePage
          .locator('.taego-target-zone-boundary')
          .nth(0);
        const initialMobilePalaceBox =
          await getBoundingBoxOrThrow(mobilePalaceZone);
        await mobilePage.getByTestId('target-zone-jump-button').tap();
        await expectZoneLocatorFocused(
          mobilePalaceZone,
          initialMobilePalaceBox,
          { width: 390, height: 844 },
        );
      } finally {
        await mobileContext.close();
      }

      expect(runtimeErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('production build tree-shakes Picker out of .next/static and next start denies all access on desktop and mobile', async ({
    browser,
  }) => {
    test.setTimeout(90_000);

    const nextBin = require.resolve('next/dist/bin/next');
    const prodEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_DIST_DIR: '.next',
    };

    execFileSync(process.execPath, [nextBin, 'build'], {
      cwd: process.cwd(),
      env: prodEnv,
      stdio: 'pipe',
    });

    const staticDir = path.join(process.cwd(), '.next', 'static');
    expect(fs.existsSync(staticDir)).toBe(true);
    const staticFiles = collectFilesRecursively(staticDir).filter(
      (filePath) => filePath.endsWith('.js') || filePath.endsWith('.css'),
    );
    expect(staticFiles.length).toBeGreaterThan(0);

    const forbiddenIdentifiers = [
      'dev-picker-toolbar',
      'dev-picker-toggle-button',
      'dev-picker-mode-polygon',
      'dev-picker-mode-vehicle',
      'dev-picker-undo-button',
      'dev-picker-cancel-button',
      'dev-picker-copy-button',
      '좌표 추출기',
      '점 되돌리기',
      'DevCoordinatePicker',
      'dev-official-preview-toggle-button',
      '로컬 31.2 지도',
      'dev-local-assets',
      'taego-31.2-base-preview',
    ];

    for (const filePath of staticFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const token of forbiddenIdentifiers) {
        expect(
          content.includes(token),
          `Found forbidden Picker token "${token}" in ${filePath}`,
        ).toBe(false);
      }
    }

    const prodServer = spawn(
      process.execPath,
      [nextBin, 'start', '-p', '3101', '-H', '127.0.0.1'],
      {
        cwd: process.cwd(),
        env: prodEnv,
        stdio: 'ignore',
      },
    );

    const prodContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const prodPage = await prodContext.newPage();
    const runtimeErrors = collectRuntimeErrors(prodPage);

    try {
      await waitForHttpReady('http://127.0.0.1:3101');

      await prodPage.goto('http://127.0.0.1:3101/');
      await prodPage.getByTestId('map-selection-card').click();
      await expect(prodPage.getByTestId('map-viewer-screen')).toBeVisible();
      await expectPickerAbsent(prodPage);

      // Query-parameter and keyboard-shortcut probes must not expose Picker in production
      await prodPage.goto('http://127.0.0.1:3101/?dev=true&picker=1');
      await prodPage.getByTestId('map-selection-card').click();
      await prodPage.keyboard.press('p');
      await prodPage.keyboard.press('Control+Shift+P');
      await expectPickerAbsent(prodPage);

      // Verify core viewer functionality (buildings + vehicle layer) works in production
      const baseOverlay = prodPage.locator('.taego-base-overlay');
      const zoneBoundary = prodPage.locator('.taego-target-zone-boundary');
      const initialZoneBox = await getBoundingBoxOrThrow(zoneBoundary);
      await prodPage.getByTestId('target-zone-jump-button').click();
      await expectTargetZoneFocused(prodPage, initialZoneBox, {
        width: 1280,
        height: 800,
      });
      await waitForStableBoundingBox(baseOverlay);
      const p1Upper = await canonicalToClientPoint(baseOverlay, [3890, 2360]);
      await prodPage.mouse.click(p1Upper.x, p1Upper.y);
      await expect(prodPage.getByTestId('building-card')).toHaveAttribute(
        'data-building-id',
        'palace-01',
      );

      await prodPage.getByTestId('vehicle-layer-toggle-button').click();
      await prodPage.getByTestId('vehicle-marker-palace-vehicle-01').click();
      await expect(prodPage.getByTestId('vehicle-spawn-card')).toHaveAttribute(
        'data-vehicle-id',
        'palace-vehicle-01',
      );
      await prodPage.getByTestId('vehicle-layer-toggle-button').click();
      await expect(prodPage.getByTestId('vehicle-spawn-card')).toHaveCount(0);

      // Verify mobile production session has zero Picker UI, working tap selection, and touch-drag guard
      const mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      try {
        const mobilePage = await mobileContext.newPage();
        const mobileCdp = await mobileContext.newCDPSession(mobilePage);
        await mobilePage.goto('http://127.0.0.1:3101/?dev=true');
        await mobilePage.getByTestId('map-selection-card').tap();
        await expect(mobilePage.getByTestId('map-viewer-screen')).toBeVisible();
        await expectPickerAbsent(mobilePage);

        const mobileZoneBox = await getBoundingBoxOrThrow(
          mobilePage.locator('.taego-target-zone-boundary'),
        );
        await mobilePage.getByTestId('target-zone-jump-button').tap();
        await expectTargetZoneFocused(mobilePage, mobileZoneBox, {
          width: 390,
          height: 844,
        });
        const mobileBaseOverlay = mobilePage.locator('.taego-base-overlay');
        await waitForStableBoundingBox(mobileBaseOverlay);
        const mobileP1 = await canonicalToClientPoint(mobileBaseOverlay, [
          3760, 2475,
        ]);

        // Touch drag starting over palace-01 must NOT open BuildingCard
        await dispatchTouchDrag(mobileCdp, mobileP1, { x: -10, y: -8 }, 5);
        await mobilePage.mouse.click(mobileP1.x - 50, mobileP1.y - 40);
        await expect(mobilePage.getByTestId('building-card')).toHaveCount(0);

        // Clean single tap after cooldown opens BuildingCard
        await waitForStableBoundingBox(mobileBaseOverlay);
        await mobilePage.waitForTimeout(220);
        const settledP1 = await canonicalToClientPoint(mobileBaseOverlay, [
          3760, 2475,
        ]);
        await mobilePage.touchscreen.tap(settledP1.x, settledP1.y);
        await expect(
          mobilePage.getByTestId('building-card'),
        ).toHaveAttribute('data-building-id', 'palace-01');
      } finally {
        await mobileContext.close();
      }

      // Dedicated dev routes and dev-local-assets API must not exist in production
      const devRouteRes = await fetch('http://127.0.0.1:3101/dev');
      const pickerRouteRes = await fetch('http://127.0.0.1:3101/picker');
      const devAssetBaseRes = await fetch(
        'http://127.0.0.1:3101/api/dev-local-assets/taego-31.2-base-preview.png',
      );
      const devAssetPalaceRes = await fetch(
        'http://127.0.0.1:3101/api/dev-local-assets/palace-31.2-highres-crop.png',
      );
      expect(devRouteRes.status).toBe(404);
      expect(pickerRouteRes.status).toBe(404);
      expect(devAssetBaseRes.status).toBe(404);
      expect(devAssetPalaceRes.status).toBe(404);

      expect(runtimeErrors).toEqual([]);
    } finally {
      await prodContext.close();
      stopChildProcess(prodServer);
    }
  });
});

async function dispatchTouchDrag(
  cdp: CDPSession,
  start: { x: number; y: number },
  stepDelta: { x: number; y: number },
  steps: number,
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: start.x, y: start.y, id: 1 }],
  });
  for (let step = 1; step <= steps; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: start.x + step * stepDelta.x,
          y: start.y + step * stepDelta.y,
          id: 1,
        },
      ],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

async function expectPalaceOverlayAlignment(
  page: Page,
  highResOverlay: Locator,
): Promise<void> {
  const overlayBox = await waitForStableBoundingBox(highResOverlay);
  const roofBox = await getBoundingBoxOrThrow(
    page.getByTestId('roof-footprint-palace-01'),
  );
  const vehicleBox = await getBoundingBoxOrThrow(
    page.getByTestId('vehicle-marker-palace-vehicle-01'),
  );

  const relLeft = (roofBox.x - overlayBox.x) / overlayBox.width;
  const relTop = (roofBox.y - overlayBox.y) / overlayBox.height;
  const vehicleRel = getRelativeCenterOffset(vehicleBox, overlayBox);

  expect(Math.abs(relLeft - 0.125)).toBeLessThan(0.01);
  expect(Math.abs(relTop - 0.125)).toBeLessThan(0.01);
  expect(Math.abs(vehicleRel.relX - 0.825)).toBeLessThan(0.01);
  expect(Math.abs(vehicleRel.relY - 0.5)).toBeLessThan(0.01);
}

test.describe('Integrated responsive layout, mobile touch/pinch guard, and resize alignment (Issue #6)', () => {
  test('mobile (390x844) blocks accidental selection during touch drag and two-finger pinch + cooldown while allowing clean single taps afterward', async ({
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
      await page.getByTestId('map-selection-card').tap();

      const baseOverlay = page.locator('.taego-base-overlay');
      const zoneBoundary = page.locator('.taego-target-zone-boundary');
      const initialZoneBox = await getBoundingBoxOrThrow(zoneBoundary);

      await page.getByTestId('target-zone-jump-button').tap();
      await expectTargetZoneFocused(page, initialZoneBox, viewport);
      await waitForStableBoundingBox(baseOverlay);

      await page.getByTestId('vehicle-layer-toggle-button').tap();
      const palaceVehicle = page.getByTestId(
        'vehicle-marker-palace-vehicle-01',
      );
      await expect(palaceVehicle).toBeVisible();

      const buildingCard = page.getByTestId('building-card');
      const vehicleCard = page.getByTestId('vehicle-spawn-card');

      // 1) Single-finger touch drag starting directly on palace-01 roof + immediate trailing click inside cooldown
      const p1Start = await canonicalToClientPoint(baseOverlay, [3760, 2475]);
      await dispatchTouchDrag(cdp, p1Start, { x: -12, y: -10 }, 6);
      await page.mouse.click(p1Start.x - 72, p1Start.y - 60);
      await expect(buildingCard).toHaveCount(0);
      await expect(vehicleCard).toHaveCount(0);

      // 2) Two-finger pinch zoom starting over palace-01 / Target Zone + trailing click inside cooldown
      await page.waitForTimeout(220);
      const pinchCenter = await canonicalToClientPoint(baseOverlay, [
        3890, 2360,
      ]);
      const baseBoxBeforePinch = await getBoundingBoxOrThrow(baseOverlay);

      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: pinchCenter.x - 18, y: pinchCenter.y, id: 1 }],
      });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [
          { x: pinchCenter.x - 18, y: pinchCenter.y, id: 1 },
          { x: pinchCenter.x + 18, y: pinchCenter.y, id: 2 },
        ],
      });
      for (let step = 1; step <= 5; step += 1) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            { x: pinchCenter.x - 18 - step * 14, y: pinchCenter.y, id: 1 },
            { x: pinchCenter.x + 18 + step * 14, y: pinchCenter.y, id: 2 },
          ],
        });
      }
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [{ x: pinchCenter.x + 88, y: pinchCenter.y, id: 2 }],
      });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });

      // Trailing tap within cooldown must not select a building or vehicle
      await page.mouse.click(pinchCenter.x, pinchCenter.y);
      await expect(buildingCard).toHaveCount(0);
      await expect(vehicleCard).toHaveCount(0);

      await expect
        .poll(async () => {
          const afterPinchBox = await baseOverlay.boundingBox();
          return afterPinchBox
            ? afterPinchBox.width > baseBoxBeforePinch.width * 1.15
            : false;
        })
        .toBe(true);

      // 3) After cooldown, clean single taps on roof, vehicle marker, and empty road work normally
      await page.getByTestId('target-zone-jump-button').tap();
      await expectTargetZoneFocused(page, initialZoneBox, viewport);
      await waitForStableBoundingBox(baseOverlay);
      await page.waitForTimeout(220);

      const p1Tap = await canonicalToClientPoint(baseOverlay, [3760, 2475]);
      await page.touchscreen.tap(p1Tap.x, p1Tap.y);
      await expect(buildingCard).toHaveAttribute(
        'data-building-id',
        'palace-01',
      );
      const cardBox = await getBoundingBoxOrThrow(buildingCard);
      const roofBox = await getBoundingBoxOrThrow(
        page.getByTestId('roof-footprint-palace-01'),
      );
      expect(cardBox.y).toBeGreaterThan(viewport.height * 0.45);
      expect(roofBox.y + roofBox.height).toBeLessThanOrEqual(cardBox.y + 4);

      await palaceVehicle.tap();
      await expect(buildingCard).toHaveCount(0);
      await expect(vehicleCard).toHaveAttribute(
        'data-vehicle-id',
        'palace-vehicle-01',
      );

      const roadTap = await canonicalToClientPoint(baseOverlay, [4010, 2750]);
      await page.touchscreen.tap(roadTap.x, roadTap.y);
      await expect(vehicleCard).toHaveCount(0);

      expect(runtimeErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('desktop <-> mobile viewport resize, Unregistered Area jump, and zoom/pan keep Roof Footprint and vehicle markers aligned while adapting card layout', async ({
    page,
  }) => {
    const desktopViewport = { width: 1280, height: 800 };
    const mobileViewport = { width: 390, height: 844 };
    await page.setViewportSize(desktopViewport);
    const runtimeErrors = collectRuntimeErrors(page);

    await page.goto('/');
    await page.getByTestId('map-selection-card').click();

    const baseOverlay = page.locator('.taego-base-overlay');
    const highResOverlay = page.locator('.taego-highres-overlay');
    const zoneBoundary = page.locator('.taego-target-zone-boundary');
    await expect(baseOverlay).toBeVisible();
    const initialZoneBox = await getBoundingBoxOrThrow(zoneBoundary);

    // 1) Pan from Unregistered Area then jump back to Target Zone
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(900, 620, { steps: 8 });
    await page.mouse.up();

    await page.getByTestId('target-zone-jump-button').click();
    await expectTargetZoneFocused(page, initialZoneBox, desktopViewport);
    await waitForStableBoundingBox(baseOverlay);

    // 2) Enable vehicle layer and select palace-01 -> desktop floating card does not obscure roof
    await page.getByTestId('vehicle-layer-toggle-button').click();
    const p1Click = await canonicalToClientPoint(baseOverlay, [3890, 2360]);
    await page.mouse.click(p1Click.x, p1Click.y);

    const buildingCard = page.getByTestId('building-card');
    await expect(buildingCard).toHaveAttribute('data-building-id', 'palace-01');
    const desktopCardBox = await getBoundingBoxOrThrow(buildingCard);
    const desktopRoofBox = await getBoundingBoxOrThrow(
      page.getByTestId('roof-footprint-palace-01'),
    );
    expect(desktopCardBox.x).toBeGreaterThan(desktopViewport.width * 0.65);
    expect(desktopCardBox.width).toBeLessThanOrEqual(360);
    expect(desktopRoofBox.x + desktopRoofBox.width).toBeLessThanOrEqual(
      desktopCardBox.x,
    );

    // 3) Zoom in/out, pan, and resize Desktop 1280x800 -> Mobile 390x844
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, -240);
    await waitForStableBoundingBox(highResOverlay);
    await page.mouse.wheel(0, 120);
    await waitForStableBoundingBox(highResOverlay);
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(610, 380, { steps: 5 });
    await page.mouse.up();
    await waitForStableBoundingBox(highResOverlay);

    await page.setViewportSize(mobileViewport);
    const mobileCardBox = await getBoundingBoxOrThrow(buildingCard);
    expect(mobileCardBox.y).toBeGreaterThan(mobileViewport.height * 0.45);
    expect(mobileCardBox.width).toBeGreaterThanOrEqual(350);
    await expectPalaceOverlayAlignment(page, highResOverlay);

    // 4) Resize Mobile 390x844 -> Desktop 1280x800 restores floating side card, alignment, and clickability
    await page.setViewportSize(desktopViewport);
    const restoredCardBox = await getBoundingBoxOrThrow(buildingCard);
    expect(restoredCardBox.x).toBeGreaterThan(desktopViewport.width * 0.65);
    await expectPalaceOverlayAlignment(page, highResOverlay);

    await page.getByTestId('building-card-close-button').click();
    await expect(buildingCard).toHaveCount(0);

    const restoredP1Click = await canonicalToClientPoint(baseOverlay, [
      3890, 2360,
    ]);
    await page.mouse.click(restoredP1Click.x, restoredP1Click.y);
    await expect(buildingCard).toHaveAttribute('data-building-id', 'palace-01');
    await page.getByTestId('building-card-close-button').click();
    await expect(buildingCard).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
  });
});
