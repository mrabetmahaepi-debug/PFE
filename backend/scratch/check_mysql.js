const mysql = require('mysql2/promise');
async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion-de-projet'
  });
  const [rows] = await connection.execute('DESCRIBE projet');
  console.log('Table projet:', rows);
  const [tables] = await connection.execute('SHOW TABLES');
  console.log('Tables:', tables);
  await connection.end();
}
main().catch(console.error);
