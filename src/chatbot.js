const db = require('./database');

const NEGOCIO = 'Claudia Rivera Beauty Center';
const DIVIDER = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';

const SERVICES = ['Uñas', 'Color', 'Pedicure', 'Manicure', 'Planchados', 'Proteínas', 'Moldeados', 'Faciales'];
const SERVICE_EMOJI = ['💅', '🎨', '🦶', '✨', '💇‍♀️', '🧴', '🌀', '🧖‍♀️'];

const SCHEDULE = {
  1: { am: ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00'], pm: ['16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'] },
  2: { am: ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00'], pm: ['16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'] },
  3: { am: ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00'], pm: ['16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'] },
  4: { am: ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00'], pm: ['16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'] },
  5: { am: ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00'], pm: ['16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'] },
  6: { am: ['8:30', '9:00', '9:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00'], pm: ['13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'] }
};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function proximasFechas(cantidad) {
  const fechas = [];
  const cursor = new Date();
  while (fechas.length < cantidad) {
    if (cursor.getDay() !== 0) {
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

function horariosDisponibles(fechaIso, dow) {
  const sched = SCHEDULE[dow];
  if (!sched) return [];
  const todos = [...sched.am, ...sched.pm];
  const esHoy = fechaIso === new Date().toISOString().split('T')[0];
  if (!esHoy) return todos;
  const ahora = new Date();
  return todos.filter(t => {
    const [h, m] = t.split(':').map(Number);
    return (h * 60 + m) > (ahora.getHours() * 60 + ahora.getMinutes() + 30);
  });
}

function formatearFechaLabel(fechaIso) {
  const [y, m, d] = fechaIso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DIAS[date.getDay()]} ${date.getDate()} de ${MESES[date.getMonth()]}`;
}

// ─── Plantillas de mensajes (con mejor formato visual) ──────────────────────

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
  const lista = horas.map((h, i) => `🕐  *${i + 1}.* ${h}`).join('\n');
  return `⏰ *Horarios disponibles*\n${DIVIDER}\n\n${lista}`;
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
 * @param {string} telefono - número normalizado, ej "+523120000000"
 * @param {string} textoCrudo - mensaje que escribió la clienta
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

  // ─── Comandos globales (funcionan en cualquier momento) ────────────────────

  // Cancelar una cita YA agendada: "cancelar cita" o "cancelar cita 2"
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

  // Ver citas agendadas
  if (['mis citas', 'ver citas', 'ver mis citas', 'citas'].includes(textoLower)) {
    return listarMisCitas(db.obtenerCitasPorTelefono(telefono));
  }

  // Cancelar el flujo de agendado en curso (no una cita ya guardada)
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
        return `😕 Ya no hay horarios para ese día.\n\n` + menuFechas(datos.fechas);
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