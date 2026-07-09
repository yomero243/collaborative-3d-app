import { useCallback, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { PuckState } from './collabTypes';
import { useYMapEntry } from './yMapUtils';
import {
  stepPuck,
  combineImpulse,
  computePaddleHit,
  createInitialPuckState,
  GoalSide,
  PaddleHitInput,
} from './puckSimulation';

export interface PuckPhysics {
  puck: PuckState | null;
  applyImpulseToPuck: (vx: number, vy: number) => void;
  hitPuckWithPaddle: (paddle: PaddleHitInput, hitBy: string) => boolean;
}

export type GoalHandler = (scorerId: string | undefined, side: GoalSide) => void;

export function usePuckPhysics(
  puckMap: Y.Map<unknown> | undefined,
  isHost: boolean,
  onGoal?: GoalHandler
): PuckPhysics {
  const puck = useYMapEntry<PuckState>(puckMap, 'state');

  const onGoalRef = useRef<GoalHandler | undefined>(onGoal);
  onGoalRef.current = onGoal;

  const applyImpulseToPuck = useCallback(
    (impulseVx: number, impulseVy: number) => {
      if (!puckMap) return;
      const currentPuck = puckMap.get('state') as PuckState | undefined;
      if (!currentPuck) return;

      const newPuckState = combineImpulse(currentPuck, impulseVx, impulseVy);
      if (newPuckState) {
        puckMap.set('state', newPuckState);
      }
    },
    [puckMap]
  );

  const hitPuckWithPaddle = useCallback(
    (paddle: PaddleHitInput, hitBy: string): boolean => {
      if (!puckMap) return false;
      const currentPuck = puckMap.get('state') as PuckState | undefined;
      if (!currentPuck) return false;

      const newPuckState = computePaddleHit(currentPuck, paddle, hitBy);
      if (!newPuckState) return false;

      puckMap.set('state', newPuckState);
      return true;
    },
    [puckMap]
  );

  useEffect(() => {
    if (!isHost || !puckMap) return;

    let lastPhysicsUpdate = Date.now();
    const interval = setInterval(() => {
      const currentPuck = puckMap.get('state') as PuckState | undefined;
      if (!currentPuck) {
        puckMap.set('state', createInitialPuckState());
        return;
      }

      const now = Date.now();
      const deltaTime = (now - lastPhysicsUpdate) / 1000;
      lastPhysicsUpdate = now;

      const { state, goal } = stepPuck(currentPuck, deltaTime, now);
      puckMap.set('state', state);

      if (goal) {
        onGoalRef.current?.(currentPuck.lastHitBy, goal);
      }
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, [isHost, puckMap]);

  return { puck, applyImpulseToPuck, hitPuckWithPaddle };
}
