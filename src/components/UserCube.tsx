import { Text, Cylinder, useGLTF } from '@react-three/drei';
import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Vector3, Group } from 'three';
import * as THREE from 'three';
import { UserData } from '../components/Scene3D';

interface UserCubeProps {
  userData: UserData;
  isCurrentUser: boolean;
  paddleRadius?: number;
  showHitbox?: boolean;
}

const UserCube: React.FC<UserCubeProps> = ({
  userData,
  isCurrentUser,
  paddleRadius = 0.5,
  showHitbox = false,
}) => {
  const groupRef = useRef<Group>(null);
  const hitboxRef = useRef<Mesh>(null);
  
  const { scene: paddleModelScene } = useGLTF('/Paddle.glb');
  
  const initialX = typeof userData.position?.x === 'number' ? userData.position.x : 0;
  const initialY = typeof userData.position?.y === 'number' ? userData.position.y : 0;
  const initialZ = typeof userData.position?.z === 'number' ? userData.position.z : 0;

  const targetPosition = useRef(new Vector3(initialX, initialY, initialZ));
  const lastPosition = useRef(new Vector3(initialX, initialY, initialZ));
  const velocity = useRef(new Vector3(0, 0, 0));

  const [processedPaddleModel, setProcessedPaddleModel] = useState<THREE.Object3D | null>(null);
  const glowIntensity = useRef(2);

  useEffect(() => {
    const posX = typeof userData.position?.x === 'number' ? userData.position.x : 0;
    const posY = typeof userData.position?.y === 'number' ? userData.position.y : 0;
    const posZ = typeof userData.position?.z === 'number' ? userData.position.z : 0;
    targetPosition.current.set(posX, posY, posZ);
    // console.log(`[UserCube ${userData.id.substring(0,3)}] useEffect[userData.position] triggered. New target:`, targetPosition.current, 'Raw userData.position:', userData.position);
  }, [userData.position.x, userData.position.y, userData.position.z, userData.id]);

  useEffect(() => {
    if (paddleModelScene) {
      const modelClone = paddleModelScene.clone();
      modelClone.traverse((child) => {
        if (child instanceof Mesh) {
          if (child.material instanceof THREE.MeshStandardMaterial) {
            const originalMaterial = child.material;
            child.material = originalMaterial.clone();
            child.material.color.set(userData.color);
            child.material.opacity = isCurrentUser ? 1 : 0.7;
            child.material.transparent = !isCurrentUser || showHitbox;
            child.material.roughness = originalMaterial.roughness !== undefined ? originalMaterial.roughness : 0.3;
            child.material.metalness = originalMaterial.metalness !== undefined ? originalMaterial.metalness : 0.7;
          } else {
            // Opcional: manejar otros tipos de material o crear uno nuevo
          }
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      setProcessedPaddleModel(modelClone);
    }
  }, [paddleModelScene, userData.color, isCurrentUser, showHitbox]);

  useFrame((state, delta) => {
    if (isCurrentUser && groupRef.current) {
      groupRef.current.position.copy(targetPosition.current);
      
      // if (delta % 0.5 < 0.016) { // Loguear aproximadamente cada 0.5 segundos
      //   console.log(`[UserCube CUR ${userData.id.substring(0,3)}] useFrame. Target:`, targetPosition.current.x.toFixed(2), targetPosition.current.z.toFixed(2), 'Actual:', groupRef.current.position.x.toFixed(2), groupRef.current.position.z.toFixed(2));
      // }

      if (targetPosition.current.distanceTo(lastPosition.current) > 0.001) {
        velocity.current.subVectors(targetPosition.current, lastPosition.current);
        if (delta > 0) {
            velocity.current.divideScalar(delta);
        }
        
        lastPosition.current.copy(targetPosition.current);
        const speed = velocity.current.length();
        glowIntensity.current = Math.min(10, 1.5 + speed * 2);
      } else {
        velocity.current.set(0, 0, 0);
      }
    } else if (!isCurrentUser && groupRef.current) {
      groupRef.current.position.lerp(targetPosition.current, 0.1);
      
      // if (delta % 0.5 < 0.016) { // Loguear aproximadamente cada 0.5 segundos
      //   console.log(`[UserCube REM ${userData.id.substring(0,3)}] useFrame. Target:`, targetPosition.current.x.toFixed(2), targetPosition.current.z.toFixed(2), 'Actual:', groupRef.current.position.x.toFixed(2), groupRef.current.position.z.toFixed(2));
      // }
    }
    
    if ((isCurrentUser && velocity.current.lengthSq() < 0.01) || !isCurrentUser) {
        if (glowIntensity.current > 1.5) {
            glowIntensity.current = Math.max(1.5, glowIntensity.current * 0.95);
        }
    }
  });

  const originalModelRadius = 3.37417;
  const originalModelMinY = -1.637767;
  const paddleScale = paddleRadius / originalModelRadius;
  const paddlePositionOffsetY = -originalModelMinY * paddleScale;
  const paddlePositionOffset: [number, number, number] = [0, paddlePositionOffsetY, 0];
  const paddleRotation: [number, number, number] = [0, 0, 0];

  return (
    <group ref={groupRef} position={[initialX, initialY, initialZ]}>
      <Cylinder
        ref={hitboxRef}
        position={[0, 0, 0]}
        args={[paddleRadius * 1.15, paddleRadius * 1.15, paddleRadius * 1.5, 32]}
        rotation={[Math.PI / 2, 0, 0]}
        visible={showHitbox}
      >
        <meshBasicMaterial color="red" wireframe={false} transparent opacity={0.5} />
      </Cylinder>
      
      {processedPaddleModel && (
        <primitive
          object={processedPaddleModel}
          scale={paddleScale}
          rotation={paddleRotation}
          position={paddlePositionOffset}
        />
      )}
      
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
          position={[0, -paddleRadius * 0.5, 0]}
          intensity={glowIntensity.current}
          distance={paddleRadius * 4}
          color={userData.color}
        />
      )}
    </group>
  );
};

export default UserCube; 