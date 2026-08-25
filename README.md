# 🌸 ClaudiaRivera-Beauty-Bot — Bot de Citas

Sistema de agendado con recordatorios automáticos por WhatsApp usando Twilio + Node.js + SQLite.

---

## ⚡ Instalación local

```bash
# 1. Clonar / descomprimir el proyecto
cd ClaudiaRivera-Beauty-Bot

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales de Twilio

# 4. Correr en desarrollo
npm run dev

# El servidor corre en http://localhost:3000
```

---

## 🔑 Configurar Twilio (paso a paso)

### 1. Crear cuenta
- Ve a https://twilio.com/try-twilio
- Regístrate gratis (te dan $15 USD de crédito)
- Verifica tu correo

### 2. Obtener credenciales
- En el dashboard ve a **Account Info** (esquina inferior izquierda)
- Copia `Account SID` y `Auth Token`
- Pégalos en tu `.env`

### 3. Activar WhatsApp Sandbox (para pruebas)
- En el panel: **Messaging → Try it out → Send a WhatsApp message**
- Verás un número tipo `+1 415 523 8886`
- Desde tu WhatsApp manda el código que aparece, ej: `join silver-table`
- Ya puedes recibir mensajes de prueba

### 4. Número WhatsApp permanente (producción)
- **Phone Numbers → Buy a number** (~$1 USD/mes)
- Solicita habilitación de WhatsApp Business desde el panel
- Twilio hace el trámite con Meta (~1-3 días hábiles)

---

## 🚀 Deploy en Railway (gratis)

```bash
# 1. Instala Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Inicializa proyecto
railway init

# 4. Agrega variables de entorno en Railway Dashboard:
#    TWILIO_ACCOUNT_SID
#    TWILIO_AUTH_TOKEN
#    TWILIO_WHATSAPP_NUMBER

# 5. Deploy
railway up
```

O también puedes:
1. Subir el código a GitHub
2. En railway.app → New Project → Deploy from GitHub repo
3. Agregar las variables de entorno en el dashboard de Railway

---

## 📡 API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/citas` | Crear nueva cita + enviar confirmación WhatsApp |
| GET | `/api/citas` | Listar todas las citas |
| DELETE | `/api/citas/:id` | Cancelar una cita |

### Ejemplo POST /api/citas
```json
{
  "nombre": "María García",
  "telefono": "+523120000000",
  "servicio": "Manicure",
  "fecha": "2024-03-15",
  "hora": "10:30"
}
```

---

## ⏰ Recordatorios automáticos

El cron job corre todos los días a las **10:00 AM hora de México**.
Busca citas del día siguiente y manda un WhatsApp automático a cada clienta.

Para probar manualmente sin esperar al cron:
```bash
node -e "require('./src/whatsapp').sendReminders()"
```

---

## 📁 Estructura del proyecto

```
lupita-beauty-bot/
├── src/
│   ├── server.js      ← Express + rutas + cron
│   ├── database.js    ← SQLite con better-sqlite3
│   └── whatsapp.js    ← Twilio SDK
├── public/            ← Aquí va el chatbot HTML
├── .env.example       ← Plantilla de variables
├── railway.json       ← Config deploy Railway
└── package.json
```
