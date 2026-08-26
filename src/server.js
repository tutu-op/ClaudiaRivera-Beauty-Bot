require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const twilio = require('twilio');
const db = require('./database');
const { sendWhatsApp, sendReminders } = require('./whatsapp');
const { procesarMensaje } = require('./chatbot');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar DB antes de arrancar
db.initDb().then(() => console.log('✅ Base de datos lista'));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Twilio manda los webhooks como form-urlencoded
app.use(express.static(path.join(__dirname, '../public')));

// ─── WEBHOOK DE WHATSAPP (chatbot conversacional) ────────────────────────────
app.post('/whatsapp/webhook', async (req, res) => {
  const { MessagingResponse } = twilio.twiml;
  const twiml = new MessagingResponse();

  try {
    const from = req.body.From || '';
    const telefono = from.replace('whatsapp:', '');
    const texto = req.body.Body || '';

    const respuesta = await procesarMensaje(telefono, texto);
    twiml.message(respuesta);
  } catch (err) {
    console.error('Error en webhook de WhatsApp:', err);
    twiml.message('❌ Ocurrió un error. Escribe *hola* para reiniciar.');
  }

  res.type('text/xml').send(twiml.toString());
});

// ─── API para el widget web de agendado ──────────────────────────────────────
app.post('/api/citas', async (req, res) => {
  try {
    const { nombre, telefono, servicio, fecha, hora } = req.body;
    if (!nombre || !telefono || !servicio || !fecha || !hora) {
      return res.status(400).json({ ok: false, error: 'Faltan datos' });
    }

    const cita = db.crearCita({ nombre, telefono, servicio, fecha, hora });

    try {
      await sendWhatsApp(
        telefono,
        `✨ ¡Hola ${nombre}! Tu cita en *Claudia Rivera Beauty Center* ha sido confirmada.\n\n` +
        `✦ Servicio: ${servicio}\n✦ Fecha: ${fecha}\n✦ Hora: ${hora}\n\n` +
        `Te mandaremos un recordatorio un día antes. ¡Nos vemos pronto! 💅`
      );
    } catch (err) {
      console.error('No se pudo enviar confirmación de WhatsApp:', err.message);
    }

    res.json({ ok: true, cita });
  } catch (err) {
    console.error('Error creando cita:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

app.get('/api/citas', (req, res) => {
  res.json(db.obtenerCitas());
});

// ─── API de estadísticas (para el dashboard) ─────────────────────────────────
app.get('/api/estadisticas', (req, res) => {
  res.json(db.obtenerEstadisticas());
});

// Recordatorios automáticos todos los días a las 10 AM
cron.schedule('0 10 * * *', () => {
  sendReminders();
});

app.listen(PORT, () => {
  console.log(`🌸 Claudia Rivera Beauty Bot corriendo en http://localhost:${PORT}`);
});
