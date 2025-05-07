import { useRef, useEffect } from 'react';
import { Sphere } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { PuckData } from '../hooks/useCollaborativeState'; // Asegúrate que la ruta es correcta
import * as THREE from 'three';

interface PuckProps {
  puckData: PuckData | null;
  radius?: number;
  color?: string;
}

// Componente para crear la estela visual del puck
const PuckTrail: React.FC<{position: THREE.Vector3, color: string}> = ({ position, color }) => {
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
        size={0.1}
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
}) => {
  const puckRef = useRef<THREE.Mesh>(null);
  const { scene } = useThree();
  const lastPos = useRef(new THREE.Vector3());
  
  // Efecto para añadir sonido de colisión
  useEffect(() => {
    // Crear un listener de audio (solo se necesita uno por escena)
    if (!scene.getObjectByName('audio-listener')) {
      const listener = new THREE.AudioListener();
      listener.name = 'audio-listener';
      scene.add(listener);
    }
    
    // Crear un sonido para las colisiones
    if (puckRef.current) {
      const sound = new THREE.PositionalAudio(
        scene.getObjectByName('audio-listener') as THREE.AudioListener
      );
      
      // Cargar el sonido (lo intentamos, pero no bloqueamos si no existe)
      try {
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load('/sounds/hit.mp3', buffer => {
          sound.setBuffer(buffer);
          sound.setRefDistance(20);
          sound.setVolume(0.5);
        }, undefined, error => {
          // Solo un log, no bloquea la app
          console.log('Error cargando sonido:', error);
        });
        
        // Añadir el sonido al puck
        puckRef.current.add(sound);
        
        // Guardar referencia al sonido
        const soundRef = sound;
        
        // Limpiar al desmontar
        return () => {
          if (puckRef.current) {
            puckRef.current.remove(soundRef);
          }
        };
      } catch (error) {
        console.log('Error con el sistema de audio:', error);
      }
    }
  }, [scene]);
  
  // Actualizar la posición del puck y calcular velocidad
  useFrame(() => {
    if (!puckRef.current || !puckData) return;

    // Sincronizar la posición del mesh con puckData
    puckRef.current.position.set(
      puckData.position.x,
      puckData.position.y,
      puckData.position.z
    );
    
    // Actualizar posición para el trail
    lastPos.current.set(
      puckData.position.x,
      puckData.position.y,
      puckData.position.z
    );
    
    // Actualizar la rotación basada en la velocidad
    const speed = Math.sqrt(puckData.velocity.x * puckData.velocity.x + puckData.velocity.z * puckData.velocity.z);
    
    if (speed > 0.001) {
      // Rotar el puck en función de la dirección de movimiento
      const angle = Math.atan2(puckData.velocity.z, puckData.velocity.x);
      puckRef.current.rotation.y += speed * 2; // Girar sobre su eje
      
      // Añadir un pequeño tilt en la dirección del movimiento
      puckRef.current.rotation.z = Math.sin(angle) * 0.2 * speed;
      puckRef.current.rotation.x = Math.cos(angle) * 0.2 * speed;
    }
  });

  if (!puckData) {
    return null; // No renderizar si no hay datos del puck
  }

  return (
    <>
      {/* Estela visual del puck */}
      <PuckTrail 
        position={new THREE.Vector3(puckData.position.x, puckData.position.y, puckData.position.z)} 
        color={color} 
      />
      
      {/* El puck */}
      <Sphere 
        ref={puckRef}
        args={[radius, 32, 32]} 
        position={[
          puckData.position.x, 
          puckData.position.y, 
          puckData.position.z
        ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={0.6}
          roughness={0.3} 
          metalness={0.7}
        />
      </Sphere>
      
      {/* Luz que sigue al puck */}
      <pointLight
        position={[puckData.position.x, puckData.position.y + 0.5, puckData.position.z]}
        intensity={1}
        distance={3}
        color={color}
        castShadow
      />
    </>
  );
};

export default Puck; 