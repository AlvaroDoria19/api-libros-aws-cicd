const express = require('express');
const { parseId, validateLibro } = require('./validators/libroValidator');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Crea la aplicación Express con el repositorio inyectado.
 */
function createApp({ librosRepository, version = '1.0.0', commit = 'local' }) {
  const app = express();
  app.use(express.json());

  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: 'JSON inválido en el cuerpo de la petición' });
    }
    return next(err);
  });

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'api-libros',
      version,
      commit,
      timestamp: new Date().toISOString(),
    });
  });

  app.get(
    '/libros',
    asyncHandler(async (req, res) => {
      const libros = await librosRepository.findAll();
      res.status(200).json(libros);
    })
  );

  app.get(
    '/libros/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'ID de libro inválido' });
      }
      const libro = await librosRepository.findById(id);
      if (!libro) {
        return res.status(404).json({ error: 'Libro no encontrado' });
      }
      return res.status(200).json(libro);
    })
  );

  app.post(
    '/libros',
    asyncHandler(async (req, res) => {
      const validation = validateLibro(req.body);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Datos inválidos para crear el libro',
          detalles: validation.errors,
        });
      }
      const created = await librosRepository.create(validation.data);
      return res.status(201).json(created);
    })
  );

  app.put(
    '/libros/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'ID de libro inválido' });
      }
      const validation = validateLibro(req.body);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Datos inválidos para actualizar el libro',
          detalles: validation.errors,
        });
      }
      const updated = await librosRepository.update(id, validation.data);
      if (!updated) {
        return res.status(404).json({ error: 'Libro no encontrado' });
      }
      return res.status(200).json(updated);
    })
  );

  app.delete(
    '/libros/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'ID de libro inválido' });
      }
      const deleted = await librosRepository.remove(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Libro no encontrado' });
      }
      return res.status(200).json({
        message: 'Libro eliminado correctamente',
        id,
      });
    })
  );

  app.use((err, req, res, next) => {
    console.error('Unhandled API error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

module.exports = { createApp };
