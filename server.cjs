// Este es un archivo de servidor para y-websocket
const WebSocket = require('ws')
const http = require('http')
const { setupWSConnection } = require('y-websocket/bin/utils')

const port = 1234
const host = 'localhost'

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('Servidor de y-websocket para Collaborative 3D App\n')
})

const wss = new WebSocket.Server({ server })

wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req, { docName: 'collaborative-hockey-app' })
  console.log('Cliente conectado:', new Date().toLocaleTimeString())
})

server.listen(port, host, () => {
  console.log(`Servidor y-websocket iniciado en: ws://${host}:${port}`)
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