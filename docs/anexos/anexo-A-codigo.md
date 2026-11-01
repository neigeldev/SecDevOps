# Anexo A — Módulo 1: Seguridad en el código

**Objetivo:** analizar y corregir las vulnerabilidades del código fuente de
SecureNotes aplicando prácticas de codificación segura (SAST, SCA y DAST).

**Entregable:** código corregido en el repositorio Git + este informe de hallazgos
y remediación.

**Herramientas de libre acceso:** Semgrep, SonarQube Community, OWASP
Dependency-Check, OWASP ZAP (más `npm audit` como complemento de SCA).

---

## A.1 Metodología (shift-left, ciclo escanear → corregir → re-escanear)

1. Se parte de la **línea base vulnerable** (`v1.0-vulnerable`).
2. Cada herramienta se ejecuta sobre v1 y se guardan los reportes en
   `reports/m1/v1/`.
3. Se corrige **una vulnerabilidad por commit** (`fix(M1/Vxx…)`), con mensaje que
   cita CWE y categoría OWASP.
4. Se re-ejecutan las herramientas sobre la versión corregida (`v2.0-secure`) y se
   guardan en `reports/m1/v2/`.
5. `node scripts/summarize.mjs` consolida el antes/después.

Comandos:

```bash
./scripts/m1-semgrep.sh v1   && ./scripts/m1-semgrep.sh v2    # SAST
./scripts/m1-sca.sh v1       && ./scripts/m1-sca.sh v2        # SCA (npm audit + Dependency-Check)
./scripts/m1-sonarqube.sh v1 && ./scripts/m1-sonarqube.sh v2  # SAST (SonarQube)
./scripts/m1-zap.sh v1 full  && ./scripts/m1-zap.sh v2 full   # DAST
```

## A.2 Aplicación bajo prueba

SecureNotes es una aplicación de notas (Node.js + Express + PostgreSQL, vistas
EJS) con registro/login, notas públicas y privadas, perfil de usuario y panel de
administración. Es deliberadamente pequeña (~15 archivos) para que el antes/después
sea limpio y cada herramienta tenga hallazgos claros que corregir.

## A.3 Resumen cuantitativo (antes / después)

> Cifras obtenidas en este repositorio. Reconstruir con `node scripts/summarize.mjs`
> (se vuelcan en `reports/RESULTADOS.md` y `reports/summary.json`).

| Herramienta | Métrica | v1 (vulnerable) | v2 (segura) |
|---|---|--:|--:|
| Semgrep (reglas propias, offline) | hallazgos | 16 | 0 |
| Semgrep | de severidad ERROR | 11 | 0 |
| npm audit | vulnerabilidades (crit/high) | 16 (2 / 6) | 0 |
| OWASP Dependency-Check | CVE únicos | _(ejecutar con NVD_API_KEY)_ | _(ídem)_ |
| SonarQube Community | issues / hotspots | _(ejecutar)_ | _(ejecutar)_ |
| OWASP ZAP (baseline) | alertas medio/bajo | 3 / 2 | 0 / 0 |

**Capturas sugeridas** (guardar en `docs/anexos/img/`):
`m1-semgrep-v1.png`, `m1-semgrep-v2.png`, `m1-sonarqube-v1.png`,
`m1-sonarqube-v2.png`, `m1-depcheck-v1.png`, `m1-zap-v1.png`, `m1-zap-v2.png`.

## A.4 Hallazgos y remediación (V01–V14)

Para cada vulnerabilidad: dónde estaba, cómo se detecta, cómo se explota en v1,
cómo se corrigió y el commit asociado.

### V01 · Inyección SQL en el login — CWE-89 · OWASP A03
- **v1:** `routes/auth.js` construía la consulta concatenando `username` y el hash:
  `"... WHERE username = '" + username + "' ..."`.
- **Detección:** Semgrep (`sql-string-concatenation`), SonarQube, ZAP full.
- **Explotación:** usuario `admin'--` evita la verificación de contraseña (login como admin).
- **Corrección:** consulta parametrizada `WHERE username = $1` y verificación de la
  contraseña en código. **Commit:** `fix(M1/V01,V02)`.

### V02 · Inyección SQL en la búsqueda — CWE-89 · OWASP A03
- **v1:** `routes/notes.js` interpolaba `q` dentro de un `ILIKE '%...%'`.
- **Explotación:** `q = zzz' UNION SELECT id, username, password_hash, role FROM users--`
  devuelve los hashes de todos los usuarios.
- **Corrección:** `ILIKE $1` con parámetro y escape de comodines `%` `_`. **Commit:** `fix(M1/V01,V02)`.

### V03 · XSS reflejado y almacenado — CWE-79 · OWASP A03
- **v1:** vistas EJS con `<%- q %>` y `<%- n.body %>` (salida sin escapar).
- **Detección:** Semgrep (`ejs-unescaped-output`), ZAP.
- **Explotación:** una nota con `<script>…</script>` ejecuta JavaScript en el navegador de quien la ve.
- **Corrección:** `<%= %>` (escape automático) + CSP estricta sin inline (ver V10). **Commit:** `fix(M1/V03)`.

### V04 · Inyección de comandos en `/api/diag` — CWE-78 · OWASP A03
- **v1:** `child_process.exec('ping -c 1 ' + host)` con `host` del usuario.
- **Explotación:** `/api/diag?host=127.0.0.1; id` ejecuta comandos arbitrarios en el servidor.
- **Corrección:** se elimina la shell (se usa `dns.lookup`), validación por lista
  blanca del host y el endpoint queda restringido a administradores. **Commit:** `fix(M1/V04)`.

### V05 · Almacenamiento débil de contraseñas — CWE-916/327 · OWASP A02 (criptografía)
- **v1:** `crypto.createHash('md5')` sin sal.
- **Explotación:** los hashes MD5 (p. ej. de `admin123`) se rompen al instante con tablas rainbow.
- **Corrección:** **scrypt** (N=2¹⁶, r=8, p=2) con sal aleatoria de 16 bytes,
  verificación en **tiempo constante** y hash señuelo para evitar enumeración por
  tiempos; política de longitud mínima (NIST SP 800-63B). **Commit:** `fix(M1/V05)`.

### V06 · Secretos embebidos — CWE-798 · OWASP A07/A05
- **v1:** `config.js` con `jwtSecret: 'secret123'` y credenciales de BD; `Dockerfile` con `ENV JWT_SECRET=…`.
- **Detección:** Semgrep (`hardcoded-secret-in-config`), SonarQube, Trivy (M2).
- **Corrección:** `config.js` lee cada secreto de variable de entorno o archivo
  (`*_FILE`); exige `JWT_SECRET` de ≥256 bits; el admin inicial se crea solo con
  `ADMIN_PASSWORD` de un gestor de secretos. **Commit:** `fix(M1/V06,V07)`.

### V07 · JWT sin expiración/algoritmo y cookie insegura — CWE-613/1004/614 · OWASP A07/A05
- **v1:** `jwt.sign(payload, secret)` sin `expiresIn`/`algorithm`; `jwt.verify` sin
  fijar algoritmo; cookie `token` sin flags.
- **Explotación:** con el secreto conocido se forja un JWT de rol `admin`; un token
  robado nunca caduca; `alg=none` podría aceptarse.
- **Corrección:** `HS256` fijo, `expiresIn`, `issuer`/`audience` verificados; cookie
  `__Host-session` con `HttpOnly`, `Secure`, `SameSite=Strict`. **Commit:** `fix(M1/V06,V07)`.

### V08 · IDOR en notas — CWE-639 · OWASP A01
- **v1:** `GET /notes/:id` y el borrado no comprobaban el dueño.
- **Explotación:** un usuario lee o borra las notas privadas de otro cambiando el id.
- **Corrección:** las consultas exigen `owner_id = $usuario` (o `is_public`) y
  responden 404 si no corresponde; validación del id. **Commit:** `fix(M1/V08,V09)`.

### V09 · Asignación masiva de atributos — CWE-915 · OWASP A01
- **v1:** `_.merge(perfil, req.body)` permitía enviar `role=admin`.
- **Detección:** Semgrep (`mass-assignment-from-request-body`).
- **Corrección:** lista blanca (solo `full_name` y `email`); el rol se consulta en
  la BD en cada petición y nunca se toma del cliente ni del token. Se elimina lodash. **Commit:** `fix(M1/V08,V09)`.

### V10 · Falta de cabeceras de seguridad y CSRF — CWE-352/693/1021 · OWASP A05
- **v1:** sin `helmet`, con `X-Powered-By`, sin CSP ni protección CSRF.
- **Corrección:** `helmet` (CSP estricta, HSTS, `X-Frame-Options: DENY`, nosniff,
  Referrer-Policy, COOP/COEP), `Permissions-Policy`, `Cache-Control: no-store`; CSRF
  con patrón *signed double-submit cookie* (HMAC con clave derivada por HKDF,
  comparación en tiempo constante) y token oculto en cada formulario. **Commit:** `fix(M1/V10,V11)`.

### V11 · Exposición de trazas de error — CWE-209 · OWASP A05
- **v1:** el manejador enviaba `err.stack` al cliente.
- **Corrección:** manejador que registra el detalle en el servidor con un ID de
  referencia y muestra al usuario solo ese ID. **Commit:** `fix(M1/V10,V11)`.

### V12 · Registro inseguro / insuficiente — CWE-532/778 · OWASP A09
- **v1:** `console.log("… password=" + password)`; sin eventos de seguridad.
- **Corrección:** logger JSON que filtra campos sensibles (password, token, cookie…)
  y emite eventos `login_failed`, `csrf_failed`, `access_denied`, etc. (base de las
  alarmas de CloudWatch del Módulo 3). **Commit:** `fix(M1/V12,V13)`.

### V13 · Sin límite de intentos (fuerza bruta) — CWE-307 · OWASP A07
- **v1:** login y registro sin límite.
- **Corrección:** `express-rate-limit` (10 intentos/15 min en login y registro; 300
  req/min por IP en general). **Commit:** `fix(M1/V12,V13)`.

### V14 · Componentes vulnerables y desactualizados — CWE-1104 · OWASP A06
- **v1:** `express@4.17.1`, `jsonwebtoken@8.5.1`, `ejs@3.1.6`, `lodash@4.17.15`,
  `pg@8.7.1`, `morgan@1.9.0` → `npm audit`: 16 vulnerabilidades (2 críticas, 6 altas).
- **Detección:** OWASP Dependency-Check y `npm audit`.
- **Corrección:** actualización a versiones parcheadas, eliminación de lodash,
  `package-lock.json` y `npm audit` en 0. **Commit:** `fix(M1/V14)`.

## A.5 Validación automatizada

`app/test/security.test.js` (ejecutable con `npm test`, runner `node:test`) prueba
scrypt con sal, rechazo de MD5, política de contraseñas, JWT con exp/iss/aud,
rechazo de `alg=none` y de tokens forjados/expirados, el prefijo `__Host-` de la
cookie y que el logger nunca escribe secretos. **8/8 pruebas en verde.**

El pipeline `.github/workflows/devsecops.yml` ejecuta Semgrep, `npm audit`,
Dependency-Check y las pruebas en cada push, y publica los SARIF en la pestaña
**Security** de GitHub (shift-left real).

## A.6 Conclusión del módulo

Todas las vulnerabilidades sembradas quedan corregidas y verificadas: Semgrep pasa
de 16 a 0 hallazgos, `npm audit` de 16 a 0 y ZAP deja de reportar alertas de
riesgo medio/bajo. La seguridad del código queda respaldada por pruebas y por el
pipeline de CI.
