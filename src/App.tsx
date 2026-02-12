import { useState, useEffect, useMemo, useCallback } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import './App.css'
import Scene3D, { UserData as SceneUserData, PuckData as ScenePuckData } from './components/Scene3D'
import UserNameForm from './components/UserNameForm'
import { ExitButton } from './components/ExitButton'
import { useCollaborativeState, UserData, PuckState } from './hooks/useCollaborativeState'

function GameComponent() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userScore, setUserScore] = useState<number>(0)
  const [isMouseOverTable, setIsMouseOverTable] = useState(false)
  const [isInfoPanelVisible, setIsInfoPanelVisible] = useState(true)

  const { users, puck, userId, updateCurrentUserPosition, applyImpulseToPuck, yDoc, updateUserName, isConnected } = useCollaborativeState(
    "air-hockey-app",
    "ws://localhost:1234"
  )

  const currentUserInHook = useMemo(() => users.find(user => user.id === userId) || null, [users, userId])

  const adaptUserToScene = useCallback((user: UserData): SceneUserData => ({
    id: user.id,
    name: user.userName,
    color: user.color,
    position: { x: user.x, y: 0.1, z: user.y },
    score: userScore,
  }), [userScore])

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

  const resetPuck = useCallback(() => {
    if (!yDoc) return
    const puckMap = yDoc.getMap('puck')
    puckMap.set('state', { x: 0, y: 0, vx: 0, vy: 0 })
  }, [yDoc])

  useEffect(() => {
    const storedName = localStorage.getItem('userName');
    if (storedName) {
      updateUserName(storedName);
    }
  }, [updateUserName]);

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
      <div className={`info-panel ${isMouseOverTable ? 'info-panel-hidden' : ''} ${!isInfoPanelVisible ? 'hidden-mobile' : ''}`}>
        <div className="flex justify-between items-center mb-4">
          <h1>Air Hockey 3D</h1>
          <div className="flex gap-2">
            <button
              className="md:hidden text-white border border-white rounded px-2 py-1 text-xs"
              onClick={() => setIsInfoPanelVisible(false)}
            >
              Ocultar
            </button>
            <ExitButton className="ml-4" />
          </div>
        </div>
        {sceneCurrentUser && (
          <>
            <p>Jugador: <span style={{ color: sceneCurrentUser.color }}>{sceneCurrentUser.name}</span></p>
            <p>Puntaje: {sceneCurrentUser.score}</p>
          </>
        )}
        <p>Usuarios conectados: {users.length}</p>

        <div className="players-list">
          <h2 className="text-lg font-semibold mb-2">Jugadores:</h2>
          {users.map(user => (
            <div key={user.id} className="player-item">
              <span style={{ color: user.color }}>
                {user.userName} {user.id === userId ? '(Tú)' : ''}
              </span>
            </div>
          ))}
        </div>

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
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></div>
          <span>{isConnected ? 'Conectado' : 'Desconectado (Servidor no iniciado)'}</span>
        </div>
      </div>

      <Scene3D
        users={usersMapForScene}
        currentUser={sceneCurrentUser}
        puck={scenePuck}
        onUpdatePosition={handleUpdatePosition}
        applyImpulseToPuck={applyImpulseToPuck}
        onMouseOverTable={setIsMouseOverTable}
      />
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<NameEntry />} />
        <Route path="/game" element={<GamePage />} />
      </Routes>
    </Router>
  )
}

const NameEntry = () => {
  const navigate = useNavigate();
  if (localStorage.getItem('userName')) {
    return <Navigate to="/game" replace />;
  }
  return (
    <UserNameForm
      initialName=""
      onSubmit={(name) => {
        localStorage.setItem('userName', name);
        navigate('/game');
      }}
    />
  );
};

const GamePage = () => {
  if (!localStorage.getItem('userName')) {
    return <Navigate to="/" replace />;
  }
  return <GameComponent />;
};

export default App
