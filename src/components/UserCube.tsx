import { Text, Cylinder, useGLTF } from '@react-three/drei';
import { useRef, useState, useEffect } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Mesh, Vector3, Group, Raycaster, Plane } from 'three';
import * as THREE from 'three';
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
  const hitboxRef = useRef<Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { camera, mouse } = useThree();
  
  // Cargar el modelo GLB del paddle
  // Asegúrate de que paddle.glb esté en la carpeta /public
  const { scene: paddleModelScene } = useGLTF('/paddle.glb');
  
  // Raycaster y plano para la detección de intersecciones
  const raycaster = useRef(new Raycaster());
  const tablePlane = useRef(new Plane(new Vector3(0, 1, 0), 0));
  
  // Vectores temporales para cálculos
  const intersection = useRef(new Vector3());
  const targetPosition = useRef(new Vector3(userData.position.x, userData.position.y, userData.position.z));
  const lastPosition = useRef(new Vector3(userData.position.x, userData.position.y, userData.position.z));
  const velocity = useRef(new Vector3(0, 0, 0));

  // Estado para el modelo clonado y procesado con materiales
  const [processedPaddleModel, setProcessedPaddleModel] = useState<THREE.Object3D | null>(null);

  // Color que se usará para el resplandor
  const glowIntensity = useRef(2);

  // Sincronizar posición cuando cambia externamente
  useEffect(() => {
    if (!isCurrentUser) {
      targetPosition.current.set(userData.position.x, userData.position.y, userData.position.z);
    }
  }, [userData.position, isCurrentUser]);

  // Efecto para procesar el modelo paddle.glb (clonar y aplicar materiales)
  useEffect(() => {
    if (paddleModelScene) {
      const modelClone = paddleModelScene.clone(); // Clonar para poder modificarlo
      modelClone.traverse((child) => {
        if (child instanceof Mesh) {
          // Intentar modificar el material existente
          if (child.material instanceof THREE.MeshStandardMaterial) {
            const originalMaterial = child.material;
            child.material = originalMaterial.clone(); // Clonar material para no afectar otras instancias
            child.material.color.set(userData.color);
            child.material.opacity = isCurrentUser ? 1 : 0.7;
            child.material.transparent = !isCurrentUser || showHitbox;
            child.material.roughness = originalMaterial.roughness !== undefined ? originalMaterial.roughness : 0.3;
            child.material.metalness = originalMaterial.metalness !== undefined ? originalMaterial.metalness : 0.7;
          } else {
            // Si no es MeshStandardMaterial o queremos un override completo:
            // child.material = new THREE.MeshStandardMaterial({
            //   color: userData.color,
            //   opacity: isCurrentUser ? 1 : 0.7,
            //   transparent: !isCurrentUser || showHitbox,
            //   roughness: 0.3,
            //   metalness: 0.7,
            // });
          }
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      setProcessedPaddleModel(modelClone);
    }
  }, [paddleModelScene, userData.color, isCurrentUser, showHitbox]);

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

  // Escala y rotación por defecto para el modelo del paddle.
  // ¡AJUSTA ESTOS VALORES SEGÚN TU MODELO paddle.glb!
  const paddleScale = paddleRadius * 2; // Ejemplo: Escalar basado en paddleRadius
  const paddleRotation: [number, number, number] = [0, 0, 0]; // Ejemplo: Sin rotación inicial
  const paddlePositionOffset: [number, number, number] = [0, -paddleRadius * 0.1, 0]; // Ajuste fino de posición si es necesario

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
      
      {/* Modelo del Paddle */}
      {processedPaddleModel && (
        <primitive
          object={processedPaddleModel}
          scale={paddleScale}
          rotation={paddleRotation}
          position={paddlePositionOffset}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp} // Asumimos que si el puntero sale, es como soltarlo
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

      {isCurrentUser && (
        <pointLight
          position={[0, -paddleRadius * 0.5, 0]} // Podrías querer ajustar la posición de esta luz relativa al nuevo modelo
          intensity={glowIntensity.current}
          distance={paddleRadius * 4}
          color={userData.color} // Usar userData.color directamente para el brillo
        />
      )}
    </group>
  );
};

export default UserCube; 