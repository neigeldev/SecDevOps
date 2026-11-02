// Genera el Informe Final del Proyecto Integrador (SecureNotes) en .docx
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, LevelFormat, TableOfContents, PageBreak, ImageRun,
  Header, Footer, PageNumber, VerticalAlign,
} = require('docx');

const OUT = process.argv[2] || 'Informe-Final-SecureNotes.docx';
const DIR = __dirname;
const W = 9360; // ancho útil (carta, márgenes de 1")
const BLUE = '1F3864';

// ---------- utilidades ----------
function runs(text, base = {}) {
  return String(text)
    .split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\]|`[^`]+`|\*[^*\s][^*]*\*)/g)
    .filter(Boolean)
    .map((s) => {
      if (s.startsWith('**')) return new TextRun({ ...base, text: s.slice(2, -2), bold: true });
      if (s.startsWith('*') && s.length > 2) return new TextRun({ ...base, text: s.slice(1, -1), italics: true });
      if (s.startsWith('[['))
        return new TextRun({ ...base, text: `[COMPLETAR: ${s.slice(2, -2)}]`, bold: true, highlight: 'yellow' });
      if (s.startsWith('`'))
        return new TextRun({ ...base, text: s.slice(1, -1), font: 'Consolas', size: (base.size || 22) - 2 });
      return new TextRun({ ...base, text: s });
    });
}
const p = (text, o = {}) =>
  new Paragraph({ children: runs(text, o.run), alignment: o.align || AlignmentType.JUSTIFIED, spacing: { after: 120, line: 276 }, ...o.para });
const h1 = (t, pageBreak = false) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: pageBreak, children: [new TextRun(t)] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const h3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const bullet = (t, level = 0) =>
  new Paragraph({ numbering: { reference: 'bullets', level }, children: runs(t), spacing: { after: 60, line: 276 } });
let numInstance = 0;
function numbered(items) {
  numInstance += 1;
  return items.map((t) => new Paragraph({ numbering: { reference: 'numbers', level: 0, instance: numInstance }, children: runs(t), spacing: { after: 60, line: 276 } }));
}
function code(lines) {
  return lines.map((l, i) =>
    new Paragraph({
      children: [new TextRun({ text: l || ' ', font: 'Consolas', size: 18 })],
      shading: { type: ShadingType.CLEAR, fill: 'F2F4F7', color: 'auto' },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: '8EAADB', space: 6 } },
      indent: { left: 200 },
      spacing: { after: i === lines.length - 1 ? 160 : 0, line: 240 },
    }));
}
let tableNo = 0;
const caption = (text) =>
  new Paragraph({ style: 'Leyenda', children: runs(text), alignment: AlignmentType.CENTER });
function table(title, headers, rows, widths, o = {}) {
  tableNo += 1;
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum !== W) throw new Error(`Tabla "${title}": ancho ${sum} != ${W}`);
  const cell = (txt, i, head, zebra) =>
    new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: head ? BLUE : zebra ? 'F2F2F2' : 'FFFFFF' },
      margins: { top: 50, bottom: 50, left: 90, right: 90 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: (o.right || []).includes(i) && !head ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: runs(txt, { size: 18, ...(head ? { bold: true, color: 'FFFFFF' } : {}) }),
      })],
    });
  return [
    new Paragraph({ style: 'Leyenda', keepNext: true, children: runs(`**Tabla ${tableNo}.** ${title}`), alignment: AlignmentType.LEFT, spacing: { before: 160, after: 60 } }),
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: widths,
      rows: [
        new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, i, true)) }),
        ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false, ri % 2 === 1)) })),
      ],
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}
function figure(file, title, w, h) {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 },
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(path.join(DIR, file)), transformation: { width: w, height: h },
        altText: { title, description: title, name: file } })] }),
    caption(title),
  ];
}
function capture(id, desc, file) {
  const b = { style: BorderStyle.DASHED, size: 8, color: 'BF9000', space: 8 };
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, keepNext: true,
      border: { top: b, left: b, bottom: b, right: b },
      shading: { type: ShadingType.CLEAR, fill: 'FFF8E1', color: 'auto' },
      spacing: { before: 200, after: 80 },
      indent: { left: 900, right: 900 },
      children: [
        new TextRun({ text: ' ', break: 1 }),
        new TextRun({ text: `[INSERTAR CAPTURA ${id}]`, bold: true, color: '7F6000', size: 22 }),
        new TextRun({ text: `Archivo sugerido: ${file}`, break: 1, color: '7F6000', size: 18 }),
        new TextRun({ text: desc, break: 1, italics: true, color: '595959', size: 18 }),
        new TextRun({ text: ' ', break: 1 }),
      ],
    }),
    caption(`**Figura ${id}.** ${desc}`),
  ];
}
const spacer = () => new Paragraph({ children: [] });

// ---------- contenido ----------
const portada = [
  new Paragraph({ spacing: { before: 1800 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PROYECTO FINAL INTEGRADOR', bold: true, size: 28, color: BLUE })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: 'Plataforma web segura: del código a la nube', bold: true, size: 44, color: BLUE })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Aseguramiento de extremo a extremo de la aplicación SecureNotes con DevSecOps', italics: true, size: 26, color: '404040' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Módulo: Desarrollo seguro, criptografía e IAM', size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 900 }, children: [new TextRun({ text: 'Diplomado DevOps', size: 24 })] }),
  p('**Autor(a):** [[nombre completo]]', { align: AlignmentType.CENTER }),
  p('**Docente:** [[nombre del docente]]', { align: AlignmentType.CENTER }),
  p('**Institución:** [[nombre de la institución]]', { align: AlignmentType.CENTER }),
  p('**Fecha:** noviembre de 2026', { align: AlignmentType.CENTER }),
];

const indice = [
  new Paragraph({ pageBreakBefore: true, spacing: { after: 200 }, children: [new TextRun({ text: 'Contenido', bold: true, size: 32, color: BLUE })] }),
  new TableOfContents('Contenido', { hyperlink: true, headingStyleRange: '1-2' }),
  p('Nota: si el índice aparece vacío, haga clic derecho sobre él y elija «Actualizar campos» (o pulse F9).', { run: { italics: true, size: 18, color: '808080' } }),
];

const resumen = [
  h1('Resumen', true),
  p('Este proyecto construye y asegura de extremo a extremo una aplicación web —SecureNotes, desarrollada en Node.js/Express con PostgreSQL— aplicando la metodología DevSecOps («shift-left»). El trabajo se organiza en tres módulos encadenados: (1) seguridad en el código, mediante análisis estático (SAST), de composición de software (SCA) y dinámico (DAST); (2) infraestructura como código (IaC), con escaneo de configuración y de contenedores; y (3) despliegue en Amazon Web Services con controles de identidad, cifrado, red y monitoreo, evaluando la postura de seguridad con herramientas CSPM.'),
  p('Para que la mejora sea medible se partió de una versión intencionalmente vulnerable (etiqueta `v1.0-vulnerable`) y se llegó a una versión corregida (`v2.0-secure`), ejecutando las mismas herramientas sobre ambas. Los resultados muestran la eliminación de los hallazgos de severidad alta en las tres capas: Semgrep pasó de 16 a 0 hallazgos, `npm audit` de 16 a 0 vulnerabilidades, OWASP ZAP de 5 alertas de riesgo alto a 0, Checkov de 31 a 0 controles fallidos y la imagen de contenedor de 425 vulnerabilidades CRITICAL/HIGH a 0, reduciendo su tamaño de 1349 MB a 223 MB y eliminando la ejecución como root. En la nube, Prowler reporta 352 controles superados y 95 fallidos tras aplicar la línea base, con las excepciones restantes documentadas y justificadas.'),
  p('**Palabras clave:** DevSecOps, SAST, SCA, DAST, infraestructura como código, Terraform, AWS, CSPM, OWASP Top 10, CIS Benchmark.'),
];

const sec1 = [
  h1('1. Título, descripción del problema, alcance y justificación', true),
  h2('1.1 Título'),
  p('Plataforma web segura de extremo a extremo (código → infraestructura → nube) aplicando DevSecOps sobre la aplicación SecureNotes.'),
  h2('1.2 Descripción del problema'),
  p('Las aplicaciones web se ven comprometidas por fallos que aparecen en todas las capas de su ciclo de vida: código vulnerable (inyección SQL, XSS, criptografía débil), infraestructura mal configurada (contenedores con privilegios, puertos expuestos, secretos embebidos) y entornos de nube sin controles (IAM permisivo, recursos sin cifrar, ausencia de auditoría). Cuando la seguridad se trata como una fase final, estos defectos llegan a producción, donde son más costosos y riesgosos de corregir.'),
  h2('1.3 Alcance'),
  p('Se toma una única aplicación, SecureNotes (gestor de notas con registro e inicio de sesión, notas públicas y privadas, perfil de usuario y panel de administración), y se asegura en tres módulos encadenados, donde la salida de cada uno es la entrada del siguiente:'),
  ...numbered([
    '**Código:** análisis SAST, SCA y DAST, y corrección de las vulnerabilidades encontradas.',
    '**Infraestructura como código:** definición de la infraestructura (Dockerfile, Docker Compose y Terraform) y verificación con escaneo de configuración y de contenedores.',
    '**Nube:** despliegue en AWS con controles de IAM, cifrado, red y monitoreo, y evaluación de la postura de seguridad con herramientas CSPM.',
  ]),
  p('Queda fuera del alcance la operación continua en producción (gestión de incidentes, alta disponibilidad multi-región). El pipeline de integración continua queda definido en el repositorio como base para trabajo futuro.'),
  h2('1.4 Justificación'),
  p('La metodología DevSecOps integra la seguridad en cada etapa del ciclo de desarrollo, reduciendo costo y riesgo frente a la revisión tardía. El proyecto lo demuestra de forma objetiva: cada capa se escanea antes y después de la corrección con herramientas de libre acceso, las versiones de las herramientas están fijadas y todo el proceso está automatizado con scripts reproducibles, de modo que cualquier evaluador puede repetir los resultados.'),
];

const sec2 = [
  h1('2. Revisión del estado del arte / Marco conceptual'),
  h2('2.1 DevSecOps y el enfoque «shift-left»'),
  p('DevSecOps extiende las prácticas DevOps incorporando controles de seguridad automatizados a lo largo de todo el ciclo de vida del software. El principio «shift-left» consiste en desplazar la detección de defectos hacia las primeras etapas (diseño, codificación, construcción), donde corregirlos es más barato, y complementarla con monitoreo continuo en producción.'),
  ...figure('flujo.png', '**Figura 1.** Flujo DevSecOps del proyecto: módulos encadenados y ciclo escanear → corregir → re-escanear.', 624, 233),
  h2('2.2 Seguridad de aplicaciones: OWASP y CWE'),
  p('El **OWASP Top 10:2021** clasifica los riesgos más críticos de las aplicaciones web (p. ej. A01 Control de acceso roto, A02 Fallas criptográficas, A03 Inyección, A05 Configuración de seguridad incorrecta, A06 Componentes vulnerables y desactualizados, A07 Fallas de identificación y autenticación, A09 Fallas de registro y monitoreo). Cada vulnerabilidad concreta se cataloga además con su identificador **CWE** (Common Weakness Enumeration). Como guía de corrección se emplean el estándar **OWASP ASVS** y las **OWASP Cheat Sheets**.'),
  h2('2.3 Técnicas de análisis de seguridad'),
  ...table('Técnicas de análisis de seguridad empleadas', ['Técnica', 'Qué analiza', 'Pregunta que responde', 'Herramientas'], [
    ['**SAST** (Static Application Security Testing)', 'Código fuente, sin ejecutarlo', '¿El código contiene patrones inseguros conocidos?', 'Semgrep, SonarQube'],
    ['**SCA** (Software Composition Analysis)', 'Dependencias de terceros', '¿Alguna librería usada tiene CVE publicadas?', 'OWASP Dependency-Check, npm audit'],
    ['**DAST** (Dynamic Application Security Testing)', 'Aplicación en ejecución (caja negra)', '¿Se pueden explotar las debilidades en la práctica?', 'OWASP ZAP'],
    ['**CSPM** (Cloud Security Posture Management)', 'Configuración de la cuenta de nube', '¿La nube está configurada según buenas prácticas?', 'Prowler, ScoutSuite'],
  ], [2100, 2100, 2860, 2300]),
  p('Las técnicas son complementarias: SAST detecta el fallo en el código propio, SCA en el código de terceros, DAST confirma si es explotable y CSPM evalúa la infraestructura donde se ejecuta la aplicación.'),
  h2('2.4 Criptografía aplicada y gestión de identidad'),
  p('Para el almacenamiento de contraseñas se recomiendan funciones de derivación de clave lentas y con sal (scrypt, Argon2, bcrypt) en lugar de funciones hash rápidas como MD5 o SHA-1 (NIST SP 800-63B). La sesión se gestiona con **JSON Web Tokens** firmados (HS256) con expiración, emisor y audiencia verificados, transportados en cookies con los atributos `HttpOnly`, `Secure` y `SameSite`. La protección contra CSRF se implementa con el patrón *signed double-submit cookie*, firmando el token con HMAC y una clave derivada mediante HKDF.'),
  h2('2.5 Infraestructura como código y políticas como código'),
  p('La **infraestructura como código** (IaC) describe servidores, redes, bases de datos y permisos en archivos de texto versionados, de modo que la infraestructura es reproducible, revisable y destruible con un solo comando. **Terraform** es la herramienta de IaC utilizada: lee archivos `.tf`, calcula un plan de cambios y los aplica mediante la API del proveedor de nube, guardando el estado de los recursos creados. La seguridad de estos archivos se verifica antes de desplegar con *políticas como código*: **Checkov** y **Trivy** evalúan configuraciones inseguras (puertos abiertos, recursos sin cifrar, permisos excesivos) y **Hadolint** revisa las buenas prácticas del Dockerfile. Para contenedores se siguen las recomendaciones del **CIS Docker Benchmark**: imagen mínima, usuario no root, sistema de archivos de solo lectura y mínimo de capacidades.'),
  h2('2.6 Seguridad en la nube y CSPM'),
  p('En el **modelo de responsabilidad compartida**, AWS asegura la infraestructura física y los servicios, mientras que el cliente es responsable de la configuración de identidades, datos, red y monitoreo. El **CIS Amazon Web Services Foundations Benchmark** define los controles mínimos de una cuenta (uso de root y MFA, política de contraseñas, CloudTrail, alarmas de monitoreo, cifrado, red). Las herramientas **CSPM** verifican automáticamente estos controles: **Prowler** evalúa cientos de controles de CIS, NIST e ISO 27001 con resultado PASS/FAIL y severidad; **ScoutSuite** genera un informe agrupado por servicio y nivel de riesgo.'),
  h2('2.7 Herramientas y versiones utilizadas'),
  ...table('Herramientas de libre acceso utilizadas (versiones fijadas para reproducibilidad)', ['Herramienta', 'Tipo', 'Módulo', 'Versión', 'Uso en el proyecto'], [
    ['Semgrep', 'SAST', 'M1', '1.183.0', 'Reglas propias + reglas OWASP del registro'],
    ['SonarQube Community', 'SAST / calidad', 'M1', '26.10 (scanner 12.3)', 'Issues, vulnerabilidades y security hotspots'],
    ['OWASP Dependency-Check', 'SCA', 'M1', '12.2.2', 'CVE de dependencias contra la NVD'],
    ['npm audit', 'SCA', 'M1', 'npm (Node.js 24)', 'Complemento de SCA (GitHub Advisories)'],
    ['OWASP ZAP', 'DAST', 'M1', '2.16.1', 'Escaneo pasivo (baseline) y activo (full)'],
    ['Checkov', 'IaC', 'M2', '3.4.0', 'Políticas sobre Terraform y Dockerfile'],
    ['Trivy', 'IaC / contenedores', 'M2', '0.76.1', 'Configuración, CVE de imagen y SBOM'],
    ['Hadolint', 'Dockerfile', 'M2', '2.15.1', 'Buenas prácticas del Dockerfile'],
    ['Terraform', 'IaC', 'M2 / M3', '≥ 1.11 (AWS 6.x)', 'Definición y despliegue en AWS'],
    ['Prowler', 'CSPM', 'M3', '5.47.0', 'Controles CIS sobre la cuenta AWS'],
    ['ScoutSuite', 'CSPM', 'M3', '5.14.0', 'Segunda evaluación de postura'],
  ], [2100, 1500, 900, 1700, 3160]),
];

const sec3 = [
  h1('3. Objetivos'),
  h2('3.1 Objetivo general'),
  p('Construir y asegurar de extremo a extremo una plataforma web, integrando controles de seguridad desde el código hasta la nube mediante la metodología DevSecOps.'),
  h2('3.2 Objetivos específicos'),
  ...numbered([
    '**(M1)** Analizar y corregir las vulnerabilidades del código fuente aplicando SAST, SCA y DAST y prácticas de codificación segura.',
    '**(M2)** Definir la infraestructura como código y verificar su seguridad con escaneo de configuración y de contenedores.',
    '**(M3)** Desplegar la aplicación en un entorno de nube aplicando controles de seguridad (IAM, cifrado, red y monitoreo) y evaluar la postura con herramientas CSPM.',
  ]),
];

const sec4 = [
  h1('4. Metodología'),
  p('Se aplicó un enfoque DevSecOps con el ciclo **escanear → corregir → re-escanear** en cada módulo, conservando evidencia versionada de cada etapa:'),
  ...numbered([
    '**Línea base vulnerable.** La versión inicial de la aplicación y de su infraestructura se etiquetó como `v1.0-vulnerable` y se escaneó con todas las herramientas.',
    '**Corrección incremental.** Cada vulnerabilidad se corrigió en un commit independiente (`fix(M1/Vxx)`, `fix(M2…)`), cuyo mensaje cita el CWE y la categoría OWASP.',
    '**Re-escaneo.** La versión corregida, etiquetada `v2.0-secure`, se escaneó con las mismas herramientas y versiones.',
    '**Consolidación.** El script `summarize.mjs` reúne los reportes y genera la tabla comparativa antes/después (`reports/RESULTADOS.md`).',
  ]),
  p('Todas las herramientas se ejecutan en contenedores Docker con versión fijada, lo que asegura que los resultados sean reproducibles en cualquier equipo. La versión v1 se reconstruye automáticamente en una copia de trabajo aparte (`git worktree`), sin modificar la rama principal. El trabajo se realizó en Windows con Git Bash y Docker Desktop, y el despliegue en una cuenta de AWS en la región `us-east-1`.'),
  ...table('Scripts de automatización del repositorio', ['Script', 'Función'], [
    ['`m1-semgrep.sh v1|v2`', 'SAST con Semgrep (JSON, SARIF y texto)'],
    ['`m1-sca.sh v1|v2`', 'SCA con npm audit y OWASP Dependency-Check'],
    ['`m1-sonarqube.sh v1|v2`', 'Levanta SonarQube local y analiza el código'],
    ['`m1-zap.sh v1|v2 full`', 'Levanta la aplicación y ejecuta OWASP ZAP (baseline y full)'],
    ['`m2-iac-scan.sh v1|v2`', 'Checkov, Trivy config y Hadolint sobre la IaC'],
    ['`m2-image-scan.sh v1|v2`', 'Construye la imagen y la escanea con Trivy (CVE + SBOM)'],
    ['`m2-runtime-check.sh v2`', 'Verifica la configuración de los contenedores en ejecución'],
    ['`m3-apply.sh account|app`', 'Aplica la línea base de la cuenta y despliega la aplicación'],
    ['`m3-verify.sh`', 'Genera evidencia de los controles desplegados en AWS'],
    ['`m3-prowler.sh before|after`', 'Evaluación CSPM con Prowler (antes/después)'],
    ['`m3-scoutsuite.sh before|after`', 'Evaluación CSPM con ScoutSuite (antes/después)'],
    ['`m3-destroy.sh app|account|all`', 'Destruye los recursos para no generar costos'],
    ['`summarize.sh`', 'Consolida todos los reportes en la tabla antes/después'],
  ], [3300, 6060]),
];

const sec5 = [
  h1('5. Planeación del proyecto (cronograma)'),
  p('El proyecto se planificó en cuatro fases secuenciales, alineadas con los tres módulos y un cierre de consolidación. La bitácora detallada de cada fase se encuentra en los Anexos A, B y C.'),
  ...table('Cronograma del proyecto', ['Fase', 'Actividades', 'Recursos / herramientas', 'Entregable', 'Periodo'], [
    ['M1 · Código', 'Construcción de la línea base, escaneo v1, corrección V01–V14, re-escaneo v2, pruebas de seguridad', 'Semgrep, SonarQube, Dependency-Check, ZAP, npm audit', 'Código corregido + Anexo A', '[[fechas]]'],
    ['M2 · IaC', 'Dockerfile, Compose y Terraform endurecidos; escaneo de configuración y de imagen', 'Checkov, Trivy, Hadolint, Docker', 'IaC + Anexo B', '[[fechas]]'],
    ['M3 · Nube', 'Línea base de la cuenta, despliegue en AWS, verificación y CSPM antes/después', 'Terraform, AWS, Prowler, ScoutSuite', 'Despliegue + Anexo C', '[[fechas]]'],
    ['Cierre', 'Consolidación de resultados, análisis, informe y destrucción de recursos', 'summarize.mjs', 'Informe final', '[[fechas]]'],
  ], [1300, 2900, 2200, 1560, 1400]),
];

const vulns = [
  ['V01', 'Inyección SQL en el login', 'CWE-89', 'A03', 'Semgrep, SonarQube, ZAP', 'Consultas parametrizadas'],
  ['V02', 'Inyección SQL en la búsqueda', 'CWE-89', 'A03', 'Semgrep, ZAP', 'Parámetros + escape de comodines LIKE'],
  ['V03', 'XSS reflejado y almacenado', 'CWE-79', 'A03', 'Semgrep, ZAP', 'Salida escapada en EJS + CSP estricta'],
  ['V04', 'Inyección de comandos del SO', 'CWE-78', 'A03', 'Semgrep, ZAP', 'Sin shell, lista blanca, solo admin'],
  ['V05', 'Hash de contraseñas MD5 sin sal', 'CWE-916/327', 'A02', 'Semgrep, SonarQube', 'scrypt con sal, comparación en tiempo constante'],
  ['V06', 'Secretos embebidos en código e imagen', 'CWE-798', 'A07/A05', 'Semgrep, SonarQube, Trivy', 'Secretos por variable/archivo (`*_FILE`)'],
  ['V07', 'JWT sin expiración y cookie insegura', 'CWE-613/614/1004', 'A07/A05', 'Semgrep, revisión', 'HS256, exp/iss/aud, cookie `__Host-`'],
  ['V08', 'IDOR en notas', 'CWE-639', 'A01', 'Revisión, pruebas', 'Verificación del dueño en cada consulta'],
  ['V09', 'Asignación masiva (rol admin)', 'CWE-915', 'A01', 'Semgrep', 'Lista blanca de campos; rol desde la BD'],
  ['V10', 'Sin cabeceras de seguridad ni CSRF', 'CWE-352/693/1021', 'A05', 'ZAP', 'helmet (CSP, HSTS…) + CSRF firmado'],
  ['V11', 'Exposición de trazas de error', 'CWE-209', 'A05', 'ZAP, revisión', 'Manejador con ID de referencia'],
  ['V12', 'Registro inseguro e insuficiente', 'CWE-532/778', 'A09', 'Semgrep', 'Logger JSON sin secretos + eventos de seguridad'],
  ['V13', 'Sin límite de intentos', 'CWE-307', 'A07', 'Revisión', 'express-rate-limit'],
  ['V14', 'Componentes vulnerables', 'CWE-1104', 'A06', 'Dependency-Check, npm audit', 'Actualización de dependencias'],
];

const sec6 = [
  h1('6. Desarrollo'),
  p('Esta sección resume la ejecución de cada módulo; el paso a paso, los comandos y las evidencias se detallan en los anexos, que funcionan como bitácora del proyecto.'),
  h2('6.1 Aplicación caso de estudio: SecureNotes'),
  p('SecureNotes es una aplicación web de notas desarrollada en Node.js 24 con Express 5, vistas EJS y PostgreSQL. Permite registro e inicio de sesión, notas públicas y privadas, búsqueda, edición de perfil y un panel de administración. Es deliberadamente pequeña (alrededor de quince archivos fuente) para que cada herramienta produzca hallazgos claros y el antes/después sea fácil de interpretar. La versión v1 contiene catorce vulnerabilidades sembradas (V01–V14) que representan las categorías principales del OWASP Top 10.'),
  h2('6.2 Módulo 1 — Seguridad en el código'),
  p('Sobre la versión v1 se ejecutaron Semgrep (con reglas propias, en `security/semgrep/`, y reglas OWASP del registro), SonarQube, OWASP Dependency-Check, `npm audit` y OWASP ZAP en modo pasivo y activo. Los hallazgos se agruparon en las catorce vulnerabilidades de la Tabla 5 y cada una se corrigió en un commit independiente. El detalle de cada corrección se encuentra en el Anexo A.'),
  ...table('Vulnerabilidades identificadas y su corrección (Módulo 1)', ['ID', 'Vulnerabilidad', 'CWE', 'OWASP 2021', 'Detectada por', 'Corrección'], vulns,
    [600, 2050, 1250, 900, 1850, 2710]),
  p('Además de las correcciones, se añadió un conjunto de pruebas automatizadas de seguridad (`app/test/security.test.js`, ejecutable con `npm test`) que verifica el hash con scrypt, el rechazo de MD5, la política de contraseñas, la validación de JWT (expiración, emisor, audiencia y rechazo de `alg=none`), el prefijo `__Host-` de la cookie y que el registro nunca escribe secretos: **8 de 8 pruebas en verde**. El repositorio incluye un pipeline de GitHub Actions (`.github/workflows/devsecops.yml`) que ejecuta Semgrep, `npm audit`, Dependency-Check y las pruebas en cada cambio.'),
  h2('6.3 Módulo 2 — Infraestructura como código'),
  p('La infraestructura de la aplicación quedó definida íntegramente como código en tres capas: la imagen de contenedor (`app/Dockerfile`), la orquestación local (`infra/docker/docker-compose.yml` con un proxy TLS Caddy) y la nube (`infra/terraform/app` y `infra/terraform/account-baseline`). Igual que en el Módulo 1, la IaC insegura de v1 se comparó con la endurecida de v2.'),
  ...table('Endurecimiento de la imagen de contenedor', ['Aspecto', 'v1 (insegura)', 'v2 (endurecida)'], [
    ['Imagen base', '`node:16` (obsoleta, sin fijar)', 'Distroless `nodejs24-debian13`, fijada por digest'],
    ['Construcción', 'Una etapa, `npm install`, copia todo el contexto', 'Multi-etapa, `npm ci --omit=dev --ignore-scripts`'],
    ['Usuario', 'root', '65532 (no root)'],
    ['Secretos', '`ENV JWT_SECRET`, `ENV DB_PASSWORD`', 'Ninguno; se inyectan en ejecución'],
    ['Tamaño', '1349 MB', '223 MB'],
    ['Otros', '`CMD` en forma shell, sin HEALTHCHECK', '`CMD` exec, HEALTHCHECK, `.dockerignore`'],
  ], [1900, 3400, 4060]),
  p('En Docker Compose cada servicio corre con sistema de archivos de solo lectura, `cap_drop: ALL`, `no-new-privileges`, usuario no root y límites de memoria, CPU y procesos. La base de datos está en una red interna sin salida a Internet y no publica puertos; solo el proxy Caddy expone HTTPS en `127.0.0.1:8443`. Los secretos se entregan como *Docker secrets*.'),
  p('En Terraform, la versión v1 concentraba los 31 controles fallidos de Checkov: SSH y PostgreSQL abiertos a Internet, rol IAM con permisos totales, IMDSv1, discos sin cifrar, bucket S3 público y secretos en `user_data`. La versión v2 se reescribió con red segmentada, mínimo privilegio, cifrado con KMS en todos los servicios, secretos en SSM Parameter Store y monitoreo (ver sección 6.4).'),
  h2('6.4 Módulo 3 — Despliegue seguro en AWS'),
  p('El despliegue se realizó con Terraform en dos *stacks* independientes: `account-baseline`, que endurece la cuenta según CIS AWS Foundations, y `app`, que despliega la aplicación. La Figura 2 muestra la arquitectura resultante.'),
  ...figure('arquitectura.png', '**Figura 2.** Arquitectura de SecureNotes desplegada en AWS y línea base de seguridad de la cuenta.', 624, 374),
  ...table('Controles de seguridad desplegados por dominio', ['Dominio', 'Control', 'Implementación'], [
    ['IAM', 'Rol de la EC2 de mínimo privilegio', 'Solo lee `/securenotes/*` en SSM, descifra con su CMK, descarga su imagen y escribe en su log group'],
    ['IAM', 'Administración sin SSH', 'AWS Systems Manager Session Manager; sin llave SSH ni puerto 22'],
    ['IAM', 'Política de contraseñas CIS y auditoría', 'Mínimo 14 caracteres, historial 24, caducidad 90 días; rol de auditoría de solo lectura; IAM Access Analyzer'],
    ['Cifrado en reposo', 'Clave KMS propia con rotación', 'Cifra EBS, RDS, ECR, SSM, CloudWatch Logs y SNS; cifrado EBS por defecto en la cuenta'],
    ['Cifrado en tránsito', 'TLS de extremo a extremo hacia los datos', 'HTTPS en CloudFront; `rds.force_ssl=1` y validación del certificado de RDS'],
    ['Secretos', 'Sin secretos en código ni en el estado', 'Generados con recursos efímeros de Terraform y guardados como SecureString en SSM'],
    ['Red', 'Segmentación y exposición mínima', 'EC2 solo accesible desde CloudFront (prefix list); RDS en subredes privadas sin ruta a Internet; NACL; Flow Logs; S3 Block Public Access'],
    ['Red / aplicación', 'Firewall de aplicación', 'AWS WAF con reglas OWASP, Log4j, SQLi, reputación IP y límite de peticiones; encabezado secreto de origen'],
    ['Monitoreo', 'Auditoría y alertas', 'CloudTrail multirregión con validación de integridad; 15 alarmas CIS; alarmas sobre eventos de seguridad de la app → SNS (correo)'],
    ['Costos', 'Control de gasto', 'Presupuesto mensual con alertas'],
  ], [1500, 2500, 5360]),
  h3('6.4.1 Ajustes e incidencias durante el despliegue'),
  p('El despliegue sobre una cuenta en el plan gratuito (Free plan) de AWS y desde Windows planteó incidencias que se resolvieron y documentaron como parte de la bitácora:'),
  ...table('Incidencias encontradas y solución aplicada', ['Incidencia', 'Causa', 'Solución'], [
    ['Dependency-Check terminaba con código 1 en Windows', 'Git Bash convertía las rutas de los volúmenes de Docker', 'Detección de Windows en `lib.sh`: `MSYS_NO_PATHCONV=1`, rutas mixtas y sin `--user`'],
    ['GuardDuty: `SubscriptionRequiredException`', 'El Free plan no incluye el servicio', '`enable_guardduty = false`; excepción documentada (sección 7.4)'],
    ['RDS: `FreeTierRestrictionError`', 'El Free plan solo permite 1 día de retención de backups', 'Variable `db_backup_retention_days = 1`'],
    ['ECR rechazó publicar la etiqueta `2.0.0`', 'Las etiquetas son inmutables (control de seguridad)', 'El script omite la publicación si la etiqueta ya existe'],
    ['CloudFront devolvía 504; logs con código PostgreSQL `28P01`', 'Un despliegue fallido a medias dejó distinta la contraseña de SSM y la de RDS', 'Resincronización de la contraseña de la base de datos'],
    ['Resumen de Prowler y de resultados fallaba en Windows / Node 24', 'Salida de Prowler concatenada y rutas `C:\\C:\\…`', 'Corrección de los scripts `m3-prowler.sh` y `summarize.mjs`'],
  ], [2700, 3000, 3660]),
  p('El caso de la contraseña desincronizada ilustra un compromiso de diseño: no guardar secretos en el estado de Terraform mejora la seguridad, pero obliga a resincronizarlos si un despliegue falla a mitad de camino.'),
];

const sec7 = [
  h1('7. Resultados y análisis de resultados'),
  p('Las cifras se obtuvieron con los scripts del repositorio y se consolidaron con `summarize.sh` (`reports/RESULTADOS.md`). Las evidencias gráficas se encuentran en los anexos.'),
  h2('7.1 Módulo 1 — Código'),
  ...table('Resultados del Módulo 1 (antes / después)', ['Herramienta', 'Métrica', 'v1 (vulnerable)', 'v2 (segura)'], [
    ['Semgrep (SAST)', 'Hallazgos totales', '16', '**0**'],
    ['Semgrep', 'Hallazgos de severidad ERROR', '11', '**0**'],
    ['npm audit (SCA)', 'Vulnerabilidades (críticas / altas)', '16 (2 / 6)', '**0**'],
    ['OWASP Dependency-Check (SCA)', 'CVE únicas', '[[v1]]', '[[v2]]'],
    ['SonarQube', 'Issues / security hotspots', '[[v1]]', '[[v2]]'],
    ['OWASP ZAP baseline (pasivo)', 'Alertas medio / bajo', '3 / 2', '**0 / 0**'],
    ['OWASP ZAP full (activo)', 'Alertas alto / medio / bajo', '5 / 3 / 2', '**0 / 0 / 0**'],
    ['Pruebas de seguridad', 'Pruebas superadas', '—', '**8 / 8**'],
  ], [2600, 2900, 1900, 1960], { right: [2, 3] }),
  p('El escaneo activo de ZAP confirmó en v1 la explotabilidad real de inyección SQL, XSS reflejado y basado en DOM, e inyección de comandos del sistema operativo (Anexo A, sección A.2); ninguna de estas alertas aparece en v2.'),
  h2('7.2 Módulo 2 — Infraestructura como código y contenedores'),
  ...table('Resultados del Módulo 2 (antes / después)', ['Herramienta', 'Métrica', 'v1 (vulnerable)', 'v2 (segura)'], [
    ['Checkov', 'Controles fallidos', '31', '**0**'],
    ['Checkov', 'Controles superados', '50', '444'],
    ['Trivy config', 'Fallos CRITICAL / HIGH', '4 / 9', '**0 / 0**'],
    ['Trivy imagen', 'Vulnerabilidades CRITICAL', '19', '**0**'],
    ['Trivy imagen', 'Vulnerabilidades HIGH', '406', '**0**'],
    ['Trivy imagen', 'Vulnerabilidades MEDIUM / LOW', '538 / 117', '24 / 8'],
    ['Hadolint', 'Advertencias', '3', '**0**'],
    ['Imagen', 'Tamaño', '1349 MB', '**223 MB**'],
    ['Imagen', 'Usuario de ejecución', 'root', '**65532 (no root)**'],
    ['Imagen', 'Secretos en variables de entorno', 'JWT_SECRET, DB_PASSWORD', '**ninguno**'],
  ], [2300, 3000, 2100, 1960], { right: [2, 3] }),
  p('La imagen pasó de 1080 vulnerabilidades en total a 32 (una reducción del 97 %), y de 425 CRITICAL/HIGH a ninguna. Las 32 restantes son de severidad media o baja, pertenecen al sistema base distroless y no tienen corrección publicada por el proveedor.'),
  h2('7.3 Módulo 3 — Nube (CSPM)'),
  ...table('Resultados del Módulo 3 (antes / después de la línea base)', ['Herramienta', 'Métrica', 'Antes', 'Después'], [
    ['Prowler', 'Controles PASS', '[[antes]]', '352'],
    ['Prowler', 'Controles FAIL', '[[antes]]', '95'],
    ['Prowler', 'Tasa de cumplimiento (PASS / total)', '[[antes]]', '78,7 %'],
    ['Prowler', 'FAIL críticos / altos', '[[antes]]', '5 / 20'],
    ['Prowler', 'FAIL medios / bajos', '[[antes]]', '40 / 30'],
    ['ScoutSuite', 'Reglas en peligro (danger)', '[[antes]]', '[[después]]'],
    ['ScoutSuite', 'Ítems marcados', '[[antes]]', '[[después]]'],
  ], [2000, 3400, 1980, 1980], { right: [2, 3] }),
  p('Principales controles en FAIL de severidad crítica y alta después de la línea base y su clasificación: [[listar los 5 críticos y 20 altos de prowler-after.html, indicando si son excepción justificada (sección 7.4) o pendiente]].'),
  h2('7.4 Excepciones y riesgos aceptados'),
  p('No todos los controles pueden ni deben llevarse a «verde» en un entorno académico. Las excepciones se documentaron explícitamente, con su justificación y control compensatorio, como corresponde a una gestión de riesgo realista:'),
  ...table('Excepciones documentadas', ['Control', 'Motivo', 'Mitigación / compensación'], [
    ['MFA y no uso de la cuenta root', 'Requiere acción manual en la consola (no automatizable con Terraform)', 'Paso manual documentado; alarma CIS de uso de root'],
    ['Amazon GuardDuty', 'No disponible en el Free plan de AWS', 'CloudTrail + 15 alarmas CIS; se activa con `enable_guardduty = true`'],
    ['Security Hub y AWS Config', 'Generan costo por evaluación / ítem registrado', 'Implementados en el código; desactivados por variable'],
    ['Retención de backups RDS (1 día)', 'Restricción del Free plan', 'Backups activos; en producción ≥ 7 días con la misma variable'],
    ['RDS Multi-AZ y Performance Insights', 'Costo / no disponible en `db.t4g.micro`', 'Monitoreo mejorado y logs exportados'],
    ['TLS de CloudFront al origen y política TLS mínima', 'Sin dominio propio no hay certificado válido para la EC2', 'SG restringido a CloudFront + encabezado secreto; con dominio y ACM se fija TLS 1.2'],
    ['Salida HTTPS de la EC2 a Internet', 'Sin NAT ni VPC endpoints (costo)', 'Solo puerto 443; el resto del egreso está bloqueado'],
    ['CVE MEDIUM/LOW en la imagen', 'Paquetes del sistema base sin corrección publicada', 'Imagen distroless mínima; re-escaneo periódico'],
  ], [2700, 3000, 3660]),
  h2('7.5 Análisis'),
  p('Los resultados muestran que integrar controles en cada etapa del ciclo de vida es efectivo: en las tres capas se eliminaron los hallazgos de severidad alta y crítica, con evidencia objetiva y reproducible. Cada técnica aportó información que las demás no ofrecían: SAST localizó la línea exacta del fallo, SCA identificó el riesgo heredado de librerías de terceros (16 vulnerabilidades sin una sola línea de código propio) y DAST confirmó qué debilidades eran explotables en la práctica.'),
  p('En la infraestructura, el escaneo de políticas como código permitió corregir configuraciones peligrosas antes de crear un solo recurso en la nube, y el endurecimiento de la imagen redujo simultáneamente la superficie de ataque, el tamaño y el riesgo de exposición de secretos. En la nube, la evaluación CSPM cuantifica la mejora de postura que aporta la línea base y deja visibles los controles que requieren acción manual o tienen costo.'),
  p('Las incidencias del despliegue aportaron aprendizajes adicionales: las restricciones del plan de la cuenta condicionan los controles disponibles, los controles de seguridad (etiquetas inmutables en ECR, secretos fuera del estado) pueden interferir con la automatización y deben contemplarse en los scripts, y el registro estructurado de eventos de la aplicación (V12) fue decisivo para diagnosticar el fallo de despliegue desde CloudWatch.'),
];

const sec8 = [
  h1('8. Conclusiones y trabajos futuros'),
  h2('8.1 Conclusiones'),
  bullet('**Objetivo 1 (código):** se corrigieron las catorce vulnerabilidades sembradas, verificándolo con SAST, SCA y DAST: Semgrep pasó de 16 a 0 hallazgos, `npm audit` de 16 a 0 y ZAP de 5 alertas altas a 0, con pruebas automatizadas que respaldan las correcciones.'),
  bullet('**Objetivo 2 (IaC):** la infraestructura quedó definida como código, versionada y validada: Checkov pasó de 31 a 0 controles fallidos y la imagen de contenedor de 1,3 GB ejecutándose como root con 425 CVE críticas o altas a 223 MB sin root y sin CVE críticas o altas.'),
  bullet('**Objetivo 3 (nube):** la aplicación se desplegó en AWS con controles de IAM, cifrado, red y monitoreo alineados con CIS AWS Foundations, y la postura se evaluó con dos herramientas CSPM independientes; las excepciones restantes están justificadas.'),
  bullet('La seguridad dejó de ser una fase final y se integró en cada etapa, con herramientas de libre acceso y un proceso completamente reproducible.'),
  h2('8.2 Trabajos futuros'),
  bullet('Activar el pipeline de CI/CD con *quality gates* que bloqueen la integración ante hallazgos altos.'),
  bullet('Firmar las imágenes (cosign) y validar el SBOM y las atestaciones en el pipeline.'),
  bullet('Gestionar los secretos con rotación automática (AWS Secrets Manager) y estado remoto de Terraform cifrado.'),
  bullet('Habilitar GuardDuty, Security Hub y AWS Config con remediación automática en una cuenta de pago.'),
  bullet('Usar un dominio propio con certificado ACM para TLS de extremo a extremo hasta el origen.'),
];

const refs = [
  'Amazon Web Services. (2024). *AWS Well-Architected Framework: Security pillar*. https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/',
  'Aqua Security. (2024). *Trivy documentation*. https://trivy.dev/',
  'Bridgecrew. (2024). *Checkov documentation*. https://www.checkov.io/',
  'Center for Internet Security. (2024). *CIS Amazon Web Services Foundations Benchmark v3.0.0*. https://www.cisecurity.org/benchmark/amazon_web_services',
  'Center for Internet Security. (2023). *CIS Docker Benchmark*. https://www.cisecurity.org/benchmark/docker',
  'HashiCorp. (2024). *Terraform documentation*. https://developer.hashicorp.com/terraform',
  'MITRE. (2024). *Common Weakness Enumeration (CWE)*. https://cwe.mitre.org/',
  'National Institute of Standards and Technology. (2017). *Digital identity guidelines: Authentication and lifecycle management* (NIST SP 800-63B). https://doi.org/10.6028/NIST.SP.800-63b',
  'NCC Group. (2024). *ScoutSuite*. https://github.com/nccgroup/ScoutSuite',
  'OWASP Foundation. (2021). *OWASP Top 10:2021*. https://owasp.org/Top10/',
  'OWASP Foundation. (2024). *OWASP Application Security Verification Standard (ASVS)*. https://owasp.org/www-project-application-security-verification-standard/',
  'OWASP Foundation. (2024). *OWASP Cheat Sheet Series*. https://cheatsheetseries.owasp.org/',
  'OWASP Foundation. (2024). *OWASP Dependency-Check*. https://owasp.org/www-project-dependency-check/',
  'Prowler. (2024). *Prowler documentation*. https://docs.prowler.com/',
  'Semgrep. (2024). *Semgrep documentation*. https://semgrep.dev/docs/',
  'SonarSource. (2024). *SonarQube documentation*. https://docs.sonarsource.com/',
  'ZAP. (2024). *ZAP documentation*. https://www.zaproxy.org/docs/',
];
function refPara(r) {
  // cursiva entre *...*
  const parts = r.split(/(\*[^*]+\*)/g).filter(Boolean);
  return new Paragraph({
    indent: { left: 720, hanging: 720 }, spacing: { after: 120, line: 276 },
    children: parts.map((s) => (s.startsWith('*') ? new TextRun({ text: s.slice(1, -1), italics: true }) : new TextRun(s))),
  });
}
const sec9 = [h1('9. Referencias', true), ...refs.map(refPara)];

// ---------- Anexo A ----------
const vulnDetail = [
  ['V01 · Inyección SQL en el login (CWE-89, A03)', '`routes/auth.js` construía la consulta concatenando el usuario y el hash de la contraseña.', 'Permitía iniciar sesión como otro usuario (incluido el administrador) sin conocer su contraseña.', 'Consulta parametrizada (`WHERE username = $1`) y verificación de la contraseña en el código. Commit `fix(M1/V01,V02)`.'],
  ['V02 · Inyección SQL en la búsqueda (CWE-89, A03)', '`routes/notes.js` interpolaba el texto de búsqueda dentro de `ILIKE`.', 'Permitía extraer datos de otras tablas, como los hashes de contraseña de todos los usuarios.', '`ILIKE $1` con parámetro y escape de los comodines `%` y `_`. Commit `fix(M1/V01,V02)`.'],
  ['V03 · XSS reflejado y almacenado (CWE-79, A03)', 'Las vistas EJS usaban salida sin escapar (`<%- %>`) para la búsqueda y el cuerpo de las notas.', 'Una nota maliciosa ejecutaba JavaScript en el navegador de quien la visualizaba.', 'Salida escapada (`<%= %>`) y política CSP estricta sin scripts en línea. Commit `fix(M1/V03)`.'],
  ['V04 · Inyección de comandos (CWE-78, A03)', '`/api/diag` ejecutaba `ping` mediante una shell concatenando el host recibido.', 'Ejecución de comandos arbitrarios en el servidor.', 'Se elimina la shell (`dns.lookup`), validación por lista blanca y acceso solo para administradores. Commit `fix(M1/V04)`.'],
  ['V05 · Almacenamiento débil de contraseñas (CWE-916/327, A02)', 'Contraseñas guardadas con MD5 sin sal.', 'Los hashes se revierten de inmediato con tablas precalculadas.', 'scrypt (N=2^16, r=8, p=2) con sal aleatoria de 16 bytes, verificación en tiempo constante, hash señuelo contra enumeración y política de longitud (NIST SP 800-63B). Commit `fix(M1/V05)`.'],
  ['V06 · Secretos embebidos (CWE-798, A07/A05)', '`config.js` con secreto JWT y credenciales fijas; Dockerfile con `ENV` de secretos.', 'Cualquiera con acceso al código o a la imagen obtenía las credenciales.', 'Secretos leídos de variables de entorno o archivos (`*_FILE`); `JWT_SECRET` de al menos 256 bits; administrador inicial solo con `ADMIN_PASSWORD` de un gestor de secretos. Commit `fix(M1/V06,V07)`.'],
  ['V07 · Sesión JWT insegura (CWE-613/614/1004, A07/A05)', 'JWT sin expiración ni algoritmo fijo; cookie sin atributos de seguridad.', 'Tokens robados válidos indefinidamente y riesgo de aceptar tokens no firmados.', 'HS256 fijo, `expiresIn`, `issuer` y `audience` verificados; cookie `__Host-session` con `HttpOnly`, `Secure` y `SameSite=Strict`. Commit `fix(M1/V06,V07)`.'],
  ['V08 · IDOR en notas (CWE-639, A01)', 'La lectura y el borrado de notas no comprobaban el dueño.', 'Un usuario podía leer o borrar notas privadas ajenas cambiando el identificador.', 'Las consultas exigen el dueño (o nota pública) y responden 404 en caso contrario. Commit `fix(M1/V08,V09)`.'],
  ['V09 · Asignación masiva (CWE-915, A01)', 'El perfil se actualizaba fusionando todo el cuerpo de la petición.', 'Un usuario podía asignarse el rol de administrador.', 'Lista blanca de campos (`full_name`, `email`); el rol se consulta en la base de datos en cada petición; se elimina lodash. Commit `fix(M1/V08,V09)`.'],
  ['V10 · Cabeceras de seguridad y CSRF (CWE-352/693/1021, A05)', 'Sin helmet, con `X-Powered-By` y sin protección CSRF.', 'Clickjacking, ataques CSRF y ausencia de defensas del navegador.', 'helmet (CSP, HSTS, `X-Frame-Options`, nosniff, Referrer-Policy), `Cache-Control: no-store` y CSRF con *signed double-submit cookie* (HMAC con clave HKDF). Commit `fix(M1/V10,V11)`.'],
  ['V11 · Exposición de trazas (CWE-209, A05)', 'El manejador de errores enviaba la traza completa al cliente.', 'Revelaba rutas internas, versiones y lógica del servidor.', 'Registro del detalle en el servidor y respuesta al usuario solo con un ID de referencia. Commit `fix(M1/V10,V11)`.'],
  ['V12 · Registro inseguro (CWE-532/778, A09)', 'Se registraban contraseñas en texto plano y no había eventos de seguridad.', 'Fuga de credenciales en los logs y nula capacidad de detección.', 'Logger JSON que filtra campos sensibles y emite eventos `login_failed`, `csrf_failed`, `access_denied`, etc., base de las alarmas del Módulo 3. Commit `fix(M1/V12,V13)`.'],
  ['V13 · Fuerza bruta (CWE-307, A07)', 'Login y registro sin límite de intentos.', 'Adivinación de contraseñas por fuerza bruta.', 'express-rate-limit: 10 intentos cada 15 minutos en login y registro; 300 peticiones por minuto por IP. Commit `fix(M1/V12,V13)`.'],
  ['V14 · Componentes vulnerables (CWE-1104, A06)', 'express 4.17.1, jsonwebtoken 8.5.1, ejs 3.1.6, lodash 4.17.15, pg 8.7.1, morgan 1.9.0.', '16 vulnerabilidades conocidas (2 críticas y 6 altas).', 'Actualización a versiones corregidas (Express 5.3, EJS 7.0, jsonwebtoken 9.0, pg 8.23), eliminación de lodash y `npm audit` en 0. Commit `fix(M1/V14)`.'],
];
const anexoA = [
  h1('Anexo A. Módulo 1 — Seguridad en el código', true),
  p('**Objetivo:** analizar y corregir las vulnerabilidades del código fuente aplicando SAST, SCA y DAST. **Entregable:** código corregido en el repositorio Git e informe de hallazgos y remediación.'),
  h2('A.1 Comandos ejecutados'),
  ...code([
    './scripts/m1-semgrep.sh v1   && ./scripts/m1-semgrep.sh v2    # SAST',
    './scripts/m1-sca.sh v1       && ./scripts/m1-sca.sh v2        # SCA',
    './scripts/m1-sonarqube.sh v1 && ./scripts/m1-sonarqube.sh v2  # SAST',
    './scripts/m1-zap.sh v1 full  && ./scripts/m1-zap.sh v2 full   # DAST',
    'cd app && npm test                                            # pruebas',
  ]),
  p('Los reportes quedan en `reports/m1/v1/` y `reports/m1/v2/` (JSON, SARIF, HTML y texto).'),
  h2('A.2 Alertas de OWASP ZAP sobre v1 (escaneo activo)'),
  ...table('Alertas de OWASP ZAP (full) sobre la versión vulnerable', ['Alerta', 'Riesgo', 'Instancias'], [
    ['SQL Injection', 'Alto', '2'],
    ['Cross Site Scripting (Reflected)', 'Alto', '1'],
    ['Cross Site Scripting (DOM Based)', 'Alto', '4'],
    ['Remote OS Command Injection', 'Alto', '1'],
    ['Remote OS Command Injection (Time Based)', 'Alto', '1'],
    ['Absence of Anti-CSRF Tokens', 'Medio', '3'],
    ['Content Security Policy (CSP) Header Not Set', 'Medio', '9'],
    ['Missing Anti-clickjacking Header', 'Medio', '6'],
    ['Server Leaks Information via "X-Powered-By"', 'Bajo', '11'],
    ['X-Content-Type-Options Header Missing', 'Bajo', '8'],
  ], [5560, 1900, 1900], { right: [2] }),
  p('Sobre v2 el mismo escaneo no reporta alertas de riesgo alto, medio ni bajo.'),
  h2('A.3 Detalle de hallazgos y remediación'),
  ...vulnDetail.flatMap(([title, where, impact, fix]) => [
    h3(title),
    bullet(`**En v1:** ${where}`),
    bullet(`**Impacto:** ${impact}`),
    bullet(`**Corrección:** ${fix}`),
  ]),
  h2('A.4 Evidencias'),
  ...capture('A-1', 'Semgrep sobre v1: 16 hallazgos (SARIF Viewer de VS Code o semgrep.txt).', 'm1-semgrep-v1.png'),
  ...capture('A-2', 'Semgrep sobre v2: 0 hallazgos.', 'm1-semgrep-v2.png'),
  ...capture('A-3', 'npm audit sobre v1 (16 vulnerabilidades) y v2 (0), salida de m1-sca.sh.', 'm1-npm-audit.png'),
  ...capture('A-4', 'Reporte HTML de OWASP Dependency-Check sobre v1 (dependency-check-report.html).', 'm1-depcheck-v1.png'),
  ...capture('A-5', 'Reporte HTML de OWASP Dependency-Check sobre v2.', 'm1-depcheck-v2.png'),
  ...capture('A-6', 'Panel de SonarQube del proyecto v1 (issues, vulnerabilidades y hotspots).', 'm1-sonarqube-v1.png'),
  ...capture('A-7', 'Panel de SonarQube del proyecto v2.', 'm1-sonarqube-v2.png'),
  ...capture('A-8', 'Reporte de OWASP ZAP full sobre v1 (zap-full.html) con las alertas altas.', 'm1-zap-v1.png'),
  ...capture('A-9', 'Reporte de OWASP ZAP full sobre v2 sin alertas.', 'm1-zap-v2.png'),
  ...capture('A-10', 'Ejecución de npm test: 8 de 8 pruebas de seguridad en verde.', 'm1-tests.png'),
  ...capture('A-11', 'Historial de Git con las etiquetas v1.0-vulnerable y v2.0-secure y los commits fix(M1/…).', 'm1-git-log.png'),
];

// ---------- Anexo B ----------
const anexoB = [
  h1('Anexo B. Módulo 2 — Infraestructura como código', true),
  p('**Objetivo:** definir la infraestructura como código y verificar su seguridad con escaneo de configuración y de contenedores. **Entregable:** archivos IaC y su explicación paso a paso.'),
  h2('B.1 Comandos ejecutados'),
  ...code([
    './scripts/m2-iac-scan.sh v1   && ./scripts/m2-iac-scan.sh v2    # IaC',
    './scripts/m2-image-scan.sh v1 && ./scripts/m2-image-scan.sh v2  # imagen',
    './scripts/m2-runtime-check.sh v2                                # runtime',
  ]),
  h2('B.2 Archivos de infraestructura como código'),
  ...table('Qué se define como código', ['Capa', 'Archivos', 'Qué describe'], [
    ['Imagen', '`app/Dockerfile`, `app/.dockerignore`', 'Empaquetado de la aplicación'],
    ['Orquestación local', '`infra/docker/docker-compose.yml`, `Caddyfile`', 'App + PostgreSQL + proxy TLS endurecidos'],
    ['Nube (aplicación)', '`infra/terraform/app/*.tf`', 'VPC, CloudFront + WAF, EC2, RDS, KMS, ECR, SSM, IAM y monitoreo'],
    ['Nube (cuenta)', '`infra/terraform/account-baseline/*.tf`', 'Línea base CIS: CloudTrail, alarmas, IAM, cifrado por defecto'],
  ], [2000, 3700, 3660]),
  h2('B.3 Hallazgos de Hadolint sobre el Dockerfile v1'),
  ...table('Advertencias de Hadolint (v1)', ['Regla', 'Línea', 'Descripción'], [
    ['DL3064', '7', 'Datos potencialmente sensibles en `ARG`/`ENV` (`JWT_SECRET`)'],
    ['DL3064', '8', 'Datos potencialmente sensibles en `ARG`/`ENV` (`DB_PASSWORD`)'],
    ['DL3025', '11', 'Usar notación JSON (forma exec) en `CMD`'],
  ], [1600, 1200, 6560]),
  h2('B.4 Configuración de los contenedores en ejecución (v2)'),
  ...table('Evidencia de m2-runtime-check.sh (runtime-config.md)', ['Servicio', 'Usuario', 'FS solo lectura', 'cap_drop', 'no-new-priv.', 'Puertos', 'Memoria', 'Secretos en ENV'], [
    ['app', '65532', 'sí', 'ALL', 'sí', 'ninguno', '512 MiB', 'ninguno'],
    ['db', '70', 'sí', 'ALL', 'sí', 'ninguno', '512 MiB', 'ninguno'],
    ['proxy', 'root', 'sí', 'ALL (+NET_BIND)', 'sí', '127.0.0.1:8443', '128 MiB', 'ninguno'],
  ], [1000, 900, 1100, 1500, 1100, 1560, 1000, 1200]),
  p('Redes: `backend` interna (sin salida a Internet) y `frontend`. El proxy conserva root únicamente para enlazar el puerto TLS, con todas las demás capacidades eliminadas.'),
  h2('B.5 Excepciones justificadas en Checkov'),
  p('La versión v2 obtiene 0 controles fallidos y 444 superados, con 18 excepciones justificadas por escrito en el propio código (`#checkov:skip=…:motivo`). Las principales son: Multi-AZ y Performance Insights de RDS desactivados para permanecer en la capa gratuita; política TLS mínima de CloudFront y TLS hasta el origen, que requieren dominio propio con certificado ACM; y la salida HTTPS de la EC2 sin NAT ni VPC endpoints por costo.'),
  h2('B.6 Evidencias'),
  ...capture('B-1', 'Checkov sobre v1: 31 controles fallidos (checkov.txt).', 'm2-checkov-v1.png'),
  ...capture('B-2', 'Checkov sobre v2: 0 fallidos, 444 superados.', 'm2-checkov-v2.png'),
  ...capture('B-3', 'Trivy config sobre v1 (trivy-config.txt).', 'm2-trivy-config-v1.png'),
  ...capture('B-4', 'Hadolint sobre el Dockerfile v1: 3 advertencias.', 'm2-hadolint-v1.png'),
  ...capture('B-5', 'Trivy imagen v1: 19 CRITICAL y 406 HIGH (trivy-image.txt).', 'm2-trivy-image-v1.png'),
  ...capture('B-6', 'Trivy imagen v2: 0 CRITICAL y 0 HIGH.', 'm2-trivy-image-v2.png'),
  ...capture('B-7', 'Comparación de imágenes (docker images): 1349 MB frente a 223 MB.', 'm2-image-size.png'),
  ...capture('B-8', 'Configuración en ejecución de los contenedores v2 (runtime-config.md).', 'm2-runtime-v2.png'),
];

// ---------- Anexo C ----------
const anexoC = [
  h1('Anexo C. Módulo 3 — Seguridad en la nube', true),
  p('**Objetivo:** desplegar la aplicación en un entorno de nube real aplicando controles de seguridad y evaluar la postura con herramientas CSPM. **Entregable:** despliegue funcional, informe de configuración de seguridad y reporte CSPM.'),
  h2('C.1 Secuencia de despliegue y evaluación'),
  ...code([
    'export AWS_REGION=us-east-1',
    './scripts/m3-prowler.sh before     # postura ANTES de la línea base',
    './scripts/m3-scoutsuite.sh before',
    './scripts/m3-apply.sh account      # línea base de la cuenta',
    './scripts/m3-apply.sh app          # imagen en ECR + infraestructura',
    './scripts/m3-verify.sh             # evidencia de los controles',
    './scripts/m3-prowler.sh after      # postura DESPUÉS',
    './scripts/m3-scoutsuite.sh after',
    './scripts/summarize.sh             # tabla consolidada',
    './scripts/m3-destroy.sh all        # eliminar recursos al final',
  ]),
  h2('C.2 Parámetros ajustados al plan de la cuenta'),
  ...table('Variables de Terraform ajustadas (terraform.tfvars)', ['Variable', 'Valor', 'Motivo'], [
    ['`enable_guardduty` (account-baseline)', 'false', 'GuardDuty no disponible en el Free plan'],
    ['`enable_securityhub`, `enable_config`', 'false', 'Evitar costos de evaluación'],
    ['`db_backup_retention_days` (app)', '1', 'Máximo permitido por el Free plan'],
    ['`region`', 'us-east-1', 'Región requerida por CloudFront/WAF y la línea base'],
  ], [3600, 1300, 4460]),
  h2('C.3 Verificación del despliegue'),
  bullet('La aplicación responde por **HTTPS** en la URL de CloudFront (salida `app_url`) con cabeceras de seguridad (HSTS, CSP, `X-Frame-Options`).'),
  bullet('El **acceso directo al origen** EC2 (salida `origin_public_dns`) falla: el grupo de seguridad solo admite la lista de prefijos de CloudFront y la app exige el encabezado secreto.'),
  bullet('La **base de datos** no tiene acceso público, está cifrada con KMS y exige TLS (`rds.force_ssl=1`).'),
  bullet('La **administración** de la instancia se realiza con Session Manager, sin llaves SSH.'),
  bullet('Los **secretos** se almacenan como SecureString cifrados en SSM Parameter Store.'),
  bullet('`m3-verify.sh` genera `reports/m3/despliegue/verificacion.md` con la evidencia de cada control.'),
  h2('C.4 Evidencias'),
  ...capture('C-1', 'Salida de terraform apply de la aplicación con los outputs (app_url, instance_id, rds_endpoint).', 'm3-terraform-apply.png'),
  ...capture('C-2', 'SecureNotes abierta por HTTPS en la URL de CloudFront (candado visible).', 'm3-app-https.png'),
  ...capture('C-3', 'Inicio de sesión como administrador y creación de una nota en la nube.', 'm3-app-login.png'),
  ...capture('C-4', 'Acceso directo al origen EC2 bloqueado.', 'm3-origin-blocked.png'),
  ...capture('C-5', 'Parámetros SecureString en SSM Parameter Store (sin mostrar valores).', 'm3-ssm-parameters.png'),
  ...capture('C-6', 'Instancia RDS: no pública, cifrada con KMS.', 'm3-rds.png'),
  ...capture('C-7', 'Web ACL de AWS WAF asociada a CloudFront.', 'm3-waf.png'),
  ...capture('C-8', 'Trail de CloudTrail multirregión con validación de integridad.', 'm3-cloudtrail.png'),
  ...capture('C-9', 'Alarmas CIS y de la aplicación en CloudWatch.', 'm3-alarmas.png'),
  ...capture('C-10', 'Eventos JSON de la aplicación en CloudWatch Logs (logger del Módulo 1).', 'm3-cloudwatch-logs.png'),
  ...capture('C-11', 'Reporte de Prowler ANTES de la línea base (prowler-before.html).', 'm3-prowler-before.png'),
  ...capture('C-12', 'Reporte de Prowler DESPUÉS: 352 PASS, 95 FAIL (prowler-after.html).', 'm3-prowler-after.png'),
  ...capture('C-13', 'Informe de ScoutSuite ANTES de la línea base.', 'm3-scoutsuite-before.png'),
  ...capture('C-14', 'Informe de ScoutSuite DESPUÉS de la línea base.', 'm3-scoutsuite-after.png'),
  ...capture('C-15', 'Destrucción de los recursos con m3-destroy.sh al finalizar.', 'm3-destroy.png'),
];

// ---------- documento ----------
const doc = new Document({
  creator: 'Proyecto Final Integrador',
  title: 'Plataforma web segura: del código a la nube',
  description: 'Informe final del proyecto integrador DevSecOps (SecureNotes)',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, color: BLUE, font: 'Arial' }, paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0, keepNext: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 25, bold: true, color: '2F5496', font: 'Arial' }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, color: '404040', font: 'Arial' }, paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2, keepNext: true } },
      { id: 'Leyenda', name: 'Leyenda', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 18, italics: false, color: '404040' }, paragraph: { spacing: { before: 60, after: 200 } } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      ] },
      { reference: 'numbers', levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ] },
    ],
  },
  sections: [{
    properties: {
      titlePage: true,
      page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
    },
    headers: {
      default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF', space: 4 } },
        children: [new TextRun({ text: 'Plataforma web segura: del código a la nube', size: 16, color: '808080' })] })] }),
      first: new Header({ children: [new Paragraph({ children: [] })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], size: 16, color: '808080' })] })] }),
      first: new Footer({ children: [new Paragraph({ children: [] })] }),
    },
    children: [
      ...portada, ...indice, ...resumen, ...sec1, ...sec2, ...sec3, ...sec4, ...sec5, ...sec6, ...sec7, ...sec8, ...sec9,
      ...anexoA, ...anexoB, ...anexoC,
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('OK', OUT, buf.length); });
