import { useSyncExternalStore, useRef, useCallback } from 'react';
import * as Y from 'yjs';

export function useYMapValuesAsArray<T>(yMap: Y.Map<T> | undefined): T[] {
  const lastSnapshotRef = useRef<T[]>([]);
  const lastSnapshotStringRef = useRef<string>('[]');

  const getSnapshot = useCallback(() => {
    if (!yMap) return lastSnapshotRef.current;

    const newSnapshot = Array.from(yMap.values()) as T[];

    let newSnapshotString;
    try {
      newSnapshotString = JSON.stringify(newSnapshot);
    } catch {
      newSnapshotString = '[]';
    }

    if (newSnapshotString !== lastSnapshotStringRef.current) {
      lastSnapshotRef.current = newSnapshot;
      lastSnapshotStringRef.current = newSnapshotString;
    }

    return lastSnapshotRef.current;
  }, [yMap]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!yMap) return () => {};
      const handler = () => onStoreChange();
      yMap.observe(handler);
      return () => yMap.unobserve(handler);
    },
    [yMap]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useYMapEntry<T>(yMap: Y.Map<unknown> | undefined, entryKey: string): T | null {
  const lastValueRef = useRef<T | null>(null);

  const getSnapshot = useCallback(() => {
    if (!yMap) return lastValueRef.current;

    const newValue = (yMap.get(entryKey) as T) || null;

    if (newValue !== lastValueRef.current) {
      lastValueRef.current = newValue;
    }

    return lastValueRef.current;
  }, [yMap, entryKey]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!yMap) return () => {};
      const handler = (event: Y.YMapEvent<unknown>) => {
        if (event.keysChanged.has(entryKey)) onStoreChange();
      };
      yMap.observe(handler);
      return () => yMap.unobserve(handler);
    },
    [yMap, entryKey]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
