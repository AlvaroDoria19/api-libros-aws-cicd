const mysql = require('mysql2/promise');

/**
 * Crea un pool de conexiones MySQL usando mysql2/promise.
 */
function createPool(dbConfig) {
  return mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

module.exports = { createPool };
