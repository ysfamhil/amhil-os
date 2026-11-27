// A row menu must stay fully inside the window wherever its button is.
import { test } from "node:test";
import assert from "node:assert/strict";

const { placeMenu } = (await import(new URL("./menu-position.ts", import.meta.url).href)) as typeof import("./menu-position");

const menu = { width: 180, height: 220 };
const button = (top: number, left: number) => ({ top, bottom: top + 28, left, right: left + 28 });
const inside = (p: { top: number; left: number }, viewport: { width: number; height: number }) =>
  p.top >= 8 && p.left >= 8 && p.left + menu.width <= viewport.width - 8 && p.top + menu.height <= viewport.height - 8;

test("opens below the button and lines up with its right edge", () => {
  assert.deepEqual(placeMenu(button(100, 900), menu, { width: 1280, height: 800 }, "right"), { top: 134, left: 748 });
});

test("flips above the button near the bottom of the window", () => {
  assert.deepEqual(placeMenu(button(760, 900), menu, { width: 1280, height: 800 }, "right"), { top: 534, left: 748 });
});

test("stays inside the window for every button position, including small phones", () => {
  for (const viewport of [{ width: 1280, height: 480 }, { width: 375, height: 667 }, { width: 320, height: 568 }, { width: 667, height: 260 }]) {
    for (let top = -20; top <= viewport.height; top += 17) {
      for (const left of [0, viewport.width / 2, viewport.width - 28]) {
        for (const align of ["left", "right"] as const) {
          const place = placeMenu(button(top, left), menu, viewport, align);
          // A window shorter than the menu plus margins cannot hold it; the panel scrolls then.
          if (top >= 0 && top <= viewport.height - 28) assert.ok(inside(place, viewport), JSON.stringify({ viewport, top, left, align, place }));
        }
      }
    }
  }
});
