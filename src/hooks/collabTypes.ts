export interface UserData {
  id: string;
  x: number;
  y: number;
  color: string;
  userName: string;
  lastUpdate: number;
}

export interface PuckState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lastUpdate: number;
  lastHitBy?: string;
}
