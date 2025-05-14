import * as THREE from 'three';
import { useState, useEffect } from 'react';

interface TileFloorProps {
  size?: number;
  position?: [number, number, number];
  tileSize?: number;
  color1?: string;
  color2?: string;
  glowColor?: string;
  glowIntensity?: number;
}

const TileFloor: React.FC<TileFloorProps> = ({
  size = 30,
  position = [0, -1.5, 0],
  tileSize = 2,
  color1 = '#222222',
  color2 = '#444444',
  glowColor = '#1e3a8a',
  glowIntensity = 0.15
}) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    // Creamos una textura de patrón de baldosas programáticamente
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Definimos el tamaño del canvas
    const canvasSize = 256;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    // Calculamos el tamaño de cada baldosa en el canvas
    const tileSizeCanvas = canvasSize / 2;
    
    // Dibujamos el patrón de baldosas
    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    
    ctx.fillStyle = color2;
    // Primera fila de baldosas
    ctx.fillRect(0, 0, tileSizeCanvas, tileSizeCanvas);
    ctx.fillRect(tileSizeCanvas * 2, tileSizeCanvas, tileSizeCanvas, tileSizeCanvas);
    
    // Segunda fila de baldosas
    ctx.fillRect(tileSizeCanvas, 0, tileSizeCanvas, tileSizeCanvas);
    ctx.fillRect(0, tileSizeCanvas, tileSizeCanvas, tileSizeCanvas);
    
    // Creamos la textura a partir del canvas
    const newTexture = new THREE.CanvasTexture(canvas);
    newTexture.wrapS = THREE.RepeatWrapping;
    newTexture.wrapT = THREE.RepeatWrapping;
    newTexture.repeat.set(size / tileSize, size / tileSize);
    
    setTexture(newTexture);
  }, [size, tileSize, color1, color2]);

  if (!texture) return null;

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial 
        map={texture}
        roughness={0.4} 
        metalness={0.6}
        emissive={new THREE.Color(glowColor)}
        emissiveIntensity={glowIntensity}
        emissiveMap={texture}
        toneMapped={false}
      />
    </mesh>
  );
};

export default TileFloor; 