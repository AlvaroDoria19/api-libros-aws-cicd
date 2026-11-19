/**
 * Valida y convierte un identificador de ruta a entero positivo.
 */
function parseId(raw) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

/**
 * Valida la carga útil de un libro (titulo, autor, anio_publicacion).
 */
function validateLibro(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      valid: false,
      data: null,
      errors: ['El cuerpo de la petición debe ser un objeto JSON válido'],
    };
  }

  const errors = [];
  const rawTitulo = body.titulo;
  const rawAutor = body.autor;
  const rawAnio = body.anio_publicacion;

  let titulo = '';
  if (typeof rawTitulo !== 'string' || rawTitulo.trim().length === 0) {
    errors.push('El campo "titulo" es obligatorio y no puede estar vacío');
  } else if (rawTitulo.trim().length > 255) {
    errors.push('El campo "titulo" no puede superar 255 caracteres');
  } else {
    titulo = rawTitulo.trim();
  }

  let autor = '';
  if (typeof rawAutor !== 'string' || rawAutor.trim().length === 0) {
    errors.push('El campo "autor" es obligatorio y no puede estar vacío');
  } else if (rawAutor.trim().length > 255) {
    errors.push('El campo "autor" no puede superar 255 caracteres');
  } else {
    autor = rawAutor.trim();
  }

  if (
    typeof rawAnio !== 'number' ||
    !Number.isInteger(rawAnio) ||
    rawAnio < 1 ||
    rawAnio > 9999
  ) {
    errors.push('El campo "anio_publicacion" debe ser un entero válido entre 1 y 9999');
  }

  if (errors.length > 0) {
    return { valid: false, data: null, errors };
  }

  return {
    valid: true,
    data: {
      titulo,
      autor,
      anio_publicacion: rawAnio,
    },
    errors: [],
  };
}

module.exports = { parseId, validateLibro };
