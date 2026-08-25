const twilio = require('twilio');
const db = require('./database');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;

async function sendWhatsApp(telefono, mensaje) {
  const to = telefono.startsWith('whatsapp:') ? telefono : `whatsapp:${telefono}`;
  return client.messages.create({
    from: FROM,
    to,
    body: mensaje
  });
}

async function sendReminders() {
  const citas = db.citasDeManana();
  for (const cita of citas) {
    try {
      await sendWhatsApp(
        cita.telefono,
        `💅 *Recordatorio de cita — Claudia Rivera Beauty Center*\n\n` +
        `Hola ${cita.nombre}, te recordamos tu cita de mañana:\n\n` +
        `✦ Servicio: ${cita.servicio}\n✦ Fecha: ${cita.fecha}\n✦ Hora: ${cita.hora}\n\n` +
        `¡Te esperamos! 💖`
      );
      db.marcarRecordatorioEnviado(cita.id);
    } catch (err) {
      console.error(`Error mandando recordatorio a ${cita.telefono}:`, err.message);
    }
  }
}

module.exports = { sendWhatsApp, sendReminders };
