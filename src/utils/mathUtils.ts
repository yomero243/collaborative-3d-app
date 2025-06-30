// Utilidades matemáticas para el sistema de físicas

export interface Vector2 {
  x: number;
  z: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

// Operaciones vectoriales 2D
export const vec2 = {
  create: (x: number = 0, z: number = 0): Vector2 => ({ x, z }),
  
  copy: (v: Vector2): Vector2 => ({ x: v.x, z: v.z }),
  
  add: (a: Vector2, b: Vector2): Vector2 => ({
    x: a.x + b.x,
    z: a.z + b.z
  }),
  
  subtract: (a: Vector2, b: Vector2): Vector2 => ({
    x: a.x - b.x,
    z: a.z - b.z
  }),
  
  multiply: (v: Vector2, scalar: number): Vector2 => ({
    x: v.x * scalar,
    z: v.z * scalar
  }),
  
  dot: (a: Vector2, b: Vector2): number => a.x * b.x + a.z * b.z,
  
  length: (v: Vector2): number => Math.sqrt(v.x * v.x + v.z * v.z),
  
  lengthSquared: (v: Vector2): number => v.x * v.x + v.z * v.z,
  
  distance: (a: Vector2, b: Vector2): number => {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  },
  
  normalize: (v: Vector2): Vector2 => {
    const len = vec2.length(v);
    if (len === 0) return { x: 0, z: 0 };
    return {
      x: v.x / len,
      z: v.z / len
    };
  },
  
  reflect: (v: Vector2, normal: Vector2): Vector2 => {
    const dot = vec2.dot(v, normal);
    return {
      x: v.x - 2 * dot * normal.x,
      z: v.z - 2 * dot * normal.z
    };
  },
  
  lerp: (a: Vector2, b: Vector2, t: number): Vector2 => ({
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t
  }),
  
  rotateAroundPoint: (point: Vector2, center: Vector2, angle: number): Vector2 => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point.x - center.x;
    const dz = point.z - center.z;
    
    return {
      x: center.x + dx * cos - dz * sin,
      z: center.z + dx * sin + dz * cos
    };
  }
};

// Operaciones vectoriales 3D
export const vec3 = {
  create: (x: number = 0, y: number = 0, z: number = 0): Vector3 => ({ x, y, z }),
  
  copy: (v: Vector3): Vector3 => ({ x: v.x, y: v.y, z: v.z }),
  
  add: (a: Vector3, b: Vector3): Vector3 => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  }),
  
  subtract: (a: Vector3, b: Vector3): Vector3 => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  }),
  
  multiply: (v: Vector3, scalar: number): Vector3 => ({
    x: v.x * scalar,
    y: v.y * scalar,
    z: v.z * scalar
  }),
  
  cross: (a: Vector3, b: Vector3): Vector3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  }),
  
  dot: (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z,
  
  length: (v: Vector3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
  
  normalize: (v: Vector3): Vector3 => {
    const len = vec3.length(v);
    if (len === 0) return { x: 0, y: 0, z: 0 };
    return {
      x: v.x / len,
      y: v.y / len,
      z: v.z / len
    };
  },
  
  toVec2: (v: Vector3): Vector2 => ({ x: v.x, z: v.z })
};

// Utilidades matemáticas generales
export const mathUtils = {
  clamp: (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
  },
  
  lerp: (a: number, b: number, t: number): number => {
    return a + (b - a) * t;
  },
  
  smoothstep: (edge0: number, edge1: number, x: number): number => {
    const t = mathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  },
  
  easeInOut: (t: number): number => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
  
  radToDeg: (rad: number): number => rad * (180 / Math.PI),
  
  degToRad: (deg: number): number => deg * (Math.PI / 180),
  
  // Función para detectar si un número es aproximadamente cero
  isZero: (value: number, epsilon: number = 1e-6): boolean => {
    return Math.abs(value) < epsilon;
  },
  
  // Función para comparar dos números con tolerancia
  isEqual: (a: number, b: number, epsilon: number = 1e-6): boolean => {
    return Math.abs(a - b) < epsilon;
  }
};