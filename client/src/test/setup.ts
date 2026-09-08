import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// React Testing Library doesn't auto-clean between tests under Vitest.
afterEach(() => cleanup());

/*
 * Browser APIs jsdom does not implement, stubbed for the Radix primitives.
 *
 * Radix measures its triggers and content to position popovers, selects and
 * dropdowns, and to keep them inside the viewport. jsdom has no layout engine,
 * so these exist only to stop the components throwing during a render — no
 * test asserts on positioning, which jsdom could not report anyway.
 */
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Radix's Select scrolls the highlighted item into view; jsdom has no scrolling.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Used by Radix to decide whether a pointer is fine or coarse.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// Radix Dialog/Popover call these when they take pointer capture.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
