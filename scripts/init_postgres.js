const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const SQL_PATH = path.join(__dirname, '..', 'db', 'init_postgres.sql');
const PG_CONN = process.env.DATABASE_URL || process.env.PG_CONNECTION;

if (!PG_CONN) {
  console.error('Falta la variable de entorno DATABASE_URL o PG_CONNECTION. Ejemplo: postgres://user:pass@host:5432/dbname');
  process.exit(2);
}

async function run() {
  const pool = new Pool({ connectionString: PG_CONN });
  try {
    const sql = fs.readFileSync(SQL_PATH, 'utf8');
    console.log('Ejecutando SQL desde', SQL_PATH);
    await pool.query(sql);
    console.log('Esquema inicial creado correctamente en la base de datos.');
  } catch (e) {
    console.error('Error ejecutando init SQL:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
