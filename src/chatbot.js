const db = require('./database');

const NEGOCIO = 'Claudia Rivera Beauty Center';

const SERVICES = ['Uñas', 'Color', 'Pedicure', 'Manicure', 'Planchados', 'Proteínas', 'Moldeados', 'Faciales'];

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

function menuServicios() {
  return `💅 ¡Hola! Bienvenida a *${NEGOCIO}*.\n\n¿Qué servicio deseas agendar? Responde con el número:\n\n` +
    SERVICES.map((s, i) => `${i + 1}. ${s}`).join('\n') +
    `\n\n_También puedes escribir *mis citas* para ver tus citas agendadas._`;
}

function menuFechas(fechas) {
  return `📅 Elige una fecha:\n\n` +
    fechas.map((f, i) => `${i + 1}. ${f.esHoy ? 'Hoy ' : ''}${f.label}`).join('\n') +
    `\n\n_Escribe *cancelar* en cualquier momento para reiniciar._`;
}

function menuHoras(horas) {
  return `⏰ Estos son los horarios disponibles:\n\n` +
    horas.map((h, i) => `${i + 1}. ${h}`).join('\n');
}

function listarMisCitas(citas) {
  if (citas.length === 0) {
    return `No tienes citas próximas agendadas 🙂\n\nEscribe *hola* para agendar una.`;
  }
  const lista = citas.map((c, i) =>
    `${i + 1}. ${c.servicio} — ${formatearFechaLabel(c.fecha)} a las ${c.hora}`
  ).join('\n');
  return `📋 Tus próximas citas:\n\n${lista}\n\n` +
    `_Para cancelar una, escribe *cancelar cita* seguido del número. Ej: "cancelar cita 1"._`;
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
      return `No entendí 🙈 Responde solo con el número de la cita que quieres cancelar.\n\n` +
        listarMisCitas(citasGuardadas);
    }
    const cita = citasGuardadas[idx];
    db.cancelarCita(cita.id);
    db.borrarConversacion(telefono);
    return `✅ Tu cita de *${cita.servicio}* el ${formatearFechaLabel(cita.fecha)} a las ${cita.hora} fue cancelada.\n\n` +
      `Escribe *hola* si quieres agendar otra.`;
  }

  // ─── Comandos globales (funcionan en cualquier momento) ────────────────────

  // Cancelar una cita YA agendada: "cancelar cita" o "cancelar cita 2"
  const matchCancelarCita = textoLower.match(/^cancelar\s+cita\s*(\d+)?$/);
  if (matchCancelarCita) {
    const citas = db.obtenerCitasPorTelefono(telefono);
    if (citas.length === 0) {
      return `No tienes citas próximas para cancelar 🙂`;
    }
    const num = matchCancelarCita[1];
    if (!num) {
      // Guardamos la lista y el estado, para saber qué hacer con el número que responda después
      db.guardarConversacion(telefono, 'ASK_CANCEL_NUM', { citas });
      return `¿Cuál quieres cancelar? Responde con el número:\n\n` + listarMisCitas(citas);
    }
    const idx = parseInt(num, 10) - 1;
    if (idx < 0 || idx >= citas.length) {
      return `No encontré esa cita. Estas son tus citas:\n\n` + listarMisCitas(citas);
    }
    const cita = citas[idx];
    db.cancelarCita(cita.id);
    return `✅ Tu cita de *${cita.servicio}* el ${formatearFechaLabel(cita.fecha)} a las ${cita.hora} fue cancelada.\n\n` +
      `Escribe *hola* si quieres agendar otra.`;
  }

  // Ver citas agendadas
  if (['mis citas', 'ver citas', 'ver mis citas', 'citas'].includes(textoLower)) {
    return listarMisCitas(db.obtenerCitasPorTelefono(telefono));
  }

  // Cancelar el flujo de agendado en curso (no una cita ya guardada)
  if (['cancelar', 'reiniciar', 'salir'].includes(textoLower)) {
    db.borrarConversacion(telefono);
    return '❌ Agendado cancelado. Escribe *hola* cuando quieras empezar de nuevo.';
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
        return `No entendí 🙈 Responde con un número del 1 al ${SERVICES.length}.\n\n` + menuServicios();
      }
      datos.servicio = SERVICES[idx];
      datos.fechas = proximasFechas(6);
      db.guardarConversacion(telefono, 'ASK_DATE', datos);
      return `Elegiste *${datos.servicio}* ✨\n\n` + menuFechas(datos.fechas);
    }

    case 'ASK_DATE': {
      const idx = parseInt(texto, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= datos.fechas.length) {
        return `No entendí 🙈 Responde con un número del 1 al ${datos.fechas.length}.\n\n` + menuFechas(datos.fechas);
      }
      const fecha = datos.fechas[idx];
      const horas = horariosDisponibles(fecha.iso, fecha.dow);
      if (horas.length === 0) {
        return `😕 Ya no hay horarios para ese día. Elige otra fecha:\n\n` + menuFechas(datos.fechas);
      }
      datos.fecha = fecha;
      datos.horas = horas;
      db.guardarConversacion(telefono, 'ASK_TIME', datos);
      return `Fecha: *${fecha.label}* 📅\n\n` + menuHoras(horas);
    }

    case 'ASK_TIME': {
      const idx = parseInt(texto, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= datos.horas.length) {
        return `No entendí 🙈 Responde con un número del 1 al ${datos.horas.length}.\n\n` + menuHoras(datos.horas);
      }
      datos.hora = datos.horas[idx];
      db.guardarConversacion(telefono, 'ASK_NAME', datos);
      return `Hora: *${datos.hora}* ⏰\n\n¿Cuál es tu nombre completo?`;
    }

    case 'ASK_NAME': {
      if (texto.length < 2) {
        return 'Escribe tu nombre completo, por favor 🙂';
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

      return `¡Listo, *${datos.nombre}*! 🎉 Tu cita quedó confirmada:\n\n` +
        `✦ Servicio: ${datos.servicio}\n` +
        `✦ Fecha: ${datos.fecha.label}\n` +
        `✦ Hora: ${datos.hora}\n\n` +
        `Te mandaremos un recordatorio un día antes. ¡Nos vemos pronto! 💅\n\n` +
        `_Escribe *hola* para agendar otra, o *mis citas* para ver tus citas._`;
    }

    default: {
      db.guardarConversacion(telefono, 'ASK_SERVICE', {});
      return menuServicios();
    }
  }
}

module.exports = { procesarMensaje };