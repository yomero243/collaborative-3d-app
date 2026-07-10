# 🚀 Despliegue en un home server (CachyOS / Arch Linux)

Guía para servir el juego desde tu propia casa con **DuckDNS + port forwarding**,
sin TLS (todo por `http://`, suficiente para jugar con conocidos).

El `server.cjs` sirve **ambas cosas** en un solo puerto: el frontend compilado
(`dist/`) y el WebSocket de sincronización. Solo necesitas abrir un puerto.

---

## 1. Preparar el server

```bash
sudo pacman -S nodejs npm git

git clone https://github.com/yomero243/collaborative-3d-app.git
cd collaborative-3d-app
npm install
npm run build        # compila el frontend a dist/ (también verifica TypeScript)
```

Prueba manual:

```bash
node server.cjs
```

Desde otra máquina de tu casa abre `http://IP-DEL-SERVER:1234` — debe cargar el
juego y decir "Conectado". Averigua la IP local con `ip addr` (algo como
`192.168.1.X`). Cuando funcione, detenlo con `Ctrl+C`.

> **IP local fija:** entra al panel de tu router y haz una *reserva DHCP* para
> la MAC de tu server, para que su IP local nunca cambie.

## 2. Dejarlo corriendo siempre (systemd)

Crea `/etc/systemd/system/airhockey.service` (cambia `TU_USUARIO` y la ruta):

```ini
[Unit]
Description=Air Hockey 3D (frontend + y-websocket)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=TU_USUARIO
WorkingDirectory=/home/TU_USUARIO/collaborative-3d-app
ExecStart=/usr/bin/node server.cjs
Environment=PORT=1234
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now airhockey    # arranca ahora y en cada boot
systemctl status airhockey               # verificar
journalctl -u airhockey -f               # ver logs en vivo
```

**Firewall:** CachyOS normalmente no trae firewall activo. Si usas uno:

```bash
# firewalld
sudo firewall-cmd --permanent --add-port=1234/tcp && sudo firewall-cmd --reload
# ufw
sudo ufw allow 1234/tcp
```

## 3. DuckDNS (nombre de dominio gratis)

1. Entra a [duckdns.org](https://www.duckdns.org) (login con GitHub/Google).
2. Crea un subdominio, p. ej. `mihockey` → `mihockey.duckdns.org`.
3. Copia tu **token**.

DuckDNS necesita conocer tu IP pública cada vez que cambie. Dos opciones:

**Opción fácil — el router lo hace:** muchos routers tienen sección
"DDNS / DNS dinámico" con soporte para DuckDNS. Si el tuyo la tiene,
configúralo ahí con tu subdominio y token, y sáltate lo siguiente.

**Opción en el server — systemd timer:**

```bash
mkdir -p ~/duckdns
cat > ~/duckdns/duck.sh << 'EOF'
#!/bin/sh
echo url="https://www.duckdns.org/update?domains=TUSUBDOMINIO&token=TUTOKEN&ip=" \
  | curl -k -o ~/duckdns/duck.log -K -
EOF
chmod +x ~/duckdns/duck.sh
```

`/etc/systemd/system/duckdns.service`:

```ini
[Unit]
Description=Actualizar IP en DuckDNS

[Service]
Type=oneshot
User=TU_USUARIO
ExecStart=/home/TU_USUARIO/duckdns/duck.sh
```

`/etc/systemd/system/duckdns.timer`:

```ini
[Unit]
Description=Actualizar DuckDNS cada 5 minutos

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now duckdns.timer
cat ~/duckdns/duck.log   # debe decir OK
```

## 4. Port forwarding (router)

1. Entra al panel de administración del router (usualmente `192.168.1.1` o
   `192.168.0.1`; usuario/contraseña suelen venir en la etiqueta del aparato).
2. Busca la sección **"Port Forwarding"**, **"NAT"**, **"Virtual Server"** o
   **"Juegos y aplicaciones"** según la marca.
3. Crea una regla: protocolo **TCP**, puerto externo **1234** → IP local del
   server, puerto interno **1234**.

> **⚠️ Verifica que no estés detrás de CGNAT:** compara la "IP WAN" que
> muestra tu router con la que ves en [whatismyip.com](https://www.whatismyip.com).
> Si **no coinciden**, tu proveedor te comparte la IP con otros clientes
> (CGNAT) y el port forwarding no funcionará — tendrías que pedirle al ISP una
> IP pública, o usar Cloudflare Tunnel en su lugar.

## 5. ¡A jugar!

Comparte con tus amigos:

```
http://TUSUBDOMINIO.duckdns.org:1234
```

Todos los que entren caen en la misma sala.

## Actualizar el juego después de cambios

```bash
cd ~/collaborative-3d-app
git pull
npm install
npm run build
sudo systemctl restart airhockey
```

## Nivel 2 (opcional): HTTPS con Caddy

Cuando quieras el candadito (`https://` y `wss://`):

1. `sudo pacman -S caddy`
2. Redirige también los puertos **80 y 443** del router al server.
3. `/etc/caddy/Caddyfile`:

   ```
   TUSUBDOMINIO.duckdns.org {
       reverse_proxy localhost:1234
   }
   ```

4. `sudo systemctl enable --now caddy`

Caddy obtiene y renueva el certificado de Let's Encrypt automáticamente.
Con esto el juego queda en `https://TUSUBDOMINIO.duckdns.org` (sin `:1234`), y
además podrías apuntar un frontend en Netlify al websocket de tu casa
compilando con `VITE_WS_URL=wss://TUSUBDOMINIO.duckdns.org`.
