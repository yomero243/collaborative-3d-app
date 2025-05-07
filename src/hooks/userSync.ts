import * as Y from 'yjs';
import { UserData, GameObjectPosition } from '../types';
import { generateRandomColor } from '../utils/colors';
import { TABLE_WIDTH, TABLE_DEPTH, PADDLE_RADIUS, TABLE_HEIGHT } from './puckPhysics'; // Constantes de dimensiones

const USER_ID_KEY = 'collaborativeAppUserId';

const getPersistentUserId = (): string => {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    // Genera un ID más único combinando aleatoriedad y timestamp
    userId = `user_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
};

/**
 * Inicializa un nuevo usuario si no existe en el mapa compartido, o carga el existente.
 * Necesita ydoc para realizar transacciones.
 */
export const initializeNewUser = (
  ydoc: Y.Doc, // ydoc es necesario para transacciones
  sharedUsersRef: Y.Map<unknown>,
  setCurrentUser: (user: UserData) => void
): UserData | null => {
  const userId = getPersistentUserId();

  const existingUserMap = sharedUsersRef.get(userId) as Y.Map<unknown> | undefined;

  if (existingUserMap) {
    const posMap = existingUserMap.get('position') as Y.Map<number> | undefined;
    const name = existingUserMap.get('name') as string || `Jugador-${userId.substring(5, 9)}`;
    // Si el nombre en localStorage es más reciente o diferente, se podría dar prioridad
    // pero por ahora, tomamos el de Yjs si existe.
    const color = existingUserMap.get('color') as string || generateRandomColor();
    
    const userData: UserData = {
      id: userId,
      name: name,
      color: color,
      position: {
        x: posMap?.get('x') ?? (Math.random() - 0.5) * TABLE_WIDTH * 0.8, // Posición inicial si no existe
        y: posMap?.get('y') ?? (PADDLE_RADIUS + TABLE_HEIGHT / 2),
        z: posMap?.get('z') ?? (Math.random() - 0.5) * TABLE_DEPTH * 0.8,
      },
      score: existingUserMap.get('score') as number || 0,
    };
    // Actualizar localStorage con el nombre de Yjs si es diferente y existe
    if (localStorage.getItem('userName') !== name) {
        localStorage.setItem('userName', name);
    }
    setCurrentUser(userData);
    return userData;
  } else {
    // Usuario no existe en Yjs, crearlo
    const savedName = localStorage.getItem('userName') || `Jugador-${userId.substring(5, 9)}`;
    const color = generateRandomColor();
    const initialX = (Math.random() - 0.5) * TABLE_WIDTH * 0.8;
    const initialZ = (Math.random() - 0.5) * TABLE_DEPTH * 0.8;
    const initialY = PADDLE_RADIUS + TABLE_HEIGHT / 2;

    const posMapY = new Y.Map<number>();
    posMapY.set('x', initialX);
    posMapY.set('y', initialY);
    posMapY.set('z', initialZ);

    const newUserMap = new Y.Map<unknown>();
    newUserMap.set('name', savedName);
    newUserMap.set('color', color);
    newUserMap.set('position', posMapY);
    newUserMap.set('score', 0);

    ydoc.transact(() => {
      sharedUsersRef.set(userId, newUserMap);
    });

    const newUserData: UserData = {
      id: userId, name: savedName, color: color,
      position: { x: initialX, y: initialY, z: initialZ }, score: 0,
    };
    setCurrentUser(newUserData);
    // Guardar el nombre en localStorage si es la primera vez o si es diferente
    if (localStorage.getItem('userName') !== savedName) {
        localStorage.setItem('userName', savedName);
    }
    return newUserData;
  }
};

/**
 * Actualiza la posición del usuario en el estado local y en Yjs.
 */
export const syncUserPosition = (
  currentUser: UserData,
  newPosition: GameObjectPosition,
  sharedUsersRef: Y.Map<unknown>,
  ydoc: Y.Doc
): UserData => {
  const clampedX = Math.max(-TABLE_WIDTH / 2 + PADDLE_RADIUS, Math.min(TABLE_WIDTH / 2 - PADDLE_RADIUS, newPosition.x));
  const clampedZ = Math.max(-TABLE_DEPTH / 2 + PADDLE_RADIUS, Math.min(TABLE_DEPTH / 2 - PADDLE_RADIUS, newPosition.z));

  const finalPosition = {
    x: clampedX,
    y: currentUser.position.y, // Mantener la altura Y actual del paddle
    z: clampedZ,
  };

  const updatedUser: UserData = {
    ...currentUser,
    position: finalPosition,
  };

  const userMap = sharedUsersRef.get(currentUser.id);
  if (userMap instanceof Y.Map) {
    const posMap = userMap.get('position');
    if (posMap instanceof Y.Map) {
      ydoc.transact(() => {
        posMap.set('x', finalPosition.x);
        posMap.set('y', finalPosition.y);
        posMap.set('z', finalPosition.z);
      });
    } else {
      console.error("[userSync] syncUserPosition - Yjs posMap no encontrado para el usuario.");
    }
  } else {
    console.error("[userSync] syncUserPosition - Yjs userMap no encontrado para el usuario.");
  }
  return updatedUser;
};

/**
 * Actualiza el nombre del usuario en localStorage, estado local y Yjs.
 */
export const syncUserName = (
  currentUser: UserData,
  name: string,
  sharedUsersRef: Y.Map<unknown>
): UserData => {
  localStorage.setItem('userName', name);

  const updatedUser = {
    ...currentUser,
    name,
  };

  const userMap = sharedUsersRef.get(currentUser.id);
  if (userMap instanceof Y.Map) {
    userMap.set('name', name);
  }
  return updatedUser;
}; 