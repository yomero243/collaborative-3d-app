import { useCallback, useEffect } from 'react';
import * as Y from 'yjs';
import { PuckState } from './collabTypes';
import { useYMapEntry } from './yMapUtils';
import {
  PUCK_RADIUS,
  PUCK_FRICTION,
  WALL_BOUNCE_FACTOR,
  MIN_SPEED_THRESHOLD,
  PADDLE_BOUNCE_FACTOR,
  MAX_PUCK_SPEED,
  MIN_PUCK_SPEED,
  TABLE_WIDTH,
  TABLE_DEPTH,
} from '../utils/physicsConstants';

const TABLE_MIN_X = -TABLE_WIDTH / 2;
const TABLE_MAX_X = TABLE_WIDTH / 2;
const TABLE_MIN_Y = -TABLE_DEPTH / 2;
const TABLE_MAX_Y = TABLE_DEPTH / 2;

export interface PuckPhysics {
  puck: PuckState | null;
  applyImpulseToPuck: (vx: number, vy: number) => void;
}

export function usePuckPhysics(puckMap: Y.Map<unknown> | undefined, isHost: boolean): PuckPhysics {
  const puck = useYMapEntry<PuckState>(puckMap, 'state');

  const applyImpulseToPuck = useCallback(
    (impulseVx: number, impulseVy: number) => {
      if (puckMap) {
        const currentPuck = puckMap.get('state') as PuckState | undefined;
        if (currentPuck) {
          const currentSpeed = Math.sqrt(currentPuck.vx * currentPuck.vx + currentPuck.vy * currentPuck.vy);
          const impulseStrength = Math.sqrt(impulseVx * impulseVx + impulseVy * impulseVy);
          if (impulseStrength < MIN_PUCK_SPEED) return;
          const normalizedImpulseX = impulseVx / impulseStrength;
          const normalizedImpulseY = impulseVy / impulseStrength;
          let newImpulseX = impulseVx;
          let newImpulseY = impulseVy;
          if (currentSpeed > MIN_PUCK_SPEED) {
            const dotProduct = currentPuck.vx * normalizedImpulseX + currentPuck.vy * normalizedImpulseY;
            if (dotProduct > 0) {
              newImpulseX = currentPuck.vx + impulseVx * PADDLE_BOUNCE_FACTOR;
              newImpulseY = currentPuck.vy + impulseVy * PADDLE_BOUNCE_FACTOR;
            } else {
              newImpulseX = impulseVx * PADDLE_BOUNCE_FACTOR;
              newImpulseY = impulseVy * PADDLE_BOUNCE_FACTOR;
            }
          } else {
            newImpulseX *= PADDLE_BOUNCE_FACTOR;
            newImpulseY *= PADDLE_BOUNCE_FACTOR;
          }
          const newSpeed = Math.sqrt(newImpulseX * newImpulseX + newImpulseY * newImpulseY);
          if (newSpeed > MAX_PUCK_SPEED) {
            const scale = MAX_PUCK_SPEED / newSpeed;
            newImpulseX *= scale;
            newImpulseY *= scale;
          }
          const newPuckState: PuckState = {
            ...currentPuck,
            vx: newImpulseX,
            vy: newImpulseY,
            lastUpdate: Date.now(),
          };
          puckMap.set('state', newPuckState);
        }
      }
    },
    [puckMap]
  );

  useEffect(() => {
    if (!isHost || !puckMap) return;

    let lastPhysicsUpdate = Date.now();
    const interval = setInterval(() => {
      const currentPuck = puckMap.get('state') as PuckState | undefined;
      if (!currentPuck) return;

      const now = Date.now();
      const deltaTime = (now - lastPhysicsUpdate) / 1000;
      lastPhysicsUpdate = now;

      let newVx = currentPuck.vx * Math.pow(PUCK_FRICTION, deltaTime * 60);
      let newVy = currentPuck.vy * Math.pow(PUCK_FRICTION, deltaTime * 60);

      let newX = currentPuck.x + newVx * deltaTime;
      let newY = currentPuck.y + newVy * deltaTime;

      if (newX + PUCK_RADIUS > TABLE_MAX_X) {
        newX = TABLE_MAX_X - PUCK_RADIUS;
        newVx = -newVx * WALL_BOUNCE_FACTOR;
      } else if (newX - PUCK_RADIUS < TABLE_MIN_X) {
        newX = TABLE_MIN_X + PUCK_RADIUS;
        newVx = -newVx * WALL_BOUNCE_FACTOR;
      }

      if (newY + PUCK_RADIUS > TABLE_MAX_Y) {
        newY = TABLE_MAX_Y - PUCK_RADIUS;
        newVy = -newVy * WALL_BOUNCE_FACTOR;
      } else if (newY - PUCK_RADIUS < TABLE_MIN_Y) {
        newY = TABLE_MIN_Y + PUCK_RADIUS;
        newVy = -newVy * WALL_BOUNCE_FACTOR;
      }

      const currentSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
      if (currentSpeed < MIN_SPEED_THRESHOLD) {
        newVx = 0;
        newVy = 0;
      }

      const newPuckState: PuckState = {
        x: newX,
        y: newY,
        vx: newVx,
        vy: newVy,
        lastUpdate: now,
        lastHitBy: currentPuck.lastHitBy,
      };
      puckMap.set('state', newPuckState);
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, [isHost, puckMap]);

  return { puck, applyImpulseToPuck };
}
