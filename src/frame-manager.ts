export type FrameSlotKind = 'state' | 'memo' | 'effect';

export type ComponentFunction<P = unknown, T = unknown> = (props: P) => T;
type ErasedComponentFunction = ComponentFunction<unknown, unknown>;

export interface ContextToken<T = unknown> {
  id: number;
  defaultValue?: T;
  hasDefault: boolean;
}

interface ContextScope {
  parent: ContextScope | null;
  context: ContextToken<unknown>;
  value: unknown;
}

export interface FrameSlot<T = unknown> {
  kind: FrameSlotKind;
  value: T;
  dispose?: () => void;
}

export interface ComponentFrame {
  id: number;
  componentFn: ErasedComponentFunction | null;
  parent: ComponentFrame | null;
  key: unknown;
  slotCursor: number;
  unkeyedChildCursor: number;
  expectedSlotCount: number | null;
  slots: FrameSlot[];
  keyedChildren: Map<unknown, ComponentFrame>;
  unkeyedChildren: ComponentFrame[];
  contextScope: ContextScope | null;
  seenEpoch: number;
  disposed: boolean;
}

let nextContextId = 1;

export function createContextToken<T>(defaultValue?: T): ContextToken<T> {
  return {
    id: nextContextId++,
    defaultValue,
    hasDefault: arguments.length > 0,
  };
}

const frameName = (frame: ComponentFrame | null): string => {
  if (!frame) return 'unknown';
  if (!frame.componentFn) return 'root';
  const name = frame.componentFn.name?.trim();
  return name && name.length > 0 ? name : '<anonymous component>';
};

const slotErrorPrefix = (frame: ComponentFrame | null): string =>
  `Component '${frameName(frame)}' rendered an inconsistent local slot layout`;

export class FrameManager {
  renderEpoch = 0;
  currentFrame: ComponentFrame | null = null;
  readonly rootFrame: ComponentFrame;

  private nextFrameId = 1;
  private currentContextScope: ContextScope | null = null;

  constructor() {
    this.rootFrame = this.createFrame(null, null, null);
    this.rootFrame.expectedSlotCount = 0;
  }

  beginRender(): void {
    this.renderEpoch += 1;
  }

  renderFrame<T>(frame: ComponentFrame, render: () => T): T {
    const previousFrame = this.currentFrame;
    const previousContextScope = this.currentContextScope;
    frame.slotCursor = 0;
    frame.unkeyedChildCursor = 0;
    this.currentFrame = frame;
    this.currentContextScope = frame.contextScope;

    try {
      const result = render();
      this.finalizeFrame(frame);
      return result;
    } finally {
      this.currentFrame = previousFrame;
      this.currentContextScope = previousContextScope;
    }
  }

  executeComponent<P, T>(
    parentFrame: ComponentFrame,
    componentFn: ComponentFunction<P, T>,
    key: unknown,
    props: P
  ): { frame: ComponentFrame; result: T } {
    const frame = this.resolveFrame(parentFrame, componentFn, key);
    frame.contextScope = this.currentContextScope;
    frame.seenEpoch = this.renderEpoch;
    const result = this.renderFrame(frame, () => componentFn(props));
    return { frame, result };
  }

  withContext<T, U>(context: ContextToken<T>, value: T, render: () => U): U {
    const previousScope = this.currentContextScope;
    this.currentContextScope = {
      parent: previousScope,
      context: context as ContextToken<unknown>,
      value,
    };
    try {
      return render();
    } finally {
      this.currentContextScope = previousScope;
    }
  }

  useContext<T>(context: ContextToken<T>): T {
    let scope = this.currentContextScope;
    while (scope) {
      if (scope.context.id === context.id) {
        return scope.value as T;
      }
      scope = scope.parent;
    }

    if (context.hasDefault) {
      return context.defaultValue as T;
    }

    throw new Error(`No provider found for context ${context.id}`);
  }

  getSlot<T>(kind: FrameSlotKind, initializer: () => T, dispose?: (value: T) => void): T {
    const frame = this.currentFrame;
    if (!frame || !frame.componentFn) {
      throw new Error(`Local ${kind} slots can only be allocated while rendering a component frame`);
    }

    const slotIndex = frame.slotCursor;
    frame.slotCursor += 1;

    if (slotIndex < frame.slots.length) {
      const slot = frame.slots[slotIndex];
      if (slot.kind !== kind) {
        throw new Error(
          `${slotErrorPrefix(frame)}: slot ${slotIndex} was '${slot.kind}' before but is now '${kind}'`
        );
      }
      return slot.value as T;
    }

    if (frame.expectedSlotCount !== null) {
      throw new Error(
        `${slotErrorPrefix(frame)}: expected ${frame.expectedSlotCount} slot(s), but render tried to allocate slot ${slotIndex + 1}`
      );
    }

    const value = initializer();
    const slot: FrameSlot<T> = {
      kind,
      value,
      dispose: dispose ? () => dispose(value) : undefined,
    };
    frame.slots.push(slot);
    return value;
  }

  sweepChildren(frame: ComponentFrame): void {
    const staleKeyed: Array<[unknown, ComponentFrame]> = [];
    for (const entry of frame.keyedChildren.entries()) {
      const [, child] = entry;
      if (child.seenEpoch !== this.renderEpoch) {
        staleKeyed.push(entry);
      }
    }

    for (const [key, child] of staleKeyed) {
      frame.keyedChildren.delete(key);
      this.disposeFrame(child, false);
    }

    const staleUnkeyed = frame.unkeyedChildren.slice(frame.unkeyedChildCursor);
    if (staleUnkeyed.length > 0) {
      frame.unkeyedChildren.length = frame.unkeyedChildCursor;
      for (const child of staleUnkeyed) {
        this.disposeFrame(child, false);
      }
    }
  }

  disposeFrame(frame: ComponentFrame, detachFromParent: boolean = true): void {
    if (frame.disposed) return;
    frame.disposed = true;

    for (const child of frame.keyedChildren.values()) {
      this.disposeFrame(child, false);
    }
    frame.keyedChildren.clear();

    for (const child of frame.unkeyedChildren) {
      this.disposeFrame(child, false);
    }
    frame.unkeyedChildren.length = 0;

    for (let idx = frame.slots.length - 1; idx >= 0; idx -= 1) {
      try {
        frame.slots[idx]?.dispose?.();
      } catch {
        // Keep disposal idempotent and fail-safe.
      }
    }
    frame.slots.length = 0;
    frame.contextScope = null;

    if (!detachFromParent || !frame.parent) return;

    if (frame.key !== null && frame.key !== undefined) {
      const current = frame.parent.keyedChildren.get(frame.key);
      if (current === frame) {
        frame.parent.keyedChildren.delete(frame.key);
      }
      return;
    }

    const index = frame.parent.unkeyedChildren.indexOf(frame);
    if (index >= 0) {
      frame.parent.unkeyedChildren.splice(index, 1);
    }
  }

  private resolveFrame<P, T>(
    parentFrame: ComponentFrame,
    componentFn: ComponentFunction<P, T>,
    key: unknown
  ): ComponentFrame {
    if (key !== null && key !== undefined) {
      const existing = parentFrame.keyedChildren.get(key);
      if (existing && existing.componentFn === componentFn && !existing.disposed) {
        return existing;
      }
      if (existing) {
        this.disposeFrame(existing, false);
      }
      const frame = this.createFrame(parentFrame, componentFn as ErasedComponentFunction, key);
      parentFrame.keyedChildren.set(key, frame);
      return frame;
    }

    const childIndex = parentFrame.unkeyedChildCursor;
    parentFrame.unkeyedChildCursor += 1;

    const existing = parentFrame.unkeyedChildren[childIndex];
    if (existing && existing.componentFn === componentFn && !existing.disposed) {
      return existing;
    }
    if (existing) {
      this.disposeFrame(existing, false);
    }

    const frame = this.createFrame(parentFrame, componentFn as ErasedComponentFunction, null);
    parentFrame.unkeyedChildren[childIndex] = frame;
    return frame;
  }

  private finalizeFrame(frame: ComponentFrame): void {
    if (frame.expectedSlotCount === null) {
      frame.expectedSlotCount = frame.slotCursor;
    } else if (frame.slotCursor !== frame.expectedSlotCount) {
      throw new Error(
        `${slotErrorPrefix(frame)}: expected ${frame.expectedSlotCount} slot(s), but render finished with ${frame.slotCursor}`
      );
    }
    this.sweepChildren(frame);
  }

  private createFrame(
    parent: ComponentFrame | null,
    componentFn: ErasedComponentFunction | null,
    key: unknown
  ): ComponentFrame {
    return {
      id: this.nextFrameId++,
      componentFn,
      parent,
      key,
      slotCursor: 0,
      unkeyedChildCursor: 0,
      expectedSlotCount: null,
      slots: [],
      keyedChildren: new Map(),
      unkeyedChildren: [],
      contextScope: parent?.contextScope ?? null,
      seenEpoch: this.renderEpoch,
      disposed: false,
    };
  }
}
