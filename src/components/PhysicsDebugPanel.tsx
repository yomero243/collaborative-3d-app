import React from 'react';
import { Html } from '@react-three/drei';
import { PuckPhysics, CollisionInfo } from '../physics/PhysicsEngine';
import { Vector2, vec2 } from '../utils/mathUtils';

interface PhysicsDebugPanelProps {
  puck: PuckPhysics | null;
  recentCollisions: CollisionInfo[];
  trajectory?: Vector2[];
  visible?: boolean;
  position?: [number, number, number];
}

const PhysicsDebugPanel: React.FC<PhysicsDebugPanelProps> = ({
  puck,
  recentCollisions,
  trajectory = [],
  visible = true,
  position = [0, 3, 0]
}) => {
  
  if (!visible || !puck) {
    return null;
  }
  
  const speed = vec2.length(puck.velocity);
  const lastCollision = recentCollisions[0];
  
  const panelStyle: React.CSSProperties = {
    backgroundColor: 'rgba(0, 20, 40, 0.9)',
    color: '#00ff88',
    padding: '15px',
    borderRadius: '8px',
    fontFamily: 'monospace',
    fontSize: '12px',
    border: '1px solid #00ff88',
    minWidth: '250px',
    backdropFilter: 'blur(5px)'
  };
  
  const sectionStyle: React.CSSProperties = {
    marginBottom: '10px',
    borderBottom: '1px solid rgba(0, 255, 136, 0.3)',
    paddingBottom: '8px'
  };
  
  const valueStyle: React.CSSProperties = {
    color: '#88ff00',
    fontWeight: 'bold'
  };
  
  return (
    <Html position={position} center>
      <div style={panelStyle}>
        <h3 style={{ margin: '0 0 10px 0', color: '#00ddff' }}>
          🔬 Physics Debug Panel
        </h3>
        
        {/* Información básica del puck */}
        <div style={sectionStyle}>
          <div><strong>Position:</strong> ({puck.position.x.toFixed(2)}, {puck.position.z.toFixed(2)})</div>
          <div><strong>Velocity:</strong> ({puck.velocity.x.toFixed(2)}, {puck.velocity.z.toFixed(2)})</div>
          <div><strong>Speed:</strong> <span style={valueStyle}>{speed.toFixed(2)} m/s</span></div>
        </div>
        
        {/* Información de rotación y spin */}
        <div style={sectionStyle}>
          <div><strong>Angular Velocity:</strong> <span style={valueStyle}>{puck.angularVelocity.toFixed(2)} rad/s</span></div>
          <div><strong>Spin:</strong> <span style={valueStyle}>{puck.spin.toFixed(2)}</span></div>
        </div>
        
        {/* Información de masa y fricción */}
        <div style={sectionStyle}>
          <div><strong>Mass:</strong> {puck.mass.toFixed(1)} kg</div>
          <div><strong>Friction:</strong> {puck.friction.toFixed(3)}</div>
          <div><strong>Restitution:</strong> {puck.restitution.toFixed(2)}</div>
        </div>
        
        {/* Información de colisiones */}
        <div style={sectionStyle}>
          <div><strong>Last Collision:</strong></div>
          {lastCollision ? (
            <div style={{ marginLeft: '10px', fontSize: '11px' }}>
              <div>Force: <span style={valueStyle}>{lastCollision.force.toFixed(2)}</span></div>
              <div>Penetration: {lastCollision.penetration.toFixed(3)}</div>
              <div>Normal: ({lastCollision.normal.x.toFixed(2)}, {lastCollision.normal.z.toFixed(2)})</div>
            </div>
          ) : (
            <div style={{ marginLeft: '10px', color: '#666' }}>No recent collisions</div>
          )}
        </div>
        
        {/* Estadísticas de trayectoria */}
        <div style={sectionStyle}>
          <div><strong>Trajectory Points:</strong> <span style={valueStyle}>{trajectory.length}</span></div>
          <div><strong>Total Collisions:</strong> <span style={valueStyle}>{recentCollisions.length}</span></div>
        </div>
        
        {/* Indicadores de estado */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: speed > 0.1 ? '#00ff00' : '#666',
              display: 'inline-block'
            }} />
            <span style={{ fontSize: '10px' }}>Moving</span>
            
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: Math.abs(puck.spin) > 0.5 ? '#ffaa00' : '#666',
              display: 'inline-block'
            }} />
            <span style={{ fontSize: '10px' }}>Spinning</span>
            
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: recentCollisions.length > 0 ? '#ff4444' : '#666',
              display: 'inline-block'
            }} />
            <span style={{ fontSize: '10px' }}>Collisions</span>
          </div>
        </div>
        
        {/* Controles rápidos */}
        <div style={{ marginTop: '10px', fontSize: '10px', color: '#888' }}>
          Press 'P' to toggle trajectory preview<br />
          Press 'D' to toggle debug panel
        </div>
      </div>
    </Html>
  );
};

export default PhysicsDebugPanel;