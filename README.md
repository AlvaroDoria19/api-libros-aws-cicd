# API REST Catálogo de Libros — AWS EC2 + RDS MySQL + Docker + GitHub Actions CI/CD

Solución individual de los Ejercicios 1 y 2 para gestionar un catálogo de libros mediante una API REST en **Node.js + Express**, persistencia en **Amazon RDS for MySQL**, proxy inverso con **Nginx** en **Amazon EC2**, pruebas automatizadas con **Jest + Supertest**, contenerización con **Docker** y despliegue continuo en **Amazon ECR + EC2** con **GitHub Actions**.

## URL pública de la API

- **URL base:** `http://3.228.10.85`
- **Healthcheck (`v1.1.0`):** `http://3.228.10.85/health`
- **Catálogo de libros:** `http://3.228.10.85/libros`

## Enlaces directos a ejecuciones exitosas de CI y CD

- **CI (`ci.yml` — Pruebas automatizadas con Jest y Supertest):** https://github.com/AlvaroDoria19/api-libros-aws-cicd/actions/runs/44620027801
- **CD (`cd.yml` — Test -> Build & Push a ECR -> Despliegue y verificación en EC2):** https://github.com/AlvaroDoria19/api-libros-aws-cicd/actions/runs/44620027592

## Arquitectura y recursos de AWS utilizados (`us-east-1`)

Todos los recursos de cómputo y base de datos residen dentro de la misma VPC (`vpc-050e94256fd7d8299`, `172.31.0.0/16`):

| Recurso AWS | Nombre / Identificador | Configuración principal |
|---|---|---|
| Instancia EC2 | `alvaro-doria-ec2-libros` (`i-057bcc32f2af34ec6`) | Ubuntu 24.04 LTS, `t3.micro`, IP pública `3.228.10.85`, Nginx en puerto `80` -> `127.0.0.1:3000` |
| Grupo de seguridad EC2 | `alvaro-doria-sg-ec2-libros` (`sg-06916feb4059201a8`) | Entrada: TCP `22` restringido por `/32` a la IP pública autorizada y TCP `80` desde `0.0.0.0/0` (sin puertos `3000` ni `3306` expuestos) |
| Instancia RDS MySQL | `alvaro-doria-rds-libros` | MySQL `8.0.46-rds.20260908` (`db.t3.micro`), **acceso público deshabilitado (`No`)**, base `catalogo_libros` |
| DB Subnet Group | `alvaro-doria-rds-subnet-group` | Subredes en `us-east-1a` (`subnet-0113f20c8d5753522`) y `us-east-1b` (`subnet-05166f3fa12d86f24`) |
| Grupo de seguridad RDS | `alvaro-doria-sg-rds-libros` (`sg-09d7e4ca8b94ead34`) | Entrada: TCP `3306` únicamente desde `alvaro-doria-sg-ec2-libros` (`sg-06916feb4059201a8`) |
| Repositorio ECR | `alvaro-doria-api-libros` | Registro privado de imágenes Docker etiquetadas con el SHA del commit (`github.sha`) |
| Usuario IAM CI/CD | `alvaro-doria-cicd` | Política de mínimo privilegio (`ecr:*` sobre el repositorio del proyecto y `ec2:AuthorizeSecurityGroupIngress` / `RevokeSecurityGroupIngress` temporal en despliegue sobre el SG de EC2) |

## Endpoints de la API

| Método y ruta | Comportamiento esperado |
|---|---|
| `GET /health` | Devuelve `200` y JSON con estado activo, servicio, `version`, `despliegue` y `commit` |
| `GET /libros` | Devuelve `200` con la lista de libros almacenados en RDS |
| `GET /libros/:id` | Devuelve `200` con el libro solicitado (`400` si el ID no es entero positivo, `404` si no existe) |
| `POST /libros` | Valida que `titulo` y `autor` no estén vacíos y que `anio_publicacion` sea un entero válido (`400` si falla); responde `201` con el registro creado |
| `PUT /libros/:id` | Valida ID y payload (`400`); actualiza un libro existente (`200`) o responde `404` si no existe |
| `DELETE /libros/:id` | Elimina un libro existente (`200`) o responde `404` si no existe |

Todas las consultas SQL en [librosRepository.js](./src/repositories/librosRepository.js) utilizan sentencias parametrizadas (`?`) sobre `mysql2/promise`, y la tabla `libros` se define en [db.sql](./db.sql).

## Ejecución local

1. Copia `.env.example` a `.env` y completa las credenciales de tu instancia MySQL:
   ```bash
   cp .env.example .env
   ```
2. Crea la base de datos y la tabla `libros`:
   ```bash
   mysql -h <DB_HOST> -u <DB_USER> -p < db.sql
   ```
3. Instala dependencias e inicia el servidor:
   ```bash
   npm ci
   npm start
   ```

## Pruebas automatizadas (sin RDS real)

Las pruebas unitarias y de integración con **Jest** y **Supertest** ([tests/libros.test.js](./tests/libros.test.js)) emplean un doble de prueba en memoria para el repositorio de libros, permitiendo validar los 13 casos (incluyendo `GET /health`, creación válida, rechazo de datos inválidos con `400`, actualización, eliminación y respuestas `404`) sin requerir conexión a RDS:

```bash
npm test
```

## Construcción y prueba local con Docker

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

- **Workflow CI ([.github/workflows/ci.yml](./.github/workflows/ci.yml)):** se dispara en `push` y `pull_request` hacia `main`, ejecutando `npm ci` y `npm test`.
- **Workflow CD ([.github/workflows/cd.yml](./.github/workflows/cd.yml)):** se dispara únicamente en `push` sobre `main` (nunca en `pull_request`), encadenando tres trabajos:
  1. `test`: ejecuta `npm ci` y `npm test`.
  2. `build-and-push`: construye la imagen Docker con `APP_COMMIT_SHA=${{ github.sha }}` y la publica en Amazon ECR con la etiqueta `${{ github.sha }}`.
  3. `deploy`: autoriza temporalmente la IP pública del runner en `alvaro-doria-sg-ec2-libros`, descarga la nueva imagen en EC2, lanza el contenedor en `127.0.0.1:3000` leyendo `/etc/api-libros/.env` (fuera del repositorio y fuera de la imagen), verifica `GET /health` y `GET /libros` a través de Nginx, ejecuta rollback automático al contenedor anterior si la verificación falla y revoca la regla SSH temporal del runner (`if: always()`).

### Secrets configurados en GitHub Actions

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `ECR_REPOSITORY`
- `EC2_SG_ID`
- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_KEY`

## Cómo verificar el despliegue en producción

```bash
curl -i http://3.228.10.85/health
curl -i http://3.228.10.85/libros
```

El endpoint `/health` debe responder `HTTP 200` con `"version": "1.1.0"`, `"despliegue": "cd-docker-v1.1.0"` y el SHA del commit desplegado; el endpoint `/libros` debe responder `HTTP 200` con los registros persistidos en RDS; y el puerto `3000` no debe responder desde Internet (solo a través del proxy Nginx en el puerto `80`).

## Evidencias (`evidencias/`)

| Archivo | Contenido verificado |
|---|---|
| [evidencias/01-ec2-instancia.png](./evidencias/01-ec2-instancia.png) | Instancia EC2 `alvaro-doria-ec2-libros` en ejecución, IP pública y VPC (datos sensibles ocultos) |
| [evidencias/02-ec2-security-group.png](./evidencias/02-ec2-security-group.png) | Reglas de entrada de `alvaro-doria-sg-ec2-libros`: solo TCP `80` (`0.0.0.0/0`) y TCP `22` (`/32`) |
| [evidencias/03-rds-instancia.png](./evidencias/03-rds-instancia.png) | Instancia RDS `alvaro-doria-rds-libros` en la misma VPC con **Accesible públicamente: No** |
| [evidencias/04-rds-security-group.png](./evidencias/04-rds-security-group.png) | Regla de entrada de `alvaro-doria-sg-rds-libros`: solo TCP `3306` desde `alvaro-doria-sg-ec2-libros` |
| [evidencias/05-crud-curl.png](./evidencias/05-crud-curl.png) | Pruebas CRUD completas con `curl` (`POST` válido e inválido `400`, `GET`, `PUT`, `DELETE`, `404`) y bloqueo del puerto `3000` |
| [evidencias/06-persistencia-rds.png](./evidencias/06-persistencia-rds.png) | Consultas SQL directas en Amazon RDS antes y después de `DELETE /libros/2` comprobando persistencia |
| [evidencias/07-pruebas-jest-y-docker-local.png](./evidencias/07-pruebas-jest-y-docker-local.png) | Ejecución exitosa de las 13 pruebas con Jest/Supertest (`npm test`) y prueba local del contenedor Docker en `/health` |
| [evidencias/08-imagen-publicada-ecr.png](./evidencias/08-imagen-publicada-ecr.png) | Imágenes Docker publicadas en Amazon ECR identificadas con el SHA de los commits |
| [evidencias/09-github-actions-ci.png](./evidencias/09-github-actions-ci.png) | Ejecución exitosa de CI (`ci.yml`) en GitHub Actions |
| [evidencias/10-github-actions-cd.png](./evidencias/10-github-actions-cd.png) | Ejecución exitosa de CD (`cd.yml`) mostrando el pipeline `test -> build-and-push -> deploy` |
| [evidencias/11-verificacion-despliegue-cd.png](./evidencias/11-verificacion-despliegue-cd.png) | Verificación en producción del cambio visible `v1.0.0 -> v1.1.0` en `/health`, persistencia en `/libros` y `docker ps` ligado a `127.0.0.1:3000` |
