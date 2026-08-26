const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../citas.db');

let db;

function getDb() {
  if (db) return db;
  throw new Error('Base de datos no inicializada. Llama a initDb() primero.');
}

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS citas (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre    TEXT NOT NULL,
      telefono  TEXT NOT NULL,
      servicio  TEXT NOT NULL,
      fecha     TEXT NOT NULL,
      hora      TEXT NOT NULL,
      recordatorio_enviado INTEGER DEFAULT 0,
      creada_en TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS conversaciones (
      telefono   TEXT PRIMARY KEY,
      estado     TEXT NOT NULL,
      datos      TEXT NOT NULL DEFAULT '{}',
      actualizada TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  saveDb();
  return db;
}

function saveDb() {
  const data = getDb().export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function crearCita({ nombre, telefono, servicio, fecha, hora }) {
  getDb().run(
    `INSERT INTO citas (nombre, telefono, servicio, fecha, hora) VALUES (?, ?, ?, ?, ?)`,
    [nombre, telefono, servicio, fecha, hora]
  );
  const result = getDb().exec('SELECT last_insert_rowid() as id');
  const id = result[0].values[0][0];
  saveDb();
  return { id, nombre, telefono, servicio, fecha, hora };
}

function obtenerCitas() {
  const result = getDb().exec('SELECT * FROM citas ORDER BY fecha, hora');
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

function obtenerCitasPorTelefono(telefono) {
  const hoy = new Date().toISOString().split('T')[0];
  const result = getDb().exec(
    'SELECT * FROM citas WHERE telefono = ? AND fecha >= ? ORDER BY fecha, hora',
    [telefono, hoy]
  );
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

function citasDeManana() {
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const fecha = manana.toISOString().split('T')[0];

  const result = getDb().exec(
    `SELECT * FROM citas WHERE fecha = '${fecha}' AND recordatorio_enviado = 0`
  );
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

function marcarRecordatorioEnviado(id) {
  getDb().run('UPDATE citas SET recordatorio_enviado = 1 WHERE id = ?', [id]);
  saveDb();
}

function cancelarCita(id) {
  getDb().run('DELETE FROM citas WHERE id = ?', [id]);
  saveDb();
}

// ─── Conversaciones de WhatsApp (estado del chatbot) ─────────────────────────

function obtenerConversacion(telefono) {
  const result = getDb().exec('SELECT estado, datos FROM conversaciones WHERE telefono = ?', [telefono]);
  if (!result.length) return null;
  const { columns, values } = result[0];
  const row = Object.fromEntries(columns.map((col, i) => [col, values[0][i]]));
  return { estado: row.estado, datos: JSON.parse(row.datos) };
}

function guardarConversacion(telefono, estado, datos) {
  getDb().run(
    `INSERT INTO conversaciones (telefono, estado, datos, actualizada)
     VALUES (?, ?, ?, datetime('now','localtime'))
     ON CONFLICT(telefono) DO UPDATE SET estado = excluded.estado, datos = excluded.datos, actualizada = excluded.actualizada`,
    [telefono, estado, JSON.stringify(datos)]
  );
  saveDb();
}

function borrarConversacion(telefono) {
  getDb().run('DELETE FROM conversaciones WHERE telefono = ?', [telefono]);
  saveDb();
}

// ─── Estadísticas ─────────────────────────────────────────────────────────

function obtenerEstadisticas() {
  const todas = obtenerCitas();
  const hoy = new Date().toISOString().split('T')[0];
  const futuras = todas.filter(c => c.fecha >= hoy);
  const pasadas = todas.filter(c => c.fecha < hoy);

  // Conteo por servicio
  const porServicio = {};
  todas.forEach(c => {
    porServicio[c.servicio] = (porServicio[c.servicio] || 0) + 1;
  });
  const servicioTop = Object.entries(porServicio).sort((a, b) => b[1] - a[1])[0];

  // Conteo por día de la semana (0=domingo..6=sábado)
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const porDiaSemana = {};
  todas.forEach(c => {
    const [y, m, d] = c.fecha.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    const nombreDia = DIAS[dow];
    porDiaSemana[nombreDia] = (porDiaSemana[nombreDia] || 0) + 1;
  });

  // Próximas 7 citas
  const proximas = futuras.slice(0, 7);

  return {
    totalCitas: todas.length,
    citasFuturas: futuras.length,
    citasPasadas: pasadas.length,
    porServicio,
    servicioTop: servicioTop ? { nombre: servicioTop[0], cantidad: servicioTop[1] } : null,
    porDiaSemana,
    proximas
  };
}

module.exports = {
  initDb, crearCita, obtenerCitas, obtenerCitasPorTelefono, citasDeManana,
  marcarRecordatorioEnviado, cancelarCita,
  obtenerConversacion, guardarConversacion, borrarConversacion,
  obtenerEstadisticas
};
