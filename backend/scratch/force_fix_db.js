const mysql = require('mysql2/promise');
async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion-de-projet'
  });
  console.log('Force creating table "projet" to clear tablespace issues...');
  try {
    // Try to create it. If it exists but corrupted, this might fail with the same error.
    await connection.execute('CREATE TABLE projet (id_projet INT PRIMARY KEY AUTO_INCREMENT)');
    console.log('Table "projet" created.');
  } catch (e) {
    console.log('Failed to create table "projet":', e.message);
    if (e.message.includes('exists')) {
       console.log('Table exists. Trying to drop it again with more force...');
       await connection.execute('DROP TABLE IF EXISTS projet');
       console.log('Dropped again.');
    }
  }
  await connection.end();
}
main().catch(console.error);
