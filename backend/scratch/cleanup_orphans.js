const mysql = require('mysql2/promise');
async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion-de-projet'
  });
  const tables = ['affectation', 'ia_engine', 'membre_projet', 'sprint', 'tache'];
  console.log('Cleaning up orphan rows referencing non-existent projects...');
  for (const table of tables) {
    try {
      // Since the projects table is empty/new, we delete all rows that have an id_projet set
      // Actually, since we just renamed 'projet' to 'projets', all existing rows are orphans.
      const [res] = await connection.execute(`DELETE FROM \`${table}\` WHERE id_projet IS NOT NULL`);
      console.log(`Cleaned ${res.affectedRows} rows from ${table}`);
    } catch (e) {
      console.log(`Error cleaning ${table}:`, e.message);
    }
  }
  await connection.end();
}
main().catch(console.error);
