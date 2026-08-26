const db = require('./database');

const NEGOCIO = 'Claudia Rivera Beauty Center';
const DIVIDER = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';

const SERVICES = ['Uñas', 'Color', 'Pedicure', 'Manicure', 'Planchados', 'Proteínas', 'Moldeados', 'Faciales'];
const SERVICE_EMOJI = ['💅', '🎨', '🦶', '✨', '💇‍♀️', '🧴', '🌀', '🧖‍♀️'];

// Horario único: 3:00 pm a 7:30 pm, todos los días que atiende (lunes a sábado)
const HORAS_NEGOCIO = ['15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'];

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function proximasFechas(cantidad) {
  const fechas = [];
  const cursor = new Date();
  while (fechas.length < cantidad) {
    if (cursor.getDay() !== 0) { // domingo cerrado
      const label = `${DIAS[cursor.getDay()]} ${cursor.getDate()} de ${MESES[cursor.getMonth()]}`;
      const iso = new Date(cursor).toISOString().split('T')[0];
      fechas.push({ iso, label, dow: cursor.getDay(), esHoy: fechas.length === 0 && sonMismoDia(cursor, new Date()) });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return fechas;
}

function sonMismoDia(a, b) {
  return a.toDateString() === b.toDateString();
}

// Devuelve las horas libres de un día: quita las que ya pasaron (si es hoy) y las ya ocupadas en la BD
function horariosDisponibles(fechaIso, dow) {
  if (dow === 0) return []; // domingo cerrado

  let horas = [...HORAS_NEGOCIO];

  const esHoy = fechaIso === new Date().toISOString().split('T')[0];
  if (esHoy) {
    const ahora = new Date();
    horas = horas.filter(t => {
      const [h, m] = t.split(':').map(Number);
      return (h * 60 + m) > (ahora.getHours() * 60 + ahora.getMinutes() + 30);
    });
  }

  const ocupadas = db.horasOcupadas(fechaIso);
  horas = horas.filter(h => !ocupadas.includes(h));

  return horas;
}

function formatearFechaLabel(fechaIso) {
  const [y, m, d] = fechaIso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DIAS[date.getDay()]} ${date.getDate()} de ${MESES[date.getMonth()]}`;
}

// ─── Plantillas de mensajes ──────────────────────────────────────────────────

function menuServicios() {
  const lista = SERVICES.map((s, i) => `${SERVICE_EMOJI[i]}  *${i + 1}.* ${s}`).join('\n');
  return `✨ *${NEGOCIO}* ✨\n${DIVIDER}\n\n` +
    `¡Hola! ¿Qué servicio deseas agendar hoy?\n\n` +
    `${lista}\n\n${DIVIDER}\n` +
    `✍️ _Responde solo con el número_\n` +
    `📋 _Escribe *mis citas* para ver tus citas agendadas_`;
}

function menuFechas(fechas) {
  const lista = fechas.map((f, i) => `🗓️  *${i + 1}.* ${f.esHoy ? '*Hoy* ' : ''}${f.label}`).join('\n');
  return `📅 *Elige una fecha*\n${DIVIDER}\n\n${lista}\n\n${DIVIDER}\n` +
    `↩️ _Escribe *cancelar* para reiniciar_`;
}

function menuHoras(horas) {
  if (horas.length === 0) {
    return `😕 Ya no quedan horarios libres ese día.`;
  }
  const lista = horas.map((h, i) => `🕐  *${i + 1}.* ${h}`).join('\n');
  return `⏰ *Horarios disponibles* (3:00 pm - 7:30 pm)\n${DIVIDER}\n\n${lista}`;
}

function listarMisCitas(citas) {
  if (citas.length === 0) {
    return `📋 *Tus citas*\n${DIVIDER}\n\n` +
      `No tienes citas próximas agendadas 🙂\n\n` +
      `✍️ _Escribe *hola* para agendar una_`;
  }
  const lista = citas.map((c, i) =>
    `*${i + 1}.* ${SERVICE_EMOJI[SERVICES.indexOf(c.servicio)] || '💅'} ${c.servicio}\n     🗓️ ${formatearFechaLabel(c.fecha)} — 🕐 ${c.hora}`
  ).join('\n\n');
  return `📋 *Tus próximas citas*\n${DIVIDER}\n\n${lista}\n\n${DIVIDER}\n` +
    `❌ _Para cancelar, escribe *cancelar cita* y el número. Ej: "cancelar cita 1"_`;
}

/**
 * Procesa un mensaje entrante y devuelve el texto de respuesta.
 */
async function procesarMensaje(telefono, textoCrudo) {
  const texto = (textoCrudo || '').trim();
  const textoLower = texto.toLowerCase();

  let conv = db.obtenerConversacion(telefono);

  // ─── Si estábamos esperando el número de la cita a cancelar ───────────────
  if (conv && conv.estado === 'ASK_CANCEL_NUM') {
    const idx = parseInt(texto, 10) - 1;
    const citasGuardadas = conv.datos.citas || [];
    if (isNaN(idx) || idx < 0 || idx >= citasGuardadas.length) {
      return `🙈 No entendí. Responde solo con el número de la cita que quieres cancelar.\n\n` +
        listarMisCitas(citasGuardadas);
    }
    const cita = citasGuardadas[idx];
    db.cancelarCita(cita.id);
    db.borrarConversacion(telefono);
    return `✅ *Cita cancelada*\n${DIVIDER}\n\n` +
      `${cita.servicio} — ${formatearFechaLabel(cita.fecha)} a las ${cita.hora}\n\n` +
      `✍️ _Escribe *hola* si quieres agendar otra_`;
  }

  // ─── Comandos globales ───────────────────────────────────────────────────

  const matchCancelarCita = textoLower.match(/^cancelar\s+cita\s*(\d+)?$/);
  if (matchCancelarCita) {
    const citas = db.obtenerCitasPorTelefono(telefono);
    if (citas.length === 0) {
      return `🙂 No tienes citas próximas para cancelar.`;
    }
    const num = matchCancelarCita[1];
    if (!num) {
      db.guardarConversacion(telefono, 'ASK_CANCEL_NUM', { citas });
      return `❓ *¿Cuál quieres cancelar?* Responde con el número:\n\n` + listarMisCitas(citas);
    }
    const idx = parseInt(num, 10) - 1;
    if (idx < 0 || idx >= citas.length) {
      return `🙈 No encontré esa cita.\n\n` + listarMisCitas(citas);
    }
    const cita = citas[idx];
    db.cancelarCita(cita.id);
    return `✅ *Cita cancelada*\n${DIVIDER}\n\n` +
      `${cita.servicio} — ${formatearFechaLabel(cita.fecha)} a las ${cita.hora}\n\n` +
      `✍️ _Escribe *hola* si quieres agendar otra_`;
  }

  if (['mis citas', 'ver citas', 'ver mis citas', 'citas'].includes(textoLower)) {
    return listarMisCitas(db.obtenerCitasPorTelefono(telefono));
  }

  if (['cancelar', 'reiniciar', 'salir'].includes(textoLower)) {
    db.borrarConversacion(telefono);
    return `❌ Agendado cancelado.\n\n✍️ _Escribe *hola* cuando quieras empezar de nuevo_`;
  }

  // ─── Máquina de estados del agendado ────────────────────────────────────────

  if (!conv || conv.estado === 'DONE') {
    db.guardarConversacion(telefono, 'ASK_SERVICE', {});
    return menuServicios();
  }

  const { estado, datos } = conv;

  switch (estado) {
    case 'ASK_SERVICE': {
      const idx = parseInt(texto, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= SERVICES.length) {
        return `🙈 Responde con un número del 1 al ${SERVICES.length}.\n\n` + menuServicios();
      }
      datos.servicio = SERVICES[idx];
      datos.fechas = proximasFechas(6);
      db.guardarConversacion(telefono, 'ASK_DATE', datos);
      return `${SERVICE_EMOJI[idx]} *${datos.servicio}* — ¡buena elección! ✨\n\n` + menuFechas(datos.fechas);
    }

    case 'ASK_DATE': {
      const idx = parseInt(texto, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= datos.fechas.length) {
        return `🙈 Responde con un número del 1 al ${datos.fechas.length}.\n\n` + menuFechas(datos.fechas);
      }
      const fecha = datos.fechas[idx];
      const horas = horariosDisponibles(fecha.iso, fecha.dow);
      if (horas.length === 0) {
        return `😕 Ya no hay horarios para ese día. Elige otra fecha:\n\n` + menuFechas(datos.fechas);
      }
      datos.fecha = fecha;
      datos.horas = horas;
      db.guardarConversacion(telefono, 'ASK_TIME', datos);
      return `🗓️ *${fecha.label}*\n\n` + menuHoras(horas);
    }

    case 'ASK_TIME': {
      const idx = parseInt(texto, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= datos.horas.length) {
        return `🙈 Responde con un número del 1 al ${datos.horas.length}.\n\n` + menuHoras(datos.horas);
      }
      datos.hora = datos.horas[idx];
      db.guardarConversacion(telefono, 'ASK_NAME', datos);
      return `🕐 *${datos.hora}*\n\n👤 ¿Cuál es tu nombre completo?`;
    }

    case 'ASK_NAME': {
      if (texto.length < 2) {
        return '👤 Escribe tu nombre completo, por favor 🙂';
      }
      datos.nombre = texto;

      // Revalidar que el horario siga libre (por si alguien más lo tomó mientras tanto)
      const horasActuales = horariosDisponibles(datos.fecha.iso, datos.fecha.dow);
      if (!horasActuales.includes(datos.hora)) {
        datos.horas = horasActuales;
        db.guardarConversacion(telefono, 'ASK_TIME', datos);
        return `😕 *¡Justo se ocupó ese horario!* Elige otro:\n\n` + menuHoras(horasActuales);
      }

      db.crearCita({
        nombre: datos.nombre,
        telefono,
        servicio: datos.servicio,
        fecha: datos.fecha.iso,
        hora: datos.hora
      });

      db.guardarConversacion(telefono, 'DONE', {});

      return `🎉 *¡Cita confirmada, ${datos.nombre}!*\n${DIVIDER}\n\n` +
        `${SERVICE_EMOJI[SERVICES.indexOf(datos.servicio)]}  *Servicio:* ${datos.servicio}\n` +
        `🗓️  *Fecha:* ${datos.fecha.label}\n` +
        `🕐  *Hora:* ${datos.hora}\n\n${DIVIDER}\n` +
        `💌 Te mandaremos un recordatorio un día antes.\n¡Nos vemos pronto! 💅\n\n` +
        `✍️ _Escribe *hola* para agendar otra, o *mis citas* para ver tus citas_`;
    }

    default: {
      db.guardarConversacion(telefono, 'ASK_SERVICE', {});
      return menuServicios();
    }
  }
}

module.exports = { procesarMensaje };
