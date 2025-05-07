import { useEffect, useState, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { generateRandomColor } from '../utils/colors';

// Interfaz para la posición de un objeto en el espacio 3D
interface GameObjectPosition {
  x: number;
  y: number;
  z: number;
}

// Interfaz para los datos de un usuario (paddle)
export interface UserData {
  id: string;
  name: string;
  color: string;
  position: GameObjectPosition;
  score: number;
}

// Interfaz para los datos del puck
export interface PuckData {
  position: GameObjectPosition;
  velocity: { x: number; z: number };
}

// Interfaz para el estado compartido entre usuarios
interface CollaborativeState {
  users: Map<string, UserData>;
  currentUser: UserData | null;
  puck: PuckData | null;
  updateUserPosition: (position: GameObjectPosition) => void;
  setUserName: (name: string) => void;
  resetPuck: () => void;
  applyImpulseToPuck: (impulseX: number, impulseZ: number) => void;
}

// Constantes para la dimensión de la mesa
const TABLE_WIDTH = 10;
const TABLE_HEIGHT = 0.2;
const TABLE_DEPTH = 6;
const PADDLE_RADIUS = 0.5;
const PUCK_RADIUS = 0.25;
const PUCK_HEIGHT = TABLE_HEIGHT / 2 + PUCK_RADIUS;

// Constantes de Física
// const FRICTION = 0.98; // No se usa directamente aquí, se usará PUCK_FRICTION
const WALL_BOUNCE_FACTOR = 0.75; // Factor de rebote en las paredes (0 a 1)
const PADDLE_BOUNCINESS = 1.4; // Aumentado para golpes más fuertes (antes 1.2)
const PUCK_FRICTION = 0.99; // Factor de fricción (ej. 0.99 reduce velocidad 1% por frame)
const MINIMUM_PUCK_SPEED = 0.01; // Velocidad por debajo de la cual el puck se considera detenido

// Funciones Auxiliares
// updatePuckPhysics se moverá dentro del hook

// Hook para manejar el estado colaborativo
export const useCollaborativeState = (): CollaborativeState => {
  const [users, setUsers] = useState<Map<string, UserData>>(new Map());
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [puck, setPuck] = useState<PuckData | null>(null);
  
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const providerRef = useRef<WebsocketProvider | null>(null);
  const sharedUsersRef = useRef<Y.Map<unknown>>(ydocRef.current.getMap('users'));
  const sharedPuckRef = useRef<Y.Map<unknown>>(ydocRef.current.getMap('puck'));
  
  const yjsSetupDoneRef = useRef(false);
  const localUserSetupDoneRef = useRef(false);
  const physicsIntervalRef = useRef<number | null>(null);

  // Función para aplicar un impulso al puck (por ejemplo, cuando un paddle lo golpea)
  // Esta función es definida ANTES de updatePuckPhysics para que esté disponible en su scope.
  const applyImpulseToPuck = (impulseX: number, impulseZ: number) => {
    if (!providerRef.current?.wsconnected || !puck) return;
    
    const currentPos = { ...puck.position };
    let currentImpulseX = impulseX;
    let currentImpulseZ = impulseZ;

    let newPosX = currentPos.x + currentImpulseX;
    let newPosZ = currentPos.z + currentImpulseZ;
    
    // Colisiones con paredes y rebote
    if (newPosX > TABLE_WIDTH / 2 - PUCK_RADIUS) {
      newPosX = TABLE_WIDTH / 2 - PUCK_RADIUS;
      currentImpulseX *= -WALL_BOUNCE_FACTOR; // Invertir y aplicar rebote
    } else if (newPosX < -TABLE_WIDTH / 2 + PUCK_RADIUS) {
      newPosX = -TABLE_WIDTH / 2 + PUCK_RADIUS;
      currentImpulseX *= -WALL_BOUNCE_FACTOR; // Invertir y aplicar rebote
    }

    if (newPosZ > TABLE_DEPTH / 2 - PUCK_RADIUS) {
      newPosZ = TABLE_DEPTH / 2 - PUCK_RADIUS;
      currentImpulseZ *= -WALL_BOUNCE_FACTOR; // Invertir y aplicar rebote
    } else if (newPosZ < -TABLE_DEPTH / 2 + PUCK_RADIUS) {
      newPosZ = -TABLE_DEPTH / 2 + PUCK_RADIUS;
      currentImpulseZ *= -WALL_BOUNCE_FACTOR; // Invertir y aplicar rebote
    }
    
    const newPosition = { x: newPosX, y: puck.position.y, z: newPosZ };
    // La "velocidad" ahora refleja el impulso después del posible rebote en la pared.
    const newVelocity = { x: currentImpulseX, z: currentImpulseZ };

    setPuck({
      position: newPosition,
      velocity: newVelocity 
    });
    
    const sharedPuck = sharedPuckRef.current;
    const posMap = sharedPuck.get('position');
    const velMap = sharedPuck.get('velocity');
    
    if (posMap instanceof Y.Map && velMap instanceof Y.Map) {
      ydocRef.current.transact(() => {
        posMap.set('x', newPosition.x);
        posMap.set('y', newPosition.y);
        posMap.set('z', newPosition.z);
        velMap.set('x', newVelocity.x); // Guardar el impulso como velocidad
        velMap.set('z', newVelocity.z);
      });
    }
  };


  /**
   * Calcula colisiones del puck con paddles y aplica impulsos.
   * Esta función ahora está DENTRO de useCollaborativeState para acceder a applyImpulseToPuck.
   */
  const updatePuckPhysicsInternal = () => {
    const currentSharedPuck = sharedPuckRef.current;
    const currentSharedUsersMap = sharedUsersRef.current;

    if (!(currentSharedPuck instanceof Y.Map) || !puck) { // Añadido check para puck state
      return;
    }

    const puckPosMap = currentSharedPuck.get('position');
    const puckVelMap = currentSharedPuck.get('velocity');

    if (!(puckPosMap instanceof Y.Map) || !(puckVelMap instanceof Y.Map)) {
      return;
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

    // 2. Calcular nueva posición basada en velocidad (afectada por fricción)
    // Esta posición solo se usará si no hay colisión con paddle, 
    // o para la detección de colisión con paddle.
    let nextPuckPosX = currentPuckPosX + currentPuckVelX;
    let nextPuckPosZ = currentPuckPosZ + currentPuckVelZ;

    // Colisiones con paredes (manejadas por applyImpulseToPuck si hay un *nuevo* impulso).
    // Aquí solo nos aseguramos de que la posición por fricción no atraviese las paredes.
    // Esta es una comprobación simple, applyImpulseToPuck tiene la lógica de rebote.
    if (nextPuckPosX > TABLE_WIDTH / 2 - PUCK_RADIUS) { nextPuckPosX = TABLE_WIDTH / 2 - PUCK_RADIUS; currentPuckVelX = 0;}
    else if (nextPuckPosX < -TABLE_WIDTH / 2 + PUCK_RADIUS) { nextPuckPosX = -TABLE_WIDTH / 2 + PUCK_RADIUS; currentPuckVelX = 0; }
    if (nextPuckPosZ > TABLE_DEPTH / 2 - PUCK_RADIUS) { nextPuckPosZ = TABLE_DEPTH / 2 - PUCK_RADIUS; currentPuckVelZ = 0; }
    else if (nextPuckPosZ < -TABLE_DEPTH / 2 + PUCK_RADIUS) { nextPuckPosZ = -TABLE_DEPTH / 2 + PUCK_RADIUS; currentPuckVelZ = 0; }
    

    // 3. Detección de Colisiones con Paddles
    const currentUsersData = new Map<string, UserData>();
    if (currentSharedUsersMap instanceof Y.Map) {
      currentSharedUsersMap.forEach((userDataYMap: unknown, id: string) => {
        if (userDataYMap instanceof Y.Map) {
          const posMap = userDataYMap.get('position');
          let userYPosition = PADDLE_RADIUS + TABLE_HEIGHT / 2;
          if (posMap instanceof Y.Map && typeof posMap.get('y') === 'number') {
            userYPosition = posMap.get('y') as number;
          }
          let position: GameObjectPosition = { x: 0, y: userYPosition, z: 0 };
          if (posMap instanceof Y.Map) {
            position = {
              x: posMap.get('x') as number || 0,
              y: userYPosition,
              z: posMap.get('z') as number || 0,
            };
          }
          currentUsersData.set(id, {
            id: id,
            name: userDataYMap.get('name') as string || 'Usuario',
            color: userDataYMap.get('color') as string || '#cccccc',
            score: userDataYMap.get('score') as number || 0,
            position: position,
          });
        }
      });
    }

    let paddleCollisionOccurred = false;
    currentUsersData.forEach((user) => {
      if (paddleCollisionOccurred) return; // Procesar solo una colisión de paddle por frame para simplificar

      // Usar nextPuckPosX/Z para la detección, ya que es donde estaría el puck después de la fricción/movimiento de este frame.
      const dx = nextPuckPosX - user.position.x;
      const dz = nextPuckPosZ - user.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < PUCK_RADIUS + PADDLE_RADIUS) {
        paddleCollisionOccurred = true;
        // console.log(`[PhysicsEngine] Colisión detectada con ${user.name}! Dist: ${distance.toFixed(2)}`);

        const nx = dx / distance;
        const nz = dz / distance;
        const dotProduct = currentPuckVelX * nx + currentPuckVelZ * nz;

        let impulseX = (currentPuckVelX - 2 * dotProduct * nx) * PADDLE_BOUNCINESS;
        let impulseZ = (currentPuckVelZ - 2 * dotProduct * nz) * PADDLE_BOUNCINESS;
        
        // Ajuste para asegurar separación y evitar que el puck se "pegue" o atraviese lentamente.
        // Si el puck no se está moviendo claramente hacia el paddle (dotProduct >= 0) 
        // O si el producto escalar es negativo pero muy pequeño (casi tangencial o el paddle lo alcanza por detrás suavemente),
        // queremos asegurarnos de que haya un impulso de separación claro.
        const minSeparationImpulseBase = 0.15; // Aumentado (antes 0.1)
        if (dotProduct >= -0.05) { // Condición relajada (antes -0.01), para aplicar más consistentemente el empuje de separación
            if (dotProduct < 0) { // Moviéndose hacia el paddle
              const reflectionMagnitude = Math.sqrt(impulseX*impulseX + impulseZ*impulseZ);
              if (reflectionMagnitude < minSeparationImpulseBase) {
                // El impulso de reflexión es muy débil, asegurar un impulso de salida mínimo.
                impulseX = nx * minSeparationImpulseBase * PADDLE_BOUNCINESS;
                impulseZ = nz * minSeparationImpulseBase * PADDLE_BOUNCINESS;
              }
            } else { // dotProduct >= 0 (Puck quieto relativo al paddle o moviéndose en paralelo/alejándose pero aún en contacto)
              // Aplicamos un impulso de separación directo.
              impulseX = nx * minSeparationImpulseBase * PADDLE_BOUNCINESS;
              impulseZ = nz * minSeparationImpulseBase * PADDLE_BOUNCINESS;
            }
        }

        const maxImpulse = 1.5;
        const currentImpulseMagnitude = Math.sqrt(impulseX * impulseX + impulseZ * impulseZ);
        if (currentImpulseMagnitude > maxImpulse) {
          const scale = maxImpulse / currentImpulseMagnitude;
          impulseX *= scale;
          impulseZ *= scale;
        }
        
        const minEffectiveImpulse = 0.05;
        if (currentImpulseMagnitude < minEffectiveImpulse && currentImpulseMagnitude > 1e-5) {
            const scaleFactor = minEffectiveImpulse / currentImpulseMagnitude;
            impulseX *= scaleFactor;
            impulseZ *= scaleFactor;
        } else if (currentImpulseMagnitude <= 1e-5 && distance < PUCK_RADIUS + PADDLE_RADIUS - 0.01) {
            impulseX = nx * minSeparationImpulseBase * PADDLE_BOUNCINESS;
            impulseZ = nz * minSeparationImpulseBase * PADDLE_BOUNCINESS;
        }
        // console.log(`[PhysicsEngine] Aplicando impulso por paddle: (${impulseX.toFixed(3)}, ${impulseZ.toFixed(3)})`);
        applyImpulseToPuck(impulseX, impulseZ);
      }
    });

    // 4. Actualizar estado del puck si no hubo colisión con paddle PERO sí hubo cambio por fricción
    if (!paddleCollisionOccurred && puckSpeedChangedByFriction) {
      // console.log(`[PhysicsEngine] Aplicando fricción. Nueva Vel: (${currentPuckVelX.toFixed(3)}, ${currentPuckVelZ.toFixed(3)})`);
      setPuck({
        position: { x: nextPuckPosX, y: currentPuckPosY, z: nextPuckPosZ },
        velocity: { x: currentPuckVelX, z: currentPuckVelZ }
      });

      // Actualizar Yjs también
      ydocRef.current.transact(() => {
        puckPosMap.set('x', nextPuckPosX);
        puckPosMap.set('y', currentPuckPosY); // Mantener y
        puckPosMap.set('z', nextPuckPosZ);
        puckVelMap.set('x', currentPuckVelX);
        puckVelMap.set('z', currentPuckVelZ);
      });
    }
  };

  // Efecto 1: Inicializar Yjs connection y observers
  useEffect(() => {
    const setupYjs = () => {
      try {
        // Intentar crear el provider si no existe
        if (!providerRef.current) {
          const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsHost = window.location.hostname === 'localhost' ? 'localhost:1234' : window.location.host;
          const wsUrl = `${wsProtocol}//${wsHost}`;
          providerRef.current = new WebsocketProvider(wsUrl, 'air-hockey-room', ydocRef.current);
          
          providerRef.current.on('status', (event: { status: string }) => {
            console.log(`[Yjs] Connection Status: ${event.status}`);
          });
        }
        
        // Setup de observadores
        if (!yjsSetupDoneRef.current) {
          setupYjsObservers();
          yjsSetupDoneRef.current = true;
        }
      } catch (error) {
        console.error("[Yjs] Error setting up Yjs:", error);
      }
    };
    
    const setupYjsObservers = () => {
      // Observer para el mapa de usuarios
      const sharedUsers = sharedUsersRef.current;
      
      // Función para procesar actualizaciones de usuarios
      const handleUserUpdate = () => {
        const updatedUsers = new Map<string, UserData>();
        
        if (sharedUsers instanceof Y.Map) {
          sharedUsers.forEach((userDataYMap: unknown, id: string) => {
            if (userDataYMap instanceof Y.Map) {
              // Extraer posición del mapa
              const posMap = userDataYMap.get('position');
              let position: GameObjectPosition = { x: 0, y: 1, z: 0 };
              
              if (posMap instanceof Y.Map) {
                position = {
                  x: posMap.get('x') as number,
                  y: posMap.get('y') as number,
                  z: posMap.get('z') as number,
                };
              }
              
              const userData: UserData = {
                id: id,
                name: userDataYMap.get('name') as string,
                color: userDataYMap.get('color') as string,
                position: position,
                score: userDataYMap.get('score') as number || 0,
              };
              
              updatedUsers.set(id, userData);
              
              // Si es nuestro usuario, actualizar currentUser
              if (currentUser && id === currentUser.id) {
                setCurrentUser(userData);
              }
            }
          });
        }
        
        setUsers(updatedUsers);
      };
      
      // Observer para el puck
      const handlePuckUpdate = () => {
        const sharedPuck = sharedPuckRef.current;
        
        if (sharedPuck instanceof Y.Map) {
          const posMap = sharedPuck.get('position');
          const velMap = sharedPuck.get('velocity');
          
          if (posMap instanceof Y.Map && velMap instanceof Y.Map) {
            const updatedPuck: PuckData = {
              position: {
                x: posMap.get('x') as number || 0,
                y: posMap.get('y') as number || PUCK_HEIGHT,
                z: posMap.get('z') as number || 0,
              },
              velocity: {
                x: velMap.get('x') as number || 0,
                z: velMap.get('z') as number || 0,
              },
            };
            
            setPuck(updatedPuck);
          }
        }
      };
      
      // Registrar los observers
      sharedUsers.observe(handleUserUpdate);
      sharedPuckRef.current.observe(handlePuckUpdate);
      
      // Realizar una llamada inicial para establecer el estado
      handleUserUpdate();
      handlePuckUpdate();
    };
    
    setupYjs();
    
    return () => {
      if (providerRef.current) {
        providerRef.current.disconnect();
        providerRef.current = null;
      }
    };
  }, [currentUser]);
  
  // Efecto 2: Crear usuario cuando tenemos conexión
  useEffect(() => {
    if (!providerRef.current?.wsconnected || localUserSetupDoneRef.current) {
      return;
    }
    
    const sharedUsers = sharedUsersRef.current;
    
    // Generar ID de usuario
    const userId = ydocRef.current.clientID.toString();
    
    // Comprobar si existe el usuario o crear nuevo
    if (!sharedUsers.has(userId)) {
      // Crear nuevo usuario
      const savedName = localStorage.getItem('userName') || `Jugador-${Math.floor(Math.random() * 1000)}`;
      const color = generateRandomColor();
      
      // Posición inicial del usuario
      const initialX = (Math.random() - 0.5) * TABLE_WIDTH * 0.8;
      const initialZ = (Math.random() - 0.5) * TABLE_DEPTH * 0.8;

      const posMap = new Y.Map();
      posMap.set('x', initialX);
      posMap.set('y', PADDLE_RADIUS + TABLE_HEIGHT / 2); // Altura del paddle
      posMap.set('z', initialZ);
      
      const userMap = new Y.Map();
      userMap.set('name', savedName);
      userMap.set('color', color);
      userMap.set('position', posMap);
      userMap.set('score', 0);
      
      // Añadir al mapa compartido
      ydocRef.current.transact(() => {
        sharedUsers.set(userId, userMap);
      });
      
      // Actualizar estado local
      const userData: UserData = {
        id: userId,
        name: savedName,
        color: color,
        position: { x: initialX, y: PADDLE_RADIUS + TABLE_HEIGHT / 2, z: initialZ },
        score: 0,
      };
      
      setCurrentUser(userData);
      localUserSetupDoneRef.current = true;
    }
  }, [providerRef.current?.wsconnected]);
  
  // Efecto 3: Inicializar puck cuando tenemos conexión
  useEffect(() => {
    if (!providerRef.current?.wsconnected || !currentUser) {
      return;
    }
    
    const sharedPuck = sharedPuckRef.current;
    
    // Solo inicializar el puck si no existe y somos el primer (o único) usuario conectado
    // Se podría refinar la lógica para decidir quién inicializa el puck si hay varios usuarios.
    if (sharedPuck.size === 0 && users.size <= 1) {
      // Lógica para inicializar puck
      const posMap = new Y.Map();
      posMap.set('x', 0);
      posMap.set('y', PUCK_HEIGHT);
      posMap.set('z', 0);
      const velMap = new Y.Map();
      velMap.set('x', 0);
      velMap.set('z', 0);
      ydocRef.current.transact(() => {
        sharedPuck.set('position', posMap);
        sharedPuck.set('velocity', velMap);
      });
    }
  }, [currentUser, users.size, providerRef.current?.wsconnected]);

  // Efecto 4: Bucle de física para colisiones y aplicar impulsos.
  useEffect(() => {
    if (physicsIntervalRef.current) {
      clearInterval(physicsIntervalRef.current);
      physicsIntervalRef.current = null;
    }

    physicsIntervalRef.current = setInterval(() => {
      if (puck && users.size > 0 && providerRef.current?.wsconnected) {
        // Llamar a la función interna que ahora tiene acceso a applyImpulseToPuck
        updatePuckPhysicsInternal();
      }
    }, 1000 / 60); // Ejecutar a ~60 FPS

    return () => {
      if (physicsIntervalRef.current) {
        clearInterval(physicsIntervalRef.current);
        physicsIntervalRef.current = null;
      }
    };
  }, [puck, users, providerRef.current?.wsconnected, applyImpulseToPuck]); // Agregado applyImpulseToPuck a las dependencias

  // Función para actualizar la posición del usuario
  const updateUserPosition = (newPosition: GameObjectPosition) => {
    if (!currentUser || !providerRef.current?.wsconnected) {
      return; // Salir si no estamos listos
    }
    
    // Restringir movimiento (clamp)
    const clampedX = Math.max(-TABLE_WIDTH / 2 + PADDLE_RADIUS, Math.min(TABLE_WIDTH / 2 - PADDLE_RADIUS, newPosition.x));
    const clampedZ = Math.max(-TABLE_DEPTH / 2 + PADDLE_RADIUS, Math.min(TABLE_DEPTH / 2 - PADDLE_RADIUS, newPosition.z));
    
    const finalPosition = {
      x: clampedX,
      y: currentUser.position.y, // Mantener la altura Y actual del paddle
      z: clampedZ,
    };

    // 1. Actualizar estado local INMEDIATAMENTE para feedback rápido
    const updatedUser: UserData = {
      ...currentUser,
      position: finalPosition,
    };
    setCurrentUser(updatedUser);

    // 2. Actualizar Yjs Map (esto notificará a otros y a nuestros propios observers)
    const sharedUsers = sharedUsersRef.current;
    const userMap = sharedUsers.get(currentUser.id);
    
    if (userMap instanceof Y.Map) {
      const posMap = userMap.get('position');
      if (posMap instanceof Y.Map) {
        // Usar transacción para agrupar potencialmente cambios futuros
        ydocRef.current.transact(() => {
          posMap.set('x', finalPosition.x);
          posMap.set('y', finalPosition.y);
          posMap.set('z', finalPosition.z);
        });
      } else {
        console.error("[Hook] updateUserPosition - Yjs posMap no encontrado para el usuario.");
      }
    } else {
       console.error("[Hook] updateUserPosition - Yjs userMap no encontrado para el usuario.");
    }
  };

  // Función para establecer el nombre del usuario
  const setUserName = (name: string) => {
    if (!currentUser || !providerRef.current?.wsconnected) return;
    
    // Guardar nombre en localStorage
    localStorage.setItem('userName', name);
    
    // Actualizar estado local
    const updatedUser = {
      ...currentUser,
      name,
    };
    setCurrentUser(updatedUser);
    
    // Actualizar nombre en el mapa compartido
    const sharedUsers = sharedUsersRef.current;
    const userMap = sharedUsers.get(currentUser.id);
    
    if (userMap instanceof Y.Map) {
      userMap.set('name', name);
    }
  };

  // Función para reiniciar el puck en el centro
  const resetPuck = () => {
    const newPosition = { x: 0, y: PUCK_HEIGHT, z: 0 };
    const newVelocity = { x: 0, z: 0 }; // Velocidad cero, no hay movimiento automático
    
    // Actualizar estado local
    setPuck({
      position: newPosition,
      velocity: newVelocity
    });
    
    // Si hay conexión WebSocket, actualizar también el estado compartido
    if (providerRef.current?.wsconnected) {
      const sharedPuck = sharedPuckRef.current;
      ydocRef.current.transact(() => {
        const posMap = sharedPuck.get('position');
        const velMap = sharedPuck.get('velocity');
        
        if (posMap instanceof Y.Map && velMap instanceof Y.Map) {
          posMap.set('x', newPosition.x);
          posMap.set('y', newPosition.y);
          posMap.set('z', newPosition.z);
          velMap.set('x', newVelocity.x);
          velMap.set('z', newVelocity.z);
        }
      });
    }
  };

  return {
    users,
    currentUser,
    puck,
    updateUserPosition,
    setUserName,
    resetPuck,
    applyImpulseToPuck,
  };
}; 