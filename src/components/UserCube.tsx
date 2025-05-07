import { Text, Cylinder } from '@react-three/drei';
import { useRef, useState, useEffect } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Mesh, Vector3, Group, Raycaster, Plane } from 'three';
import { UserData } from '../components/Scene3D';

interface UserCubeProps {
  userData: UserData;
  isCurrentUser: boolean;
  onPositionUpdate?: (position: { x: number; y: number; z: number }) => void;
  tableDepth?: number;
  tableWidth?: number;
  paddleRadius?: number;
  showHitbox?: boolean;
}

const UserCube: React.FC<UserCubeProps> = ({
  userData,
  isCurrentUser,
  onPositionUpdate,
  tableDepth = 6,
  tableWidth = 10,
  paddleRadius = 0.5,
  showHitbox = true,
}) => {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const hitboxRef = useRef<Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { camera, mouse } = useThree();
  
  // Raycaster y plano para la detección de intersecciones
  const raycaster = useRef(new Raycaster());
  const tablePlane = useRef(new Plane(new Vector3(0, 1, 0), 0));
  
  // Vectores temporales para cálculos
  const intersection = useRef(new Vector3());
  const targetPosition = useRef(new Vector3(userData.position.x, userData.position.y, userData.position.z));
  const lastPosition = useRef(new Vector3(userData.position.x, userData.position.y, userData.position.z));
  const velocity = useRef(new Vector3(0, 0, 0));

  // Color que se usará para el resplandor
  const glowIntensity = useRef(2);
  const glowColor = userData.color;

  // Sincronizar posición cuando cambia externamente
  useEffect(() => {
    if (!isCurrentUser) {
      targetPosition.current.set(userData.position.x, userData.position.y, userData.position.z);
    }
  }, [userData.position, isCurrentUser]);

  // Sistema de movimiento e interacción principal
  useFrame(() => {
    // 1. Actualizar posición del paddle basado en el mouse para usuario actual
    if (isCurrentUser) {
      // Si estamos arrastrando, actualizar targetPosition basado en el mouse
      if (isDragging) {
        // Configurar el raycaster desde la cámara a través del punto del mouse
        raycaster.current.setFromCamera(mouse, camera);
        
        // Calcular la intersección con el plano horizontal de la mesa
        if (raycaster.current.ray.intersectPlane(tablePlane.current, intersection.current)) {
          // Restringir la posición dentro de los límites de la mesa
          const halfWidth = tableWidth / 2 - paddleRadius;
          const halfDepth = tableDepth / 2 - paddleRadius;
          
          const clampedX = Math.max(-halfWidth, Math.min(halfWidth, intersection.current.x));
          const clampedZ = Math.max(-halfDepth, Math.min(halfDepth, intersection.current.z));
          
          // Actualizar la posición objetivo
          targetPosition.current.set(clampedX, userData.position.y, clampedZ);
          
          // Solo enviamos actualizaciones cuando hay un cambio significativo
          if (targetPosition.current.distanceTo(lastPosition.current) > 0.01) {
            if (onPositionUpdate) {
              onPositionUpdate({
                x: targetPosition.current.x,
                y: targetPosition.current.y,
                z: targetPosition.current.z
              });
            }
            
            // Calcular velocidad para efectos visuales
            velocity.current.subVectors(targetPosition.current, lastPosition.current);
            lastPosition.current.copy(targetPosition.current);
            
            // Aumentar intensidad del brillo basado en velocidad
            const speed = velocity.current.length() * 20;
            glowIntensity.current = Math.min(10, 2 + speed);
          }
        }
      } 
      // Si tenemos un grupo pero no estamos arrastrando, actualizar posición con nuestro userData
      else if (groupRef.current) {
        targetPosition.current.set(userData.position.x, userData.position.y, userData.position.z);
      }
      
      // Actualizar la posición del grupo para que coincida con targetPosition
      if (groupRef.current) {
        groupRef.current.position.lerp(targetPosition.current, 0.3);
      }
    }
    // 2. Para usuarios remotos, hacer una interpolación suave hacia la posición objetivo
    else if (groupRef.current) {
      groupRef.current.position.lerp(targetPosition.current, 0.1);
    }
    
    // 3. Reducir gradualmente la intensidad del brillo cuando no estamos arrastrando
    if (!isDragging && glowIntensity.current > 2) {
      glowIntensity.current = Math.max(2, glowIntensity.current * 0.95);
    }
  });

  // Manejar eventos del mouse
  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (isCurrentUser) {
      event.stopPropagation();
      setIsDragging(true);
      
      // Capturar el puntero para recibir eventos incluso fuera del elemento
      if (event.target) {
        const element = event.target as unknown as HTMLElement;
        element.setPointerCapture(event.pointerId);
      }
    }
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (isCurrentUser) {
      event.stopPropagation();
      setIsDragging(false);
      
      // Liberar captura del puntero
      if (event.target) {
        const element = event.target as unknown as HTMLElement;
        element.releasePointerCapture(event.pointerId);
      }
    }
  };

  return (
    <group ref={groupRef} position={[userData.position.x, userData.position.y, userData.position.z]}>
      {/* Hitbox mejorada - Ahora visible para debug */}
      <Cylinder
        ref={hitboxRef}
        position={[0, 0, 0]}
        args={[paddleRadius * 1.15, paddleRadius * 1.15, paddleRadius * 1.5, 32]}
        rotation={[Math.PI / 2, 0, 0]}
        visible={showHitbox}
      >
        <meshBasicMaterial color="red" wireframe={true} transparent opacity={0.5} />
      </Cylinder>
      
      {/* Base del paddle visible */}
      <Cylinder
        ref={meshRef}
        position={[0, 0, 0]}
        args={[paddleRadius, paddleRadius * 1.1, paddleRadius * 1.2, 32]}
        rotation={[Math.PI / 2, 0, 0]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial 
          color={userData.color} 
          opacity={isCurrentUser ? 1 : 0.7}
          transparent={!isCurrentUser || showHitbox}
          roughness={0.3}
          metalness={0.7}
        />
      </Cylinder>
      
      {/* Mango del paddle */}
      <Cylinder
        position={[0, paddleRadius * 0.7, 0]}
        args={[paddleRadius * 0.3, paddleRadius * 0.2, paddleRadius * 0.8, 12]}
        castShadow
      >
        <meshStandardMaterial 
          color={isCurrentUser ? userData.color : "#999999"} 
          roughness={0.5}
          metalness={0.3}
        />
      </Cylinder>
      
      {/* Efecto de brillo (solo para el usuario actual) */}
      {isCurrentUser && (
        <pointLight
          position={[0, -paddleRadius * 0.5, 0]}
          intensity={glowIntensity.current}
          distance={paddleRadius * 4}
          color={glowColor}
        />
      )}
      
      {/* Nombre del usuario */}
      <Text
        position={[0, paddleRadius + 0.5, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="black"
      >
        {userData.name}
      </Text>
    </group>
  );
};

export default UserCube; 