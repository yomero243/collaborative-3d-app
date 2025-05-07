// src/types.ts
export interface GameObjectPosition {
  x: number;
  y: number;
  z: number;
}

export interface UserData {
  id: string;
  name: string;
  color: string;
  position: GameObjectPosition;
  score: number;
}

export interface PuckData {
  position: GameObjectPosition;
  velocity: { x: number; z: number };
} 