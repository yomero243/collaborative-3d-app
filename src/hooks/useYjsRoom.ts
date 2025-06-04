import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { UserData } from './collabTypes';

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

export interface YjsRoom {
  userId: string;
  yDoc: Y.Doc | undefined;
  usersMap: Y.Map<UserData> | undefined;
  puckMap: Y.Map<unknown> | undefined;
  isConnected: boolean;
  isInitialUserSet: boolean;
}

export function useYjsRoom(roomName: string, serverUrl: string): YjsRoom {
  const userId = useRef(getUserId()).current;
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialUserSet, setIsInitialUserSet] = useState(false);

  const ydocRef = useRef<Y.Doc>();
  const providerRef = useRef<WebsocketProvider>();
  const usersMapRef = useRef<Y.Map<UserData>>();
  const puckMapRef = useRef<Y.Map<unknown>>();
  const hasLoggedErrorRef = useRef(false);

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
        x: (Math.random() - 0.5) * 5,
        y: -3 + PuckConstants.PADDLE_RADIUS + 0.5,
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

    return () => {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
      }
      if (usersMapRef.current) {
        usersMapRef.current.delete(userId);
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

  return {
    userId,
    yDoc: ydocRef.current,
    usersMap: usersMapRef.current,
    puckMap: puckMapRef.current,
    isConnected,
    isInitialUserSet,
  };
}

// Constants used for puck physics setup
export const PuckConstants = {
  PUCK_RADIUS: 0.25,
  PADDLE_RADIUS: 0.5,
};
