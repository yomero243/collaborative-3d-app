import { useSyncExternalStore, useEffect, useRef, useCallback, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const PUCK_RADIUS = 0.25;
const PADDLE_RADIUS = 0.5;
const PUCK_FRICTION = 0.995;
const WALL_BOUNCE_FACTOR = 0.85;
const MIN_SPEED_THRESHOLD = 0.005;
const PADDLE_BOUNCE_FACTOR = 1.2;
const MAX_PUCK_SPEED = 15.0;
const MIN_PUCK_SPEED = 0.1;

const TABLE_MIN_X = -5;
const TABLE_MAX_X = 5;
const TABLE_MIN_Y = -3;
const TABLE_MAX_Y = 3;

const USER_ID_KEY = 'collab3d-userId';
const JWT_TOKEN_KEY = 'authToken';

function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

function getAuthToken(): string | null {
  return localStorage.getItem(JWT_TOKEN_KEY);
}

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

function useYMapValuesAsArray<T>(yMap: Y.Map<T> | undefined): T[] {
  const lastSnapshotRef = useRef<T[]>([]);
  const lastSnapshotStringRef = useRef<string>("[]");

  const getSnapshot = useCallback(() => {
    if (!yMap) return lastSnapshotRef.current;
    
    const newSnapshot = Array.from(yMap.values()) as T[];
    
    let newSnapshotString;
    try {
      newSnapshotString = JSON.stringify(newSnapshot);
    } catch {
      newSnapshotString = "[]";
    }

    if (newSnapshotString !== lastSnapshotStringRef.current) {
      lastSnapshotRef.current = newSnapshot;
      lastSnapshotStringRef.current = newSnapshotString;
    }
    
    return lastSnapshotRef.current;

  }, [yMap]);
  
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (!yMap) return () => {};
    const handler = () => onStoreChange();
    yMap.observe(handler);
    return () => yMap.unobserve(handler);
  }, [yMap]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useYMapEntry<T>(yMap: Y.Map<unknown> | undefined, entryKey: string): T | null {
  const lastValueRef = useRef<T | null>(null);
  
  const getSnapshot = useCallback(() => {
    if (!yMap) return lastValueRef.current;
    
    const newValue = (yMap.get(entryKey) as T) || null;
    
    if (newValue !== lastValueRef.current) {
      lastValueRef.current = newValue;
    }
    
    return lastValueRef.current;
  }, [yMap, entryKey]);

  const subscribe = useCallback((onStoreChange: () => void) => {
    if (!yMap) return () => {};
    const handler = (event: Y.YMapEvent<unknown>) => {
      if (event.keysChanged.has(entryKey)) onStoreChange();
    };
    yMap.observe(handler);
    return () => yMap.unobserve(handler);
  }, [yMap, entryKey]);
  
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useCollaborativeState(
  roomName: string = "default-room",
  serverUrl: string = "ws://localhost:1234"
): {
  users: UserData[];
  puck: PuckState | null;
  userId: string;
  yDoc: Y.Doc | undefined;
  updateCurrentUserPosition: (pos: { x: number; y: number }) => void;
  applyImpulseToPuck: (vx: number, vy: number) => void;
  updateUserName: (name: string) => void;
  isConnected: boolean;
} {
  const userId = useRef(getUserId()).current;
  const [isConnected, setIsConnected] = useState(false);
  
  const ydocRef = useRef<Y.Doc>();
  const providerRef = useRef<WebsocketProvider>();
  const usersMapRef = useRef<Y.Map<UserData>>();
  const puckMapRef = useRef<Y.Map<unknown>>();
  const physicsIntervalRef = useRef<number | null>(null);
  const hasLoggedErrorRef = useRef(false);
  const [isInitialUserSet, setIsInitialUserSet] = useState(false);
  const [amIActuallyHost, setAmIActuallyHost] = useState(false);
  const wakePhysicsRef = useRef<() => void>(() => {});

  const positionUpdateTimeoutRef = useRef<number | null>(null);
  const latestPositionToSendRef = useRef<UserData | null>(null);
  const POSITION_UPDATE_INTERVAL = 50;

  useEffect(() => {
    let cleanupInterval: number | null = null;
  
    try {
      if (!roomName || typeof roomName !== 'string') {
        throw new Error(`roomName debe ser un string válido, recibido: ${roomName}`);
      }
      if (!serverUrl || typeof serverUrl !== 'string') {
        throw new Error(`serverUrl debe ser un string válido, recibido: ${serverUrl}`);
      }
      
      const doc = new Y.Doc();
      ydocRef.current = doc;
      
      usersMapRef.current = doc.getMap<UserData>('users');
      puckMapRef.current = doc.getMap('puck') as Y.Map<unknown>; 

      const token = getAuthToken();

      try {
        const provider = new WebsocketProvider(
          serverUrl,
          roomName,
          doc,
          token ? { params: { token } } : undefined
        );
        
        providerRef.current = provider;
        
        provider.on('status', ({ status }: { status: 'connected' | 'disconnected' }) => {
          setIsConnected(status === 'connected');
          
          if (status === 'connected' && usersMapRef.current) {
            const currentUserData = usersMapRef.current.get(userId);
            if (currentUserData) {
              usersMapRef.current.set(userId, currentUserData);
            }
          }
        });

        cleanupInterval = setInterval(() => {
          if (usersMapRef.current && provider.wsconnected) {
            const now = Date.now();
            const users = Array.from(usersMapRef.current.values());
            users.forEach(user => {
              if (user.lastUpdate && now - user.lastUpdate > 10000) {
                usersMapRef.current?.delete(user.id);
              }
            });
          }
        }, 5000);
        
        provider.on('connection-error', (event: Error) => {
          console.error('Error de conexión:', event);
          setIsConnected(false);
        });

        const initialUserData: UserData = { 
          id: userId, 
          x: (Math.random() - 0.5) * TABLE_MAX_X,
          y: TABLE_MIN_Y + PADDLE_RADIUS + 0.5,
          color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`,
          userName: localStorage.getItem('userName') || 'Player',
          lastUpdate: Date.now()
        };

        if (usersMapRef.current) {
          usersMapRef.current.set(userId, initialUserData);
          setIsInitialUserSet(true);
        }
        
        if (puckMapRef.current && puckMapRef.current.get('state') === undefined) {
          puckMapRef.current.set('state', { x: 0, y: 0, vx: 0, vy: 0 });
        }
        
      } catch (error) { 
        console.error('Error al configurar el proveedor:', error);
        if (!hasLoggedErrorRef.current) {
          hasLoggedErrorRef.current = true;
        }
      }
    } catch (error) { 
      console.error('Error en la configuración inicial:', error);
      if (!hasLoggedErrorRef.current) {
        hasLoggedErrorRef.current = true;
      }
    }
  
    return () => {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
      }
      if (usersMapRef.current) {
        usersMapRef.current.delete(userId);
      }
      if (physicsIntervalRef.current) {
        clearInterval(physicsIntervalRef.current);
        physicsIntervalRef.current = null;
      }
      if (providerRef.current) {
        providerRef.current.disconnect();
        providerRef.current.destroy();
        providerRef.current = undefined;
      }
      if (ydocRef.current) {
        usersMapRef.current = undefined;
        puckMapRef.current = undefined;
        
        ydocRef.current.destroy();
        ydocRef.current = undefined;
      }
      
      hasLoggedErrorRef.current = false;
      setIsInitialUserSet(false);
    };
  }, [roomName, serverUrl, userId]);

  const users = useYMapValuesAsArray<UserData>(usersMapRef.current);
  const puck = useYMapEntry<PuckState>(puckMapRef.current, 'state');

  useEffect(() => {
    if (!isInitialUserSet) {
      setAmIActuallyHost(false);
      return;
    }
    
    let newAmIHost = false;
    if (users.length > 0) {
      const sortedUsers = [...users].sort((a, b) => a.id.localeCompare(b.id));
      if (sortedUsers[0].id === userId) {
        newAmIHost = true;
      }
    }
    if (users.length === 1 && users[0].id === userId) {
      newAmIHost = true;
    }

    setAmIActuallyHost(newAmIHost);
  }, [users, userId, isInitialUserSet, amIActuallyHost]);

  useEffect(() => {
    if (physicsIntervalRef.current) {
      clearInterval(physicsIntervalRef.current);
      physicsIntervalRef.current = null;
    }

    if (!isInitialUserSet || !amIActuallyHost) {
      return;
    }

    if (!puckMapRef.current || !usersMapRef.current) {
      return;
    }

    const currentPuckMap = puckMapRef.current;
    
    const puckCache = { x: 0, y: 0, vx: 0, vy: 0 };
    
    let isSleeping = true;
    let sleepCheckTimeoutId: ReturnType<typeof setTimeout> | null = null;
    
    let animationFrameId: number | null = null;
    let lastUpdateTime = 0;
    const TARGET_FPS = 60;
    const FRAME_MIN_TIME = (1000/TARGET_FPS);
    
    function scheduleWakeCheck() {
      if (sleepCheckTimeoutId) clearTimeout(sleepCheckTimeoutId);
      
      sleepCheckTimeoutId = setTimeout(() => {
        const currentPuck = currentPuckMap.get('state') as PuckState | undefined;
        if (currentPuck) {
          const sqSpeed = currentPuck.vx * currentPuck.vx + currentPuck.vy * currentPuck.vy;
          if (sqSpeed < MIN_SPEED_THRESHOLD * MIN_SPEED_THRESHOLD * 0.25) {
            if (animationFrameId !== null) {
              cancelAnimationFrame(animationFrameId);
              animationFrameId = null;
              isSleeping = true;
            }
          }
        }
      }, 100);
    }
    
    function wakePhysics() {
      if (isSleeping) {
        isSleeping = false;
        if (animationFrameId === null) {
          lastUpdateTime = performance.now();
          animationFrameId = requestAnimationFrame(updatePhysics);
        }
      }
      
      scheduleWakeCheck();
    }
    
    wakePhysicsRef.current = wakePhysics;
    
    function updatePhysics(currentTime: number) {
      const timeSinceLastUpdate = currentTime - lastUpdateTime;
      
      if (timeSinceLastUpdate >= FRAME_MIN_TIME) {
        lastUpdateTime = currentTime - (timeSinceLastUpdate % FRAME_MIN_TIME);
        
        const currentPuckState = currentPuckMap.get('state') as PuckState | undefined;
        if (!currentPuckState) {
          animationFrameId = requestAnimationFrame(updatePhysics);
          return;
        }
        
        let { x, y, vx, vy } = currentPuckState;
        
        const sqSpeed = vx * vx + vy * vy;
        const minSpeedSq = MIN_SPEED_THRESHOLD * MIN_SPEED_THRESHOLD;

        if (sqSpeed > minSpeedSq * 0.25) {
          const dt = FRAME_MIN_TIME / 1000;
          x += vx * dt;
          y += vy * dt;
          
          vx *= PUCK_FRICTION;
          vy *= PUCK_FRICTION;
          
          if (vx * vx + vy * vy < minSpeedSq) { 
            vx = 0;
            vy = 0;
          }
          
          const puckRadius = PUCK_RADIUS;
          if (x - puckRadius < TABLE_MIN_X) {
            x = TABLE_MIN_X + puckRadius;
            vx = -vx * WALL_BOUNCE_FACTOR;
          } else if (x + puckRadius > TABLE_MAX_X) {
            x = TABLE_MAX_X - puckRadius;
            vx = -vx * WALL_BOUNCE_FACTOR;
          }
          
          if (y - puckRadius < TABLE_MIN_Y) {
            y = TABLE_MIN_Y + puckRadius;
            vy = -vy * WALL_BOUNCE_FACTOR;
          } else if (y + puckRadius > TABLE_MAX_Y) {
            y = TABLE_MAX_Y - puckRadius;
            vy = -vy * WALL_BOUNCE_FACTOR;
          }
          
          const hasSignificantChanges = 
            Math.abs(x - currentPuckState.x) > 0.001 ||
            Math.abs(y - currentPuckState.y) > 0.001 || 
            Math.abs(vx - currentPuckState.vx) > 0.001 || 
            Math.abs(vy - currentPuckState.vy) > 0.001;
          
          if (hasSignificantChanges) {
            puckCache.x = x;
            puckCache.y = y;
            puckCache.vx = vx;
            puckCache.vy = vy;
            currentPuckMap.set('state', puckCache);
          }
        } else if (vx !== 0 || vy !== 0) {
          puckCache.x = x;
          puckCache.y = y;
          puckCache.vx = 0;
          puckCache.vy = 0;
          currentPuckMap.set('state', puckCache);
        } else {
          if (!isSleeping) {
            scheduleWakeCheck();
          }
        }
      }
      
      if (!isSleeping) {
        animationFrameId = requestAnimationFrame(updatePhysics);
      }
    }
    
    wakePhysics();
    
    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      
      if (sleepCheckTimeoutId) {
        clearTimeout(sleepCheckTimeoutId);
      }
    };
  }, [amIActuallyHost, isInitialUserSet]);

  const updateCurrentUserPosition = useCallback((pos: { x: number; y: number }) => {
    if (usersMapRef.current && userId) {
      const currentUserData = usersMapRef.current.get(userId);
      if (currentUserData) {
        if (Math.abs(currentUserData.x - pos.x) > 0.001 || Math.abs(currentUserData.y - pos.y) > 0.001) {
          latestPositionToSendRef.current = { 
            ...currentUserData, 
            x: pos.x, 
            y: pos.y,
            lastUpdate: Date.now() 
          };

          if (positionUpdateTimeoutRef.current) {
            clearTimeout(positionUpdateTimeoutRef.current);
          }

          positionUpdateTimeoutRef.current = setTimeout(() => {
            if (usersMapRef.current && userId && latestPositionToSendRef.current) {
              usersMapRef.current.set(userId, latestPositionToSendRef.current);
            }
            positionUpdateTimeoutRef.current = null;
          }, POSITION_UPDATE_INTERVAL);
        }
      }
    }
  }, [userId, POSITION_UPDATE_INTERVAL]);

  const applyImpulseToPuckOriginal = useCallback((impulseVx: number, impulseVy: number) => {
    if (puckMapRef.current) {
      const currentPuck = puckMapRef.current.get('state') as PuckState | undefined;
      if (currentPuck) {
        const currentSpeed = Math.sqrt(currentPuck.vx * currentPuck.vx + currentPuck.vy * currentPuck.vy);
        
        const impulseStrength = Math.sqrt(impulseVx * impulseVx + impulseVy * impulseVy);
        
        if (impulseStrength < MIN_PUCK_SPEED) {
          return;
        }

        const normalizedImpulseX = impulseVx / impulseStrength;
        const normalizedImpulseY = impulseVy / impulseStrength;

        let newImpulseX = impulseVx;
        let newImpulseY = impulseVy;

        if (currentSpeed > MIN_PUCK_SPEED) {
          const dotProduct = (currentPuck.vx * normalizedImpulseX + currentPuck.vy * normalizedImpulseY);
          
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
          lastHitBy: userId
        };

        puckMapRef.current.set('state', newPuckState);
        
        wakePhysicsRef.current();
      }
    }
  }, [userId]);

  const updateUserName = useCallback((name: string) => {
    if (usersMapRef.current && userId) {
      const currentUserData = usersMapRef.current.get(userId);
      if (currentUserData) {
        usersMapRef.current.set(userId, {
          ...currentUserData,
          userName: name,
          lastUpdate: Date.now()
        });
      }
    }
  }, [userId]);

  useEffect(() => {
    if (!amIActuallyHost || !isInitialUserSet) return;

    let lastPhysicsUpdate = Date.now();
    const physicsInterval = setInterval(() => {
      if (!puckMapRef.current) return;

      const currentPuck = puckMapRef.current.get('state') as PuckState | undefined;
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
        lastHitBy: currentPuck.lastHitBy
      };

      puckMapRef.current.set('state', newPuckState);
    }, 1000 / 60);

    return () => clearInterval(physicsInterval);
  }, [amIActuallyHost, isInitialUserSet]);

  return {
    users,
    puck,
    userId,
    yDoc: ydocRef.current,
    updateCurrentUserPosition,
    applyImpulseToPuck: applyImpulseToPuckOriginal,
    updateUserName,
    isConnected
  };
}