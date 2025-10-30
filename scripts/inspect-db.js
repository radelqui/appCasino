const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function inspectDb(dbPath) {
  console.log('DB Path:', dbPath);
  if (!fs.existsSync(path.dirname(dbPath))) {
    console.error('Directorio no existe:', path.dirname(dbPath));
    process.exit(1);
  }
  const db = new Database(dbPath, { fileMustExist: false });
  const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all();
  console.log('TABLAS:', tables.map(t => t.name));
  for (const t of tables) {
    const info = db.prepare(`PRAGMA table_info(${t.name})`).all();
    console.log(`\n== ${t.name} ==`);
    for (const col of info) {
      console.log(` - ${col.name} ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? 'DEFAULT ' + col.dflt_value : ''}`);
    }
  }
  db.close();
}

const dbPath = path.join(process.cwd(), 'data', 'casino.db');
inspectDb(dbPath);

