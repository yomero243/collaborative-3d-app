import * as Y from 'yjs';
import { PuckData, UserData } from '../types';
import {
  TABLE_WIDTH,
  TABLE_HEIGHT,
  TABLE_DEPTH,
  PADDLE_RADIUS,
  PUCK_RADIUS,
  PUCK_FRICTION,
  WALL_BOUNCE_FACTOR,
  MIN_SPEED_THRESHOLD as MINIMUM_PUCK_SPEED,
  PADDLE_BOUNCE_FACTOR as PADDLE_BOUNCINESS,
} from '../utils/physicsConstants';

export const PUCK_HEIGHT = TABLE_HEIGHT / 2 + PUCK_RADIUS;

/**
 * Aplica un impulso al puck, actualizando su posición y velocidad.
 * Esta función también maneja las colisiones con las paredes.
 */
export const applyPuckImpulse = (
  puck: PuckData, // Puck actual
  impulseX: number,
  impulseZ: number,
  sharedPuckRef: Y.Map<unknown>, // Referencia al Y.Map del puck
  ydoc: Y.Doc, // Documento Yjs para transacciones
  position?: { x: number, y: number, z: number } // Posición opcional para corregir
): PuckData => {
  // Lógica de applyImpulseToPuck original, adaptada
  const currentPos = { ...puck.position };
  let currentImpulseX = impulseX;
  let currentImpulseZ = impulseZ;

  // Si se proporciona una posición corregida, la usamos
  let newPosX = position ? position.x : currentPos.x + currentImpulseX;
  let newPosZ = position ? position.z : currentPos.z + currentImpulseZ;

  // Si no hay posición corregida, aplicamos el impulso normal
  if (!position) {
    newPosX = currentPos.x + currentImpulseX;
    newPosZ = currentPos.z + currentImpulseZ;
  }

  // Colisiones con paredes y rebote
  if (newPosX > TABLE_WIDTH / 2 - PUCK_RADIUS) {
    newPosX = TABLE_WIDTH / 2 - PUCK_RADIUS;
    currentImpulseX *= -WALL_BOUNCE_FACTOR;
  } else if (newPosX < -TABLE_WIDTH / 2 + PUCK_RADIUS) {
    newPosX = -TABLE_WIDTH / 2 + PUCK_RADIUS;
    currentImpulseX *= -WALL_BOUNCE_FACTOR;
  }

  if (newPosZ > TABLE_DEPTH / 2 - PUCK_RADIUS) {
    newPosZ = TABLE_DEPTH / 2 - PUCK_RADIUS;
    currentImpulseZ *= -WALL_BOUNCE_FACTOR;
  } else if (newPosZ < -TABLE_DEPTH / 2 + PUCK_RADIUS) {
    newPosZ = -TABLE_DEPTH / 2 + PUCK_RADIUS;
    currentImpulseZ *= -WALL_BOUNCE_FACTOR;
  }

  const newPosition = { x: newPosX, y: puck.position.y, z: newPosZ };
  const newVelocity = { x: currentImpulseX, z: currentImpulseZ };

  const updatedPuck = {
    position: newPosition,
    velocity: newVelocity,
  };

  const posMap = sharedPuckRef.get('position');
  const velMap = sharedPuckRef.get('velocity');

  if (posMap instanceof Y.Map && velMap instanceof Y.Map) {
    ydoc.transact(() => {
      posMap.set('x', newPosition.x);
      posMap.set('y', newPosition.y);
      posMap.set('z', newPosition.z);
      velMap.set('x', newVelocity.x);
      velMap.set('z', newVelocity.z);
    });
  }
  return updatedPuck;
};

/**
 * Calcula la física del puck, incluyendo fricción y colisiones con paddles.
 * Devuelve el nuevo estado del puck si ha cambiado, o null si no.
 */
export const calculatePuckPhysicsUpdate = (
  puck: PuckData, // Puck actual
  users: Map<string, UserData>, // Usuarios actuales
  sharedPuckRef: Y.Map<unknown>, // Referencia al Y.Map del puck
  sharedUsersRef: Y.Map<unknown>, // Referencia al Y.Map de usuarios
  ydoc: Y.Doc // Documento Yjs para transacciones
): PuckData | null => {
  // Lógica de updatePuckPhysicsInternal original, adaptada
  // Esta función llamará a applyPuckImpulse internamente si es necesario

  const puckPosMap = sharedPuckRef.get('position');
  const puckVelMap = sharedPuckRef.get('velocity');

  if (!(puckPosMap instanceof Y.Map) || !(puckVelMap instanceof Y.Map)) {
    return null;
  }

  let currentPuckVelX = puckVelMap.get('x') as number || 0;
  let currentPuckVelZ = puckVelMap.get('z') as number || 0;
  const currentPuckPosX = puckPosMap.get('x') as number || 0;
  const currentPuckPosY = puckPosMap.get('y') as number || PUCK_HEIGHT;
  const currentPuckPosZ = puckPosMap.get('z') as number || 0;

  let puckSpeedChangedByFriction = false;

  // 1. Aplicar Fricción
  if (Math.abs(currentPuckVelX) > 0 || Math.abs(currentPuckVelZ) > 0) {
    currentPuckVelX *= PUCK_FRICTION;
    currentPuckVelZ *= PUCK_FRICTION;

    const speed = Math.sqrt(currentPuckVelX * currentPuckVelX + currentPuckVelZ * currentPuckVelZ);
    if (speed < MINIMUM_PUCK_SPEED) {
      currentPuckVelX = 0;
      currentPuckVelZ = 0;
    }
    puckSpeedChangedByFriction = true;
  }

  let nextPuckPosX = currentPuckPosX + currentPuckVelX;
  let nextPuckPosZ = currentPuckPosZ + currentPuckVelZ;

  if (nextPuckPosX > TABLE_WIDTH / 2 - PUCK_RADIUS) { nextPuckPosX = TABLE_WIDTH / 2 - PUCK_RADIUS; currentPuckVelX = 0;}
  else if (nextPuckPosX < -TABLE_WIDTH / 2 + PUCK_RADIUS) { nextPuckPosX = -TABLE_WIDTH / 2 + PUCK_RADIUS; currentPuckVelX = 0; }
  if (nextPuckPosZ > TABLE_DEPTH / 2 - PUCK_RADIUS) { nextPuckPosZ = TABLE_DEPTH / 2 - PUCK_RADIUS; currentPuckVelZ = 0; }
  else if (nextPuckPosZ < -TABLE_DEPTH / 2 + PUCK_RADIUS) { nextPuckPosZ = -TABLE_DEPTH / 2 + PUCK_RADIUS; currentPuckVelZ = 0; }
  
  let paddleCollisionOccurred = false;
  users.forEach((user) => {
    if (paddleCollisionOccurred) return;

    const dx = nextPuckPosX - user.position.x;
    const dz = nextPuckPosZ - user.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    const paddleHitboxMultiplier = 1.15; 
    // Combined radius ahora es la suma exacta de los radios de los hitboxes visuales
    const combinedRadius = PUCK_RADIUS + (PADDLE_RADIUS * paddleHitboxMultiplier);
    
    // Condición de colisión simplificada
    if (distance < combinedRadius) {
      paddleCollisionOccurred = true;
      
      // Cálculo de la normal simplificado y cambiado a const
      const nx = dx / Math.max(distance, 0.001);
      const nz = dz / Math.max(distance, 0.001);
      
      const dotProduct = currentPuckVelX * nx + currentPuckVelZ * nz;
      let impulseX = (currentPuckVelX - 2 * dotProduct * nx) * PADDLE_BOUNCINESS;
      let impulseZ = (currentPuckVelZ - 2 * dotProduct * nz) * PADDLE_BOUNCINESS;
      const impactoAdicional = 5.0; 
      const velocidadMinima = 0.5; 
      impulseX += nx * impactoAdicional;
      impulseZ += nz * impactoAdicional;
      const magnitudActual = Math.sqrt(impulseX * impulseX + impulseZ * impulseZ);
      if (magnitudActual < velocidadMinima && magnitudActual > 0.001) {
        const factor = velocidadMinima / magnitudActual;
        impulseX *= factor;
        impulseZ *= factor;
      } else if (magnitudActual <= 0.001) {
        impulseX = nx * velocidadMinima;
        impulseZ = nz * velocidadMinima;
      }
      const minSeparationImpulseBase = 0.15;
      if (dotProduct >= -0.05) { 
          if (dotProduct < 0) { 
            const reflectionMagnitude = Math.sqrt(impulseX*impulseX + impulseZ*impulseZ);
            if (reflectionMagnitude < minSeparationImpulseBase * PADDLE_BOUNCINESS * 0.5) {
              impulseX = nx * minSeparationImpulseBase * PADDLE_BOUNCINESS;
              impulseZ = nz * minSeparationImpulseBase * PADDLE_BOUNCINESS;
            }
          } else { 
            impulseX = nx * minSeparationImpulseBase * PADDLE_BOUNCINESS;
            impulseZ = nz * minSeparationImpulseBase * PADDLE_BOUNCINESS;
          }
      }
      const maxImpulse = 12.0;
      let currentImpulseMagnitude = Math.sqrt(impulseX * impulseX + impulseZ * impulseZ);
      if (currentImpulseMagnitude > maxImpulse) {
        const scale = maxImpulse / currentImpulseMagnitude;
        impulseX *= scale;
        impulseZ *= scale;
        currentImpulseMagnitude = maxImpulse;
      }
      const minEffectiveImpulse = 0.05;
      if (currentImpulseMagnitude < minEffectiveImpulse && currentImpulseMagnitude > 1e-5) {
          const scaleFactor = minEffectiveImpulse / currentImpulseMagnitude;
          impulseX *= scaleFactor;
          impulseZ *= scaleFactor;
      } else if (currentImpulseMagnitude <= 1e-5 && distance < (PUCK_RADIUS + (PADDLE_RADIUS * paddleHitboxMultiplier)) - 0.01) {
          impulseX = nx * minSeparationImpulseBase * PADDLE_BOUNCINESS * 0.5;
          impulseZ = nz * minSeparationImpulseBase * PADDLE_BOUNCINESS * 0.5;
      }

      // Asegurar separación mínima para evitar atravesar el paddle
      // Condición y requiredDistance ajustadas para usar paddleHitboxMultiplier
      if (distance < PUCK_RADIUS + (PADDLE_RADIUS * paddleHitboxMultiplier)) {
        const requiredDistance = PUCK_RADIUS + (PADDLE_RADIUS * paddleHitboxMultiplier) + 0.01; // Pequeño margen para empujar hacia afuera
        const separationX = user.position.x + nx * requiredDistance;
        const separationZ = user.position.z + nz * requiredDistance;
        return applyPuckImpulse(
          puck, 
          impulseX, 
          impulseZ, 
          sharedPuckRef, 
          ydoc,
          { x: separationX, y: puck.position.y, z: separationZ }
        );
      }
      
      return applyPuckImpulse(puck, impulseX, impulseZ, sharedPuckRef, ydoc);
    }
  });

  if (paddleCollisionOccurred) {
    return null; 
  }

  if (!paddleCollisionOccurred && puckSpeedChangedByFriction) {
    const newPuckState = {
      position: { x: nextPuckPosX, y: currentPuckPosY, z: nextPuckPosZ },
      velocity: { x: currentPuckVelX, z: currentPuckVelZ }
    };
    ydoc.transact(() => {
      puckPosMap.set('x', nextPuckPosX);
      puckPosMap.set('y', currentPuckPosY);
      puckPosMap.set('z', nextPuckPosZ);
      puckVelMap.set('x', currentPuckVelX);
      puckVelMap.set('z', currentPuckVelZ);
    });
    return newPuckState;
  }
  
  return null; 
}; 