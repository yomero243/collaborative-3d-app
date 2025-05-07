import { useState } from 'react';

interface UserNameFormProps {
  initialName?: string;
  onSubmit: (name: string) => void;
}

// Estilos como objetos para usar con style={{}}
const styles = {
  userNameForm: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
  },
  form: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center' as const,
  },
  heading: {
    marginTop: 0,
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    margin: '1rem 0',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '1rem',
  },
  button: {
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  },
  buttonHover: {
    backgroundColor: '#45a049',
  }
};

const UserNameForm: React.FC<UserNameFormProps> = ({ initialName = '', onSubmit }) => {
  // Estado para el nombre del usuario
  const [name, setName] = useState(initialName);
  // Estado para el hover del botón
  const [isButtonHovered, setIsButtonHovered] = useState(false);

  // Manejar el envío del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <div style={styles.userNameForm}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h2 style={styles.heading}>Introduce tu nombre</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre aquí"
          required
          autoFocus
          style={styles.input}
        />
        <button 
          type="submit"
          style={{...styles.button, ...(isButtonHovered ? styles.buttonHover : {})}}
          onMouseEnter={() => setIsButtonHovered(true)}
          onMouseLeave={() => setIsButtonHovered(false)}
        >
          Entrar a la escena 3D
        </button>
      </form>
    </div>
  );
};

export default UserNameForm; 