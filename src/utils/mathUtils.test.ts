import { describe, it, expect } from 'vitest';
import { vec2, vec3, mathUtils } from './mathUtils';

describe('vec2', () => {
  it('crea vectores con valores por defecto', () => {
    expect(vec2.create()).toEqual({ x: 0, z: 0 });
    expect(vec2.create(2, -3)).toEqual({ x: 2, z: -3 });
  });

  it('suma y resta componentes', () => {
    const a = vec2.create(1, 2);
    const b = vec2.create(3, -1);
    expect(vec2.add(a, b)).toEqual({ x: 4, z: 1 });
    expect(vec2.subtract(a, b)).toEqual({ x: -2, z: 3 });
  });

  it('multiplica por escalar', () => {
    expect(vec2.multiply(vec2.create(2, -3), 2)).toEqual({ x: 4, z: -6 });
  });

  it('calcula producto punto, longitud y distancia', () => {
    expect(vec2.dot(vec2.create(1, 0), vec2.create(0, 1))).toBe(0);
    expect(vec2.dot(vec2.create(2, 3), vec2.create(4, 5))).toBe(23);
    expect(vec2.length(vec2.create(3, 4))).toBe(5);
    expect(vec2.distance(vec2.create(1, 1), vec2.create(4, 5))).toBe(5);
  });

  it('normaliza vectores y maneja el vector cero', () => {
    expect(vec2.normalize(vec2.create(10, 0))).toEqual({ x: 1, z: 0 });
    expect(vec2.normalize(vec2.create(0, 0))).toEqual({ x: 0, z: 0 });
  });

  it('refleja un vector sobre una normal', () => {
    const reflected = vec2.reflect(vec2.create(1, -1), vec2.create(0, 1));
    expect(reflected.x).toBeCloseTo(1);
    expect(reflected.z).toBeCloseTo(1);
  });

  it('interpola linealmente entre dos vectores', () => {
    const result = vec2.lerp(vec2.create(0, 0), vec2.create(10, -10), 0.5);
    expect(result).toEqual({ x: 5, z: -5 });
  });
});

describe('vec3', () => {
  it('calcula el producto cruz', () => {
    const cross = vec3.cross(vec3.create(1, 0, 0), vec3.create(0, 1, 0));
    expect(cross).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('convierte a vec2 descartando y', () => {
    expect(vec3.toVec2(vec3.create(1, 2, 3))).toEqual({ x: 1, z: 3 });
  });
});

describe('mathUtils', () => {
  it('clamp restringe al rango', () => {
    expect(mathUtils.clamp(5, 0, 10)).toBe(5);
    expect(mathUtils.clamp(-5, 0, 10)).toBe(0);
    expect(mathUtils.clamp(15, 0, 10)).toBe(10);
  });

  it('lerp interpola escalares', () => {
    expect(mathUtils.lerp(0, 10, 0.3)).toBeCloseTo(3);
  });

  it('isZero e isEqual usan tolerancia', () => {
    expect(mathUtils.isZero(1e-9)).toBe(true);
    expect(mathUtils.isZero(0.1)).toBe(false);
    expect(mathUtils.isEqual(1, 1 + 1e-9)).toBe(true);
  });
});
