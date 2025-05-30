import { useGLTF, Grid } from '@react-three/drei';
import { ThreeEvent, useFrame } from '@react-three/fiber'; // Importar ThreeEvent y useFrame
import modelUrl from '../assets/Untitled.glb'; // Importar el modelo
import * as THREE from 'three'; // Importar THREE
import { useState, useEffect, useRef } from 'react';
import textureUrl from '../assets/Material.001_baseColor_1001.png'; // Importar la textura
import normalMapUrl from '../assets/Material.001_normal_1001.png'; // Importar mapa de normales
import ormMapUrl from '../assets/Material.001_occlusionRoughnessMetallic_1001.png'; // Importar mapa ORM
// import * as THREE from 'three'; // Eliminado porque no se usa

interface AirHockeyTableProps {
  width?: number;
  height?: number;
  depth?: number;
  color?: string;
  onPointerMove?: (event: ThreeEvent<PointerEvent>) => void; // Nueva prop
  onPointerLeave?: (event: ThreeEvent<PointerEvent>) => void; // Nueva prop
  showGrid?: boolean; // Nueva propiedad
}

// const MODEL_PATH = '../assets/Untitled.glb'; // Ya no es necesario, usamos modelUrl

const AirHockeyTable: React.FC<AirHockeyTableProps> = ({
  width = 10,
  // height = 0.2, // Comentado o eliminado ya que el GLB define su propia altura
  depth = 6,
  // color = '#111119', // Comentado o eliminado ya que el GLB tiene sus propios materiales
  onPointerMove,
  onPointerLeave,
  showGrid = false, // Valor por defecto
}) => {
  // Cargar el modelo GLB usando la URL importada
  const { scene } = useGLTF(modelUrl);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const neonGlowRef = useRef<THREE.Mesh>(null);
  const neonIntensityRef = useRef(0);
  const neonColorRef = useRef(new THREE.Color(0x00ffff)); // Color neón cian por defecto

  // Efecto de animación para el brillo neón
  useFrame(() => {
    if (neonGlowRef.current) {
      // Animar la intensidad del brillo neón
      neonIntensityRef.current = 0.5 + Math.sin(Date.now() * 0.002) * 0.2;
      
      // Aplicar la intensidad a la emisión del material
      const material = neonGlowRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = neonIntensityRef.current;
      
      // Cambiar ligeramente el color del neón para un efecto más dinámico
      neonColorRef.current.setHSL(
        (Math.sin(Date.now() * 0.001) * 0.1 + 0.5) % 1, // Hue oscila alrededor del cian
        0.8, // Saturación
        0.6  // Luminosidad
      );
      material.emissive.copy(neonColorRef.current);
    }
  });

  // Cargar las texturas
  useEffect(() => {
    const textureLoader = new THREE.TextureLoader();
    
    // Cargar texturas asegurando que los parámetros estén correctamente configurados
    const baseTexture = textureLoader.load(textureUrl);
    const normalTexture = textureLoader.load(normalMapUrl);
    const ormTexture = textureLoader.load(ormMapUrl);
    
    // Configurar correctamente las texturas
    [baseTexture, normalTexture, ormTexture].forEach(texture => {
      texture.flipY = false; // Las texturas GLTF no deben voltear en Y
      texture.colorSpace = THREE.SRGBColorSpace; // Usar SRGBColorSpace en lugar de encoding
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    });
    
    // Clonar la escena
    const clonedScene = scene.clone();
    
    // Aplicar las texturas
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Asegurarnos que la geometría tiene UVs
        if (child.geometry && !child.geometry.attributes.uv2 && child.geometry.attributes.uv) {
          child.geometry.setAttribute('uv2', child.geometry.attributes.uv);
        }
        
        if (child.material) {
          // Procesamos material único o array de materiales
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          
          materials.forEach(mat => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              // Aplicar texturas con configuración correcta
              mat.map = baseTexture;
              mat.normalMap = normalTexture;
              
              // Configurar el mapa ORM
              mat.aoMap = ormTexture;
              mat.roughnessMap = ormTexture;
              mat.metalnessMap = ormTexture;
              
              // Ajustar parámetros para los canales específicos del mapa ORM
              // Normalmente: R = Oclusión, G = Rugosidad, B = Metalicidad
              mat.aoMapIntensity = 1.0;
              mat.roughness = 0.6; // Reducir rugosidad para efecto más brillante
              mat.metalness = 0.8; // Aumentar metalicidad para efecto más brillante
              
              // Ajustar repetición de textura si es necesario
              // Descomenta y ajusta estos valores si necesitas cambiar la escala de los UVs
              // baseTexture.repeat.set(2, 2);
              // normalTexture.repeat.set(2, 2);
              // ormTexture.repeat.set(2, 2);
              
              mat.needsUpdate = true;
            }
          });
        }
      }
    });
    
    setModel(clonedScene);
  }, [scene]);

  if (!model) {
    return null; // O algún componente de carga
  }

  return (
    <group>
      {/* Renderizar el modelo GLB cargado */}
      <primitive 
        object={model} 
        scale={[width / 9, depth / 6, 3/ 2]}
        position={[0, -1, 0]}
        receiveShadow 
        castShadow
        onPointerMove={onPointerMove} // Pasar la prop
        onPointerLeave={onPointerLeave} // Pasar la prop
      />
      
      {/* Efecto de brillo neón alrededor de la mesa */}
      <mesh 
        ref={neonGlowRef}
        position={[0, -0.95, 0]} 
        scale={[width * 1.02, 0.05, depth * 1.02]}
      >
        <boxGeometry />
        <meshStandardMaterial
          color="#111111"
          emissive={neonColorRef.current}
          emissiveIntensity={1}
          toneMapped={false}
        />
      </mesh>
      
      {/* Luz puntual para aumentar el efecto de brillo */}
      <pointLight 
        position={[0, -0.5, 0]} 
        color={neonColorRef.current} 
        intensity={2} 
        distance={10}
      />
      
      {/* Plano invisible para mejorar la detección de eventos del mouse */}
      <mesh 
        position={[0, 0.1, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      
      {showGrid && (
        <Grid
          position={[0, 0.15, 0]} // Mantener la rejilla elevada
          args={[width, depth]} 
          cellSize={0.5}
          cellThickness={0.03} // Aumentar grosor ligeramente
          cellColor="red" 
          sectionSize={1}
          sectionThickness={0.03} // Aumentar grosor ligeramente
          sectionColor="red" // Cambiar a rojo para que toda la rejilla sea roja
          fadeDistance={25}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid={false}
        />
      )}
    </group>
  );
};

export default AirHockeyTable; 