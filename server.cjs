// Servidor de y-websocket + frontend estático para Collaborative 3D App
const WebSocket = require('ws')
const http = require('http')
const path = require('path')
const fs = require('fs')
const express = require('express')
const { setupWSConnection } = require('y-websocket/bin/utils')

// Configurables por variables de entorno (con valores por defecto para desarrollo)
const port = parseInt(process.env.PORT, 10) || 1234
const host = process.env.HOST || '0.0.0.0'

const app = express()

// Servir el frontend compilado si existe (generado con `npm run build`)
const distPath = path.join(__dirname, 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  // Fallback de SPA: cualquier ruta no encontrada devuelve index.html (react-router)
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
  console.log('Sirviendo frontend desde:', distPath)
} else {
  app.get('/', (_req, res) => {
    res
      .status(200)
      .send('Servidor de y-websocket para Collaborative 3D App\nEjecuta "npm run build" para servir también el juego desde aquí.\n')
  })
  console.log('Aviso: no existe la carpeta dist/. Solo se servirá el WebSocket (ejecuta "npm run build" para servir el juego).')
}

const server = http.createServer(app)

const wss = new WebSocket.Server({ server })

wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req)
  console.log('Cliente conectado:', new Date().toLocaleTimeString())
})

server.listen(port, host, () => {
  console.log(`Servidor iniciado en: http://${host}:${port} (WebSocket en el mismo puerto)`)
  console.log('Para detener el servidor: Ctrl+C')
})

// Manejar señales de cierre para cerrar limpiamente
process.on('SIGINT', () => {
  console.log('\nCerrando servidor...')
  wss.close(() => {
    console.log('Servidor WebSocket cerrado.')
    server.close(() => {
      console.log('Servidor HTTP cerrado.')
      process.exit(0)
    })
  })
})
