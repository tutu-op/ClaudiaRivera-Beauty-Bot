const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../citas.db');

let db;

// Inicializar base de datos (sincrónico con wrapper)
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

module.exports = { initDb, crearCita, obtenerCitas, citasDeManana, marcarRecordatorioEnviado, cancelarCita };
