import { Canvas } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import UserCube from './UserCube';
import AirHockeyTable from './AirHockeyTable';
import Puck from './Puck';

export interface UserData {
  id: string;
  name: string;
  color: string;
  position: { x: number; y: number; z: number };
  score: number;
}

export interface PuckData {
  position: { x: number; y: number; z: number };
  velocity: { x: number; z: number };
}

interface Scene3DProps {
  users: Map<string, UserData>;
  currentUser: UserData | null;
  puck: PuckData | null;
  onUpdatePosition: (position: { x: number; y: number; z: number }) => void;
}

const Scene3D: React.FC<Scene3DProps> = ({ users, currentUser, puck, onUpdatePosition }) => {
  const TABLE_WIDTH = 10;
  const TABLE_DEPTH = 6;
  const PADDLE_RADIUS = 0.5;

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Canvas 
        camera={{ position: [0, TABLE_DEPTH * 0.8, TABLE_DEPTH * 1.2], fov: 60 }}
        shadows
      >
       {/*OrbitControls 
            enableDamping 
            dampingFactor={0.1}
            target={[0, 0, 0]}
            minDistance={TABLE_DEPTH / 2}
            maxDistance={TABLE_DEPTH * 2.5}
            minPolarAngle={Math.PI / 8}
            maxPolarAngle={Math.PI / 2 - 0.05}
          />*/}
        
       
          <color attach="background" args={['#111827']} />
          
          <ambientLight intensity={0.5} />
          <directionalLight 
              position={[TABLE_WIDTH, TABLE_DEPTH * 2, TABLE_DEPTH]} 
            intensity={1.5} 
            castShadow 
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={50}
            shadow-camera-left={-TABLE_WIDTH * 1.5}
            shadow-camera-right={TABLE_WIDTH * 1.5}
            shadow-camera-top={TABLE_DEPTH * 1.5}
            shadow-camera-bottom={-TABLE_DEPTH * 1.5}
        />
        <directionalLight position={[-TABLE_WIDTH, 10, -TABLE_DEPTH/2]} intensity={0.5} />
        
        {/* Luces de portería */}
        <pointLight position={[-TABLE_WIDTH - 0.5, 1, 0]} intensity={2} distance={3} color="red" />
        <pointLight position={[TABLE_WIDTH + 0.5, 1, 0]} intensity={2} distance={3} color="blue" />
        
        <Environment preset="sunset" />
        
        {/* Efecto de sombra suave */}
        <ContactShadows
          position={[0, -TABLE_DEPTH/2 - 0.01, 0]}
          opacity={0.4}
          scale={20}
          blur={1.5}
          far={4.5}
        />
        
        <AirHockeyTable width={TABLE_WIDTH} depth={TABLE_DEPTH} />
        
        <Puck puckData={puck} radius={0.25} showHitbox={true} />

        {Array.from(users.values()).map((userData) => (
          <UserCube
            key={userData.id}
            userData={userData}
            isCurrentUser={currentUser?.id === userData.id}
            onPositionUpdate={
              currentUser?.id === userData.id ? onUpdatePosition : undefined
            }
            tableWidth={TABLE_WIDTH}
            tableDepth={TABLE_DEPTH}
            paddleRadius={PADDLE_RADIUS}
          />
        ))}
      </Canvas>
    </div>
  );
};

export default Scene3D; 