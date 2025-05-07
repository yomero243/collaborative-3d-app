import { useRef, useEffect, useState } from 'react';
import { Sphere } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { PuckData } from '../components/Scene3D'; // Importar desde Scene3D
import * as THREE from 'three';

interface PuckProps {
  puckData: PuckData | null;
  radius?: number;
  color?: string;
  showHitbox?: boolean;
}

// Componente para crear la estela visual del puck
const PuckTrail: React.FC<{position: THREE.Vector3, color: string, speed: number}> = ({ position, color, speed }) => {
  const particles = useRef<THREE.Points>(null);
  const particleCount = 10;
  const positions = useRef<number[]>([]);
  
  // Crear geometría de partículas
  useEffect(() => {
    positions.current = Array(particleCount * 3).fill(0);
  }, []);
  
  useFrame(() => {
    if (!particles.current) return;
    
    // Actualizar posiciones de partículas
    // Mover todas las partículas hacia abajo en el array
    for (let i = positions.current.length - 3; i >= 3; i -= 3) {
      positions.current[i] = positions.current[i - 3];
      positions.current[i + 1] = positions.current[i - 2];
      positions.current[i + 2] = positions.current[i - 1];
    }
    
    // Establecer la primera partícula en la posición actual
    positions.current[0] = position.x;
    positions.current[1] = position.y;
    positions.current[2] = position.z;
    
    // Actualizar la geometría
    const geometry = particles.current.geometry as THREE.BufferGeometry;
    const positionAttribute = geometry.getAttribute('position');
    const typedArray = positionAttribute.array as Float32Array;
    
    for (let i = 0; i < positions.current.length; i++) {
      typedArray[i] = positions.current[i];
    }
    
    positionAttribute.needsUpdate = true;
  });
  
  return (
    <points ref={particles}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={new Float32Array(particleCount * 3)}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.08 + (speed * 0.1)}
        sizeAttenuation={true}
        transparent={true}
        opacity={0.8}
      />
    </points>
  );
};

const Puck: React.FC<PuckProps> = ({
  puckData,
  radius = 0.25,
  color = 'red',
  showHitbox = true,
}) => {
  const puckRef = useRef<THREE.Mesh>(null);
  const hitboxRef = useRef<THREE.Mesh>(null);
  const [lastCollision, setLastCollision] = useState(0);
  const [collisionIntensity, setCollisionIntensity] = useState(0);
  
  // Posición a la que el puck visual debe moverse (viene de puckData)
  const targetPosition = useRef(new THREE.Vector3());
  // Posición usada por PuckTrail, actualizada con la posición visual actual del puck
  const trailPosition = useRef(new THREE.Vector3()); 
  // Velocidad actual para efectos visuales
  const currentSpeed = useRef(0);

  // Flag para saber si el puck visual ha sido colocado en su posición inicial
  const isVisualPuckInitialized = useRef(false);
  // Guardar la última posición para detectar cambios bruscos (colisiones)
  const lastPositionRef = useRef(new THREE.Vector3());
  // Guardar velocidad previa para detectar cambios bruscos
  const lastVelocityRef = useRef(new THREE.Vector2());

  const SNAP_THRESHOLD = radius * 5; 
  const LERP_FACTOR = 0.2; 

  // Efecto para actualizar targetPosition y manejar la inicialización visual
  useEffect(() => {
    if (puckData && puckData.position) {
      const newPos = new THREE.Vector3(puckData.position.x, puckData.position.y, puckData.position.z);
      
      // Detectar colisiones basado en cambios bruscos de velocidad
      if (isVisualPuckInitialized.current && puckRef.current) {
        const oldVel = lastVelocityRef.current;
        const newVel = new THREE.Vector2(puckData.velocity.x, puckData.velocity.z);
        
        // Verificar si ha habido un cambio brusco en la velocidad (colisión)
        const velDiff = oldVel.distanceTo(newVel);
        const newSpeed = newVel.length();
        const suddenChange = velDiff > 0.3 || newSpeed > 5.0; // Detectar también velocidades altas como colisiones
        
        if (suddenChange) {
          // Calcular intensidad basada en la velocidad y el cambio
          const intensidad = Math.max(
            Math.min(1.0, velDiff * 0.5),
            Math.min(1.0, newSpeed / 10.0)
          );
          setLastCollision(Date.now());
          setCollisionIntensity(intensidad);
        }
        
        // Actualizar velocidad guardada
        lastVelocityRef.current.set(puckData.velocity.x, puckData.velocity.z);
      }
      
      // Actualizar posición objetivo
      targetPosition.current.copy(newPos);
      
      if (!isVisualPuckInitialized.current && puckRef.current) {
        // Primera vez que tenemos datos válidos, o si se reinicializa,
        // teletransportar el puck visual a la posición objetivo.
        puckRef.current.position.copy(targetPosition.current);
        trailPosition.current.copy(targetPosition.current); // Sincronizar la estela también
        lastPositionRef.current.copy(targetPosition.current); // Guardar última posición
        isVisualPuckInitialized.current = true;
        puckRef.current.visible = true; // Asegurarse que esté visible
      } else if (isVisualPuckInitialized.current && !puckRef.current?.visible) {
        // Si ya estaba inicializado pero se ocultó, y vuelve a haber puckData
        if(puckRef.current) puckRef.current.visible = true;
      }
    } else {
      // Si puckData se vuelve null o no tiene posición, resetear el flag y ocultar.
      isVisualPuckInitialized.current = false;
      if (puckRef.current) {
        puckRef.current.visible = false;
      }
    }
  }, [puckData]); // Depender del objeto puckData completo o de sus propiedades relevantes.

  useFrame((state, delta) => {
    if (!puckRef.current || !puckData || !puckData.position || !isVisualPuckInitialized.current) {
      return;
    }

    const distanceToTarget = puckRef.current.position.distanceTo(targetPosition.current);

    if (distanceToTarget > SNAP_THRESHOLD) {
      puckRef.current.position.copy(targetPosition.current);
    } else if (distanceToTarget > 0.001) { 
      puckRef.current.position.lerp(targetPosition.current, LERP_FACTOR);
    }

    trailPosition.current.copy(puckRef.current.position);
    
    // Sincronizar la posición del hitbox con la del puck en cada frame
    if (hitboxRef.current && showHitbox) {
      hitboxRef.current.position.copy(puckRef.current.position);
    }
    
    const speed = Math.sqrt(puckData.velocity.x * puckData.velocity.x + puckData.velocity.z * puckData.velocity.z);
    currentSpeed.current = speed;
    
    // Actualizar la rotación basada en la velocidad de puckData
    if (speed > 0.001) {
      const angle = Math.atan2(puckData.velocity.z, puckData.velocity.x);
      const rotationSpeedFactor = 1.5; 
      puckRef.current.rotation.y += speed * rotationSpeedFactor * (60 * delta); 

      const tiltFactor = 0.1;
      puckRef.current.rotation.z = Math.sin(angle) * tiltFactor * speed;
      puckRef.current.rotation.x = Math.cos(angle) * tiltFactor * speed;
    } else {
      puckRef.current.rotation.x = THREE.MathUtils.lerp(puckRef.current.rotation.x, 0, 0.1);
      puckRef.current.rotation.z = THREE.MathUtils.lerp(puckRef.current.rotation.z, 0, 0.1);
    }
    
    // Efecto de destello en colisiones
    if (Date.now() - lastCollision < 500) {
      const timeSinceCollision = (Date.now() - lastCollision) / 500; // Normalizado 0-1
      const collisionFlash = 1 - timeSinceCollision; // Decrece con el tiempo
      
      if (puckRef.current.material instanceof THREE.MeshStandardMaterial) {
        puckRef.current.material.emissiveIntensity = 0.6 + collisionFlash * collisionIntensity * 3.0;
      }
    } else if (puckRef.current.material instanceof THREE.MeshStandardMaterial) {
      puckRef.current.material.emissiveIntensity = 0.6;
    }
  });

  return (
    <>
      {/* Estela visual del puck, siempre activa pero sigue a trailPosition */}
      {/* trailPosition se actualiza incluso si el puck principal está oculto (se queda en el último sitio) */}
      {/* o podrías condicionar el renderizado de PuckTrail también con isVisualPuckInitialized.current */}
      {isVisualPuckInitialized.current && <PuckTrail 
        position={trailPosition.current}
        color={color}
        speed={currentSpeed.current}
      />}
      
      {/* Visualización de hitbox del puck */}
      {showHitbox && isVisualPuckInitialized.current && (
        <Sphere
          ref={hitboxRef}
          args={[radius, 16, 16]}
          visible={true}
        >
          <meshBasicMaterial color="blue" wireframe={true} transparent opacity={0.5} />
        </Sphere>
      )}
      
      <Sphere 
        ref={puckRef}
        args={[radius, 32, 32]} 
        // La posición y visibilidad se manejan en los hooks.
        // Podríamos inicializarlo como no visible para evitar un flash en (0,0,0).
        visible={false} 
        castShadow
        receiveShadow
      >
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={0.6}
          roughness={0.3} 
          metalness={0.7}
          transparent={showHitbox}
          opacity={showHitbox ? 0.8 : 1}
        />
      </Sphere>
      
      {/* Luz que sigue al puck con intensidad basada en la velocidad */}
      {isVisualPuckInitialized.current && puckRef.current && (
        <pointLight
          position={puckRef.current.position.clone().add(new THREE.Vector3(0, 0.5, 0))}
          intensity={1 + currentSpeed.current}
          distance={3 + currentSpeed.current * 4}
          color={color}
        />
      )}
      
      {/* Efecto de explosión en colisiones fuertes */}
      {isVisualPuckInitialized.current && puckRef.current && Date.now() - lastCollision < 300 && collisionIntensity > 0.3 && (
        <pointLight
          position={puckRef.current.position.clone()}
          intensity={(1 - (Date.now() - lastCollision) / 300) * 8 * collisionIntensity}
          distance={3 * collisionIntensity}
          color="white"
        />
      )}
    </>
  );
};

export default Puck;