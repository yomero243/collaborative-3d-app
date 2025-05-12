# Air Hockey 3D Colaborativo
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/yomero243/collaborative-3d-app)
Una aplicación de Air Hockey en 3D que permite jugar en línea con otros usuarios en tiempo real.

## Características

- Mesa de Air Hockey en 3D con físicas realistas
- Interacción del paddle con el mouse
- Sistema colaborativo en tiempo real
- Efectos visuales de movimiento
- Sistema de colisiones realista
v1
## Requisitos

- Node.js 16 o superior
- NPM 7 o superior

## Instalación

1. Clona el repositorio:
```bash
git clone <url-del-repositorio>
cd collaborative-3d-app
```

2. Instala las dependencias:
```bash
npm install
```

## Ejecución

Para ejecutar el proyecto necesitas dos terminales, una para el servidor y otra para el cliente:

### Terminal 1 - Servidor WebSocket:
```bash
npm run server
```

### Terminal 2 - Cliente:
```bash
npm run dev
```

O puedes ejecutar ambos con un solo comando:
```bash
npm install concurrently --save-dev
npm run start
```

## Cómo jugar

1. Abre el navegador en la URL indicada por Vite (normalmente http://localhost:5173)
2. Ingresa tu nombre de usuario
3. Usa el mouse para mover tu paddle (cilindro)
4. Intenta golpear el puck hacia la portería del oponente
5. Usa los botones de control para reiniciar el puck o aplicar impulsos aleatorios

## Solución de problemas

Si el puck no aparece o los paddles no responden:
1. Asegúrate de que el servidor WebSocket esté funcionando (Terminal 1)
2. Verifica que no haya errores en la consola del navegador
3. Intenta recargar la página

## Configuración avanzada

Para modificar la URL del servidor WebSocket, edita el archivo `src/hooks/useCollaborativeState.ts` y cambia la URL en la creación del WebsocketProvider.

## Tecnologías Utilizadas

- React 19
- TypeScript
- Three.js
- @react-three/fiber
- @react-three/drei
- Yjs (para sincronización en tiempo real)
- y-websocket (para comunicación WebSocket)
- Vite (como bundler)

## Estructura del Proyecto

- `src/`
  - `components/` - Componentes de React
    - `Scene3D.tsx` - Componente principal de la escena 3D
    - `UserCube.tsx` - Componente que representa un cubo de usuario
    - `UserNameForm.tsx` - Formulario para ingresar nombre de usuario
  - `hooks/`
    - `useCollaborativeState.ts` - Hook personalizado para manejar el estado compartido
  - `App.tsx` - Componente principal de la aplicación
  - `main.tsx` - Punto de entrada

## Licencia

MIT
