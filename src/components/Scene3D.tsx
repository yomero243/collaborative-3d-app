import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { Environment, /* ContactShadows, */ OrbitControls, Grid } from '@react-three/drei';
import UserCube from './UserCube';
import AirHockeyTable from './AirHockeyTable';
import PuckComponent from './Puck';
import TileFloor from './TileFloor';
import { useRef, useState, useEffect } from 'react';
import { Raycaster, Plane, Vector3 } from 'three';
import {
  TABLE_WIDTH,
  TABLE_DEPTH,
  PADDLE_RADIUS,
  PUCK_RADIUS,
  TABLE_HEIGHT,
} from '../utils/physicsConstants';

export interface UserData {
  id: string;
  name: string;
  color: string;
  position: { x: number; y: number; z: number };
  score: number;
}

export interface PuckData {
  position: { x: number; y: number; z: number };
  velocity: { x: number; z: number };
}

interface Scene3DProps {
  users: Map<string, UserData>;
  currentUser: UserData | null;
  puck: PuckData | null;
  onUpdatePosition: (position: { x: number; y: number; z: number }) => void;
  applyImpulseToPuck: (vx: number, vy: number) => void;
  onMouseOverTable?: (isOver: boolean) => void;
}

interface CollisionDetectorProps {
  currentUser: UserData | null;
  puck: PuckData | null;
  optimisticUsers: Map<string, UserData>;
  applyImpulseToPuck: (vx: number, vy: number) => void;
  PADDLE_RADIUS: number;
  PUCK_RADIUS: number;
  PADDLE_Y_CENTER: number;
  PUCK_Y_CENTER: number;
  lastHitTimeRef: React.MutableRefObject<number>;
  HIT_COOLDOWN: number;
}

// Umbral para la fase amplia de detección de colisiones (distancia al cuadrado)
// Si el puck y la paleta están más lejos que esto (aproximadamente), no se procesa la colisión detallada.
// (PADDLE_RADIUS + PUCK_RADIUS + buffer)^2 = (0.5 + 0.25 + 1.5)^2 = 2.25^2 = 5.0625
const BROAD_PHASE_THRESHOLD_SQ = (0.5 + 0.25 + 1.5) ** 2;

const CollisionDetector: React.FC<CollisionDetectorProps> = ({
  currentUser,
  puck,
  optimisticUsers,
  applyImpulseToPuck,
  PADDLE_RADIUS,
  PUCK_RADIUS,
  PADDLE_Y_CENTER,
  PUCK_Y_CENTER,
  lastHitTimeRef,
  HIT_COOLDOWN,
}) => {
  const paddlePos = useRef(new Vector3());
  const puckPos = useRef(new Vector3());
  const impulseDirection = useRef(new Vector3());

  useFrame(() => {
    if (!currentUser || !puck || !puck.position) {
      return;
    }
    const paddleUserData = optimisticUsers.get(currentUser.id);
    if (!paddleUserData || !paddleUserData.position) return;

    // --- Inicio de la Fase Amplia (Broad-phase) ---
    const dxBroad = paddleUserData.position.x - puck.position.x;
    const dzBroad = paddleUserData.position.z - puck.position.z;
    const distanceSqBroad = dxBroad * dxBroad + dzBroad * dzBroad;

    if (distanceSqBroad > BROAD_PHASE_THRESHOLD_SQ) {
      return; // Puck demasiado lejos, no hay necesidad de comprobar colisión detallada o cooldown
    }
    // --- Fin de la Fase Amplia ---

    const currentTime = Date.now();
    if (currentTime - lastHitTimeRef.current < HIT_COOLDOWN) {
      return;
    }

    paddlePos.current.set(paddleUserData.position.x, PADDLE_Y_CENTER, paddleUserData.position.z);
    puckPos.current.set(puck.position.x, PUCK_Y_CENTER, puck.position.z);

    const distanceSq = (paddlePos.current.x - puckPos.current.x) ** 2 +
      (paddlePos.current.z - puckPos.current.z) ** 2;
    const collisionThresholdSq = (PADDLE_RADIUS + PUCK_RADIUS) ** 2;

    if (distanceSq < collisionThresholdSq) {
      lastHitTimeRef.current = currentTime;

      impulseDirection.current
        .subVectors(puckPos.current, paddlePos.current)
        .normalize();

      const impulseStrength = 1.5;
      applyImpulseToPuck(
        impulseDirection.current.x * impulseStrength,
        impulseDirection.current.z * impulseStrength
      );
    }
  });
  return null;
};

// Función para detectar si el dispositivo es móvil
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768);
};

const Scene3D: React.FC<Scene3DProps> = ({
  users,
  currentUser,
  puck,
  onUpdatePosition,
  applyImpulseToPuck,
  onMouseOverTable
}) => {
  const PADDLE_Y_CENTER = TABLE_HEIGHT / 2;
  const PUCK_Y_CENTER = PUCK_RADIUS;

  const lastHitTimeRef = useRef(0);
  const HIT_COOLDOWN = 250;
  const [isMobile, setIsMobile] = useState(isMobileDevice());

  const [optimisticUserPosition, setOptimisticUserPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [isMouseOverTable, setIsMouseOverTable] = useState(false);

  useEffect(() => {
    if (onMouseOverTable) {
      onMouseOverTable(isMouseOverTable);
    }
  }, [isMouseOverTable, onMouseOverTable]);

  useEffect(() => {
    if (!currentUser?.position || !currentUser.id) return;

    if (!optimisticUserPosition ||
      Math.abs(currentUser.position.x - optimisticUserPosition.x) > 0.1 ||
      Math.abs(currentUser.position.z - optimisticUserPosition.z) > 0.1) {
      setOptimisticUserPosition({
        x: currentUser.position.x,
        y: currentUser.position.y,
        z: currentUser.position.z
      });
    }
  }, [currentUser?.position, currentUser?.id, optimisticUserPosition]);

  const raycasterRef = useRef(new Raycaster());
  const PADDLE_MOUSE_PLANE_Y = 0.0;
  const tableCollisionPlane = useRef(new Plane(new Vector3(0, 1, 0), -PADDLE_MOUSE_PLANE_Y));
  const intersectionPoint = useRef(new Vector3());
  const lastMousePosition = useRef<{ x: number, z: number } | null>(null);
  const predictedPosition = useRef<{ x: number, z: number } | null>(null);
  const lastRaycastTime = useRef(0);

  const handlePointerMoveOnTable = (event: ThreeEvent<PointerEvent>) => {
    if (!currentUser) return;

    // Actualizar el estado local
    if (!isMouseOverTable) {
      setIsMouseOverTable(true);
    }

    const currentTime = performance.now();
    const timeSinceLastRaycast = currentTime - lastRaycastTime.current;

    // Optimize raycasting - only perform every 4ms (~240 FPS) for maximum responsiveness
    if (timeSinceLastRaycast < 4) {
      // Use prediction for intermediate frames
      if (predictedPosition.current) {
        const newPosition = { x: predictedPosition.current.x, y: PADDLE_Y_CENTER, z: predictedPosition.current.z };
        setOptimisticUserPosition(newPosition);
        onUpdatePosition(newPosition);
      }
      return;
    }

    lastRaycastTime.current = currentTime;
    raycasterRef.current.ray.copy(event.ray);
    if (raycasterRef.current.ray.intersectPlane(tableCollisionPlane.current, intersectionPoint.current)) {
      const halfWidth = TABLE_WIDTH / 2 - PADDLE_RADIUS;
      const halfDepth = TABLE_DEPTH / 2 - PADDLE_RADIUS;
      const clampedX = Math.max(-halfWidth, Math.min(halfWidth, intersectionPoint.current.x));
      const clampedZ = Math.max(-halfDepth, Math.min(halfDepth, intersectionPoint.current.z));

      // Ultra-sensitive threshold for movement detection
      if (lastMousePosition.current &&
        Math.abs(lastMousePosition.current.x - clampedX) < 0.001 &&
        Math.abs(lastMousePosition.current.z - clampedZ) < 0.001) {
        return;
      }

      lastMousePosition.current = { x: clampedX, z: clampedZ };
      predictedPosition.current = { x: clampedX, z: clampedZ };
      const newPosition = { x: clampedX, y: PADDLE_Y_CENTER, z: clampedZ };
      setOptimisticUserPosition(newPosition);
      onUpdatePosition(newPosition);
    }
  };

  const handlePointerLeaveTable = () => {
    // Actualizar el estado local
    setIsMouseOverTable(false);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Verificar si el mouse está fuera del canvas
      const canvas = document.querySelector('canvas');
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        if (isMouseOverTable) {
          setIsMouseOverTable(false);
        }
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isMouseOverTable]);

  const getOptimisticUsersData = () => {
    if (!currentUser || !optimisticUserPosition) {
      return users;
    }

    const currentUserData = users.get(currentUser.id);
    if (!currentUserData) {
      return users;
    }

    if (Math.abs(currentUserData.position.x - optimisticUserPosition.x) < 0.001 &&
      Math.abs(currentUserData.position.z - optimisticUserPosition.z) < 0.001) {
      return users;
    }

    const newOptimisticUsers = new Map(users);
    newOptimisticUsers.set(currentUser.id, {
      ...currentUserData,
      position: optimisticUserPosition
    });
    return newOptimisticUsers;
  };

  const optimisticUsers = getOptimisticUsersData();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Canvas
        camera={{ position: [0, TABLE_DEPTH * 0.8, TABLE_DEPTH * 1.2], fov: 60 }}
        shadows
        style={{ touchAction: 'none' }}
      >
        <OrbitControls
          enableDamping
          dampingFactor={0.1}
          target={[0, 0, 0]}
          minDistance={TABLE_DEPTH / 2}
          maxDistance={TABLE_DEPTH * 2.5}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2 - 0.05}
          enableZoom={!isMobile}
          enableRotate={!isMobile}
          enablePan={!isMobile}
        />
        <color attach="background" args={['#111827']} />
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[TABLE_WIDTH, TABLE_DEPTH * 2, TABLE_DEPTH]}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={50}
          shadow-camera-left={-TABLE_WIDTH * 1.5}
          shadow-camera-right={TABLE_WIDTH * 1.5}
          shadow-camera-top={TABLE_DEPTH * 1.5}
          shadow-camera-bottom={-TABLE_DEPTH * 1.5}
        />
        <directionalLight position={[-TABLE_WIDTH, 10, -TABLE_DEPTH / 2]} intensity={0.25} />
        <pointLight position={[-TABLE_WIDTH - 0.5, 1, 0]} intensity={1} distance={3} color="red" />
        <pointLight position={[TABLE_WIDTH + 0.5, 1, 0]} intensity={1} distance={3} color="blue" />
        <Environment preset="sunset" />
        <TileFloor
          size={40}
          position={[0, -2.2, 0]}
          tileSize={2.5}
          color1="#1a1a2e"
          color2="#303045"
          glowColor="#4158D0"
          glowIntensity={0.3}
        />
        <AirHockeyTable
          width={TABLE_WIDTH}
          depth={TABLE_DEPTH}
          onPointerMove={handlePointerMoveOnTable}
          onPointerLeave={handlePointerLeaveTable}
          showGrid={true}
        />
        <Grid
          position={[0, PUCK_Y_CENTER, 0]}
          args={[TABLE_WIDTH, TABLE_DEPTH]}
          cellSize={0.5}
          cellThickness={1}
          cellColor="#6f6f6f"
          sectionSize={2}
          sectionThickness={1.5}
          sectionColor="#2c82c7"
          fadeDistance={TABLE_DEPTH * 1.5}
          fadeStrength={1}
          infiniteGrid={false}
        />
        {puck && puck.position && <PuckComponent puckData={puck} radius={PUCK_RADIUS} showHitbox={true} />}
        {Array.from(optimisticUsers.values()).map((userDataItem) => (
          <UserCube
            key={userDataItem.id}
            userData={userDataItem}
            isCurrentUser={currentUser?.id === userDataItem.id}
            paddleRadius={PADDLE_RADIUS}
          />
        ))}

        <CollisionDetector
          currentUser={currentUser}
          puck={puck}
          optimisticUsers={optimisticUsers}
          applyImpulseToPuck={applyImpulseToPuck}
          PADDLE_RADIUS={PADDLE_RADIUS}
          PUCK_RADIUS={PUCK_RADIUS}
          PADDLE_Y_CENTER={PADDLE_Y_CENTER}
          PUCK_Y_CENTER={PUCK_Y_CENTER}
          lastHitTimeRef={lastHitTimeRef}
          HIT_COOLDOWN={HIT_COOLDOWN}
        />
      </Canvas>
    </div>
  );
};

export default Scene3D;