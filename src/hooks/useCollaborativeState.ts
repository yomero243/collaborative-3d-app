import { useMemo } from 'react';
import { useYjsRoom } from './useYjsRoom';
import { useUserSync } from './useUserSync';
import { usePuckPhysics } from './usePuckPhysics';

export type { UserData, PuckState } from './collabTypes';

export function useCollaborativeState(
  roomName = 'default-room',
  serverUrl = 'ws://127.0.0.1:1234'
) {
  const { userId, yDoc, usersMap, puckMap, isConnected, isInitialUserSet } = useYjsRoom(roomName, serverUrl);

  const { users, updateCurrentUserPosition, updateUserName } = useUserSync(usersMap, userId);

  const amIHost = useMemo(() => {
    if (!isInitialUserSet) return false;
    if (users.length === 0) return false;
    const sorted = [...users].sort((a, b) => a.id.localeCompare(b.id));
    return sorted[0].id === userId;
  }, [users, userId, isInitialUserSet]);

  const { puck, applyImpulseToPuck } = usePuckPhysics(puckMap, amIHost);

  return {
    users,
    puck,
    userId,
    yDoc,
    updateCurrentUserPosition,
    applyImpulseToPuck,
    updateUserName,
    isConnected,
  };
}
