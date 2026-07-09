import { PuckState } from './collabTypes';
import {
  TABLE_WIDTH,
  TABLE_DEPTH,
  PADDLE_RADIUS,
  PUCK_RADIUS,
  PUCK_FRICTION,
  WALL_BOUNCE_FACTOR,
  MIN_SPEED_THRESHOLD,
  PADDLE_BOUNCE_FACTOR,
  MAX_PUCK_SPEED,
  MIN_PUCK_SPEED,
  PADDLE_HITBOX_MULTIPLIER,
  PADDLE_VELOCITY_TRANSFER,
  MIN_HIT_SPEED,
  PADDLE_HIT_SEPARATION,
  GOAL_WIDTH,
} from '../utils/physicsConstants';

// Nota de coordenadas: PuckState usa (x, y) donde `y` corresponde al eje z de la escena 3D.

export const TABLE_MIN_X = -TABLE_WIDTH / 2;
export const TABLE_MAX_X = TABLE_WIDTH / 2;
export const TABLE_MIN_Y = -TABLE_DEPTH / 2;
export const TABLE_MAX_Y = TABLE_DEPTH / 2;

export type GoalSide = 'left' | 'right';

export interface PuckStepResult {
  state: PuckState;
  goal: GoalSide | null;
}

export interface PaddleHitInput {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function isInGoalMouth(y: number): boolean {
  return Math.abs(y) < GOAL_WIDTH / 2;
}

export function clampPuckToTable(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(TABLE_MIN_X + PUCK_RADIUS, Math.min(TABLE_MAX_X - PUCK_RADIUS, x)),
    y: Math.max(TABLE_MIN_Y + PUCK_RADIUS, Math.min(TABLE_MAX_Y - PUCK_RADIUS, y)),
  };
}

export function createInitialPuckState(now: number = Date.now()): PuckState {
  return { x: 0, y: 0, vx: 0, vy: 0, lastUpdate: now };
}

/**
 * Avanza la simulación del puck un paso: fricción, integración de posición,
 * rebotes contra las paredes y detección de gol en las aberturas laterales.
 */
export function stepPuck(current: PuckState, deltaTime: number, now: number = Date.now()): PuckStepResult {
  let newVx = current.vx * Math.pow(PUCK_FRICTION, deltaTime * 60);
  let newVy = current.vy * Math.pow(PUCK_FRICTION, deltaTime * 60);

  let newX = current.x + newVx * deltaTime;
  let newY = current.y + newVy * deltaTime;
  let goal: GoalSide | null = null;

  if (newX + PUCK_RADIUS > TABLE_MAX_X) {
    if (isInGoalMouth(newY)) {
      goal = 'right';
    } else {
      newX = TABLE_MAX_X - PUCK_RADIUS;
      newVx = -newVx * WALL_BOUNCE_FACTOR;
    }
  } else if (newX - PUCK_RADIUS < TABLE_MIN_X) {
    if (isInGoalMouth(newY)) {
      goal = 'left';
    } else {
      newX = TABLE_MIN_X + PUCK_RADIUS;
      newVx = -newVx * WALL_BOUNCE_FACTOR;
    }
  }

  if (goal) {
    return { state: createInitialPuckState(now), goal };
  }

  if (newY + PUCK_RADIUS > TABLE_MAX_Y) {
    newY = TABLE_MAX_Y - PUCK_RADIUS;
    newVy = -newVy * WALL_BOUNCE_FACTOR;
  } else if (newY - PUCK_RADIUS < TABLE_MIN_Y) {
    newY = TABLE_MIN_Y + PUCK_RADIUS;
    newVy = -newVy * WALL_BOUNCE_FACTOR;
  }

  const speed = Math.sqrt(newVx * newVx + newVy * newVy);
  if (speed < MIN_SPEED_THRESHOLD) {
    newVx = 0;
    newVy = 0;
  }

  return {
    state: {
      x: newX,
      y: newY,
      vx: newVx,
      vy: newVy,
      lastUpdate: now,
      lastHitBy: current.lastHitBy,
    },
    goal: null,
  };
}

/**
 * Combina un impulso arbitrario con la velocidad actual del puck
 * (usado por acciones tipo "impulso aleatorio"). Devuelve null si el
 * impulso es demasiado débil para tener efecto.
 */
export function combineImpulse(
  current: PuckState,
  impulseVx: number,
  impulseVy: number,
  now: number = Date.now()
): PuckState | null {
  const impulseStrength = Math.sqrt(impulseVx * impulseVx + impulseVy * impulseVy);
  if (impulseStrength < MIN_PUCK_SPEED) return null;

  const currentSpeed = Math.sqrt(current.vx * current.vx + current.vy * current.vy);
  let newVx = impulseVx;
  let newVy = impulseVy;

  if (currentSpeed > MIN_PUCK_SPEED) {
    const dotProduct =
      (current.vx * impulseVx + current.vy * impulseVy) / impulseStrength;
    if (dotProduct > 0) {
      newVx = current.vx + impulseVx * PADDLE_BOUNCE_FACTOR;
      newVy = current.vy + impulseVy * PADDLE_BOUNCE_FACTOR;
    } else {
      newVx = impulseVx * PADDLE_BOUNCE_FACTOR;
      newVy = impulseVy * PADDLE_BOUNCE_FACTOR;
    }
  } else {
    newVx *= PADDLE_BOUNCE_FACTOR;
    newVy *= PADDLE_BOUNCE_FACTOR;
  }

  const newSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
  if (newSpeed > MAX_PUCK_SPEED) {
    const scale = MAX_PUCK_SPEED / newSpeed;
    newVx *= scale;
    newVy *= scale;
  }

  return { ...current, vx: newVx, vy: newVy, lastUpdate: now };
}

/**
 * Resuelve un golpe de paddle sobre el puck. La velocidad resultante
 * combina la reflexión del puck contra el paddle con la velocidad del
 * propio paddle, garantiza una velocidad mínima de salida y separa el
 * puck para que no quede atrapado dentro del paddle.
 * Devuelve null si no hay contacto.
 */
export function computePaddleHit(
  puck: PuckState,
  paddle: PaddleHitInput,
  hitBy?: string,
  now: number = Date.now()
): PuckState | null {
  const dx = puck.x - paddle.x;
  const dy = puck.y - paddle.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const combinedRadius = PUCK_RADIUS + PADDLE_RADIUS * PADDLE_HITBOX_MULTIPLIER;

  if (distance >= combinedRadius) return null;

  const safeDistance = Math.max(distance, 1e-4);
  const nx = dx / safeDistance;
  const ny = dy / safeDistance;

  // Reflejar la velocidad del puck solo si se acerca al paddle
  let newVx = puck.vx;
  let newVy = puck.vy;
  const velocityAlongNormal = newVx * nx + newVy * ny;
  if (velocityAlongNormal < 0) {
    newVx = (newVx - 2 * velocityAlongNormal * nx) * PADDLE_BOUNCE_FACTOR;
    newVy = (newVy - 2 * velocityAlongNormal * ny) * PADDLE_BOUNCE_FACTOR;
  }

  // Transferir parte del momentum del paddle al puck
  newVx += paddle.vx * PADDLE_VELOCITY_TRANSFER;
  newVy += paddle.vy * PADDLE_VELOCITY_TRANSFER;

  // Garantizar velocidad mínima de salida a lo largo de la normal
  const outwardSpeed = newVx * nx + newVy * ny;
  if (outwardSpeed < MIN_HIT_SPEED) {
    newVx += nx * (MIN_HIT_SPEED - outwardSpeed);
    newVy += ny * (MIN_HIT_SPEED - outwardSpeed);
  }

  const newSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
  if (newSpeed > MAX_PUCK_SPEED) {
    const scale = MAX_PUCK_SPEED / newSpeed;
    newVx *= scale;
    newVy *= scale;
  }

  // Separar el puck del paddle para evitar que quede atrapado
  const separated = clampPuckToTable(
    paddle.x + nx * (combinedRadius + PADDLE_HIT_SEPARATION),
    paddle.y + ny * (combinedRadius + PADDLE_HIT_SEPARATION)
  );

  return {
    x: separated.x,
    y: separated.y,
    vx: newVx,
    vy: newVy,
    lastUpdate: now,
    lastHitBy: hitBy ?? puck.lastHitBy,
  };
}
