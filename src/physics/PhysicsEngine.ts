import { Vector2, vec2, mathUtils } from '../utils/mathUtils';
import {
  TABLE_WIDTH,
  TABLE_DEPTH,
  PADDLE_RADIUS,
  PUCK_RADIUS,
  PUCK_FRICTION,
  MIN_SPEED_THRESHOLD,
  PADDLE_BOUNCE_FACTOR,
  MAX_PUCK_SPEED,
  PUCK_MASS,
  PADDLE_MASS,
  RESTITUTION_PUCK,
  RESTITUTION_PADDLE,
  RESTITUTION_WALL,
  MAGNUS_COEFFICIENT,
  ANGULAR_FRICTION,
  MAX_ANGULAR_VELOCITY,
  MAX_SPIN,
  COLLISION_SEPARATION,
  VELOCITY_SMOOTHING
} from '../utils/physicsConstants';

// Tipos mejorados para el motor de físicas
export interface PhysicsBody {
  position: Vector2;
  velocity: Vector2;
  mass: number;
  radius: number;
  restitution: number; // Coeficiente de rebote
  friction: number;    // Coeficiente de fricción
  isStatic: boolean;   // Si el objeto se puede mover
}

export interface PuckPhysics extends PhysicsBody {
  angularVelocity: number; // Rotación
  spin: number;           // Efecto de spin
  lastCollisionTime: number;
  lastCollisionForce: number;
}

export interface PaddlePhysics extends PhysicsBody {
  lastPosition: Vector2;  // Para calcular velocidad del paddle
  playerVelocity: Vector2; // Velocidad calculada del jugador
}

export interface CollisionInfo {
  occurred: boolean;
  point: Vector2;
  normal: Vector2;
  penetration: number;
  relativeVelocity: Vector2;
  impulse: Vector2;
  force: number;
}

export interface Wall {
  normal: Vector2;
  distance: number; // Distancia desde el origen
  bounds: { min: Vector2; max: Vector2 };
}

export class PhysicsEngine {
  private walls: Wall[];
  private timeAccumulator: number = 0;
  private readonly fixedTimeStep: number = 1/120; // 120 FPS para físicas
  private readonly maxTimeStep: number = 1/30;   // Límite para evitar spiral of death
  
  constructor() {
    this.setupWalls();
  }
  
  private setupWalls(): void {
    const halfWidth = TABLE_WIDTH / 2;
    const halfDepth = TABLE_DEPTH / 2;
    
    this.walls = [
      // Pared derecha
      {
        normal: vec2.create(-1, 0),
        distance: halfWidth,
        bounds: { min: vec2.create(halfWidth, -halfDepth), max: vec2.create(halfWidth, halfDepth) }
      },
      // Pared izquierda
      {
        normal: vec2.create(1, 0),
        distance: halfWidth,
        bounds: { min: vec2.create(-halfWidth, -halfDepth), max: vec2.create(-halfWidth, halfDepth) }
      },
      // Pared superior
      {
        normal: vec2.create(0, -1),
        distance: halfDepth,
        bounds: { min: vec2.create(-halfWidth, halfDepth), max: vec2.create(halfWidth, halfDepth) }
      },
      // Pared inferior
      {
        normal: vec2.create(0, 1),
        distance: halfDepth,
        bounds: { min: vec2.create(-halfWidth, -halfDepth), max: vec2.create(halfWidth, -halfDepth) }
      }
    ];
  }
  
  // Actualiza la física usando integración temporal fija
  public update(deltaTime: number, puck: PuckPhysics, paddles: Map<string, PaddlePhysics>): {
    puck: PuckPhysics;
    collisions: CollisionInfo[];
  } {
    // Limitar el deltaTime para evitar problemas de estabilidad
    const clampedDeltaTime = Math.min(deltaTime, this.maxTimeStep);
    this.timeAccumulator += clampedDeltaTime;
    
    const collisions: CollisionInfo[] = [];
    
    // Procesar físicas en pasos fijos
    while (this.timeAccumulator >= this.fixedTimeStep) {
      const stepCollisions = this.fixedUpdate(this.fixedTimeStep, puck, paddles);
      collisions.push(...stepCollisions);
      this.timeAccumulator -= this.fixedTimeStep;
    }
    
    // Interpolar posición para rendering suave
    // const interpolationFactor = this.timeAccumulator / this.fixedTimeStep;
    this.interpolatePosition();
    
    return { puck, collisions };
  }
  
  private fixedUpdate(deltaTime: number, puck: PuckPhysics, paddles: Map<string, PaddlePhysics>): CollisionInfo[] {
    const collisions: CollisionInfo[] = [];
    
    // 1. Actualizar velocidades de paddles basado en movimiento
    this.updatePaddleVelocities(paddles, deltaTime);
    
    // 2. Aplicar fuerzas al puck (fricción, etc.)
    this.applyForces(puck, deltaTime);
    
    // 3. Integrar posición usando Verlet
    this.integrateVerlet(puck, deltaTime);
    
    // 4. Detectar y resolver colisiones con paddles
    paddles.forEach(paddle => {
      const collision = this.checkPaddleCollision(puck, paddle);
      if (collision.occurred) {
        this.resolvePaddleCollision(puck, paddle, collision);
        collisions.push(collision);
      }
    });
    
    // 5. Detectar y resolver colisiones con paredes
    const wallCollision = this.checkWallCollisions(puck);
    if (wallCollision.occurred) {
      this.resolveWallCollision(puck, wallCollision);
      collisions.push(wallCollision);
    }
    
    // 6. Aplicar límites de velocidad
    this.applyVelocityLimits(puck);
    
    return collisions;
  }
  
  private updatePaddleVelocities(paddles: Map<string, PaddlePhysics>, deltaTime: number): void {
    paddles.forEach(paddle => {
      // Calcular velocidad basada en cambio de posición
      const positionDelta = vec2.subtract(paddle.position, paddle.lastPosition);
      paddle.playerVelocity = vec2.multiply(positionDelta, 1 / deltaTime);
      
      // Suavizar la velocidad para evitar saltos bruscos
      paddle.playerVelocity = vec2.lerp(paddle.velocity, paddle.playerVelocity, VELOCITY_SMOOTHING);
      
      // Actualizar última posición
      paddle.lastPosition = vec2.copy(paddle.position);
      
      // Los paddles no tienen velocidad propia en el sistema de físicas (son controlados por el jugador)
      paddle.velocity = vec2.create(0, 0);
    });
  }
  
  private applyForces(puck: PuckPhysics, deltaTime: number): void {
    // Aplicar fricción
    const speed = vec2.length(puck.velocity);
    if (speed > MIN_SPEED_THRESHOLD) {
      // Fricción proporcional a la velocidad - más suave
      const frictionForce = Math.pow(puck.friction, deltaTime * 45); // Reducido de 60 a 45
      puck.velocity = vec2.multiply(puck.velocity, frictionForce);
      
      // Fricción angular más suave
      puck.angularVelocity *= Math.pow(ANGULAR_FRICTION, deltaTime * 30); // Reducido de 60 a 30
    } else {
      // Parar completamente si la velocidad es muy baja
      puck.velocity = vec2.create(0, 0);
      puck.angularVelocity = 0;
    }
    
    // Aplicar efecto Magnus (spin)
    if (Math.abs(puck.spin) > 0.01 && speed > 0.1) {
      const perpendicular = vec2.create(-puck.velocity.z, puck.velocity.x);
      const magnusForce = vec2.multiply(
        vec2.normalize(perpendicular), 
        puck.spin * MAGNUS_COEFFICIENT * speed * deltaTime
      );
      puck.velocity = vec2.add(puck.velocity, magnusForce);
    }
  }
  
  private integrateVerlet(puck: PuckPhysics, deltaTime: number): void {
    // Integración de Verlet para mayor estabilidad
    // x(t+dt) = x(t) + v(t)*dt
    const displacement = vec2.multiply(puck.velocity, deltaTime);
    puck.position = vec2.add(puck.position, displacement);
  }
  
  private checkPaddleCollision(puck: PuckPhysics, paddle: PaddlePhysics): CollisionInfo {
    const distance = vec2.distance(puck.position, paddle.position);
    const combinedRadius = puck.radius + paddle.radius;
    
    if (distance < combinedRadius && distance > 0) {
      const normal = vec2.normalize(vec2.subtract(puck.position, paddle.position));
      const penetration = combinedRadius - distance;
      const relativeVelocity = vec2.subtract(puck.velocity, paddle.playerVelocity);
      
      return {
        occurred: true,
        point: vec2.add(paddle.position, vec2.multiply(normal, paddle.radius)),
        normal,
        penetration,
        relativeVelocity,
        impulse: vec2.create(0, 0), // Se calculará en la resolución
        force: 0
      };
    }
    
    return {
      occurred: false,
      point: vec2.create(0, 0),
      normal: vec2.create(0, 0),
      penetration: 0,
      relativeVelocity: vec2.create(0, 0),
      impulse: vec2.create(0, 0),
      force: 0
    };
  }
  
  private resolvePaddleCollision(puck: PuckPhysics, paddle: PaddlePhysics, collision: CollisionInfo): void {
    // Separar objetos para evitar superposición
    const separationDistance = collision.penetration + COLLISION_SEPARATION;
    const separation = vec2.multiply(collision.normal, separationDistance);
    puck.position = vec2.add(puck.position, separation);
    
    // Calcular velocidad relativa a lo largo de la normal de colisión
    const relativeVelocity = vec2.subtract(puck.velocity, paddle.playerVelocity);
    const velocityAlongNormal = vec2.dot(relativeVelocity, collision.normal);
    
    // No resolver si los objetos se están separando
    if (velocityAlongNormal > 0) return;
    
    // Calcular coeficiente de restitución combinado
    const restitution = Math.sqrt(puck.restitution * paddle.restitution) * PADDLE_BOUNCE_FACTOR;
    
    // Calcular magnitud del impulso
    const impulseMagnitude = -(1 + restitution) * velocityAlongNormal;
    
    // Masa efectiva (paddle es infinitamente masivo comparado con el puck)
    const totalInverseMass = 1 / puck.mass; // Paddle tiene masa infinita
    const impulse = vec2.multiply(collision.normal, impulseMagnitude / totalInverseMass);
    
    // Aplicar impulso al puck
    puck.velocity = vec2.add(puck.velocity, vec2.multiply(impulse, 1 / puck.mass));
    
    // Transferir algo de momentum del paddle al puck
    const paddleInfluence = 0.3; // Factor de influencia del paddle
    const paddleContribution = vec2.multiply(paddle.playerVelocity, paddleInfluence);
    puck.velocity = vec2.add(puck.velocity, paddleContribution);
    
    // Añadir spin basado en el punto de impacto y velocidad del paddle
    const impactOffset = vec2.subtract(collision.point, paddle.position);
    const tangentialVelocity = vec2.dot(paddle.playerVelocity, vec2.create(-collision.normal.z, collision.normal.x));
    puck.spin += tangentialVelocity * 0.1;
    puck.angularVelocity += vec2.length(impactOffset) * tangentialVelocity * 0.05;
    
    // Guardar información de colisión
    collision.impulse = impulse;
    collision.force = vec2.length(impulse);
    puck.lastCollisionTime = Date.now();
    puck.lastCollisionForce = collision.force;
  }
  
  private checkWallCollisions(puck: PuckPhysics): CollisionInfo {
    for (const wall of this.walls) {
      // Calcular distancia del puck a la pared
      const distanceToWall = Math.abs(vec2.dot(puck.position, wall.normal)) - wall.distance;
      
      if (distanceToWall > -puck.radius) {
        const penetration = puck.radius - distanceToWall;
        
        if (penetration > 0) {
          return {
            occurred: true,
            point: vec2.subtract(puck.position, vec2.multiply(wall.normal, puck.radius)),
            normal: vec2.copy(wall.normal),
            penetration,
            relativeVelocity: vec2.copy(puck.velocity),
            impulse: vec2.create(0, 0),
            force: 0
          };
        }
      }
    }
    
    return {
      occurred: false,
      point: vec2.create(0, 0),
      normal: vec2.create(0, 0),
      penetration: 0,
      relativeVelocity: vec2.create(0, 0),
      impulse: vec2.create(0, 0),
      force: 0
    };
  }
  
  private resolveWallCollision(puck: PuckPhysics, collision: CollisionInfo): void {
    // Separar el puck de la pared
    const separation = vec2.multiply(collision.normal, collision.penetration + COLLISION_SEPARATION);
    puck.position = vec2.add(puck.position, separation);
    
    // Reflejar velocidad
    const velocityAlongNormal = vec2.dot(puck.velocity, collision.normal);
    
    if (velocityAlongNormal < 0) {
      const reflection = vec2.multiply(collision.normal, 2 * velocityAlongNormal);
      puck.velocity = vec2.subtract(puck.velocity, reflection);
      
      // Aplicar pérdida de energía basada en el coeficiente de restitución de pared
      puck.velocity = vec2.multiply(puck.velocity, RESTITUTION_WALL);
      
      // Reducir spin en rebotes de pared
      puck.spin *= 0.7;
      puck.angularVelocity *= 0.8;
      
      // Guardar información de colisión
      collision.force = Math.abs(velocityAlongNormal);
      puck.lastCollisionTime = Date.now();
      puck.lastCollisionForce = collision.force;
    }
  }
  
  private applyVelocityLimits(puck: PuckPhysics): void {
    const speed = vec2.length(puck.velocity);
    
    if (speed > MAX_PUCK_SPEED) {
      puck.velocity = vec2.multiply(vec2.normalize(puck.velocity), MAX_PUCK_SPEED);
    }
    
    // Limitar velocidad angular
    puck.angularVelocity = mathUtils.clamp(puck.angularVelocity, -MAX_ANGULAR_VELOCITY, MAX_ANGULAR_VELOCITY);
    
    // Limitar spin
    puck.spin = mathUtils.clamp(puck.spin, -MAX_SPIN, MAX_SPIN);
  }
  
  private interpolatePosition(): void {
    // Para rendering suave, podríamos interpolar entre la posición actual y la predicha
    // Por ahora, mantener la posición física exacta
  }
  
  // Métodos utilitarios públicos
  public createPuck(position: Vector2): PuckPhysics {
    return {
      position: vec2.copy(position),
      velocity: vec2.create(0, 0),
      mass: PUCK_MASS,
      radius: PUCK_RADIUS,
      restitution: RESTITUTION_PUCK,
      friction: PUCK_FRICTION,
      isStatic: false,
      angularVelocity: 0,
      spin: 0,
      lastCollisionTime: 0,
      lastCollisionForce: 0
    };
  }
  
  public createPaddle(position: Vector2): PaddlePhysics {
    return {
      position: vec2.copy(position),
      velocity: vec2.create(0, 0),
      mass: PADDLE_MASS,
      radius: PADDLE_RADIUS,
      restitution: RESTITUTION_PADDLE,
      friction: 0.1,
      isStatic: true,
      lastPosition: vec2.copy(position),
      playerVelocity: vec2.create(0, 0)
    };
  }
  
  public applyImpulse(puck: PuckPhysics, impulse: Vector2): void {
    if (!puck.isStatic) {
      const acceleration = vec2.multiply(impulse, 1 / puck.mass);
      puck.velocity = vec2.add(puck.velocity, acceleration);
    }
  }
  
  // Predicción de trayectoria para IA o UI
  public predictTrajectory(puck: PuckPhysics, steps: number = 60): Vector2[] {
    const trajectory: Vector2[] = [];
    
    // Crear copia temporal para simulación
    const tempPuck: PuckPhysics = {
      ...puck,
      position: vec2.copy(puck.position),
      velocity: vec2.copy(puck.velocity)
    };
    
    for (let i = 0; i < steps; i++) {
      // Simular un paso de física
      this.applyForces(tempPuck, this.fixedTimeStep);
      this.integrateVerlet(tempPuck, this.fixedTimeStep);
      
      // Verificar colisiones con paredes
      const wallCollision = this.checkWallCollisions(tempPuck);
      if (wallCollision.occurred) {
        this.resolveWallCollision(tempPuck, wallCollision);
      }
      
      trajectory.push(vec2.copy(tempPuck.position));
      
      // Parar si la velocidad es muy baja
      if (vec2.length(tempPuck.velocity) < MIN_SPEED_THRESHOLD) break;
    }
    
    return trajectory;
  }
}