import assert from "node:assert/strict";
import test from "node:test";
import {
  PRINT_MODE_ATTRIBUTE,
  PRINT_ROOT_ATTRIBUTE,
  printIsolatedRoot,
} from "./print-isolation";

class FakeElement {
  attributes = new Map<string, string>();
  removed = false;

  hasAttribute(name: string) {
    return this.attributes.has(name);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }

  remove() {
    this.removed = true;
  }
}

test("isolated printing activates before layout and cleans up after print or cancel", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalRaf = globalThis.requestAnimationFrame;
  const body = new FakeElement();
  const root = new FakeElement();
  const frames: FrameRequestCallback[] = [];
  let printCalls = 0;
  let afterPrint: EventListener | undefined;
  let callbackCalls = 0;

  Object.assign(globalThis, {
    document: { body },
    window: {
      addEventListener: (type: string, listener: EventListener) => {
        if (type === "afterprint") afterPrint = listener;
      },
      removeEventListener: () => undefined,
      print: () => {
        printCalls += 1;
      },
    },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    },
  });

  try {
    const started = printIsolatedRoot({
      mode: "test-label",
      root: root as unknown as HTMLElement,
      onAfterPrint: () => {
        callbackCalls += 1;
      },
    });

    assert.equal(started, true);
    assert.equal(body.attributes.get(PRINT_MODE_ATTRIBUTE), "test-label");
    assert.equal(root.attributes.get(PRINT_ROOT_ATTRIBUTE), "true");
    assert.equal(printCalls, 0);

    frames.shift()?.(0);
    assert.equal(printCalls, 0);
    frames.shift()?.(0);
    assert.equal(printCalls, 1);

    afterPrint?.(new Event("afterprint"));
    assert.equal(root.removed, true);
    assert.equal(body.hasAttribute(PRINT_MODE_ATTRIBUTE), false);
    assert.equal(callbackCalls, 1);
  } finally {
    Object.assign(globalThis, {
      document: originalDocument,
      window: originalWindow,
      requestAnimationFrame: originalRaf,
    });
  }
});

test("a second print request is rejected and its root is removed", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalRaf = globalThis.requestAnimationFrame;
  const body = new FakeElement();
  const firstRoot = new FakeElement();
  const secondRoot = new FakeElement();
  let afterPrint: EventListener | undefined;

  Object.assign(globalThis, {
    document: { body },
    window: {
      addEventListener: (_type: string, listener: EventListener) => {
        afterPrint = listener;
      },
      removeEventListener: () => undefined,
      print: () => undefined,
    },
    requestAnimationFrame: () => 1,
  });

  try {
    assert.equal(
      printIsolatedRoot({ mode: "labels", root: firstRoot as unknown as HTMLElement }),
      true,
    );
    assert.equal(
      printIsolatedRoot({ mode: "labels", root: secondRoot as unknown as HTMLElement }),
      false,
    );
    assert.equal(secondRoot.removed, true);
    afterPrint?.(new Event("afterprint"));
  } finally {
    Object.assign(globalThis, {
      document: originalDocument,
      window: originalWindow,
      requestAnimationFrame: originalRaf,
    });
  }
});
