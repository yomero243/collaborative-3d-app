import { useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { UserData } from './collabTypes';
import { useYMapValuesAsArray } from './yMapUtils';

export interface UserSync {
  users: UserData[];
  updateCurrentUserPosition: (pos: { x: number; y: number }) => void;
  updateUserName: (name: string) => void;
}

export function useUserSync(usersMap: Y.Map<UserData> | undefined, userId: string): UserSync {
  const positionUpdateTimeoutRef = useRef<number | null>(null);
  const latestPositionToSendRef = useRef<UserData | null>(null);
  const POSITION_UPDATE_INTERVAL = 8; // Reduced to 8ms (~120 FPS) for ultra-responsive controls

  const users = useYMapValuesAsArray<UserData>(usersMap);

  const updateCurrentUserPosition = useCallback(
    (pos: { x: number; y: number }) => {
      if (usersMap && userId) {
        const currentUserData = usersMap.get(userId);
        if (currentUserData) {
          if (Math.abs(currentUserData.x - pos.x) > 0.001 || Math.abs(currentUserData.y - pos.y) > 0.001) {
            latestPositionToSendRef.current = {
              ...currentUserData,
              x: pos.x,
              y: pos.y,
              lastUpdate: Date.now(),
            };

            if (positionUpdateTimeoutRef.current) {
              clearTimeout(positionUpdateTimeoutRef.current);
            }

            positionUpdateTimeoutRef.current = window.setTimeout(() => {
              if (usersMap && userId && latestPositionToSendRef.current) {
                usersMap.set(userId, latestPositionToSendRef.current);
              }
              positionUpdateTimeoutRef.current = null;
            }, POSITION_UPDATE_INTERVAL);
          }
        }
      }
    },
    [usersMap, userId]
  );

  const updateUserName = useCallback(
    (name: string) => {
      if (usersMap && userId) {
        const currentUserData = usersMap.get(userId);
        if (currentUserData) {
          usersMap.set(userId, {
            ...currentUserData,
            userName: name,
            lastUpdate: Date.now(),
          });
        }
      }
    },
    [usersMap, userId]
  );

  return {
    users,
    updateCurrentUserPosition,
    updateUserName,
  };
}
