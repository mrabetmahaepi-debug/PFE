const mysql = require('mysql2/promise');
async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion-de-projet'
  });
  const [tables] = await connection.execute('SHOW TABLES');
  console.log('Tables:', tables);
  for (const t of tables) {
    const tableName = Object.values(t)[0];
    try {
      const [desc] = await connection.execute(`DESCRIBE \`${tableName}\``);
      const [count] = await connection.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
      console.log(`Table ${tableName}: ${count[0].count} rows`);
    } catch (e) {
      console.log(`Table ${tableName}: ERROR - ${e.message}`);
    }
  }
  await connection.end();
}
main().catch(console.error);
