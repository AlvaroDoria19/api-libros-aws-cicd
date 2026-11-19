const { loadConfig } = require('./config');
const { createPool } = require('./db/pool');
const { createLibrosRepository } = require('./repositories/librosRepository');
const { createApp } = require('./app');

const config = loadConfig();
const pool = createPool(config.db);
const librosRepository = createLibrosRepository(pool);
const app = createApp({
  librosRepository,
  version: config.version,
  commit: config.commit,
});

const server = app.listen(config.port, config.host, () => {
  console.log(
    `API Libros escuchando en http://${config.host}:${config.port} (version=${config.version}, commit=${config.commit})`
  );
});

async function shutdown(signal) {
  console.log(`Recibida señal ${signal}, cerrando servidor...`);
  server.close(async () => {
    try {
      await pool.end();
    } catch (err) {
      console.error('Error al cerrar pool MySQL:', err.message);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
