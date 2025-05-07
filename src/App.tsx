import { useState, useEffect } from 'react'
import './App.css'
import Scene3D from './components/Scene3D'
import UserNameForm from './components/UserNameForm'
import { useCollaborativeState } from './hooks/useCollaborativeState'

function App() {
  // Estado para controlar si el usuario ha ingresado su nombre
  const [hasEnteredName, setHasEnteredName] = useState(false)
  
  // Obtener el estado colaborativo usando nuestro hook personalizado
  const { users, currentUser, puck, updateUserPosition, setUserName, resetPuck, applyImpulseToPuck } = useCollaborativeState()

  // Comprobar si ya existe un nombre guardado en localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('userName')
    if (savedName && currentUser) {
      setHasEnteredName(true)
    }
  }, [currentUser])

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
    const randomX = (Math.random() - 0.5) * 0.4;
    const randomZ = (Math.random() - 0.5) * 0.4;
    applyImpulseToPuck(randomX, randomZ);
  }

  // Si el currentUser no existe y no se ha ingresado nombre, mostramos el form.
  // Si sí existe, pero no se ha ingresado (hasEnteredName es false), también.
  const showNameForm = !currentUser || !hasEnteredName

  return (
    <div className="app">
      {showNameForm && (
        <UserNameForm 
          initialName={currentUser?.name || localStorage.getItem('userName') || ''} 
          onSubmit={handleNameSubmit} 
        />
      )}
      
      {/* Información sobre la escena */}
      <div className="info-panel">
        <h1>Air Hockey 3D</h1>
        {currentUser && (
          <> 
            <p>Jugador: <span style={{ color: currentUser.color }}>{currentUser.name}</span></p>
            <p>Puntaje: {currentUser.score}</p>
          </>
        )}
        <p>Usuarios conectados: {users.size}</p>
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
        users={users} 
        currentUser={currentUser} 
        puck={puck}
        onUpdatePosition={updateUserPosition} 
      />
    </div>
  )
}

export default App
