# 🏒 Air Hockey 3D Colaborativo

¡Bienvenido al **Air Hockey 3D Colaborativo**! Una experiencia arcade inmersiva en tu navegador que te permite competir contra amigos o practicar tus habilidades en una mesa de aire futurista.

![Air Hockey 3D Banner](https://via.placeholder.com/1200x400?text=Air+Hockey+3D+Colaborativo)

## 🚀 Características Principales

*   **Multijugador en Tiempo Real:** Juega contra otros usuarios en tiempo real gracias a la sincronización de baja latencia.
*   **Gráficos 3D Inmersivos:** Construido con **Three.js** y **React Three Fiber** para una experiencia visual impresionante.
*   **Físicas Realistas:** Un motor de físicas personalizado que simula colisiones, rebotes, fricción y efectos de spin (Magnus) para un juego auténtico.
*   **Sincronización de Estado:** Utiliza **Yjs** y **WebSockets** para asegurar que todos los jugadores vean la misma acción sin importar dónde estén.
*   **Interfaz Moderna:** UI limpia y responsiva para una fácil navegación y control.

## 🛠️ Tecnologías Utilizadas

*   **Frontend:** [React](https://reactjs.org/), [Vite](https://vitejs.dev/)
*   **Gráficos 3D:** [Three.js](https://threejs.org/), [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
*   **Físicas:** Motor de físicas personalizado (Verlet integration, colisiones elásticas)
*   **Colaboración:** [Yjs](https://github.com/yjs/yjs), [y-websocket](https://github.com/yjs/y-websocket)
*   **Estilos:** [CSS Modules](https://github.com/css-modules/css-modules) / CSS estándar

## 📋 Requisitos Previos

Asegúrate de tener instalado lo siguiente antes de comenzar:

*   [Node.js](https://nodejs.org/) (v16 o superior recomendado)
*   [npm](https://www.npmjs.com/) (generalmente incluido con Node.js)

## 🔧 Instalación

1.  **Clona el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/collaborative-3d-app.git
    cd collaborative-3d-app
    ```

2.  **Instala las dependencias:**
    ```bash
    npm install
    ```

## ▶️ Ejecución

Para iniciar el entorno de desarrollo (servidor de WebSocket y cliente Vite concurrentemente):

```bash
npm start
```

Esto lanzará:
-   El servidor de señalización/WebSocket en el puerto 1234 (por defecto).
-   La aplicación cliente en `http://localhost:5173`.

> **Nota:** Si solo quieres ejecutar el cliente (sin servidor local), usa `npm run dev`, pero ten en cuenta que las funciones multijugador requerirán un servidor de WebSocket activo.

## 🎮 Controles

*   **Mouse/Touch:** Arrastra el "mallet" (golpeador) para moverlo por la mesa.
*   **Cámara:** Usa `Click Izquierdo + Arrastrar` para rotar la vista (si está habilitado), o `Scroll` para hacer zoom.
*   **Teclas de Depuración (si están habilitadas):**
    *   `P`: Alternar predicción de trayectoria.
    *   `D`: Alternar panel de depuración.
    *   `H`: Alternar visualización de Hitboxes.

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Por favor, lee nuestro [CONTRIBUTING.md](CONTRIBUTING.md) para más detalles sobre cómo enviar Pull Requests.

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

---

Desarrollado con ❤️ por el equipo de Air Hockey 3D.
