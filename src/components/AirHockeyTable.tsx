import { useGLTF, Grid } from '@react-three/drei';
import modelUrl from '../assets/Untitled.glb'; // Importar el modelo
import { ThreeEvent } from '@react-three/fiber'; // Importar ThreeEvent
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
        onPointerMove={onPointerMove} // Pasar la prop
        onPointerLeave={onPointerLeave} // Pasar la prop
      />
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