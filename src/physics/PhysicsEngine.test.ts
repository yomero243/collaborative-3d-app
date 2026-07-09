import { describe, it, expect } from 'vitest';
import { PhysicsEngine } from './PhysicsEngine';
import { vec2 } from '../utils/mathUtils';
import {
  TABLE_WIDTH,
  TABLE_DEPTH,
  PUCK_RADIUS,
  MAX_PUCK_SPEED,
} from '../utils/physicsConstants';

const HALF_W = TABLE_WIDTH / 2;
const HALF_D = TABLE_DEPTH / 2;

describe('PhysicsEngine', () => {
  it('crea un puck con los valores por defecto', () => {
    const engine = new PhysicsEngine();
    const puck = engine.createPuck(vec2.create(1, 2));
    expect(puck.position).toEqual({ x: 1, z: 2 });
    expect(puck.velocity).toEqual({ x: 0, z: 0 });
    expect(puck.radius).toBe(PUCK_RADIUS);
  });

  it('la fricción desacelera el puck', () => {
    const engine = new PhysicsEngine();
    const puck = engine.createPuck(vec2.create(0, 0));
    puck.velocity = vec2.create(5, 0);
    engine.update(1 / 60, puck, new Map());
    expect(puck.velocity.x).toBeGreaterThan(0);
    expect(puck.velocity.x).toBeLessThan(5);
  });

  // Regresión: la versión anterior usaba Math.abs en la distancia a la pared,
  // confundía paredes opuestas y expulsaba el puck fuera de la mesa.
  it.each([
    ['derecha', vec2.create(HALF_W - 0.1, 0), vec2.create(10, 0)],
    ['izquierda', vec2.create(-HALF_W + 0.1, 0), vec2.create(-10, 0)],
    ['superior', vec2.create(0, HALF_D - 0.1), vec2.create(0, 10)],
    ['inferior', vec2.create(0, -HALF_D + 0.1), vec2.create(0, -10)],
  ])('el puck rebota hacia adentro en la pared %s', (_name, position, velocity) => {
    const engine = new PhysicsEngine();
    const puck = engine.createPuck(position);
    puck.velocity = velocity;

    const { collisions } = engine.update(1 / 60, puck, new Map());

    expect(collisions.length).toBeGreaterThan(0);
    // Tras el rebote el puck queda dentro de la mesa
    expect(Math.abs(puck.position.x)).toBeLessThanOrEqual(HALF_W - PUCK_RADIUS + 1e-6);
    expect(Math.abs(puck.position.z)).toBeLessThanOrEqual(HALF_D - PUCK_RADIUS + 1e-6);
    // Y su velocidad apunta hacia el interior
    const outwardVelocity =
      puck.velocity.x * Math.sign(position.x) + puck.velocity.z * Math.sign(position.z);
    expect(outwardVelocity).toBeLessThanOrEqual(0);
  });

  it('un puck en el centro no colisiona con ninguna pared', () => {
    const engine = new PhysicsEngine();
    const puck = engine.createPuck(vec2.create(0, 0));
    puck.velocity = vec2.create(1, 1);
    const { collisions } = engine.update(1 / 60, puck, new Map());
    expect(collisions.length).toBe(0);
  });

  it('el puck permanece dentro de la mesa tras una simulación larga', () => {
    const engine = new PhysicsEngine();
    const puck = engine.createPuck(vec2.create(0, 0));
    puck.velocity = vec2.create(14, -11);

    for (let i = 0; i < 600; i++) {
      engine.update(1 / 60, puck, new Map());
      expect(Math.abs(puck.position.x)).toBeLessThanOrEqual(HALF_W);
      expect(Math.abs(puck.position.z)).toBeLessThanOrEqual(HALF_D);
    }
  });

  it('una colisión con paddle empuja el puck hacia afuera', () => {
    const engine = new PhysicsEngine();
    const puck = engine.createPuck(vec2.create(0.5, 0));
    puck.velocity = vec2.create(-3, 0);
    const paddle = engine.createPaddle(vec2.create(0, 0));
    const paddles = new Map([['p1', paddle]]);

    engine.update(1 / 60, puck, paddles);

    // El puck termina moviéndose alejándose del paddle
    expect(puck.velocity.x).toBeGreaterThan(0);
    const distance = vec2.distance(puck.position, paddle.position);
    expect(distance).toBeGreaterThanOrEqual(puck.radius + paddle.radius - 1e-6);
  });

  it('limita la velocidad del puck a MAX_PUCK_SPEED', () => {
    const engine = new PhysicsEngine();
    const puck = engine.createPuck(vec2.create(0, 0));
    engine.applyImpulse(puck, vec2.create(1000, 0));
    engine.update(1 / 60, puck, new Map());
    expect(vec2.length(puck.velocity)).toBeLessThanOrEqual(MAX_PUCK_SPEED + 1e-6);
  });

  it('predictTrajectory mantiene la trayectoria dentro de la mesa', () => {
    const engine = new PhysicsEngine();
    const puck = engine.createPuck(vec2.create(0, 0));
    puck.velocity = vec2.create(12, 9);
    const trajectory = engine.predictTrajectory(puck, 120);
    expect(trajectory.length).toBeGreaterThan(0);
    trajectory.forEach((point) => {
      expect(Math.abs(point.x)).toBeLessThanOrEqual(HALF_W);
      expect(Math.abs(point.z)).toBeLessThanOrEqual(HALF_D);
    });
  });
});
