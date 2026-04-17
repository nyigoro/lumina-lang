import { createContextToken, type ComponentFrame, type ComponentFunction, FrameManager } from '../src/frame-manager.js';

const runRoot = <T>(manager: FrameManager, render: () => T): T => {
  manager.beginRender();
  manager.rootFrame.seenEpoch = manager.renderEpoch;
  return manager.renderFrame(manager.rootFrame, render);
};

describe('FrameManager resolveAndExecute', () => {
  test('creates a new frame on first call', () => {
    const manager = new FrameManager();
    const component = jest.fn(() => 'ok');

    let frame: ComponentFrame;
    runRoot(manager, () => {
      frame = manager.executeComponent(manager.rootFrame, component, null, undefined).frame;
    });

    expect(frame!).toBeDefined();
    expect(frame!.componentFn).toBe(component);
    expect(frame!.parent).toBe(manager.rootFrame);
    expect(manager.rootFrame.unkeyedChildren).toHaveLength(1);
  });

  test('reuses frame on second call with same identity', () => {
    const manager = new FrameManager();
    const component = jest.fn(() => 'ok');

    let firstFrame: ComponentFrame;
    runRoot(manager, () => {
      firstFrame = manager.executeComponent(manager.rootFrame, component, null, undefined).frame;
    });

    let secondFrame: ComponentFrame;
    runRoot(manager, () => {
      secondFrame = manager.executeComponent(manager.rootFrame, component, null, undefined).frame;
    });

    expect(secondFrame!).toBe(firstFrame!);
  });

  test('detects component function swap and disposes old frame', () => {
    const manager = new FrameManager();
    const componentA = jest.fn(() => 'A');
    const componentB = jest.fn(() => 'B');

    let firstFrame: ComponentFrame;
    runRoot(manager, () => {
      firstFrame = manager.executeComponent(manager.rootFrame, componentA, null, undefined).frame;
    });

    let secondFrame: ComponentFrame;
    runRoot(manager, () => {
      secondFrame = manager.executeComponent(manager.rootFrame, componentB, null, undefined).frame;
    });

    expect(firstFrame!.disposed).toBe(true);
    expect(secondFrame!).not.toBe(firstFrame!);
    expect(secondFrame!.componentFn).toBe(componentB);
  });

  test('handles keyed children separately from unkeyed children', () => {
    const manager = new FrameManager();
    const keyed = jest.fn(() => 'keyed');
    const unkeyed = jest.fn(() => 'unkeyed');

    runRoot(manager, () => {
      manager.executeComponent(manager.rootFrame, keyed, 'child-a', undefined);
      manager.executeComponent(manager.rootFrame, unkeyed, null, undefined);
    });

    expect(manager.rootFrame.keyedChildren.size).toBe(1);
    expect(manager.rootFrame.unkeyedChildren).toHaveLength(1);
    expect(manager.rootFrame.keyedChildren.get('child-a')?.componentFn).toBe(keyed);
    expect(manager.rootFrame.unkeyedChildren[0]?.componentFn).toBe(unkeyed);
  });

  test('increments unkeyedChildCursor only for unkeyed children', () => {
    const manager = new FrameManager();
    const keyed = jest.fn(() => 'keyed');
    const unkeyed = jest.fn(() => 'unkeyed');

    runRoot(manager, () => {
      expect(manager.rootFrame.unkeyedChildCursor).toBe(0);
      manager.executeComponent(manager.rootFrame, keyed, 'first', undefined);
      expect(manager.rootFrame.unkeyedChildCursor).toBe(0);
      manager.executeComponent(manager.rootFrame, unkeyed, null, undefined);
      expect(manager.rootFrame.unkeyedChildCursor).toBe(1);
      manager.executeComponent(manager.rootFrame, keyed, 'second', undefined);
      expect(manager.rootFrame.unkeyedChildCursor).toBe(1);
    });
  });

  test('resets unkeyedChildCursor at frame start', () => {
    const manager = new FrameManager();
    const component = jest.fn(() => 'ok');

    runRoot(manager, () => {
      manager.executeComponent(manager.rootFrame, component, null, undefined);
      expect(manager.rootFrame.unkeyedChildCursor).toBe(1);
    });

    runRoot(manager, () => {
      expect(manager.rootFrame.unkeyedChildCursor).toBe(0);
      manager.executeComponent(manager.rootFrame, component, null, undefined);
      expect(manager.rootFrame.unkeyedChildCursor).toBe(1);
    });
  });
});

describe('FrameManager getSlot', () => {
  test('allocates a new state slot on first call', () => {
    const manager = new FrameManager();
    const token = { value: 1 };
    const component = jest.fn(() => manager.getSlot('state', () => token));

    let frame: ComponentFrame;
    let result: unknown;
    runRoot(manager, () => {
      const executed = manager.executeComponent(manager.rootFrame, component, null, undefined);
      frame = executed.frame;
      result = executed.result;
    });

    expect(result).toBe(token);
    expect(frame!.slots).toHaveLength(1);
    expect(frame!.slots[0]?.kind).toBe('state');
    expect(frame!.slots[0]?.value).toBe(token);
  });

  test('returns same slot instance on subsequent renders of the same frame', () => {
    const manager = new FrameManager();
    const firstToken = { label: 'first' };
    const secondToken = { label: 'second' };
    let renderCount = 0;
    const component = jest.fn(() => {
      renderCount += 1;
      return manager.getSlot('state', () => (renderCount === 1 ? firstToken : secondToken));
    });

    let firstResult: unknown;
    runRoot(manager, () => {
      firstResult = manager.executeComponent(manager.rootFrame, component, null, undefined).result;
    });

    let secondResult: unknown;
    runRoot(manager, () => {
      secondResult = manager.executeComponent(manager.rootFrame, component, null, undefined).result;
    });

    expect(firstResult).toBe(firstToken);
    expect(secondResult).toBe(firstToken);
    expect(secondResult).not.toBe(secondToken);
  });

  test('throws if slot count increases after first render', () => {
    const manager = new FrameManager();
    let phase = 0;
    const component = jest.fn(() => {
      manager.getSlot('state', () => ({ index: 0 }));
      if (phase > 0) {
        manager.getSlot('state', () => ({ index: 1 }));
      }
      return null;
    });

    runRoot(manager, () => {
      manager.executeComponent(manager.rootFrame, component, null, undefined);
    });

    phase = 1;
    expect(() =>
      runRoot(manager, () => {
        manager.executeComponent(manager.rootFrame, component, null, undefined);
      })
    ).toThrow("expected 1 slot(s), but render tried to allocate slot 2");
  });

  test('throws if slot kind changes at the same index', () => {
    const manager = new FrameManager();
    let useMemo = false;
    const component = jest.fn(() => {
      if (useMemo) {
        return manager.getSlot('memo', () => ({ kind: 'memo' }));
      }
      return manager.getSlot('state', () => ({ kind: 'state' }));
    });

    runRoot(manager, () => {
      manager.executeComponent(manager.rootFrame, component, null, undefined);
    });

    useMemo = true;
    expect(() =>
      runRoot(manager, () => {
        manager.executeComponent(manager.rootFrame, component, null, undefined);
      })
    ).toThrow("slot 0 was 'state' before but is now 'memo'");
  });

  test('throws outside of a component frame', () => {
    const manager = new FrameManager();

    expect(() => manager.getSlot('state', () => 1)).toThrow(
      'Local state slots can only be allocated while rendering a component frame'
    );
  });

  test('locks expectedSlotCount after first render exit', () => {
    const manager = new FrameManager();
    const component = jest.fn(() => {
      manager.getSlot('state', () => 1);
      manager.getSlot('memo', () => 2);
      manager.getSlot('effect', () => 3);
      return null;
    });

    let frame: ComponentFrame;
    runRoot(manager, () => {
      frame = manager.executeComponent(manager.rootFrame, component, null, undefined).frame;
    });

    expect(frame!.expectedSlotCount).toBe(3);
  });
});

describe('FrameManager context scope', () => {
  test('returns the provided value inside a scoped render callback', () => {
    const manager = new FrameManager();
    const theme = createContextToken('light');

    const seen = runRoot(manager, () =>
      manager.withContext(theme, 'dark', () => manager.useContext(theme))
    );

    expect(seen).toBe('dark');
  });

  test('falls back to the default context value when no provider exists', () => {
    const manager = new FrameManager();
    const theme = createContextToken('light');

    const seen = runRoot(manager, () => manager.useContext(theme));

    expect(seen).toBe('light');
  });

  test('shadows outer context values with nested providers', () => {
    const manager = new FrameManager();
    const theme = createContextToken('light');

    const seen = runRoot(manager, () =>
      manager.withContext(theme, 'dark', () =>
        manager.withContext(theme, 'contrast', () => manager.useContext(theme))
      )
    );

    expect(seen).toBe('contrast');
  });

  test('restores the previous context after provider exit', () => {
    const manager = new FrameManager();
    const theme = createContextToken('light');

    const seen = runRoot(manager, () => {
      manager.withContext(theme, 'dark', () => manager.useContext(theme));
      return manager.useContext(theme);
    });

    expect(seen).toBe('light');
  });

  test('passes provider scope to descendant component frames', () => {
    const manager = new FrameManager();
    const theme = createContextToken('light');
    const child = jest.fn(() => manager.useContext(theme));
    const parent = jest.fn(() =>
      manager.withContext(theme, 'dark', () =>
        manager.executeComponent(manager.currentFrame!, child, null, undefined).result
      )
    );

    let result: unknown;
    runRoot(manager, () => {
      result = manager.executeComponent(manager.rootFrame, parent, null, undefined).result;
    });

    expect(result).toBe('dark');
  });
});

describe('FrameManager sweepChildren', () => {
  test('removes keyed children not seen in current epoch', () => {
    const manager = new FrameManager();
    const componentA = jest.fn(() => 'A');
    const componentB = jest.fn(() => 'B');

    let frameA: ComponentFrame;
    let frameB: ComponentFrame;
    runRoot(manager, () => {
      frameA = manager.executeComponent(manager.rootFrame, componentA, 'a', undefined).frame;
      frameB = manager.executeComponent(manager.rootFrame, componentB, 'b', undefined).frame;
    });

    runRoot(manager, () => {
      manager.executeComponent(manager.rootFrame, componentA, 'a', undefined);
    });

    expect(frameA!.disposed).toBe(false);
    expect(frameB!.disposed).toBe(true);
    expect(manager.rootFrame.keyedChildren.has('a')).toBe(true);
    expect(manager.rootFrame.keyedChildren.has('b')).toBe(false);
  });

  test('removes unkeyed children beyond unkeyedChildCursor', () => {
    const manager = new FrameManager();
    const componentA = jest.fn(() => 'A');
    const componentB = jest.fn(() => 'B');

    let firstFrame: ComponentFrame;
    let secondFrame: ComponentFrame;
    runRoot(manager, () => {
      firstFrame = manager.executeComponent(manager.rootFrame, componentA, null, undefined).frame;
      secondFrame = manager.executeComponent(manager.rootFrame, componentB, null, undefined).frame;
    });

    runRoot(manager, () => {
      manager.executeComponent(manager.rootFrame, componentA, null, undefined);
    });

    expect(firstFrame!.disposed).toBe(false);
    expect(secondFrame!.disposed).toBe(true);
    expect(manager.rootFrame.unkeyedChildren).toHaveLength(1);
  });

  test('calls disposeFrame recursively on removed children', () => {
    const manager = new FrameManager();
    const parentCleanup = jest.fn();
    const grandchildCleanup = jest.fn();

    const grandchild = jest.fn(() => {
      manager.getSlot('effect', () => ({ kind: 'grandchild' }), () => grandchildCleanup());
      return null;
    });

    const parent = jest.fn(() => {
      manager.getSlot('effect', () => ({ kind: 'parent' }), () => parentCleanup());
      manager.executeComponent(manager.currentFrame as ComponentFrame, grandchild, null, undefined);
      return null;
    });

    let parentFrame: ComponentFrame;
    runRoot(manager, () => {
      parentFrame = manager.executeComponent(manager.rootFrame, parent, null, undefined).frame;
    });

    const grandchildFrame = parentFrame!.unkeyedChildren[0];
    expect(grandchildFrame).toBeDefined();

    runRoot(manager, () => {
      // Omit the parent on purpose so the previous frame tree becomes stale.
    });

    expect(parentFrame!.disposed).toBe(true);
    expect(grandchildFrame!.disposed).toBe(true);
    expect(parentCleanup).toHaveBeenCalledTimes(1);
    expect(grandchildCleanup).toHaveBeenCalledTimes(1);
  });

  test('maintains keyed and unkeyed boundaries independently', () => {
    const manager = new FrameManager();
    const keyed = jest.fn(() => 'keyed');
    const unkeyedA = jest.fn(() => 'A');
    const unkeyedB = jest.fn(() => 'B');

    let staleUnkeyed: ComponentFrame;
    runRoot(manager, () => {
      manager.executeComponent(manager.rootFrame, keyed, 'stable', undefined);
      manager.executeComponent(manager.rootFrame, unkeyedA, null, undefined);
      staleUnkeyed = manager.executeComponent(manager.rootFrame, unkeyedB, null, undefined).frame;
    });

    runRoot(manager, () => {
      manager.executeComponent(manager.rootFrame, keyed, 'stable', undefined);
      manager.executeComponent(manager.rootFrame, unkeyedA, null, undefined);
    });

    expect(manager.rootFrame.keyedChildren.size).toBe(1);
    expect(manager.rootFrame.unkeyedChildren).toHaveLength(1);
    expect(staleUnkeyed!.disposed).toBe(true);
  });
});

describe('FrameManager epoch tracking', () => {
  test('increments renderEpoch on each render cycle', () => {
    const manager = new FrameManager();

    expect(manager.renderEpoch).toBe(0);
    manager.beginRender();
    expect(manager.renderEpoch).toBe(1);
    manager.beginRender();
    expect(manager.renderEpoch).toBe(2);
  });

  test('marks frame seenEpoch on execute', () => {
    const manager = new FrameManager();
    const component = jest.fn(() => 'ok');

    let frame: ComponentFrame;
    runRoot(manager, () => {
      frame = manager.executeComponent(manager.rootFrame, component, null, undefined).frame;
    });

    expect(frame!.seenEpoch).toBe(manager.renderEpoch);
  });

  test('stale frames are identified by seenEpoch mismatch', () => {
    const manager = new FrameManager();
    const component = jest.fn(() => 'ok');

    let frame: ComponentFrame;
    runRoot(manager, () => {
      frame = manager.executeComponent(manager.rootFrame, component, 'stale', undefined).frame;
    });

    manager.beginRender();
    expect(frame!.seenEpoch).toBeLessThan(manager.renderEpoch);
  });
});
