import * as Y from 'yjs';
import { UserData, GameObjectPosition } from '../types';
import { generateRandomColor } from '../utils/colors';
import {
  TABLE_WIDTH,
  TABLE_DEPTH,
  PADDLE_RADIUS,
  TABLE_HEIGHT,
} from '../utils/physicsConstants'; // Constantes de dimensiones

const USER_ID_KEY = 'collaborativeAppUserId';

/**
 * PATRÓN SINGLETON - Gestión de ID único
 * 
 * Este patrón garantiza que cada usuario tenga un identificador único y persistente.
 * El ID se genera una sola vez y se almacena en localStorage para mantener la identidad
 * del usuario a través de sesiones y recargas de página.
 * 
 * Características del patrón:
 * - Una sola instancia del ID por usuario/navegador
 * - Persistencia a través de localStorage
 * - Generación lazy (solo cuando se necesita)
 */
const getPersistentUserId = (): string => {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    // Genera un ID más único combinando aleatoriedad y timestamp
    // PATRÓN BUILDER implícito: construye el ID paso a paso
    userId = `user_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
};

/**
 * PATRÓN FACTORY - Creación/Recuperación de Usuarios
 * 
 * Esta función encapsula la lógica compleja de creación de usuarios,
 * manejando tanto la inicialización de nuevos usuarios como la
 * recuperación de usuarios existentes del estado compartido.
 * 
 * Patrones implementados:
 * 1. FACTORY: Crea objetos UserData de manera consistente
 * 2. STRATEGY: Diferentes estrategias para usuario nuevo vs existente
 * 3. TEMPLATE METHOD: Estructura común con variaciones específicas
 * 
 * @param ydoc - Documento Yjs para transacciones atómicas
 * @param sharedUsersRef - Mapa compartido de usuarios (SHARED STATE PATTERN)
 * @param setCurrentUser - Callback para actualizar estado local (OBSERVER PATTERN)
 */
export const initializeNewUser = (
  ydoc: Y.Doc, // ydoc es necesario para transacciones
  sharedUsersRef: Y.Map<unknown>,
  setCurrentUser: (user: UserData) => void
): UserData | null => {
  const userId = getPersistentUserId(); // SINGLETON PATTERN

  const existingUserMap = sharedUsersRef.get(userId) as Y.Map<unknown> | undefined;

  if (existingUserMap) {
    // PATRÓN ADAPTER - Convierte datos de Yjs a UserData
    const posMap = existingUserMap.get('position') as Y.Map<number> | undefined;
    const name = existingUserMap.get('name') as string || `Jugador-${userId.substring(5, 9)}`;
    // Si el nombre en localStorage es más reciente o diferente, se podría dar prioridad
    // pero por ahora, tomamos el de Yjs si existe.
    const color = existingUserMap.get('color') as string || generateRandomColor();
    
    // PATRÓN BUILDER - Construye el objeto UserData paso a paso
    const userData: UserData = {
      id: userId,
      name: name,
      color: color,
      position: {
        // PATRÓN NULL OBJECT/DEFAULT VALUES - Proporciona valores por defecto
        x: posMap?.get('x') ?? (Math.random() - 0.5) * TABLE_WIDTH * 0.8, // Posición inicial si no existe
        y: posMap?.get('y') ?? (PADDLE_RADIUS + TABLE_HEIGHT / 2),
        z: posMap?.get('z') ?? (Math.random() - 0.5) * TABLE_DEPTH * 0.8,
      },
      score: existingUserMap.get('score') as number || 0,
    };
    
    // PATRÓN SYNCHRONIZER - Sincroniza datos entre localStorage y estado compartido
    if (localStorage.getItem('userName') !== name) {
        localStorage.setItem('userName', name);
    }
    setCurrentUser(userData);
    return userData;
  } else {
    // ESTRATEGIA PARA NUEVO USUARIO
    // Usuario no existe en Yjs, crearlo
    const savedName = localStorage.getItem('userName') || `Jugador-${userId.substring(5, 9)}`;
    const color = generateRandomColor();
    const initialX = (Math.random() - 0.5) * TABLE_WIDTH * 0.8;
    const initialZ = (Math.random() - 0.5) * TABLE_DEPTH * 0.8;
    const initialY = PADDLE_RADIUS + TABLE_HEIGHT / 2;

    // PATRÓN COMPOSITE - Estructura anidada de mapas
    const posMapY = new Y.Map<number>();
    posMapY.set('x', initialX);
    posMapY.set('y', initialY);
    posMapY.set('z', initialZ);

    const newUserMap = new Y.Map<unknown>();
    newUserMap.set('name', savedName);
    newUserMap.set('color', color);
    newUserMap.set('position', posMapY);
    newUserMap.set('score', 0);

    // PATRÓN UNIT OF WORK/TRANSACTION - Operación atómica
    ydoc.transact(() => {
      sharedUsersRef.set(userId, newUserMap);
    });

    // PATRÓN BUILDER - Construye el objeto de retorno
    const newUserData: UserData = {
      id: userId, name: savedName, color: color,
      position: { x: initialX, y: initialY, z: initialZ }, score: 0,
    };
    setCurrentUser(newUserData);
    
    // PATRÓN SYNCHRONIZER - Mantiene consistencia con localStorage
    if (localStorage.getItem('userName') !== savedName) {
        localStorage.setItem('userName', savedName);
    }
    return newUserData;
  }
};

/**
 * PATRÓN COMMAND - Comando de Sincronización de Posición
 * 
 * Encapsula la operación de actualizar la posición del usuario tanto
 * en el estado local como en el estado compartido distribuido.
 * 
 * Patrones implementados:
 * 1. COMMAND: Encapsula la acción de sincronizar posición
 * 2. VALIDATION: Valida y sanitiza los datos de entrada
 * 3. TRANSACTION: Usa transacciones para operaciones atómicas
 * 4. IMMUTABLE UPDATE: Retorna nuevo objeto sin mutar el original
 * 
 * @param currentUser - Estado actual del usuario
 * @param newPosition - Nueva posición a sincronizar
 * @param sharedUsersRef - Referencia al estado compartido
 * @param ydoc - Documento para transacciones
 */
export const syncUserPosition = (
  currentUser: UserData,
  newPosition: GameObjectPosition,
  sharedUsersRef: Y.Map<unknown>,
  ydoc: Y.Doc
): UserData => {
  // PATRÓN VALIDATION/SANITIZATION - Valida límites del juego
  const clampedX = Math.max(-TABLE_WIDTH / 2 + PADDLE_RADIUS, Math.min(TABLE_WIDTH / 2 - PADDLE_RADIUS, newPosition.x));
  const clampedZ = Math.max(-TABLE_DEPTH / 2 + PADDLE_RADIUS, Math.min(TABLE_DEPTH / 2 - PADDLE_RADIUS, newPosition.z));

  // PATRÓN IMMUTABLE OBJECT - Crea nueva posición sin mutar la original
  const finalPosition = {
    x: clampedX,
    y: currentUser.position.y, // Mantener la altura Y actual del paddle
    z: clampedZ,
  };

  // PATRÓN IMMUTABLE UPDATE - Retorna nuevo usuario sin mutar el original
  const updatedUser: UserData = {
    ...currentUser,
    position: finalPosition,
  };

  // PATRÓN SAFE NAVIGATION - Verificación de tipos antes de operaciones
  const userMap = sharedUsersRef.get(currentUser.id);
  if (userMap instanceof Y.Map) {
    const posMap = userMap.get('position');
    if (posMap instanceof Y.Map) {
      // PATRÓN TRANSACTION/UNIT OF WORK - Operación atómica
      ydoc.transact(() => {
        posMap.set('x', finalPosition.x);
        posMap.set('y', finalPosition.y);
        posMap.set('z', finalPosition.z);
      });
    } else {
      // PATRÓN ERROR HANDLING - Manejo defensivo de errores
      console.error("[userSync] syncUserPosition - Yjs posMap no encontrado para el usuario.");
    }
  } else {
    console.error("[userSync] syncUserPosition - Yjs userMap no encontrado para el usuario.");
  }
  return updatedUser;
};

/**
 * PATRÓN COMMAND - Comando de Sincronización de Nombre
 * 
 * Encapsula la operación de actualizar el nombre del usuario
 * en múltiples capas de persistencia: localStorage, estado local y estado compartido.
 * 
 * Patrones implementados:
 * 1. COMMAND: Encapsula la acción de cambiar nombre
 * 2. MULTI-LAYER SYNC: Sincroniza en 3 capas diferentes
 * 3. IMMUTABLE UPDATE: Retorna nuevo objeto
 * 4. FACADE: Simplifica la operación compleja de sincronización
 * 
 * @param currentUser - Usuario actual
 * @param name - Nuevo nombre
 * @param sharedUsersRef - Estado compartido
 */
export const syncUserName = (
  currentUser: UserData,
  name: string,
  sharedUsersRef: Y.Map<unknown>
): UserData => {
  // PATRÓN PERSISTENCE LAYER - Actualiza localStorage
  localStorage.setItem('userName', name);

  // PATRÓN IMMUTABLE UPDATE - Crea nuevo objeto usuario
  const updatedUser = {
    ...currentUser,
    name,
  };

  // PATRÓN SAFE NAVIGATION + SHARED STATE UPDATE
  const userMap = sharedUsersRef.get(currentUser.id);
  if (userMap instanceof Y.Map) {
    userMap.set('name', name);
  }
  return updatedUser;
}; 