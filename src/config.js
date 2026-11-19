const path = require('path');
const dotenv = require('dotenv');
const pkg = require('../package.json');

dotenv.config({ path: process.env.ENV_FILE || path.resolve(process.cwd(), '.env') });

function loadConfig() {
  return {
    port: Number(process.env.PORT || 3000),
    host: process.env.HOST || '0.0.0.0',
    version: process.env.APP_VERSION || pkg.version,
    commit: process.env.APP_COMMIT_SHA || 'local',
    db: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'admin_libros',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'catalogo_libros',
    },
  };
}

module.exports = { loadConfig };
