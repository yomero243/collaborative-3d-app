import { useRef, useEffect, useState } from 'react';
import { Sphere } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { PuckData } from '../components/Scene3D'; // Importar desde Scene3D
import * as THREE from 'three';
import HolographicMaterial from './HolographicMaterial';
import {
  PUCK_VISUAL_LERP_FACTOR,
  PUCK_SNAP_THRESHOLD_MULTIPLIER,
  PUCK_ROTATION_SPEED_FACTOR,
  PUCK_TILT_BASE_FACTOR,
  PUCK_SPIN_TILT_FACTOR
} from '../utils/physicsConstants';

interface PuckProps {
  puckData: PuckData | null;
  radius?: number;
  color?: string;
  showHitbox?: boolean;
  enhancedPhysics?: {
    angularVelocity?: number;
    spin?: number;
    lastCollisionTime?: number;
    lastCollisionForce?: number;
  };
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
    if (!particles.current || speed < 0.5) return;
    
    const frameStart = performance.now();
    if (frameStart % 2 !== 0) return; // Skip every other frame
    
    // Actualizar posiciones de partículas
    for (let i = positions.current.length - 3; i >= 3; i -= 3) {
      positions.current[i] = positions.current[i - 3];
      positions.current[i + 1] = positions.current[i - 2];
      positions.current[i + 2] = positions.current[i - 1];
    }
    
    positions.current[0] = position.x;
    positions.current[1] = position.y;
    positions.current[2] = position.z;
    
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
  showHitbox = false,
  enhancedPhysics,
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

  const SNAP_THRESHOLD = radius * PUCK_SNAP_THRESHOLD_MULTIPLIER; 
  const LERP_FACTOR = PUCK_VISUAL_LERP_FACTOR; 

  // Efecto para actualizar targetPosition y manejar la inicialización visual
  useEffect(() => {
    if (puckData && puckData.position) {
      const newPos = new THREE.Vector3(puckData.position.x, puckData.position.y, puckData.position.z);
      
      // Usar datos de colisión del motor de físicas (elimina duplicación)
      if (isVisualPuckInitialized.current && enhancedPhysics?.lastCollisionTime && enhancedPhysics?.lastCollisionForce) {
        const timeSinceLastCollision = Date.now() - enhancedPhysics.lastCollisionTime;
        if (timeSinceLastCollision < 100) {
          setLastCollision(Date.now());
          setCollisionIntensity(Math.min(1.0, enhancedPhysics.lastCollisionForce / 8.0));
        }
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
  }, [puckData, enhancedPhysics?.lastCollisionTime, enhancedPhysics?.lastCollisionForce]);

  useFrame((state, delta) => {
    if (!puckRef.current || !puckData || !puckData.position || !isVisualPuckInitialized.current) {
      return;
    }

    const frameStartTime = performance.now();
    const FRAME_BUDGET_MS = 12;

    const distanceToTarget = puckRef.current.position.distanceTo(targetPosition.current);

    if (distanceToTarget > SNAP_THRESHOLD) {
      puckRef.current.position.copy(targetPosition.current);
    } else if (distanceToTarget > 0.0005) { // Reducido para mejor precisión
      puckRef.current.position.lerp(targetPosition.current, LERP_FACTOR);
    }

    trailPosition.current.copy(puckRef.current.position);
    
    // Sincronizar la posición del hitbox con la del puck en cada frame
    if (hitboxRef.current && showHitbox) {
      hitboxRef.current.position.copy(puckRef.current.position);
    }
    
    const speed = Math.sqrt(puckData.velocity.x * puckData.velocity.x + puckData.velocity.z * puckData.velocity.z);
    currentSpeed.current = speed;
    
    // Skip expensive visual effects if frame is taking too long
    if (performance.now() - frameStartTime > FRAME_BUDGET_MS) {
      return;
    }

    // Actualizar la rotación basada en la velocidad y físicas mejoradas
    if (speed > 0.001) {
      const angle = Math.atan2(puckData.velocity.z, puckData.velocity.x);
      
      // Rotación principal basada en velocidad
      puckRef.current.rotation.y += speed * PUCK_ROTATION_SPEED_FACTOR * (60 * delta);
      
      // Si tenemos físicas mejoradas, usar la velocidad angular real
      if (enhancedPhysics?.angularVelocity !== undefined) {
        puckRef.current.rotation.y += enhancedPhysics.angularVelocity * delta;
      }

      // Check frame budget before expensive calculations
      if (performance.now() - frameStartTime < FRAME_BUDGET_MS) {
        // Efecto de inclinación basado en la velocidad y spin
        const spinTiltFactor = enhancedPhysics?.spin ? Math.abs(enhancedPhysics.spin) * PUCK_SPIN_TILT_FACTOR : 0;
        const totalTiltFactor = PUCK_TILT_BASE_FACTOR + spinTiltFactor;
        
        puckRef.current.rotation.z = Math.sin(angle) * totalTiltFactor * speed;
        puckRef.current.rotation.x = Math.cos(angle) * totalTiltFactor * speed;
        
        // Wobble adicional para spin alto
        if (enhancedPhysics?.spin && Math.abs(enhancedPhysics.spin) > 2) {
          const time = Date.now() * 0.001;
          const wobbleIntensity = Math.min(Math.abs(enhancedPhysics.spin) / 5, 1);
          puckRef.current.rotation.z += Math.sin(time * 8) * wobbleIntensity * 0.05;
          puckRef.current.rotation.x += Math.cos(time * 6) * wobbleIntensity * 0.03;
        }
      }
    } else {
      // Suavizar rotación cuando se detiene
      puckRef.current.rotation.x = THREE.MathUtils.lerp(puckRef.current.rotation.x, 0, 0.15);
      puckRef.current.rotation.z = THREE.MathUtils.lerp(puckRef.current.rotation.z, 0, 0.15);
    }
    
    // Efecto de destello en colisiones (implementado en HolographicMaterial)
    // El material holográfico maneja los efectos de colisión internamente
  });

  return (
    <>
      {/* Estela visual del puck - Disabled for performance */}
      {false && isVisualPuckInitialized.current && <PuckTrail 
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
          <meshBasicMaterial color="blue" wireframe={false} transparent opacity={0.5} />
        </Sphere>
      )}
      
      <Sphere 
        ref={puckRef}
        args={[radius, 32, 32]} 
        visible={false} 
        castShadow
        receiveShadow
      >
        <HolographicMaterial 
          hologramColor="green"
          hologramOpacity={showHitbox ? 0.8 : 1.0}
          enableAdditive={true} // Puedes ajustar estas propiedades según sea necesario
          fresnelAmount={0.35}
          fresnelOpacity={0.5}
          scanlineSize={5.0}
          signalSpeed={0.3}
          enableBlinking={true}
        />
      </Sphere>
      
      {/* Luz que sigue al puck con intensidad basada en la velocidad y spin */}
      {isVisualPuckInitialized.current && puckRef.current && (
        <pointLight
          position={puckRef.current.position.clone().add(new THREE.Vector3(0, 0.5, 0))}
          intensity={1 + currentSpeed.current + (enhancedPhysics?.spin ? Math.abs(enhancedPhysics.spin) * 0.3 : 0)}
          distance={3 + currentSpeed.current * 4}
          color={enhancedPhysics?.spin && Math.abs(enhancedPhysics.spin) > 1 ? 
            `hsl(${(enhancedPhysics.spin * 30) % 360}, 70%, 60%)` : color}
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