# API REST Catálogo de Libros — AWS EC2 + RDS MySQL + Docker + GitHub Actions CI/CD

Solución completa de los Ejercicios 1 y 2 para la gestión de un catálogo de libros mediante una API REST en **Node.js + Express**, persistencia en **Amazon RDS for MySQL**, proxy inverso con **Nginx** en **Amazon EC2**, pruebas automatizadas con **Jest + Supertest**, contenerización con **Docker** y despliegue continuo en **Amazon ECR + EC2** con **GitHub Actions**.

## URL pública de la API

- **Base URL:** `http://3.228.10.85`
- **Healthcheck:** `http://3.228.10.85/health`
- **Catálogo de libros:** `http://3.228.10.85/libros`

## Arquitectura y recursos de AWS utilizados (`us-east-1`)

Todos los recursos de cómputo y base de datos residen en la misma VPC (`vpc-050e94256fd7d8299`, `172.31.0.0/16`):

| Recurso AWS | Identificador / Nombre | Configuración principal |
|---|---|---|
| Instancia EC2 | `alvaro-doria-ec2-libros` (`i-057bcc32f2af34ec6`) | Ubuntu 24.04 LTS, `t3.micro`, IP pública `3.228.10.85`, Nginx en puerto 80 -> `127.0.0.1:3000` |
| Grupo de seguridad EC2 | `alvaro-doria-sg-ec2-libros` (`sg-06916feb4059201a8`) | Entrada: TCP `22` restringido por `/32` y TCP `80` desde `0.0.0.0/0` (sin puertos `3000` ni `3306` expuestos) |
| Instancia RDS MySQL | `alvaro-doria-rds-libros` | MySQL 8.0 (`db.t3.micro`), **acceso público deshabilitado**, base `catalogo_libros` |
| DB Subnet Group | `alvaro-doria-rds-subnet-group` | Subredes en `us-east-1a` y `us-east-1b` dentro de la misma VPC |
| Grupo de seguridad RDS | `alvaro-doria-sg-rds-libros` (`sg-09d7e4ca8b94ead34`) | Entrada: TCP `3306` únicamente desde `alvaro-doria-sg-ec2-libros` |
| Repositorio ECR | `alvaro-doria-api-libros` | Almacén de imágenes Docker etiquetadas con `github.sha` |
| Usuario IAM CI/CD | `alvaro-doria-cicd` | Política de mínimo privilegio (push/pull en ECR y autorización temporal de SSH en el SG de EC2 durante el despliegue) |

## Endpoints de la API

| Método y ruta | Comportamiento |
|---|---|
| `GET /health` | Devuelve `200` con estado del servicio, versión y commit desplegado |
| `GET /libros` | Lista todos los libros persistidos en RDS |
| `GET /libros/:id` | Obtiene un libro por ID (`400` si el ID es inválido, `404` si no existe) |
| `POST /libros` | Valida campos (`titulo`, `autor`, `anio_publicacion` entero) y crea el libro (`201`, o `400` si hay datos inválidos) |
| `PUT /libros/:id` | Actualiza un libro existente (`200`, `400` si datos/ID inválidos, `404` si no existe) |
| `DELETE /libros/:id` | Elimina un libro existente (`200`, o `404` si no existe) |

## Ejecución local

1. Copia el archivo de ejemplo y define tus credenciales locales de MySQL:
   ```bash
   cp .env.example .env
   ```
2. Crea la base de datos y tabla ejecutando `db.sql`:
   ```bash
   mysql -h <HOST> -u <USUARIO> -p < db.sql
   ```
3. Instala dependencias e inicia la API:
   ```bash
   npm ci
   npm start
   ```

## Pruebas automatizadas (sin RDS real)

Las pruebas usan Jest + Supertest inyectando un doble de prueba en memoria para el repositorio de libros (`tests/libros.test.js`):

```bash
npm test
```

## Contenedor Docker

Construcción y verificación local en el puerto `3000` (solo en loopback):

```bash
docker build --build-arg APP_COMMIT_SHA=local -t api-libros:local .
docker run -d --name api-libros-local \
  -p 127.0.0.1:3000:3000 \
  -e DB_HOST=rds-ejemplo.us-east-1.rds.amazonaws.com \
  -e DB_PORT=3306 \
  -e DB_USER=admin_libros \
  -e DB_PASSWORD=clave_ficticia \
  -e DB_NAME=catalogo_libros \
  api-libros:local
curl -i http://127.0.0.1:3000/health
docker rm -f api-libros-local
```

## CI/CD con GitHub Actions

- **CI (`.github/workflows/ci.yml`):** se ejecuta en `push` y `pull_request` hacia `main`, ejecutando `npm ci` y `npm test`.
- **CD (`.github/workflows/cd.yml`):** se ejecuta únicamente en `push` sobre `main` (nunca en `pull_request`) con tres trabajos encadenados:
  1. `test`: ejecuta `npm ci` y `npm test`.
  2. `build-and-push`: construye la imagen Docker con `APP_COMMIT_SHA=${{ github.sha }}` y la publica en Amazon ECR etiquetada con `${{ github.sha }}`.
  3. `deploy`: autoriza temporalmente la IP del runner en `alvaro-doria-sg-ec2-libros`, despliega el nuevo contenedor en EC2 leyendo `/etc/api-libros/.env` (expuesto solo en `127.0.0.1:3000`), verifica `GET /health` y `GET /libros` a través de Nginx, realiza rollback automático si falla la verificación y revoca la IP temporal del runner.

### Secrets configurados en GitHub Actions

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `ECR_REPOSITORY`
- `EC2_SG_ID`
- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_KEY`

## Verificación del despliegue en producción

```bash
curl -i http://3.228.10.85/health
curl -i http://3.228.10.85/libros
```

## Ejecuciones de CI/CD y evidencias

- Se actualizarán los enlaces directos de CI y CD y el índice de capturas en `evidencias/` tras finalizar las ejecuciones en GitHub Actions.
