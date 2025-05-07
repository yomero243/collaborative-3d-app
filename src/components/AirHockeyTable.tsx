import { useGLTF } from '@react-three/drei';
import modelUrl from '../assets/Untitled.glb'; // Importar el modelo
// import * as THREE from 'three'; // Eliminado porque no se usa

interface AirHockeyTableProps {
  width?: number;
  height?: number;
  depth?: number;
  color?: string;
}

// const MODEL_PATH = '../assets/Untitled.glb'; // Ya no es necesario, usamos modelUrl

const AirHockeyTable: React.FC<AirHockeyTableProps> = ({
  width = 10,
  // height = 0.2, // Comentado o eliminado ya que el GLB define su propia altura
  depth = 6,
  // color = '#111119', // Comentado o eliminado ya que el GLB tiene sus propios materiales
}) => {
  // Cargar el modelo GLB usando la URL importada
  const { scene } = useGLTF(modelUrl);

  // Clonar la escena para poder manipularla (opcional pero buena práctica si se reutiliza)
  const model = scene.clone();

  return (
    <group>
      {/* Renderizar el modelo GLB cargado */}
      <primitive 
        object={model} 
        scale={[width / 9, depth / 6, 3/ 2]}
        position={[0, -1, 0]}
        receiveShadow 
        castShadow
      />
    </group>
  );
};

export default AirHockeyTable; 