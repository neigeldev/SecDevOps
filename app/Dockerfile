# syntax=docker/dockerfile:1.7
#
# SecureNotes v2: imagen endurecida (Módulo 2)
# - Construcción multi-etapa: las herramientas de build no llegan a producción.
# - Imágenes base fijadas por versión y digest (reproducible, sin "latest").
# - Imagen final distroless: sin shell, sin gestor de paquetes, usuario no root.
# - Sin secretos en la imagen: se inyectan en tiempo de ejecución (*_FILE / SSM).

# ---------- Etapa 1: dependencias de producción ----------
FROM node:24.22.2-trixie-slim@sha256:54f84b4cf8432b21aaffd5d3ce8d41e12cea0d10d33c09d2f3c9879d49d6b446 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci respeta el lockfile; --ignore-scripts impide ejecutar scripts de instalación
# de terceros. El .npmrc opcional (registro privado/proxy) llega como secreto de
# BuildKit y no queda en ninguna capa.
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund

# ---------- Etapa 2: imagen final ----------
FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:b8cec4b2f2126ff7bd034ec9ac207ffb3272667dfdc48376e3b035d3270549ba

LABEL org.opencontainers.image.title="securenotes" \
      org.opencontainers.image.description="SecureNotes: caso de estudio DevSecOps" \
      org.opencontainers.image.source="https://github.com/neigeldev/SecDevOps" \
      org.opencontainers.image.version="2.0.0"

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# El código queda como propiedad de root y solo lectura para el usuario de la app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY views ./views
COPY public ./public

USER nonroot
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["/nodejs/bin/node", "src/healthcheck.js"]

CMD ["src/server.js"]
