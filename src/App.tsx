import { useState, useEffect, useMemo, useCallback } from 'react'
import './App.css'
import Scene3D, { UserData as SceneUserData, PuckData as ScenePuckData } from './components/Scene3D'
import UserNameForm from './components/UserNameForm'
import { useCollaborativeState, UserData, PuckState } from './hooks/useCollaborativeState'

function App() {
  const initialUserName = useMemo(() => localStorage.getItem('userName'), [])
  const [userName, setUserNameState] = useState<string>(initialUserName || 'Player')
  const [hasEnteredName, setHasEnteredName] = useState<boolean>(!!initialUserName)
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userScore, setUserScore] = useState<number>(0)
  
  const { users, puck, userId, updateCurrentUserPosition, applyImpulseToPuck, yDoc } = useCollaborativeState(
    "air-hockey-app",
    "ws://localhost:1234"
  )

  const currentUserInHook = useMemo(() => users.find(user => user.id === userId) || null, [users, userId])

  const adaptUserToScene = useCallback((user: UserData): SceneUserData => ({
    id: user.id,
    name: userName,
    color: user.color,
    position: { x: user.x, y: 0.1, z: user.y },
    score: userScore,
  }), [userName, userScore])

  const adaptPuckToScene = useCallback((puckState: PuckState | null): ScenePuckData | null => {
    if (!puckState) return null
    return {
      position: { x: puckState.x, y: 0.05, z: puckState.y },
      velocity: { x: puckState.vx, z: puckState.vy },
    }
  }, [])

  const handleUpdatePosition = useCallback((position: { x: number; y: number; z: number }) => {
    updateCurrentUserPosition({ x: position.x, y: position.z })
  }, [updateCurrentUserPosition])

  const handleSetUserName = useCallback((name: string) => {
    setUserNameState(name)
    localStorage.setItem('userName', name)
    setHasEnteredName(true)
  }, [])

  const resetPuck = useCallback(() => {
    if (!yDoc) return
    const puckMap = yDoc.getMap('puck')
    puckMap.set('state', { x: 0, y: 0, vx: 0, vy: 0 })
  }, [yDoc])

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'userName' && event.newValue) {
        setUserNameState(event.newValue)
        setHasEnteredName(true)
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])
  
  const showNameForm = !hasEnteredName

  const usersMapForScene = useMemo(() => {
    const map = new Map<string, SceneUserData>()
    users.forEach(user => {
      map.set(user.id, adaptUserToScene(user))
    })
    return map
  }, [users, adaptUserToScene])

  const sceneCurrentUser = useMemo(() => 
    currentUserInHook ? adaptUserToScene(currentUserInHook) : null,
    [currentUserInHook, adaptUserToScene]
  )

  const scenePuck = useMemo(() => 
    adaptPuckToScene(puck),
    [puck, adaptPuckToScene]
  )

  return (
    <div className="app">
      {showNameForm && (
        <UserNameForm 
          initialName={userName}
          onSubmit={handleSetUserName} 
        />
      )}
      
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
        
        <div className="controls">
          <button onClick={resetPuck} className="control-button">
            Reiniciar Puck
          </button>
          <button onClick={() => applyImpulseToPuck((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2)} className="control-button">
            Impulso Aleatorio
          </button>
        </div>

        <div className="server-status">
          <div className={`status-indicator ${puck ? 'connected' : 'disconnected'}`}></div>
          <span>{puck ? 'Conectado' : 'Desconectado'}</span>
        </div>
      </div>
      
      <Scene3D 
        users={usersMapForScene} 
        currentUser={sceneCurrentUser} 
        puck={scenePuck}
        onUpdatePosition={handleUpdatePosition}
        applyImpulseToPuck={applyImpulseToPuck}
      />
    </div>
  )
}

export default App
