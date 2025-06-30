import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { Vector2 } from '../utils/mathUtils';
import * as THREE from 'three';

interface TrajectoryPreviewProps {
  trajectory: Vector2[];
  visible?: boolean;
  color?: string;
  opacity?: number;
  lineWidth?: number;
  maxPoints?: number;
}

const TrajectoryPreview: React.FC<TrajectoryPreviewProps> = ({
  trajectory,
  visible = true,
  color = '#00ff88',
  opacity = 0.6,
  lineWidth = 2,
  maxPoints = 60
}) => {
  
  // Convertir la trayectoria 2D a puntos 3D para Three.js
  const trajectoryPoints = useMemo(() => {
    if (!trajectory || trajectory.length === 0) return [];
    
    const points: THREE.Vector3[] = [];
    const limitedTrajectory = trajectory.slice(0, maxPoints);
    
    limitedTrajectory.forEach((point) => {
      const y = 0.25; // Altura del puck sobre la mesa
      points.push(new THREE.Vector3(point.x, y, point.z));
    });
    
    return points;
  }, [trajectory, maxPoints]);
  
  // Crear puntos de fade para efectos de desvanecimiento gradual
  const fadedPoints = useMemo(() => {
    if (trajectoryPoints.length === 0) return [];
    
    return trajectoryPoints.map((point, index) => {
      const fadeProgress = index / trajectoryPoints.length;
      return {
        position: point,
        opacity: opacity * (1 - fadeProgress * 0.8)
      };
    });
  }, [trajectoryPoints, opacity]);
  
  if (!visible || trajectoryPoints.length < 2) {
    return null;
  }
  
  return (
    <>
      {/* Línea principal de trayectoria */}
      <Line
        points={trajectoryPoints}
        color={color}
        lineWidth={lineWidth}
        transparent
        opacity={opacity}
      />
      
      {/* Puntos de trayectoria con fade gradual */}
      {fadedPoints.map((point, index) => (
        index % 3 === 0 && ( // Mostrar solo cada 3er punto para mejor rendimiento
          <mesh key={index} position={point.position}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={point.opacity * 0.8}
            />
          </mesh>
        )
      ))}
      
      {/* Punto de destino final (donde se detendría el puck) */}
      {trajectoryPoints.length > 10 && (
        <mesh position={trajectoryPoints[trajectoryPoints.length - 1]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={opacity * 0.9}
          />
          {/* Anillo pulsante alrededor del punto final */}
          <mesh>
            <ringGeometry args={[0.1, 0.15, 16]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={opacity * 0.4}
              side={THREE.DoubleSide}
            />
          </mesh>
        </mesh>
      )}
    </>
  );
};

export default TrajectoryPreview;