import { useState, useEffect, useMemo } from 'react'
import './App.css'
import Scene3D, { UserData as SceneUserData, PuckData as ScenePuckData } from './components/Scene3D'
import UserNameForm from './components/UserNameForm'
import { useCollaborativeState, UserData, PuckState } from './hooks/useCollaborativeState'

function App() {
  // Estado para controlar si el usuario ha ingresado su nombre
  const [hasEnteredName, setHasEnteredName] = useState(false)
  // Estado para el nombre del usuario
  const [userName, setUserNameState] = useState<string>(() => localStorage.getItem('userName') || 'Player')
  // Estado para la puntuación (ya que no está en la nueva UserData)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userScore, setUserScore] = useState<number>(0)
  
  // Obtener el estado colaborativo usando nuestro hook personalizado
  // Ahora con la nueva API
  const { users, puck, userId, updateCurrentUserPosition, applyImpulseToPuck, yDoc } = useCollaborativeState(
    "air-hockey-app", // Nombre de la sala
    "ws://localhost:1234" // URL local del servidor WebSocket
  )

  // Encontrar el usuario actual basado en userId
  const currentUser = useMemo(() => {
    return users.find(user => user.id === userId) || null;
  }, [users, userId]);

  // Traducir UserData a SceneUserData para mantener compatibilidad
  const adaptUserToScene = (user: UserData): SceneUserData => {
    return {
      id: user.id,
      name: userName, // Usa el nombre del estado local
      color: user.color,
      position: { x: user.x, y: 0.1, z: user.y }, // Adapta coordenadas
      score: userScore // Usa la puntuación del estado local
    };
  };

  // Adaptar PuckState al formato que espera Scene3D
  const adaptPuckToScene = (puckState: PuckState | null): ScenePuckData | null => {
    if (!puckState) return null;
    return {
      position: { x: puckState.x, y: 0.05, z: puckState.y }, // Adapta coordenadas
      velocity: { x: puckState.vx, z: puckState.vy } // Adapta velocidades
    };
  };

  // Función para actualizar la posición del usuario
  const updateUserPosition = (position: { x: number; y: number; z: number }) => {
    // La nueva API usa updateCurrentUserPosition que espera { x, y }
    // Asumimos que z en el viejo modelo es y en el nuevo
    updateCurrentUserPosition({ x: position.x, y: position.z });
  };

  // Función para actualizar el nombre del usuario
  const setUserName = (name: string) => {
    // Guardar nombre en estado local y localStorage
    setUserNameState(name);
    localStorage.setItem('userName', name);
    
    // En la nueva versión, podríamos intentar guardar metadata adicional, pero
    // como UserData ya no tiene name, lo manejamos localmente
  };

  // Función para resetear el puck
  const resetPuck = () => {
    if (!yDoc) return;
    
    const puckMap = yDoc.getMap('puck');
    puckMap.set('state', { x: 0, y: 0, vx: 0, vy: 0 });
  };

  // Comprobar si ya existe un nombre guardado en localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('userName')
    if (savedName && currentUser) {
      setHasEnteredName(true)
      setUserNameState(savedName);
    }
  }, [currentUser]);

  // Manejar el envío del formulario de nombre
  const handleNameSubmit = (name: string) => {
    setUserName(name)
    setHasEnteredName(true)
  }

  // Resetear el puck a la posición inicial
  const handleResetPuck = () => {
    resetPuck();
  }

  // Aplicar un impulso aleatorio al puck
  const handleRandomImpulse = () => {
    // En air hockey, los impulsos tienden a ser más fuertes y direccionales
    // Generar un ángulo aleatorio
    const angle = Math.random() * Math.PI * 2; // 0-360 grados en radianes
    
    // Fuerza del impulso (más fuerte para air hockey)
    const force = 0.5 + Math.random() * 0.8; // Entre 0.5 y 1.3
    
    // Calcular componentes X e Y del impulso basado en ángulo y fuerza
    const impulseX = Math.cos(angle) * force;
    const impulseY = Math.sin(angle) * force;
    
    console.log(`Aplicando impulso aleatorio: ángulo=${(angle * 180 / Math.PI).toFixed(1)}°, fuerza=${force.toFixed(2)}`);
    
    // La nueva API usa vx, vy en lugar de impulseX, impulseZ
    applyImpulseToPuck(impulseX, impulseY);
  }

  // Si el currentUser no existe y no se ha ingresado nombre, mostramos el form.
  // Si sí existe, pero no se ha ingresado (hasEnteredName es false), también.
  const showNameForm = !currentUser || !hasEnteredName

  // Crear un Map simulado para compatibilidad con el componente Scene3D
  // que espera un Map<string, SceneUserData>
  const usersMap = useMemo(() => {
    const map = new Map<string, SceneUserData>();
    users.forEach(user => {
      map.set(user.id, adaptUserToScene(user));
    });
    return map;
  }, [users, userName, userScore]);

  // Preparar el usuario actual en formato legacy para la UI
  const sceneCurrentUser = useMemo(() => {
    return currentUser ? adaptUserToScene(currentUser) : null;
  }, [currentUser, userName, userScore]);

  // Convertir el puck al formato que espera Scene3D
  const scenePuck = useMemo(() => {
    return adaptPuckToScene(puck);
  }, [puck]);

  return (
    <div className="app">
      {showNameForm && (
        <UserNameForm 
          initialName={userName} 
          onSubmit={handleNameSubmit} 
        />
      )}
      
      {/* Información sobre la escena */}
      <div className="info-panel">
        <h1>Air Hockey 3D</h1>
        {sceneCurrentUser && (
          <> 
            <p>Jugador: <span style={{ color: sceneCurrentUser.color }}>{sceneCurrentUser.name}</span></p>
            <p>Puntaje: {sceneCurrentUser.score}</p>
          </>
        )}
        <p>Usuarios conectados: {users.length}</p>
        <p className="instructions">
          Arrastra tu paddle con el mouse para moverlo.
          <br />
          ¡Intenta golpear el puck para mandarlo a la meta rival!
        </p>
        
        {/* Botones de control */}
        <div className="controls">
          <button onClick={handleResetPuck} className="control-button">
            Reiniciar Puck
          </button>
          <button onClick={handleRandomImpulse} className="control-button">
            Impulso Aleatorio
          </button>
        </div>

        {/* Información de estado del servidor */}
        <div className="server-status">
          <div className={`status-indicator ${puck ? 'connected' : 'disconnected'}`}></div>
          <span>{puck ? 'Conectado' : 'Desconectado'}</span>
        </div>
      </div>
      
      {/* Escena 3D */}
      <Scene3D 
        users={usersMap} 
        currentUser={sceneCurrentUser} 
        puck={scenePuck}
        onUpdatePosition={updateUserPosition} 
      />
    </div>
  )
}

export default App
