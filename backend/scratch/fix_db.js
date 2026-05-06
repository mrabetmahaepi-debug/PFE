const mysql = require('mysql2/promise');
async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion-de-projet'
  });
  console.log('Attempting to fix table "projet"...');
  try {
    await connection.execute('DROP TABLE IF EXISTS projet');
    console.log('Table "projet" dropped successfully.');
  } catch (e) {
    console.log('Failed to drop table "projet":', e.message);
  }
  await connection.end();
}
main().catch(console.error);
