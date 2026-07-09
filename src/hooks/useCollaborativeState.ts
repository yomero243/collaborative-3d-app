import { useCallback, useMemo } from 'react';
import { useYjsRoom } from './useYjsRoom';
import { useUserSync } from './useUserSync';
import { usePuckPhysics } from './usePuckPhysics';
import { GoalSide } from './puckSimulation';

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

  // El host acredita el gol al último jugador que tocó el puck
  const handleGoal = useCallback(
    (scorerId: string | undefined, _side: GoalSide) => {
      void _side;
      if (!scorerId || !usersMap) return;
      const scorer = usersMap.get(scorerId);
      if (scorer) {
        usersMap.set(scorerId, {
          ...scorer,
          score: (scorer.score ?? 0) + 1,
          lastUpdate: Date.now(),
        });
      }
    },
    [usersMap]
  );

  const { puck, applyImpulseToPuck, hitPuckWithPaddle } = usePuckPhysics(puckMap, amIHost, handleGoal);

  return {
    users,
    puck,
    userId,
    yDoc,
    updateCurrentUserPosition,
    applyImpulseToPuck,
    hitPuckWithPaddle,
    updateUserName,
    isConnected,
  };
}
