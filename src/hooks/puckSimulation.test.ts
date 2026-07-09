import { describe, it, expect } from 'vitest';
import {
  stepPuck,
  combineImpulse,
  computePaddleHit,
  clampPuckToTable,
  isInGoalMouth,
  createInitialPuckState,
  TABLE_MIN_X,
  TABLE_MAX_X,
  TABLE_MIN_Y,
  TABLE_MAX_Y,
} from './puckSimulation';
import { PuckState } from './collabTypes';
import {
  PUCK_RADIUS,
  PADDLE_RADIUS,
  PADDLE_HITBOX_MULTIPLIER,
  MAX_PUCK_SPEED,
  MIN_HIT_SPEED,
  GOAL_WIDTH,
} from '../utils/physicsConstants';

const makePuck = (overrides: Partial<PuckState> = {}): PuckState => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  lastUpdate: 0,
  ...overrides,
});

describe('stepPuck', () => {
  it('aplica fricción y reduce la velocidad', () => {
    const { state } = stepPuck(makePuck({ vx: 5, vy: 0 }), 1 / 60, 1);
    expect(state.vx).toBeGreaterThan(0);
    expect(state.vx).toBeLessThan(5);
  });

  it('detiene el puck por debajo del umbral mínimo', () => {
    const { state } = stepPuck(makePuck({ vx: 0.001, vy: 0.001 }), 1 / 60, 1);
    expect(state.vx).toBe(0);
    expect(state.vy).toBe(0);
  });

  it('rebota contra la pared derecha fuera de la portería', () => {
    const y = GOAL_WIDTH / 2 + 0.5; // fuera de la boca de la portería
    const { state, goal } = stepPuck(
      makePuck({ x: TABLE_MAX_X - PUCK_RADIUS - 0.01, y, vx: 10, vy: 0 }),
      1 / 60,
      1
    );
    expect(goal).toBeNull();
    expect(state.vx).toBeLessThan(0);
    expect(state.x).toBeLessThanOrEqual(TABLE_MAX_X - PUCK_RADIUS);
  });

  it('rebota contra las paredes largas (eje y)', () => {
    const { state } = stepPuck(
      makePuck({ x: 0, y: TABLE_MAX_Y - PUCK_RADIUS - 0.01, vx: 0, vy: 10 }),
      1 / 60,
      1
    );
    expect(state.vy).toBeLessThan(0);
    expect(state.y).toBeLessThanOrEqual(TABLE_MAX_Y - PUCK_RADIUS);
  });

  it('detecta gol en la portería derecha y reinicia el puck', () => {
    const { state, goal } = stepPuck(
      makePuck({ x: TABLE_MAX_X - PUCK_RADIUS - 0.01, y: 0, vx: 10, vy: 0, lastHitBy: 'p1' }),
      1 / 60,
      123
    );
    expect(goal).toBe('right');
    expect(state.x).toBe(0);
    expect(state.y).toBe(0);
    expect(state.vx).toBe(0);
    expect(state.vy).toBe(0);
    expect(state.lastHitBy).toBeUndefined();
  });

  it('detecta gol en la portería izquierda', () => {
    const { goal } = stepPuck(
      makePuck({ x: TABLE_MIN_X + PUCK_RADIUS + 0.01, y: 0.3, vx: -10, vy: 0 }),
      1 / 60,
      1
    );
    expect(goal).toBe('left');
  });

  it('el puck nunca sale de la mesa tras muchos pasos con velocidades aleatorias', () => {
    let state = makePuck({ vx: 15, vy: -13 });
    for (let i = 0; i < 2000; i++) {
      const result = stepPuck(state, 1 / 60, i);
      state = result.state;
      if (result.goal) continue; // tras un gol el puck vuelve al centro
      expect(state.x).toBeGreaterThanOrEqual(TABLE_MIN_X + PUCK_RADIUS - 1e-9);
      expect(state.x).toBeLessThanOrEqual(TABLE_MAX_X - PUCK_RADIUS + 1e-9);
      expect(state.y).toBeGreaterThanOrEqual(TABLE_MIN_Y + PUCK_RADIUS - 1e-9);
      expect(state.y).toBeLessThanOrEqual(TABLE_MAX_Y - PUCK_RADIUS + 1e-9);
    }
  });

  it('conserva lastHitBy mientras no haya gol', () => {
    const { state } = stepPuck(makePuck({ vx: 1, lastHitBy: 'p7' }), 1 / 60, 1);
    expect(state.lastHitBy).toBe('p7');
  });
});

describe('combineImpulse', () => {
  it('ignora impulsos demasiado débiles', () => {
    expect(combineImpulse(makePuck(), 0.01, 0.01, 1)).toBeNull();
  });

  it('aplica el impulso a un puck detenido', () => {
    const result = combineImpulse(makePuck(), 2, 0, 1);
    expect(result).not.toBeNull();
    expect(result!.vx).toBeGreaterThan(0);
    expect(result!.vy).toBe(0);
  });

  it('nunca excede la velocidad máxima', () => {
    const result = combineImpulse(makePuck({ vx: 17, vy: 0 }), 17, 0, 1);
    expect(result).not.toBeNull();
    const speed = Math.hypot(result!.vx, result!.vy);
    expect(speed).toBeLessThanOrEqual(MAX_PUCK_SPEED + 1e-9);
  });
});

describe('computePaddleHit', () => {
  const combinedRadius = PUCK_RADIUS + PADDLE_RADIUS * PADDLE_HITBOX_MULTIPLIER;

  it('devuelve null si no hay contacto', () => {
    const result = computePaddleHit(
      makePuck({ x: 3, y: 0 }),
      { x: 0, y: 0, vx: 0, vy: 0 }
    );
    expect(result).toBeNull();
  });

  it('separa el puck fuera del radio combinado tras el golpe', () => {
    const result = computePaddleHit(
      makePuck({ x: 0.3, y: 0 }),
      { x: 0, y: 0, vx: 0, vy: 0 },
      'p1',
      1
    );
    expect(result).not.toBeNull();
    const distance = Math.hypot(result!.x - 0, result!.y - 0);
    expect(distance).toBeGreaterThanOrEqual(combinedRadius);
  });

  it('garantiza una velocidad mínima de salida', () => {
    const result = computePaddleHit(
      makePuck({ x: 0.3, y: 0 }),
      { x: 0, y: 0, vx: 0, vy: 0 },
      'p1',
      1
    );
    const speed = Math.hypot(result!.vx, result!.vy);
    expect(speed).toBeGreaterThanOrEqual(MIN_HIT_SPEED - 1e-9);
  });

  it('un golpe rápido del paddle transfiere más velocidad que uno lento', () => {
    const slow = computePaddleHit(
      makePuck({ x: 0.5, y: 0 }),
      { x: 0, y: 0, vx: 1, vy: 0 },
      'p1',
      1
    );
    const fast = computePaddleHit(
      makePuck({ x: 0.5, y: 0 }),
      { x: 0, y: 0, vx: 10, vy: 0 },
      'p1',
      1
    );
    expect(Math.hypot(fast!.vx, fast!.vy)).toBeGreaterThan(Math.hypot(slow!.vx, slow!.vy));
  });

  it('refleja un puck que se acerca al paddle', () => {
    // Puck moviéndose hacia el paddle (hacia -x), debe salir hacia +x
    const result = computePaddleHit(
      makePuck({ x: 0.5, y: 0, vx: -5, vy: 0 }),
      { x: 0, y: 0, vx: 0, vy: 0 },
      'p1',
      1
    );
    expect(result!.vx).toBeGreaterThan(0);
  });

  it('registra quién golpeó el puck', () => {
    const result = computePaddleHit(
      makePuck({ x: 0.3, y: 0 }),
      { x: 0, y: 0, vx: 0, vy: 0 },
      'jugador-42',
      1
    );
    expect(result!.lastHitBy).toBe('jugador-42');
  });

  it('respeta la velocidad máxima aunque el paddle golpee muy fuerte', () => {
    const result = computePaddleHit(
      makePuck({ x: 0.3, y: 0 }),
      { x: 0, y: 0, vx: 100, vy: 0 },
      'p1',
      1
    );
    const speed = Math.hypot(result!.vx, result!.vy);
    expect(speed).toBeLessThanOrEqual(MAX_PUCK_SPEED + 1e-9);
  });

  it('mantiene la posición separada dentro de la mesa cerca de una esquina', () => {
    const cornerX = TABLE_MAX_X - PUCK_RADIUS - 0.05;
    const cornerY = TABLE_MAX_Y - PUCK_RADIUS - 0.05;
    const result = computePaddleHit(
      makePuck({ x: cornerX, y: cornerY }),
      { x: cornerX - 0.3, y: cornerY - 0.3, vx: 5, vy: 5 },
      'p1',
      1
    );
    expect(result).not.toBeNull();
    expect(result!.x).toBeLessThanOrEqual(TABLE_MAX_X - PUCK_RADIUS);
    expect(result!.y).toBeLessThanOrEqual(TABLE_MAX_Y - PUCK_RADIUS);
  });
});

describe('utilidades', () => {
  it('clampPuckToTable restringe posiciones al interior de la mesa', () => {
    const clamped = clampPuckToTable(100, -100);
    expect(clamped.x).toBe(TABLE_MAX_X - PUCK_RADIUS);
    expect(clamped.y).toBe(TABLE_MIN_Y + PUCK_RADIUS);
  });

  it('isInGoalMouth distingue portería de pared', () => {
    expect(isInGoalMouth(0)).toBe(true);
    expect(isInGoalMouth(GOAL_WIDTH / 2 - 0.01)).toBe(true);
    expect(isInGoalMouth(GOAL_WIDTH / 2 + 0.01)).toBe(false);
  });

  it('createInitialPuckState centra el puck sin velocidad', () => {
    const state = createInitialPuckState(5);
    expect(state).toEqual({ x: 0, y: 0, vx: 0, vy: 0, lastUpdate: 5 });
  });
});
