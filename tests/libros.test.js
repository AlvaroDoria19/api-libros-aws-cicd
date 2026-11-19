const request = require('supertest');
const { createApp } = require('../src/app');

function createFakeLibrosRepository(initialBooks = []) {
  let nextId = initialBooks.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  const store = initialBooks.map((item) => ({ ...item }));

  return {
    async findAll() {
      return store.map((item) => ({ ...item }));
    },
    async findById(id) {
      const found = store.find((item) => item.id === id);
      return found ? { ...found } : null;
    },
    async create({ titulo, autor, anio_publicacion }) {
      const created = { id: nextId++, titulo, autor, anio_publicacion };
      store.push(created);
      return { ...created };
    },
    async update(id, { titulo, autor, anio_publicacion }) {
      const index = store.findIndex((item) => item.id === id);
      if (index === -1) {
        return null;
      }
      store[index] = { id, titulo, autor, anio_publicacion };
      return { ...store[index] };
    },
    async remove(id) {
      const index = store.findIndex((item) => item.id === id);
      if (index === -1) {
        return false;
      }
      store.splice(index, 1);
      return true;
    },
  };
}

describe('API Catálogo de Libros (sin RDS real)', () => {
  let app;

  beforeEach(() => {
    const fakeRepo = createFakeLibrosRepository([
      {
        id: 1,
        titulo: 'El Aleph',
        autor: 'Jorge Luis Borges',
        anio_publicacion: 1949,
      },
    ]);
    app = createApp({
      librosRepository: fakeRepo,
      version: '1.0.0',
      commit: 'test-sha',
    });
  });

  test('GET /health responde 200 con estado activo', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'api-libros',
        version: '1.0.0',
        commit: 'test-sha',
      })
    );
    expect(typeof res.body.timestamp).toBe('string');
  });

  test('POST /libros crea un libro válido y responde 201', async () => {
    const payload = {
      titulo: 'Cien años de soledad',
      autor: 'Gabriel García Márquez',
      anio_publicacion: 1967,
    };

    const res = await request(app).post('/libros').send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: 2,
      titulo: 'Cien años de soledad',
      autor: 'Gabriel García Márquez',
      anio_publicacion: 1967,
    });

    const listRes = await request(app).get('/libros');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(2);
  });

  test.each([
    {
      caso: 'titulo vacío',
      payload: { titulo: '', autor: 'Autor', anio_publicacion: 2020 },
    },
    {
      caso: 'autor con solo espacios',
      payload: { titulo: 'Título', autor: '   ', anio_publicacion: 2020 },
    },
    {
      caso: 'anio_publicacion como texto',
      payload: { titulo: 'Título', autor: 'Autor', anio_publicacion: '2020' },
    },
    {
      caso: 'anio_publicacion decimal',
      payload: { titulo: 'Título', autor: 'Autor', anio_publicacion: 2020.5 },
    },
    {
      caso: 'anio_publicacion negativo',
      payload: { titulo: 'Título', autor: 'Autor', anio_publicacion: -10 },
    },
    {
      caso: 'anio_publicacion cero',
      payload: { titulo: 'Título', autor: 'Autor', anio_publicacion: 0 },
    },
    {
      caso: 'anio_publicacion ausente',
      payload: { titulo: 'Título', autor: 'Autor' },
    },
  ])('POST /libros rechaza datos inválidos ($caso) con 400', async ({ payload }) => {
    const res = await request(app).post('/libros').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(Array.isArray(res.body.detalles)).toBe(true);
    expect(res.body.detalles.length).toBeGreaterThan(0);
  });

  test('GET /libros devuelve el listado completo', async () => {
    const res = await request(app).get('/libros');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: 1,
        titulo: 'El Aleph',
        autor: 'Jorge Luis Borges',
        anio_publicacion: 1949,
      },
    ]);
  });

  test('GET /libros/:id devuelve 200 si existe, 404 si no existe y 400 si el ID es inválido', async () => {
    const okRes = await request(app).get('/libros/1');
    expect(okRes.status).toBe(200);
    expect(okRes.body.titulo).toBe('El Aleph');

    const notFoundRes = await request(app).get('/libros/999');
    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body.error).toBeDefined();

    const badIdRes = await request(app).get('/libros/abc');
    expect(badIdRes.status).toBe(400);
  });

  test('PUT /libros/:id actualiza existente, valida payload y responde 404 si no existe', async () => {
    const updateRes = await request(app).put('/libros/1').send({
      titulo: 'Ficciones',
      autor: 'Jorge Luis Borges',
      anio_publicacion: 1944,
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body).toEqual({
      id: 1,
      titulo: 'Ficciones',
      autor: 'Jorge Luis Borges',
      anio_publicacion: 1944,
    });

    const invalidRes = await request(app).put('/libros/1').send({
      titulo: '',
      autor: 'Jorge Luis Borges',
      anio_publicacion: 1944,
    });
    expect(invalidRes.status).toBe(400);

    const notFoundRes = await request(app).put('/libros/999').send({
      titulo: 'Pedro Páramo',
      autor: 'Juan Rulfo',
      anio_publicacion: 1955,
    });
    expect(notFoundRes.status).toBe(404);
  });

  test('DELETE /libros/:id elimina existente y responde 404 si no existe', async () => {
    const delRes = await request(app).delete('/libros/1');
    expect(delRes.status).toBe(200);

    const afterRes = await request(app).get('/libros/1');
    expect(afterRes.status).toBe(404);

    const missingRes = await request(app).delete('/libros/999');
    expect(missingRes.status).toBe(404);
  });
});
