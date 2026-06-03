const twilio = require('twilio');
const db = require('./database');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Número virtual de Twilio con prefijo whatsapp:
const FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;

/**
 * Envía un mensaje de WhatsApp a un número
 * @param {string} telefono - Número destino ej: "+523120000000"
 * @param {string} mensaje  - Texto del mensaje
 */
async function sendWhatsApp(telefono, mensaje) {
  // Limpiar número y asegurar formato México correcto
  let digits = telefono.replace(/\D/g, '');
  if (digits.startsWith('521')) digits = digits.slice(3);
  else if (digits.startsWith('52')) digits = digits.slice(2);
  else if (digits.startsWith('1')) digits = digits.slice(1);
  digits = digits.slice(-10);
  const to = `+521${digits}`;
  

  try {
    const msg = await client.messages.create({
      from: FROM,
      to: `whatsapp:${to}`,
      body: mensaje
    });
    console.log(`✅ WhatsApp enviado a ${to} — SID: ${msg.sid}`);
    return msg;
  } catch (err) {
    console.error(`❌ Error enviando WhatsApp a ${to}:`, err.message);
    throw err;
  }
}

/**
 * Busca citas de mañana y envía recordatorio a cada una
 */
async function sendReminders() {
  const citas = db.citasDeManana();

  if (citas.length === 0) {
    console.log('📭 No hay citas para mañana.');
    return;
  }

  console.log(`📬 Enviando ${citas.length} recordatorio(s)...`);

  for (const cita of citas) {
    try {
      await sendWhatsApp(
        cita.telefono,
        `💅 *Recordatorio de cita — Lupita Cuéllar Beauty Center*\n\n` +
        `¡Hola ${cita.nombre}! Te recordamos que mañana tienes una cita con nosotros:\n\n` +
        `📋 *Servicio:* ${cita.servicio}\n` +
        `⏰ *Hora:* ${cita.hora}\n\n` +
        `📍 ¡Te esperamos! Si necesitas cancelar o reprogramar, escríbenos aquí 😊`
      );
      db.marcarRecordatorioEnviado(cita.id);
    } catch (err) {
      console.error(`Error con cita ID ${cita.id}:`, err.message);
    }
  }
}

module.exports = { sendWhatsApp, sendReminders };
