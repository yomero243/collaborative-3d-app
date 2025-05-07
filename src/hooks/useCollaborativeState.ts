import { useSyncExternalStore, useEffect, useRef, useCallback, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// --- Constantes de Configuración y Física (Monolítico) ---

/** Radio del Puck en metros. */
const PUCK_RADIUS = 0.25; // m - Actualizado para coincidir con la representación visual (0.25)
/** Radio de la Paleta (Paddle) en metros. */
const PADDLE_RADIUS = 0.5; // m - Actualizado para coincidir con la representación visual (0.5)
/** Factor de fricción del Puck (0-1, más cercano a 1 menos fricción). */
const PUCK_FRICTION = 0.995; // Aumentado para simular mejor el deslizamiento sobre aire
/** Coeficiente de restitución contra las paredes (0-1). */
const WALL_BOUNCE_FACTOR = 0.85; // Ligeramente aumentado para rebotes más enérgicos
/** Coeficiente de restitución contra las paletas (0-inf). */
const PADDLE_BOUNCINESS = 1.3; // Aumentado para que los golpes sean más potentes
/** Velocidad mínima para considerar el puck detenido (m/s). */
const MIN_SPEED_THRESHOLD = 0.005; // m/s - Reducido para que el puck no se detenga tan rápido

// Límites de la mesa (ejemplo, ajusta a tu escena 3D)
// Asumimos que el origen (0,0) es el centro de la mesa.
/** Límite X mínimo de la mesa en metros. */
const TABLE_MIN_X = -5; // m - Actualizado para coincidir con TABLE_WIDTH (10m)
/** Límite X máximo de la mesa en metros. */
const TABLE_MAX_X = 5;  // m - Actualizado para coincidir con TABLE_WIDTH (10m) 
/** Límite Y mínimo de la mesa (o Z en tu caso, si es horizontal) en metros. */
const TABLE_MIN_Y = -3; // m - Actualizado para coincidir con TABLE_DEPTH (6m)
/** Límite Y máximo de la mesa en metros. */
const TABLE_MAX_Y = 3;  // m - Actualizado para coincidir con TABLE_DEPTH (6m)

/** Clave persistente para almacenar el UUID del usuario generado. */
const USER_ID_KEY = 'collab3d-userId';
/** Clave para el token JWT (conceptual). */
const JWT_TOKEN_KEY = 'authToken'; // Conceptual, la lógica de getAuthToken la usa.

// --- Funciones de Ayuda ---

/**
 * Recupera o genera un UUID persistente para el usuario actual.
 * @returns {string} El UUID del usuario.
 */
function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

/**
 * Recupera el token JWT (conceptual) del almacenamiento.
 * @returns {string | null} El token o null si no se encuentra.
 */
function getAuthToken(): string | null {
  return localStorage.getItem(JWT_TOKEN_KEY);
}

// --- Tipos de Datos ---

/**
 * Forma de los datos para un usuario remoto en el juego.
 * Las coordenadas están en metros.
 */
export interface UserData {
  id: string;
  /** Posición X del usuario (centro de la paleta) en metros. */
  x: number;
  /** Posición Y del usuario (centro de la paleta) en metros. */
  y: number; // En un plano 2D. Si tu juego es 3D con paletas en Y=constante, esto podría ser Z.
  /** Color del usuario en formato hexadecimal. */
  color: string;
}

/**
 * Forma de los datos para el estado del puck.
 * Coordenadas en metros, velocidades en metros/segundo.
 */
export interface PuckState {
  /** Posición X del puck en metros. */
  x: number;
  /** Posición Y del puck en metros. */
  y: number;
  /** Velocidad X del puck en metros/segundo. */
  vx: number;
  /** Velocidad Y del puck en metros/segundo. */
  vy: number;
}


// --- Lógica de Física del Puck (Monolítico) ---

/**
 * Calcula el siguiente estado del puck basándose en su estado actual, las paletas y el delta de tiempo.
 * Esta es una función pura.
 * @param {PuckState} currentPuck El estado actual del puck.
 * @param {UserData[]} users Array de todos los usuarios (paletas).
 * @param {number} dt Delta de tiempo en segundos (ej., 1/60 para 60Hz).
 * @returns {PuckState} El nuevo estado calculado del puck.
 */
function computeNextPuckState(
  currentPuck: PuckState,
  users: UserData[],
  dt: number
): PuckState {
  let { x, y, vx, vy } = currentPuck;

  // 1. Aplicar velocidad actual para obtener nueva posición tentativa
  x += vx * dt;
  y += vy * dt;

  // 2. Aplicar fricción a las velocidades - simulando rozamiento en mesa de air hockey
  vx *= PUCK_FRICTION;
  vy *= PUCK_FRICTION;

  // 3. Detener el puck si la velocidad es muy baja
  if (Math.sqrt(vx * vx + vy * vy) < MIN_SPEED_THRESHOLD) {
    vx = 0;
    vy = 0;
  }

  // 4. Detección de colisiones con las paredes y rebote
  // Colisión con paredes verticales (izquierda/derecha)
  if (x - PUCK_RADIUS < TABLE_MIN_X) {
    x = TABLE_MIN_X + PUCK_RADIUS;
    vx = -vx * WALL_BOUNCE_FACTOR;
  } else if (x + PUCK_RADIUS > TABLE_MAX_X) {
    x = TABLE_MAX_X - PUCK_RADIUS;
    vx = -vx * WALL_BOUNCE_FACTOR;
  }

  // Colisión con paredes horizontales (arriba/abajo)
  if (y - PUCK_RADIUS < TABLE_MIN_Y) {
    y = TABLE_MIN_Y + PUCK_RADIUS;
    vy = -vy * WALL_BOUNCE_FACTOR;
    // Aquí podría ir la lógica de gol si TABLE_MIN_Y es una portería
  } else if (y + PUCK_RADIUS > TABLE_MAX_Y) {
    y = TABLE_MAX_Y - PUCK_RADIUS;
    vy = -vy * WALL_BOUNCE_FACTOR;
    // Aquí podría ir la lógica de gol si TABLE_MAX_Y es una portería
  }

  // 5. Detección de colisiones con las paletas (usuarios)
  for (const user of users) {
    const dx = x - user.x; // Distancia en x entre centros del puck y la paleta
    const dy = y - user.y; // Distancia en y entre centros
    const distance = Math.sqrt(dx * dx + dy * dy);
    const sumRadii = PUCK_RADIUS + PADDLE_RADIUS;

    if (distance < sumRadii) { // Hay colisión
      console.log(`[Colisión] Paddle-Puck detectada: distancia=${distance.toFixed(2)}, sumRadii=${sumRadii}`);
      
      // Calcular normal de colisión (vector unitario desde la paleta al puck)
      const nx = dx / distance;
      const ny = dy / distance;

      // Separar los objetos para evitar superposición
      const overlap = sumRadii - distance;
      x += nx * overlap * 1.01; // Mover puck con mayor separación para evitar pegarse
      
      // Calcular velocidad relativa
      const rvx = vx; // Asumimos que la paleta está quieta para simplificar
      const rvy = vy;

      // Calcular velocidad relativa a lo largo de la normal
      const velAlongNormal = rvx * nx + rvy * ny;

      // No procesar si las velocidades ya se están separando
      if (velAlongNormal > 0) {
        // Aún así, asegurar que estén separados lo suficiente
        continue;
      }

      // Calcular impulso (j) con rebote mejorado para air hockey
      const j = -(1 + PADDLE_BOUNCINESS) * velAlongNormal;

      // Aplicar impulso base
      vx += j * nx;
      vy += j * ny;
      
      // Añadir un impulso mínimo en la dirección de la normal para evitar que el puck quede pegado
      // Esto es especialmente importante en air hockey donde el puck debe seguir moviéndose
      const minImpulse = 0.3; // Aumentado para air hockey
      const currentSpeed = Math.sqrt(vx * vx + vy * vy);
      
      if (currentSpeed < minImpulse) {
        // Si la velocidad resultante es muy baja, asegurar un impulso mínimo
        vx = nx * minImpulse * 1.8; // Más fuerte para air hockey
        vy = ny * minImpulse * 1.8;
        console.log(`[Rebote] Aplicando impulso mínimo: vx=${vx.toFixed(2)}, vy=${vy.toFixed(2)}`);
      }
      
      // Para air hockey, añadimos un poco de variación a la dirección
      // para que no sea demasiado predecible
      const randomVariation = 0.05; // 5% de variación
      vx += vx * (Math.random() * 2 - 1) * randomVariation;
      vy += vy * (Math.random() * 2 - 1) * randomVariation;
    }
  }

  // Limitar la velocidad máxima del puck para air hockey
  const maxSpeed = 10.0; // m/s - Velocidad máxima para air hockey
  const currentSpeed = Math.sqrt(vx * vx + vy * vy);
  if (currentSpeed > maxSpeed) {
    const reduction = maxSpeed / currentSpeed;
    vx *= reduction;
    vy *= reduction;
  }

  return { x, y, vx, vy };
}


// --- Hooks de Suscripción a Yjs (useSyncExternalStore) ---

/**
 * Hook para suscribirse a un Y.Map y devolver sus valores como un array.
 */
function useYMapValuesAsArray<T>(yMap: Y.Map<T> | undefined): T[] {
  // Reintroducimos la caché, pero la lógica de comparación será más robusta
  const lastSnapshotRef = useRef<T[]>([]);
  const lastSnapshotStringRef = useRef<string>("[]"); // Cache para el string JSON

  const getSnapshot = useCallback(() => {
    if (!yMap) return lastSnapshotRef.current; // Devolver la última caché si no hay mapa
    
    // 1. Obtener los valores actuales
    const newSnapshot = Array.from(yMap.values()) as T[];
    
    // 2. Serializar el nuevo snapshot a JSON
    let newSnapshotString;
    try {
      newSnapshotString = JSON.stringify(newSnapshot);
    } catch (e) {
      console.error("Error serializing snapshot in useYMapValuesAsArray", e, newSnapshot);
      newSnapshotString = "[]"; // Fallback
    }

    // 3. Comparar el string JSON actual con el cacheado
    if (newSnapshotString !== lastSnapshotStringRef.current) {
      // Si son diferentes, el contenido ha cambiado.
      // Actualizar ambas cachés (el array y su string)
      lastSnapshotRef.current = newSnapshot;
      lastSnapshotStringRef.current = newSnapshotString;
      // console.log("[useYMapValuesAsArray] Snapshot changed"); // Log opcional para debug
    }
    
    // 4. Devolver SIEMPRE la referencia del array cacheado.
    // React detectará el cambio solo cuando actualizamos lastSnapshotRef.current
    // porque la próxima vez que llame a getSnapshot, obtendrá una referencia diferente.
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

/**
 * Hook para suscribirse a una entrada específica en un Y.Map.
 */
function useYMapEntry<T>(yMap: Y.Map<unknown> | undefined, entryKey: string): T | null {
  // Usar un ref para mantener el último valor y evitar el warning de "getSnapshot should be cached"
  const lastValueRef = useRef<T | null>(null);
  
  const getSnapshot = useCallback(() => {
    if (!yMap) return lastValueRef.current;
    
    const newValue = (yMap.get(entryKey) as T) || null;
    
    // Solo actualizar la referencia si el valor ha cambiado
    // ESTA COMPARACIÓN SIGUE SIENDO SUPERFICIAL. Podría necesitar mejora si T es un objeto complejo
    // y solo sus propiedades internas cambian sin que cambie la referencia del objeto en el Y.Map.
    // Sin embargo, para el puck (que se reemplaza entero con .set), debería funcionar.
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


// --- Hook Principal: useCollaborativeState ---

/**
 * Hook principal para el estado colaborativo: usuarios, puck, e ID de usuario propio.
 * Gestiona el documento Yjs, WebsocketProvider, y suscripciones a datos compartidos.
 * Incluye la lógica de física del puck y su actualización.
 *
 * @param {string} [roomName="default-room"] El nombre de la sala de colaboración.
 * @param {string} [serverUrl="ws://localhost:1234"] La URL del servidor WebSocket.
 * @returns {{
 *   users: UserData[];
 *   puck: PuckState | null;
 *   userId: string;
 *   yDoc: Y.Doc | undefined;
 *   updateCurrentUserPosition: (pos: { x: number; y: number }) => void;
 *   applyImpulseToPuck: (vx: number, vy: number) => void; // Para interacciones directas si es necesario
 * }}
 */
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
} {
  const userId = useRef(getUserId()).current;
  
  const ydocRef = useRef<Y.Doc>();
  const providerRef = useRef<WebsocketProvider>();
  const usersMapRef = useRef<Y.Map<UserData>>();
  const puckMapRef = useRef<Y.Map<unknown>>(); // Usar unknown en lugar de any
  const physicsIntervalRef = useRef<number | null>(null);
  const hasLoggedErrorRef = useRef(false);
  const [isInitialUserSet, setIsInitialUserSet] = useState(false); // Nuevo estado

  // Efecto para configurar Yjs, WebsocketProvider, y datos iniciales.
  useEffect(() => {
    try {
      // Validar params
      if (!roomName || typeof roomName !== 'string') {
        throw new Error(`roomName debe ser un string válido, recibido: ${roomName}`);
      }
      if (!serverUrl || typeof serverUrl !== 'string') {
        throw new Error(`serverUrl debe ser un string válido, recibido: ${serverUrl}`);
      }

      console.log(`[Yjs] Inicializando con roomName: "${roomName}", serverUrl: "${serverUrl}"`);
      
      // Crear Y.Doc
      const doc = new Y.Doc();
      ydocRef.current = doc;
      
      // Obtener mapas
      usersMapRef.current = doc.getMap<UserData>('users');
      puckMapRef.current = doc.getMap('puck') as Y.Map<unknown>; 

      // Obtener token (si está disponible)
      const token = getAuthToken();

      try {
        // Crear WebsocketProvider con manejo de errores explícito
        const provider = new WebsocketProvider(
          serverUrl,
          roomName,
          doc,
          token ? { params: { token } } : undefined
        );
        
        providerRef.current = provider;
        
        provider.on('status', (event: { status: string }) => {
          console.log(`[Yjs] Provider Status: ${event.status}`);
        });
        
        provider.on('connection-error', (event: Error) => {
          console.error('[Yjs] Connection error (provider.on):', event);
        });
      } catch (providerError) {
        if (!hasLoggedErrorRef.current) {
          console.error('[Yjs] Error creando WebsocketProvider:', providerError);
          console.error(`[Yjs] Comprueba que serverUrl (${serverUrl}) y roomName (${roomName}) sean válidos`);
          console.error('[Yjs] Nota: Si usas localhost en un entorno seguro (HTTPS), cambia a wss:// o usa una URL segura');
          hasLoggedErrorRef.current = true;
        }
        // Comentado para evitar colapso y permitir un estado degradado:
        // throw providerError; 
      }

      // Datos iniciales del usuario
      const initialUserData: UserData = { 
        id: userId, 
        x: (Math.random() - 0.5) * TABLE_MAX_X, // Posición X aleatoria dentro de los límites
        y: TABLE_MIN_Y + PADDLE_RADIUS + 0.5, // Posición Y cerca del borde inferior con espacio suficiente
        color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}` 
      };
      // Asegurarse de que usersMapRef.current existe antes de usarlo
      if (usersMapRef.current) {
        usersMapRef.current.set(userId, initialUserData);
        setIsInitialUserSet(true); // Señalizar que el usuario inicial está configurado
      }
      
      // Inicializar puck si no existe
      // Asegurarse de que puckMapRef.current existe antes de usarlo
      if (puckMapRef.current && puckMapRef.current.get('state') === undefined) {
        puckMapRef.current.set('state', { x: 0, y: 0, vx: 0, vy: 0 });
      }
      
    } catch (err) {
      if (!hasLoggedErrorRef.current) {
        console.error('[Yjs] Error en useEffect de inicialización:', err);
        hasLoggedErrorRef.current = true;
      }
    }
  
    // Limpieza al desmontar o cambiar dependencias
    return () => {
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
        // No es estrictamente necesario limpiar los refs de los mapas aquí,
        // ya que se invalidarán con ydocRef.current.destroy(),
        // pero hacerlo explícito no daña.
        usersMapRef.current = undefined;
        puckMapRef.current = undefined;
        
        ydocRef.current.destroy();
        ydocRef.current = undefined;
      }
      
      // Resetear otros refs para limpieza completa
      hasLoggedErrorRef.current = false;
      setIsInitialUserSet(false); // Restablecer en la limpieza
    };
  }, [roomName, serverUrl, userId]);

  // Suscripciones al estado
  const users = useYMapValuesAsArray<UserData>(usersMapRef.current);
  const puck = useYMapEntry<PuckState>(puckMapRef.current, 'state');

  // Efecto para el bucle de física (60Hz)
  useEffect(() => {
    if (!isInitialUserSet) { // Esperar a que el usuario inicial esté configurado
      console.log('[PhysicsDebug] Esperando a que isInitialUserSet sea true.');
      if (physicsIntervalRef.current) clearInterval(physicsIntervalRef.current); // Asegurar limpieza si ya existía
      physicsIntervalRef.current = null;
      return;
    }

    if (physicsIntervalRef.current) clearInterval(physicsIntervalRef.current);

    console.log('[PhysicsDebug] useEffect para bucle de física. userId:', userId);
    console.log('[PhysicsDebug] users:', users);

    let amIHost = false;
    if (users.length > 0) {
        const sortedUsers = [...users].sort((a, b) => a.id.localeCompare(b.id));
        if (sortedUsers[0].id === userId) {
            amIHost = true;
        }
        console.log('[PhysicsDebug] Multi-user host check. Sorted users:', sortedUsers, 'My userId:', userId, 'Is host:', amIHost);
    }
    if (users.length === 1 && users[0].id === userId) {
        amIHost = true;
        console.log('[PhysicsDebug] Single-user host check. Is host:', amIHost);
    }

    console.log('[PhysicsDebug] Final amIHost:', amIHost);

    if (amIHost && puckMapRef.current && usersMapRef.current) { // Solo el "host" calcula
      console.log('[PhysicsDebug] Soy el HOST. Iniciando setInterval para física.');
      // Capturar las referencias actuales para usarlas de forma segura en el closure del intervalo
      const currentPuckMap = puckMapRef.current;
      const currentUsersMap = usersMapRef.current;
      
      // Crear un array para reutilizar en el bucle de física
      // Esto evita crear un nuevo array en cada ciclo del intervalo
      const usersDataCache: UserData[] = [];
      
      // Ref para verificar si el puck está realmente en movimiento
      const isPuckMovingRef = {current: false};

      physicsIntervalRef.current = window.setInterval(() => {
        // Usar las referencias capturadas
        const currentPuckState = currentPuckMap.get('state') as PuckState | undefined;
        
        if (!currentPuckState) {
          // console.log('[PhysicsDebug] Interval: No currentPuckState. Retornando.'); // Puede ser muy ruidoso
          return;
        }
        
        const puckSpeed = Math.sqrt(currentPuckState.vx * currentPuckState.vx + currentPuckState.vy * currentPuckState.vy);
        const isMovingNow = puckSpeed > MIN_SPEED_THRESHOLD * 2;
        
        // console.log(`[PhysicsDebug] Interval: Puck (vx:${currentPuckState.vx.toFixed(3)}, vy:${currentPuckState.vy.toFixed(3)}), Speed:${puckSpeed.toFixed(3)}, isMovingNow:${isMovingNow}, wasMoving:${isPuckMovingRef.current}`);

        if (!isMovingNow && !isPuckMovingRef.current) {
          // console.log('[PhysicsDebug] Interval: Puck no se mueve y no se movía. Omitiendo computeNextPuckState.'); // Puede ser ruidoso
          return;
        }
        
        isPuckMovingRef.current = isMovingNow;
        
        // Obtener usuarios actuales más eficientemente
        // Reutilizamos el array en lugar de crear uno nuevo en cada ciclo
        usersDataCache.length = 0; // Vaciar el array sin crear uno nuevo
        currentUsersMap.forEach(userData => {
          usersDataCache.push(userData);
        });
        
        if (usersDataCache.length > 0) {
          // console.log('[PhysicsDebug] Interval: Calculando nextPuckState.'); // Puede ser ruidoso
          const nextPuck = computeNextPuckState(currentPuckState, usersDataCache, 1 / 60);
          
          if (nextPuck.x !== currentPuckState.x || 
              nextPuck.y !== currentPuckState.y || 
              nextPuck.vx !== currentPuckState.vx || 
              nextPuck.vy !== currentPuckState.vy) {
            // console.log('[PhysicsDebug] Interval: Puck state cambió. Actualizando Y.Map.'); // Puede ser ruidoso
            currentPuckMap.set('state', nextPuck); // Actualiza el estado compartido
          }
        }
      }, 1000 / 60);
    } else {
      console.log('[PhysicsDebug] NO soy el HOST o faltan refs. No se inicia setInterval para física.');
    }

    return () => {
      if (physicsIntervalRef.current) {
        clearInterval(physicsIntervalRef.current);
        physicsIntervalRef.current = null; // Importante para la re-ejecución del efecto
      }
    };
  // Dependencias: `users` para re-evaluar quién es el host, `userId` para la comparación.
  }, [users, userId, isInitialUserSet]); // Añadir isInitialUserSet como dependencia


  // Funciones para actualizar el estado desde la UI u otros componentes
  const updateCurrentUserPosition = useCallback((pos: { x: number; y: number }) => {
    // Eliminar logs innecesarios para mejorar rendimiento
    // console.log('[useCollaborativeState] updateCurrentUserPosition called with (x, y=sceneZ):', pos.x.toFixed(2), pos.y.toFixed(2));
    
    if (usersMapRef.current && userId) {
      const currentUserData = usersMapRef.current.get(userId);
      if (currentUserData) {
        // Evitar actualizaciones redundantes que podrían causar re-renderizados innecesarios
        // Solo actualizar si la posición ha cambiado significativamente
        if (Math.abs(currentUserData.x - pos.x) > 0.001 || Math.abs(currentUserData.y - pos.y) > 0.001) {
          const newUserData = { ...currentUserData, x: pos.x, y: pos.y };
          // console.log('[useCollaborativeState] Setting Y.Map data for user:', userId.substring(0,3));
          usersMapRef.current.set(userId, newUserData);
        }
      } else {
        // console.warn('[useCollaborativeState] No currentUserData found in Y.Map for ID:', userId);
      }
    } else {
      // console.warn('[useCollaborativeState] usersMapRef.current or userId is not available.');
    }
  }, [userId]);

  const applyImpulseToPuck = useCallback((impulseVx: number, impulseVy: number) => {
    if (puckMapRef.current) {
      const currentPuck = puckMapRef.current.get('state') as PuckState | undefined;
      if (currentPuck) {
        // Verificar si el impulso es suficientemente grande
        const impulseStrength = Math.sqrt(impulseVx * impulseVx + impulseVy * impulseVy);
        const minStrength = 0.05;
        
        // Si el impulso es muy débil, no hacemos nada
        if (impulseStrength < minStrength) {
          console.log(`[Impulso] Demasiado débil (${impulseStrength.toFixed(3)}), ignorando`);
          return;
        }
        
        // Si el impulso es pequeño pero no insignificante, lo aumentamos
        let finalImpulseVx = impulseVx;
        let finalImpulseVy = impulseVy;
        
        // Para air hockey, asegurar impulsos más potentes
        if (impulseStrength < 0.3) {
          const scale = 0.3 / impulseStrength;
          finalImpulseVx *= scale;
          finalImpulseVy *= scale; 
          console.log(`[Impulso] Amplificado de ${impulseStrength.toFixed(3)} a 0.300`);
        }
        
        // Añadir una pequeña variación aleatoria para simular imperfecciones en el golpe
        const randomVariation = 0.05; // 5% de variación
        finalImpulseVx += finalImpulseVx * (Math.random() * 2 - 1) * randomVariation;
        finalImpulseVy += finalImpulseVy * (Math.random() * 2 - 1) * randomVariation;
        
        // En air hockey, el impulso a veces reemplaza la velocidad en lugar de sumarse
        // Esto simula un golpe directo donde la dirección viene determinada por el golpe
        // en lugar de conservar el momento anterior
        const currentSpeed = Math.sqrt(currentPuck.vx * currentPuck.vx + currentPuck.vy * currentPuck.vy);
        const newImpulseSpeed = Math.sqrt(finalImpulseVx * finalImpulseVx + finalImpulseVy * finalImpulseVy);
        
        let newVx, newVy;
        
        // Si el golpe es significativamente más fuerte que la velocidad actual, reemplazar
        if (newImpulseSpeed > currentSpeed * 1.5) {
          newVx = finalImpulseVx;
          newVy = finalImpulseVy;
          console.log(`[Impulso] Reemplazando velocidad con golpe fuerte`);
        } else {
          // De lo contrario, sumar al movimiento actual (conservar momento)
          newVx = currentPuck.vx + finalImpulseVx;
          newVy = currentPuck.vy + finalImpulseVy;
        }
        
        // Limitador de velocidad máxima para air hockey
        const maxSpeed = 10.0;
        const resultingSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
        if (resultingSpeed > maxSpeed) {
          const reduction = maxSpeed / resultingSpeed;
          newVx *= reduction;
          newVy *= reduction;
          console.log(`[Impulso] Limitando velocidad máxima a ${maxSpeed.toFixed(1)} m/s`);
        }
        
        const newPuckState: PuckState = {
          ...currentPuck,
          vx: newVx,
          vy: newVy,
        };
        
        console.log(`[Impulso] Aplicado: vx=${newVx.toFixed(3)}, vy=${newVy.toFixed(3)}`);
        puckMapRef.current.set('state', newPuckState);
      }
    }
  }, []);

  return {
    users,
    puck,
    userId,
    yDoc: ydocRef.current,
    updateCurrentUserPosition,
    applyImpulseToPuck,
  };
}