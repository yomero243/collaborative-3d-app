import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ExitButtonProps {
  className?: string;
}

export const ExitButton: React.FC<ExitButtonProps> = ({ className = '' }) => {
  const navigate = useNavigate();

  const handleExit = () => {
    // Limpiar el ID del usuario y token del localStorage
    localStorage.removeItem('collab3d-userId');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userName');
    
    // Redirigir a la página de inicio
    navigate('/');
  };

  return (
    <button
      onClick={handleExit}
      className={`bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 ${className}`}
    >
      Salir
    </button>
  );
}; 