require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const db = require('./database');
const { sendWhatsApp, sendReminders } = require('./whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar DB antes de arrancar
db.initDb().then(() => console.log('✅ Base de datos lista'));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── RUTAS ────────────────────────────────────────────────────────────────────

// Crear una cita nueva
app.post('/api/citas', async (req, res) => {
  const { nombre, telefono, servicio, fecha, hora } = req.body;

  if (!nombre || !telefono || !servicio || !fecha || !hora) {
    return res.status(400).json({ error: 'Faltan datos de la cita' });
  }

  try {
    const cita = db.crearCita({ nombre, telefono, servicio, fecha, hora });

    // Enviar confirmación inmediata por WhatsApp
    await sendWhatsApp(
      telefono,
      `✨ ¡Hola ${nombre}! Tu cita en *Lupita Cuéllar Beauty Center* ha sido confirmada.\n\n` +
      `📋 *Servicio:* ${servicio}\n` +
      `📅 *Fecha:* ${fecha}\n` +
      `⏰ *Hora:* ${hora}\n\n` +
      `Te recordaremos el día anterior. ¡Nos vemos pronto! 💅`
    );

    res.json({ ok: true, cita });
  } catch (err) {
    console.error('Error al crear cita:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener todas las citas (para panel admin)
app.get('/api/citas', (req, res) => {
  const citas = db.obtenerCitas();
  res.json(citas);
});

// Cancelar una cita
app.delete('/api/citas/:id', (req, res) => {
  db.cancelarCita(req.params.id);
  res.json({ ok: true });
});

// ─── CRON: Recordatorios cada día a las 10:00 AM (hora México) ───────────────
// '0 10 * * *' = todos los días a las 10:00 AM
cron.schedule('0 10 * * *', async () => {
  console.log('⏰ Enviando recordatorios del día...');
  await sendReminders();
}, {
  timezone: 'America/Mexico_City'
});

app.listen(PORT, () => {
  console.log(`🌸 Lupita Beauty Bot corriendo en http://localhost:${PORT}`);
});
