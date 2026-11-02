// Genera el Informe Final del Proyecto Integrador (SecureNotes) en .docx con formato APA 7.ª edición
// (trabajo de estudiante): Times New Roman 12, doble espacio, alineación a la izquierda,
// sangría de primera línea de 1,27 cm, márgenes de 2,54 cm y número de página arriba a la derecha.
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, BorderStyle, LevelFormat, TableOfContents, ImageRun, Header, PageNumber, VerticalAlign,
} = require('docx');

const OUT = process.argv[2] || 'Informe-Final-SecureNotes.docx';
const DIR = __dirname;
const W = 9360; // ancho útil (carta, márgenes de 1")
const FONT = 'Times New Roman';
const SZ = 24; // 12 pt
const DOUBLE = { line: 480, lineRule: 'auto', before: 0, after: 0 };
const SINGLE = { line: 240, lineRule: 'auto', before: 0, after: 0 };
const INDENT = 720; // 0,5" = 1,27 cm

// ---------- utilidades ----------
// Marcas: **negrita**, *cursiva*, `código`, ^a^ superíndice, [[texto]] = pendiente de completar
function runs(text, base = {}) {
  const { noBold, ...b } = base;
  return String(text)
    .split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\]|`[^`]+`|\^[^^\s]+\^|\*[^*\s][^*]*\*)/g)
    .filter(Boolean)
    .map((s) => {
      if (s.startsWith('**')) return new TextRun({ ...b, text: s.slice(2, -2), bold: !noBold || b.bold });
      if (s.startsWith('[['))
        return new TextRun({ ...b, text: `[COMPLETAR: ${s.slice(2, -2)}]`, bold: true, highlight: 'yellow' });
      if (s.startsWith('`'))
        return new TextRun({ ...b, text: s.slice(1, -1), font: 'Courier New', size: (b.size || SZ) - 2 });
      if (s.startsWith('^') && s.length > 2) return new TextRun({ ...b, text: s.slice(1, -1), superScript: true });
      if (s.startsWith('*') && s.length > 2) return new TextRun({ ...b, text: s.slice(1, -1), italics: !b.italics });
      return new TextRun({ ...b, text: s });
    });
}
// Párrafo APA: doble espacio, sin espacio extra, alineado a la izquierda, sangría de primera línea.
// En el cuerpo no se usa negrita para enfatizar (APA 7, 6.22).
const p = (text, o = {}) =>
  new Paragraph({
    children: runs(text, { noBold: !o.keepBold, ...o.run }),
    alignment: o.align || AlignmentType.LEFT,
    spacing: DOUBLE,
    indent: o.noIndent ? undefined : { firstLine: INDENT },
    ...o.para,
  });
const h1 = (t, pageBreak = false) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: pageBreak, children: [new TextRun(t)] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const h3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
// Anexo APA: etiqueta y título centrados en negrita, en página nueva
const annexHeading = (label, title) => new Paragraph({
  heading: HeadingLevel.HEADING_1, pageBreakBefore: true,
  children: [new TextRun(label), new TextRun({ text: title, break: 1 })],
});
const bullet = (t, level = 0) =>
  new Paragraph({ numbering: { reference: 'bullets', level }, children: runs(t), spacing: DOUBLE });
let numInstance = 0;
function numbered(items) {
  numInstance += 1;
  return items.map((t) => new Paragraph({ numbering: { reference: 'numbers', level: 0, instance: numInstance }, children: runs(t), spacing: DOUBLE }));
}
function code(lines) {
  return lines.map((l, i) =>
    new Paragraph({
      children: [new TextRun({ text: l || ' ', font: 'Courier New', size: 18 })],
      indent: { left: INDENT },
      spacing: { line: 240, lineRule: 'auto', before: i === 0 ? 120 : 0, after: i === lines.length - 1 ? 240 : 0 },
    }));
}

// Numeración de tablas y figuras: 1, 2, 3… en el cuerpo; A1, A2… en cada anexo (APA 7, 7.6)
let prefix = '';
const counters = { tabla: {}, figura: {} };
const nextNo = (kind) => { counters[kind][prefix] = (counters[kind][prefix] || 0) + 1; return `${prefix}${counters[kind][prefix]}`; };
const setAnnex = (letter) => { prefix = letter; };
// Rótulo APA: número en negrita y título en cursiva en la línea siguiente, ambos a doble espacio
const label = (kind, title) => [
  new Paragraph({ keepNext: true, spacing: { line: 480, lineRule: 'auto', before: 240, after: 0 }, children: [new TextRun({ text: `${kind === 'tabla' ? 'Tabla' : 'Figura'} ${nextNo(kind)}`, bold: true })] }),
  new Paragraph({ keepNext: true, spacing: DOUBLE, children: runs(title, { italics: true, noBold: true }) }),
];
const nota = (text) => new Paragraph({ spacing: DOUBLE, children: runs(`*Nota.* ${text}`, { noBold: true }) });

// Tabla APA: sin líneas verticales; filetes horizontales arriba, bajo el encabezado y al final.
function table(title, headers, rows, widths, o = {}) {
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum !== W) throw new Error(`Tabla "${title}": ancho ${sum} != ${W}`);
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const rule = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
  const cell = (txt, i, head) =>
    new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      verticalAlign: VerticalAlign.CENTER,
      borders: { top: head ? rule : none, bottom: head ? rule : none, left: none, right: none },
      children: [new Paragraph({
        spacing: SINGLE,
        alignment: (o.right || []).includes(i) && !head ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: runs(txt, { size: 20, ...(head ? { bold: true } : { noBold: true }) }),
      })],
    });
  const lastRow = rows.length - 1;
  return [
    ...label('tabla', title),
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: widths,
      borders: { top: rule, bottom: rule, left: none, right: none, insideHorizontal: none, insideVertical: none },
      rows: [
        new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, i, true)) }),
        ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) })),
      ],
    }),
    ...(o.notes || []).map((t, i) => (i === 0 ? nota(t) : new Paragraph({ spacing: DOUBLE, children: runs(t, { noBold: true }) }))),
    new Paragraph({ spacing: DOUBLE, children: [] }),
  ];
}
function figure(file, title, w, h, note = 'Elaboración propia.') {
  return [
    ...label('figura', title),
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: SINGLE,
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(path.join(DIR, file)), transformation: { width: w, height: h },
        altText: { title, description: title, name: file } })] }),
    nota(note),
  ];
}
// Espacio reservado para una captura de pantalla (se reemplaza por la imagen en Word)
function capture(desc, file) {
  const b = { style: BorderStyle.DASHED, size: 8, color: '7F7F7F', space: 8 };
  return [
    ...label('figura', desc),
    new Paragraph({
      alignment: AlignmentType.CENTER, keepNext: true, keepLines: true,
      border: { top: b, left: b, bottom: b, right: b },
      spacing: { line: 240, lineRule: 'auto', before: 120, after: 120 },
      indent: { left: 900, right: 900 },
      children: [
        new TextRun({ text: ' ', break: 1 }),
        new TextRun({ text: '[INSERTAR CAPTURA]', bold: true, highlight: 'yellow' }),
        new TextRun({ text: `Archivo sugerido: ${file}`, break: 1, size: 20 }),
        new TextRun({ text: ' ', break: 1 }),
      ],
    }),
    nota('Captura de pantalla propia.'),
  ];
}

// ---------- contenido ----------
const titulo = 'Plataforma web segura: del código a la nube';
const centro = (children, extra = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: DOUBLE, children, ...extra });
// Portada de trabajo de estudiante (APA 7, 2.3)
const portada = [
  centro([new TextRun({ text: titulo, bold: true })], { spacing: { line: 480, lineRule: 'auto', before: 2880, after: 0 } }),
  centro([new TextRun({ text: 'Aseguramiento de extremo a extremo de la aplicación SecureNotes con DevSecOps', bold: true })]),
  centro([]),
  centro(runs('[[nombre completo del autor]]')),
  centro(runs('[[facultad o programa]], [[nombre de la institución]]')),
  centro([new TextRun('Desarrollo seguro, criptografía e IAM — Diplomado DevOps')]),
  centro(runs('[[nombre del docente]]')),
  centro([new TextRun('2 de noviembre de 2026')]),
];

const indice = [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: DOUBLE, children: [new TextRun({ text: 'Tabla de Contenido', bold: true })] }),
  new TableOfContents('Tabla de Contenido', { hyperlink: true, headingStyleRange: '1-2' }),
  p('Si la tabla de contenido aparece vacía, haga clic derecho sobre ella y elija «Actualizar campo» (o pulse F9).', { noIndent: true, run: { italics: true, size: 20 } }),
];

// Resumen APA: un solo párrafo sin sangría (máx. 250 palabras) y palabras clave con sangría
const resumen = [
  h1('Resumen', true),
  p('Este proyecto asegura de extremo a extremo una aplicación web, SecureNotes (Node.js, Express y PostgreSQL), aplicando la metodología DevSecOps en tres módulos encadenados: seguridad en el código mediante análisis estático (SAST), de composición de software (SCA) y dinámico (DAST); infraestructura como código con escaneo de configuración y de contenedores; y despliegue en Amazon Web Services con controles de identidad, cifrado, red y monitoreo, evaluando la postura con herramientas de gestión de la postura de seguridad en la nube (CSPM). Para medir la mejora se partió de una versión intencionalmente vulnerable y se llegó a una corregida, ejecutando las mismas herramientas sobre ambas. En el código, Semgrep pasó de 19 hallazgos a 0, SonarQube de 2 vulnerabilidades a 0, npm audit de 16 a 0, OWASP Dependency-Check de 33 CVE a 1 disputada por el proveedor y OWASP ZAP de 3 alertas de riesgo medio a 0. En la infraestructura, Checkov pasó de 31 controles fallidos a 0 y la imagen de contenedor de 425 vulnerabilidades críticas o altas a ninguna, con una reducción de tamaño de 1360 MB a 223 MB y sin ejecución como root. En la nube, Prowler reportó un 78,7 % de controles superados; los hallazgos críticos y altos restantes se clasificaron como acciones manuales, controles no aplicables a una cuenta individual o excepciones justificadas. Los resultados muestran que integrar la seguridad en cada etapa del ciclo de vida reduce el riesgo de forma medible y reproducible.', { noIndent: true }),
  new Paragraph({ spacing: DOUBLE, indent: { firstLine: INDENT }, children: [new TextRun({ text: 'Palabras clave: ', italics: true }), new TextRun('DevSecOps, SAST, SCA, DAST, infraestructura como código, Terraform, AWS, CSPM')] }),
];

const sec1 = [
  centro([new TextRun({ text: titulo, bold: true })], { pageBreakBefore: true }),
  h1('Título, descripción del problema, alcance y justificación'),
  h2('Título'),
  p('Plataforma web segura de extremo a extremo (código → infraestructura → nube) aplicando DevSecOps sobre la aplicación SecureNotes.'),
  h2('Descripción del problema'),
  p('Las aplicaciones web se ven comprometidas por fallos que aparecen en todas las capas de su ciclo de vida: código vulnerable (inyección SQL, XSS, criptografía débil), infraestructura mal configurada (contenedores con privilegios, puertos expuestos, secretos embebidos) y entornos de nube sin controles (IAM permisivo, recursos sin cifrar, ausencia de auditoría). Cuando la seguridad se trata como una fase final, estos defectos llegan a producción, donde son más costosos y riesgosos de corregir.'),
  h2('Alcance'),
  p('Se toma una única aplicación, SecureNotes (gestor de notas con registro e inicio de sesión, notas públicas y privadas, perfil de usuario y panel de administración), y se asegura en tres módulos encadenados, donde la salida de cada uno es la entrada del siguiente:'),
  ...numbered([
    '**Código:** análisis SAST, SCA y DAST, y corrección de las vulnerabilidades encontradas.',
    '**Infraestructura como código:** definición de la infraestructura (Dockerfile, Docker Compose y Terraform) y verificación con escaneo de configuración y de contenedores.',
    '**Nube:** despliegue en AWS con controles de IAM, cifrado, red y monitoreo, y evaluación de la postura de seguridad con herramientas CSPM.',
  ]),
  p('Queda fuera del alcance la operación continua en producción (gestión de incidentes, alta disponibilidad multi-región). El pipeline de integración continua queda definido en el repositorio como base para trabajo futuro.'),
  h2('Justificación'),
  p('La metodología DevSecOps integra la seguridad en cada etapa del ciclo de desarrollo, en línea con las prácticas de desarrollo seguro recomendadas por el Secure Software Development Framework (Souppaya et al., 2022), y reduce costo y riesgo frente a la revisión tardía. El proyecto lo demuestra de forma objetiva: cada capa se escanea antes y después de la corrección con herramientas de libre acceso, las versiones de las herramientas están fijadas y todo el proceso está automatizado con scripts reproducibles, de modo que cualquier evaluador puede repetir los resultados.'),
];

const sec2 = [
  h1('Revisión del estado del arte / Marco conceptual'),
  h2('DevSecOps y el enfoque «shift-left»'),
  p('DevSecOps extiende las prácticas DevOps incorporando controles de seguridad automatizados a lo largo de todo el ciclo de vida del software. El principio «shift-left» consiste en desplazar la detección de defectos hacia las primeras etapas (diseño, codificación y construcción), donde corregirlos es más barato, y complementarla con monitoreo continuo en producción. El National Institute of Standards and Technology recoge este enfoque en su marco de desarrollo seguro, que pide integrar la verificación de seguridad en el propio proceso de construcción del software (Souppaya et al., 2022).'),
  ...figure('flujo.png', 'Flujo DevSecOps del proyecto: módulos encadenados y ciclo escanear, corregir y re-escanear', 624, 233),
  h2('Seguridad de aplicaciones: OWASP y CWE'),
  p('El OWASP Top 10:2021 clasifica los riesgos más críticos de las aplicaciones web, entre ellos A01 Control de acceso roto, A02 Fallas criptográficas, A03 Inyección, A05 Configuración de seguridad incorrecta, A06 Componentes vulnerables y desactualizados, A07 Fallas de identificación y autenticación y A09 Fallas de registro y monitoreo (OWASP Foundation, 2021b). Cada vulnerabilidad concreta se cataloga además con su identificador en la Common Weakness Enumeration (MITRE, s. f.). Como guía de corrección se emplean el Application Security Verification Standard (OWASP Foundation, 2021a) y las OWASP Cheat Sheets (OWASP Foundation, s. f.-a).'),
  h2('Técnicas de análisis de seguridad'),
  ...table('Técnicas de análisis de seguridad empleadas', ['Técnica', 'Qué analiza', 'Pregunta que responde', 'Herramientas'], [
    ['**SAST** (Static Application Security Testing)', 'Código fuente, sin ejecutarlo', '¿El código contiene patrones inseguros conocidos?', 'Semgrep, SonarQube'],
    ['**SCA** (Software Composition Analysis)', 'Dependencias de terceros', '¿Alguna librería usada tiene CVE publicadas?', 'OWASP Dependency-Check, npm audit'],
    ['**DAST** (Dynamic Application Security Testing)', 'Aplicación en ejecución (caja negra)', '¿Se pueden explotar las debilidades en la práctica?', 'OWASP ZAP'],
    ['**CSPM** (Cloud Security Posture Management)', 'Configuración de la cuenta de nube', '¿La nube está configurada según buenas prácticas?', 'Prowler, ScoutSuite'],
  ], [2100, 2100, 2860, 2300]),
  p('Las técnicas son complementarias: SAST detecta el fallo en el código propio, SCA en el código de terceros, DAST comprueba el comportamiento de la aplicación en ejecución y CSPM evalúa la infraestructura donde esta se ejecuta. En este proyecto se emplearon Semgrep (Semgrep, s. f.) y SonarQube (SonarSource, s. f.) para SAST, OWASP Dependency-Check (OWASP Foundation, s. f.-b) y npm audit para SCA, OWASP ZAP (ZAP, s. f.) para DAST, y Prowler (Prowler, s. f.) y ScoutSuite (NCC Group, s. f.) para CSPM.'),
  h2('Criptografía aplicada y gestión de identidad'),
  p('Para el almacenamiento de contraseñas se recomiendan funciones de derivación de clave lentas y con sal en lugar de funciones hash rápidas como MD5 o SHA-1 (Grassi et al., 2017); el proyecto utiliza scrypt (Percival y Josefsson, 2016). La sesión se gestiona con JSON Web Tokens firmados con HS256 (Jones et al., 2015), con expiración, emisor y audiencia verificados, transportados en cookies con los atributos `HttpOnly`, `Secure` y `SameSite`. La protección contra la falsificación de peticiones (CSRF) sigue el patrón *signed double-submit cookie* (OWASP Foundation, s. f.-a), firmando el token con HMAC y una clave derivada mediante HKDF (Krawczyk y Eronen, 2010).'),
  h2('Infraestructura como código y políticas como código'),
  p('La infraestructura como código (IaC) describe servidores, redes, bases de datos y permisos en archivos de texto versionados, de modo que la infraestructura es reproducible, revisable y destruible con un solo comando. Terraform es la herramienta de IaC utilizada: lee archivos `.tf`, calcula un plan de cambios y los aplica mediante la API del proveedor de nube, guardando el estado de los recursos creados (HashiCorp, s. f.). La seguridad de estos archivos se verifica antes de desplegar con *políticas como código*: Checkov (Bridgecrew, s. f.) y Trivy (Aqua Security, s. f.) evalúan configuraciones inseguras, como puertos abiertos, recursos sin cifrar o permisos excesivos, y Hadolint (Hadolint, s. f.) revisa las buenas prácticas del Dockerfile. Para los contenedores se siguen las recomendaciones del CIS Docker Benchmark (Center for Internet Security [CIS], 2023): imagen mínima, usuario no root, sistema de archivos de solo lectura y mínimo de capacidades.'),
  h2('Seguridad en la nube y CSPM'),
  p('En el modelo de responsabilidad compartida, AWS asegura la infraestructura física y los servicios, mientras que el cliente es responsable de la configuración de identidades, datos, red y monitoreo (Amazon Web Services [AWS], s. f.-b), aspectos que el pilar de seguridad del AWS Well-Architected Framework desarrolla en detalle (AWS, s. f.-a). El CIS Amazon Web Services Foundations Benchmark define los controles mínimos de una cuenta: uso de root y MFA, política de contraseñas, CloudTrail, alarmas de monitoreo, cifrado y red (CIS, 2024). Las herramientas CSPM verifican automáticamente estos controles: Prowler evalúa cientos de controles de CIS, NIST e ISO 27001 con resultado PASS o FAIL y su severidad (Prowler, s. f.), y ScoutSuite genera un informe agrupado por servicio y nivel de riesgo (NCC Group, s. f.).'),
  h2('Herramientas y versiones utilizadas'),
  ...table('Herramientas de libre acceso utilizadas (versiones fijadas para reproducibilidad)', ['Herramienta', 'Tipo', 'Módulo', 'Versión', 'Uso en el proyecto'], [
    ['Semgrep', 'SAST', 'M1', '1.183.0', 'Reglas propias + OWASP Top 10, JavaScript, Node.js, Express y secretos'],
    ['SonarQube Community', 'SAST / calidad', 'M1', '26.10 (scanner 12.3)', 'Issues, vulnerabilidades y security hotspots'],
    ['OWASP Dependency-Check', 'SCA', 'M1', '12.2.2', 'CVE de dependencias contra la NVD'],
    ['npm audit', 'SCA', 'M1', 'npm (Node.js 24)', 'Complemento de SCA (GitHub Advisories)'],
    ['OWASP ZAP', 'DAST', 'M1', '2.16.1', 'Escaneo pasivo (baseline) de la app en ejecución'],
    ['Checkov', 'IaC', 'M2', '3.4.0', 'Políticas sobre Terraform y Dockerfile'],
    ['Trivy', 'IaC / contenedores', 'M2', '0.76.1', 'Configuración, CVE de imagen y SBOM'],
    ['Hadolint', 'Dockerfile', 'M2', '2.15.1', 'Buenas prácticas del Dockerfile'],
    ['Terraform', 'IaC', 'M2 / M3', '≥ 1.11 (AWS 6.x)', 'Definición y despliegue en AWS'],
    ['Prowler', 'CSPM', 'M3', '5.47.0', 'Controles CIS sobre la cuenta AWS'],
    ['ScoutSuite', 'CSPM', 'M3', '5.14.0', 'Segunda evaluación de postura'],
  ], [2100, 1500, 900, 1700, 3160]),
];

const sec3 = [
  h1('Objetivos'),
  h2('Objetivo general'),
  p('Construir y asegurar de extremo a extremo una plataforma web, integrando controles de seguridad desde el código hasta la nube mediante la metodología DevSecOps.'),
  h2('Objetivos específicos'),
  ...numbered([
    '**(M1)** Analizar y corregir las vulnerabilidades del código fuente aplicando SAST, SCA y DAST y prácticas de codificación segura.',
    '**(M2)** Definir la infraestructura como código y verificar su seguridad con escaneo de configuración y de contenedores.',
    '**(M3)** Desplegar la aplicación en un entorno de nube aplicando controles de seguridad (IAM, cifrado, red y monitoreo) y evaluar la postura con herramientas CSPM.',
  ]),
];

const sec4 = [
  h1('Metodología'),
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
    ['`m1-zap.sh v1|v2 [full]`', 'Levanta la aplicación y ejecuta OWASP ZAP (baseline; opcionalmente activo)'],
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
  h1('Planeación del proyecto (cronograma)'),
  p('El proyecto se planificó en cuatro fases secuenciales, alineadas con los tres módulos y un cierre de consolidación. La bitácora detallada de cada fase se encuentra en los Anexos A, B y C.'),
  ...table('Cronograma del proyecto', ['Fase', 'Actividades', 'Recursos / herramientas', 'Entregable', 'Periodo'], [
    ['M1 · Código', 'Construcción de la línea base, escaneo v1, corrección V01–V14, re-escaneo v2, pruebas de seguridad', 'Semgrep, SonarQube, Dependency-Check, ZAP, npm audit', 'Código corregido + Anexo A', '[[fechas]]'],
    ['M2 · IaC', 'Dockerfile, Compose y Terraform endurecidos; escaneo de configuración y de imagen', 'Checkov, Trivy, Hadolint, Docker', 'IaC + Anexo B', '[[fechas]]'],
    ['M3 · Nube', 'Línea base de la cuenta, despliegue en AWS, verificación y CSPM antes/después', 'Terraform, AWS, Prowler, ScoutSuite', 'Despliegue + Anexo C', '[[fechas]]'],
    ['Cierre', 'Consolidación de resultados, análisis, informe y destrucción de recursos', 'summarize.mjs', 'Informe final', '[[fechas]]'],
  ], [1300, 2900, 2200, 1560, 1400]),
];

const vulns = [
  ['V01', 'Inyección SQL en el login', 'CWE-89', 'A03', 'Semgrep (`sql-string-concatenation`, `tainted-sql-string`)', 'Consultas parametrizadas'],
  ['V02', 'Inyección SQL en la búsqueda', 'CWE-89', 'A03', 'Semgrep (`sql-string-concatenation`, `tainted-sql-string`)', 'Parámetros + escape de comodines LIKE'],
  ['V03', 'XSS reflejado y almacenado', 'CWE-79', 'A03', 'Semgrep (`ejs-unescaped-output`, 3)', 'Salida escapada en EJS + CSP estricta'],
  ['V04', 'Inyección de comandos del SO', 'CWE-78', 'A03', 'Semgrep (`child-process-exec-user-input`)', 'Sin shell, lista blanca, solo admin'],
  ['V05', 'Hash de contraseñas MD5 sin sal', 'CWE-916/327', 'A02', 'Semgrep (`weak-password-hash`), SonarQube (S4790)', 'scrypt con sal, comparación en tiempo constante'],
  ['V06', 'Secretos embebidos en código e imagen', 'CWE-798', 'A07/A05', 'Semgrep (`hardcoded-secret-in-config`), Trivy (DS-0031), Hadolint (DL3064)', 'Secretos por variable/archivo (`*_FILE`)'],
  ['V07', 'JWT sin expiración y cookie insegura', 'CWE-613/614/1004', 'A07/A05', 'Semgrep (reglas JWT y cookie), ZAP (cookie sin HttpOnly/SameSite)', 'HS256, exp/iss/aud, cookie `__Host-`'],
  ['V08', 'IDOR en notas', 'CWE-639', 'A01', 'Revisión manual y pruebas', 'Verificación del dueño en cada consulta'],
  ['V09', 'Asignación masiva (rol admin)', 'CWE-915', 'A01', 'Semgrep (`mass-assignment-from-request-body`)', 'Lista blanca de campos; rol desde la BD'],
  ['V10', 'Sin cabeceras de seguridad ni CSRF', 'CWE-352/693/1021', 'A05', 'ZAP (CSP, anti-clickjacking, anti-CSRF), Semgrep, SonarQube (S5689)', 'helmet (CSP, HSTS…) + CSRF firmado'],
  ['V11', 'Exposición de trazas de error', 'CWE-209', 'A05', 'Semgrep (`stack-trace-exposed-to-client`)', 'Manejador con ID de referencia'],
  ['V12', 'Registro inseguro e insuficiente', 'CWE-532/778', 'A09', 'Semgrep (`password-written-to-log`)', 'Logger JSON sin secretos + eventos de seguridad'],
  ['V13', 'Sin límite de intentos', 'CWE-307', 'A07', 'Revisión manual', 'express-rate-limit'],
  ['V14', 'Componentes vulnerables', 'CWE-1104', 'A06', 'Dependency-Check (33 CVE), npm audit (16)', 'Actualización de dependencias'],
];

const sec6 = [
  h1('Desarrollo'),
  p('Esta sección resume la ejecución de cada módulo; el paso a paso, los comandos y las evidencias se detallan en los anexos, que funcionan como bitácora del proyecto.'),
  h2('Aplicación caso de estudio: SecureNotes'),
  p('SecureNotes es una aplicación web de notas desarrollada en Node.js 24 con Express 5, vistas EJS y PostgreSQL. Permite registro e inicio de sesión, notas públicas y privadas, búsqueda, edición de perfil y un panel de administración. Es deliberadamente pequeña (alrededor de quince archivos fuente) para que cada herramienta produzca hallazgos claros y el antes/después sea fácil de interpretar. La versión v1 contiene catorce vulnerabilidades sembradas (V01–V14) que representan las categorías principales del OWASP Top 10.'),
  h2('Módulo 1 — Seguridad en el código'),
  p('Sobre la versión v1 se ejecutaron Semgrep (reglas propias en `security/semgrep/` más los paquetes del registro OWASP Top 10, JavaScript, Node.js, Express y secretos), SonarQube Community, OWASP Dependency-Check, `npm audit` y OWASP ZAP en modo pasivo (baseline). Los hallazgos se agruparon en las catorce vulnerabilidades de la Tabla 5, indicando la regla concreta que detectó cada una, y cada vulnerabilidad se corrigió en un commit independiente. El detalle se encuentra en el Anexo A.'),
  ...table('Vulnerabilidades identificadas y su corrección (Módulo 1)', ['ID', 'Vulnerabilidad', 'CWE', 'OWASP 2021', 'Detectada por', 'Corrección'], vulns,
    [560, 1900, 1150, 850, 2600, 2300]),
  p('Además de las correcciones, se añadió un conjunto de pruebas automatizadas de seguridad (`app/test/security.test.js`, ejecutable con `npm test`) que verifica el hash con scrypt, el rechazo de MD5, la política de contraseñas, la validación de JWT (expiración, emisor, audiencia y rechazo de `alg=none`), el prefijo `__Host-` de la cookie y que el registro nunca escribe secretos: **8 de 8 pruebas en verde**. El repositorio incluye un pipeline de GitHub Actions (`.github/workflows/devsecops.yml`) que ejecuta Semgrep, `npm audit`, Dependency-Check y las pruebas en cada cambio.'),
  h2('Módulo 2 — Infraestructura como código'),
  p('La infraestructura de la aplicación quedó definida íntegramente como código en tres capas: la imagen de contenedor (`app/Dockerfile`), la orquestación local (`infra/docker/docker-compose.yml` con un proxy TLS Caddy) y la nube (`infra/terraform/app` y `infra/terraform/account-baseline`). Igual que en el Módulo 1, la IaC insegura de v1 se comparó con la endurecida de v2.'),
  ...table('Endurecimiento de la imagen de contenedor', ['Aspecto', 'v1 (insegura)', 'v2 (endurecida)'], [
    ['Imagen base', '`node:16` (obsoleta, sin fijar)', 'Distroless `nodejs24-debian13`, fijada por digest'],
    ['Construcción', 'Una etapa, `npm install`, copia todo el contexto', 'Multi-etapa, `npm ci --omit=dev --ignore-scripts`'],
    ['Usuario', 'root', '65532 (no root)'],
    ['Secretos', '`ENV JWT_SECRET`, `ENV DB_PASSWORD`', 'Ninguno; se inyectan en ejecución'],
    ['Tamaño', '1360 MB', '223 MB'],
    ['Otros', '`CMD` en forma shell, sin HEALTHCHECK', '`CMD` exec, HEALTHCHECK, `.dockerignore`'],
  ], [1900, 3400, 4060]),
  p('En Docker Compose cada servicio corre con sistema de archivos de solo lectura, `cap_drop: ALL`, `no-new-privileges`, usuario no root y límites de memoria, CPU y procesos. La base de datos está en una red interna sin salida a Internet y no publica puertos; solo el proxy Caddy expone HTTPS en `127.0.0.1:8443`. Los secretos se entregan como *Docker secrets*.'),
  p('En Terraform, la versión v1 concentraba los 31 controles fallidos de Checkov: SSH y PostgreSQL abiertos a Internet, rol IAM con permisos totales, IMDSv1, discos sin cifrar, bucket S3 público y secretos en `user_data`. La versión v2 se reescribió con red segmentada, mínimo privilegio, cifrado con KMS en todos los servicios, secretos en SSM Parameter Store y monitoreo (véase Módulo 3 — Despliegue seguro en AWS).'),
  h2('Módulo 3 — Despliegue seguro en AWS'),
  p('El despliegue se realizó con Terraform en dos *stacks* independientes: `account-baseline`, que endurece la cuenta según CIS AWS Foundations, y `app`, que despliega la aplicación. La Figura 2 muestra la arquitectura resultante.'),
  ...figure('arquitectura.png', 'Arquitectura de SecureNotes desplegada en AWS y línea base de seguridad de la cuenta', 624, 374),
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
  h3('Ajustes e incidencias durante el despliegue'),
  p('El despliegue sobre una cuenta en el plan gratuito (Free plan) de AWS y desde Windows planteó incidencias que se resolvieron y documentaron como parte de la bitácora:'),
  ...table('Incidencias encontradas y solución aplicada', ['Incidencia', 'Causa', 'Solución'], [
    ['Dependency-Check terminaba con código 1 en Windows', 'Git Bash convertía las rutas de los volúmenes de Docker', 'Detección de Windows en `lib.sh`: `MSYS_NO_PATHCONV=1`, rutas mixtas y sin `--user`'],
    ['GuardDuty: `SubscriptionRequiredException`', 'El Free plan no incluye el servicio', '`enable_guardduty = false`; excepción documentada (véase Excepciones y riesgos aceptados)'],
    ['RDS: `FreeTierRestrictionError`', 'El Free plan solo permite 1 día de retención de backups', 'Variable `db_backup_retention_days = 1`'],
    ['ECR rechazó publicar la etiqueta `2.0.0`', 'Las etiquetas son inmutables (control de seguridad)', 'El script omite la publicación si la etiqueta ya existe'],
    ['CloudFront devolvía 504; logs con código PostgreSQL `28P01`', 'Un despliegue fallido a medias dejó distinta la contraseña de SSM y la de RDS', 'Resincronización de la contraseña de la base de datos'],
    ['Resumen de Prowler y de resultados fallaba en Windows / Node 24', 'Salida de Prowler concatenada y rutas `C:\\C:\\…`', 'Corrección de los scripts `m3-prowler.sh` y `summarize.mjs`'],
  ], [2700, 3000, 3660]),
  p('El caso de la contraseña desincronizada ilustra un compromiso de diseño: no guardar secretos en el estado de Terraform mejora la seguridad, pero obliga a resincronizarlos si un despliegue falla a mitad de camino.'),
];

const sec7 = [
  h1('Resultados y análisis de resultados'),
  p('Las cifras corresponden a la ejecución de los scripts del repositorio en el equipo de trabajo (Windows, Git Bash y Docker Desktop) y se consolidaron con `summarize.sh` en `reports/RESULTADOS.md`. Las evidencias gráficas se encuentran en los anexos.'),
  h2('Módulo 1 — Código'),
  ...table('Resultados del Módulo 1 (antes / después)', ['Herramienta', 'Métrica', 'v1 (vulnerable)', 'v2 (segura)'], [
    ['Semgrep (SAST)', 'Hallazgos totales', '19', '**0**'],
    ['Semgrep', 'Severidad ERROR / WARNING', '14 / 5', '**0 / 0**'],
    ['SonarQube (SAST)', 'Vulnerabilidades', '2', '**0**'],
    ['SonarQube', 'Security hotspots', '0', '0'],
    ['SonarQube', 'Calificación de seguridad', 'D (4.0)', '**A (1.0)**'],
    ['npm audit (SCA)', 'Vulnerabilidades (críticas / altas)', '16 (2 / 6)', '**0**'],
    ['OWASP Dependency-Check (SCA)', 'CVE únicas', '33', '1^a^'],
    ['Dependency-Check', 'Críticas / altas / medias / bajas', '2 / 10 / 14 / 7', '1^a^ / 0 / 0 / 0'],
    ['OWASP ZAP baseline (DAST)', 'Alertas alto / medio / bajo', '0 / 3 / 7', '0 / 0 / 1^b^'],
    ['Pruebas de seguridad', 'Pruebas superadas', '—', '**8 / 8**'],
  ], [2500, 2900, 1980, 1980], { right: [2, 3], notes: [
    'Elaboración propia a partir de los reportes de `reports/m1/` consolidados con `summarize.sh`.',
    '^a^CVE-2023-29827 en EJS 7.0.2: está disputada por el mantenedor y la base NVD la asigna a todas las versiones de EJS, por lo que no existe versión corregida (National Institute of Standards and Technology, 2023). Solo es explotable si la aplicación pasa datos del usuario como opciones de la plantilla, lo que SecureNotes no hace; por eso npm audit no la reporta. ^b^Aviso «ZAP is Out of Date» sobre la versión del propio escáner; no es un hallazgo de la aplicación.',
  ] }),
  p('Las herramientas mostraron una cobertura complementaria. Semgrep fue la más completa en el código propio (19 hallazgos en 14 reglas), mientras que SonarQube Community detectó solo 2 —el hash MD5 y la divulgación de la versión del framework— porque el análisis de flujo de datos (*taint analysis*) que detecta inyecciones no está incluido en la edición gratuita. En dependencias, Dependency-Check (NVD) reportó 33 CVE frente a las 16 de `npm audit` (GitHub Advisories), ya que cada fuente cubre vulnerabilidades distintas. El escaneo pasivo de ZAP confirmó en ejecución la ausencia de CSP, de protección anti-clickjacking y de tokens anti-CSRF, y las cookies sin atributos de seguridad; todas desaparecen en v2.'),
  h2('Módulo 2 — Infraestructura como código y contenedores'),
  ...table('Resultados del Módulo 2 (antes / después)', ['Herramienta', 'Métrica', 'v1 (vulnerable)', 'v2 (segura)'], [
    ['Checkov', 'Controles fallidos', '31', '**0**'],
    ['Checkov', 'Controles superados', '50', '443'],
    ['Trivy config', 'Fallos CRITICAL / HIGH / MEDIUM', '4 / 9 / 1', '0 / 0 / 1^a^'],
    ['Trivy imagen', 'Vulnerabilidades CRITICAL', '19', '**0**'],
    ['Trivy imagen', 'Vulnerabilidades HIGH', '406', '**0**'],
    ['Trivy imagen', 'Vulnerabilidades MEDIUM / LOW', '538 / 117', '24 / 8'],
    ['Hadolint', 'Advertencias', '3', '**0**'],
    ['Imagen', 'Tamaño', '1360 MB', '**223 MB**'],
    ['Imagen', 'Usuario de ejecución', 'root', '**65532 (no root)**'],
    ['Imagen', 'Secretos en variables de entorno', 'JWT_SECRET, DB_PASSWORD', '**ninguno**'],
  ], [2300, 3000, 2100, 1960], { right: [2, 3], notes: [
    'Elaboración propia a partir de los reportes de `reports/m2/`.',
    '^a^AWS-0077: retención de backups de RDS de 1 día, impuesta por el Free plan de AWS.',
  ] }),
  p('La imagen pasó de 1082 vulnerabilidades en total a 32 (una reducción del 97 %), y de 425 CRITICAL/HIGH a ninguna. Las 32 restantes son de severidad media o baja, pertenecen al sistema base distroless y no tienen corrección publicada por el proveedor. Checkov registra además 30 omisiones (23 controles distintos), todas justificadas por escrito en el código (Anexo B).'),
  h2('Módulo 3 — Nube (CSPM)'),
  p('La evaluación CSPM se ejecutó sobre la cuenta con la línea base de seguridad y la aplicación ya desplegadas. Además de las dos herramientas CSPM, el script `m3-verify.sh` comprobó uno a uno los controles desplegados (Anexo C, Verificación del despliegue).'),
  ...table('Postura de seguridad de la cuenta tras aplicar la línea base', ['Herramienta', 'Métrica', 'Resultado'], [
    ['Prowler', 'Controles PASS / FAIL', '352 / 95'],
    ['Prowler', 'Tasa de cumplimiento (PASS / total)', '**78,7 %**'],
    ['Prowler', 'FAIL por severidad: crítica / alta / media / baja', '5 / 20 / 40 / 30'],
    ['ScoutSuite', 'Reglas en peligro (danger) / advertencia (warning)', '6 / 15'],
    ['ScoutSuite', 'Ítems marcados', '47'],
  ], [1800, 4800, 2760], { right: [2] }),
  p('Los 25 hallazgos críticos y altos de Prowler corresponden a 15 controles. Su análisis muestra que ninguno proviene de los recursos desplegados por el proyecto sin justificación: la mayoría son acciones manuales sobre los usuarios de la cuenta o controles propios de AWS Organizations, que no aplican a una cuenta individual.'),
  ...table('Clasificación de los FAIL críticos y altos de Prowler', ['Sev.', 'Control (Prowler)', 'Rec.', 'Clasificación y acción'], [
    ['Crítica', '`iam_user_administrator_access_policy`', '2', 'Acción manual: usuarios IAM personales con AdministratorAccess usados para desplegar; sustituir por IAM Identity Center o un rol de despliegue de mínimo privilegio'],
    ['Crítica', '`iam_aws_attached_policy_no_administrative_privileges`', '1', 'Misma causa: política administrada `*:*` adjunta a esos usuarios'],
    ['Crítica', '`kms_cmk_not_deleted_unintentionally`', '2', 'Esperado: claves KMS de despliegues anteriores programadas para borrarse al destruir y recrear el entorno'],
    ['Alta', '`iam_user_mfa_enabled_console_access`, `iam_user_hardware_mfa_enabled`', '3 + 3', 'Acción manual: activar MFA en los usuarios IAM (no automatizable con Terraform)'],
    ['Alta', '`iam_user_with_temporary_credentials`', '2', 'Acción manual: reemplazar llaves de acceso de larga duración por credenciales temporales (SSO)'],
    ['Alta', '`iam_avoid_root_usage`', '1', 'Acción manual: la cuenta root se usó para gestionar el plan de facturación; vigilado por la alarma CIS 4.3'],
    ['Alta', '`iam_role_cross_service_confused_deputy_prevention`', '3', 'Mejora pendiente: añadir condiciones `aws:SourceAccount`/`aws:SourceArn` a las políticas de confianza de los roles de servicio'],
    ['Alta', '`ec2_networkacl_allow_ingress_any_port`', '2', 'Mejora pendiente: la subred pública usa la NACL por defecto; el control efectivo es el SG restringido a CloudFront'],
    ['Alta', '`ec2_instance_internet_facing_with_instance_profile`', '1', 'Riesgo aceptado: EC2 con IP pública pero SG solo desde CloudFront, IMDSv2 con hop limit 1 y rol de mínimo privilegio'],
    ['Alta', '`rds_instance_protected_by_backup_plan`', '1', 'Excepción: backups automáticos de RDS activos; AWS Backup tiene costo'],
    ['Alta', '`ec2_ebs_volume_snapshots_exists`', '1', 'Excepción: la EC2 no guarda estado (los datos están en RDS)'],
    ['Alta', '`cloudfront_distributions_default_root_object`', '1', 'No aplica: el origen es una aplicación dinámica que atiende la ruta raíz'],
    ['Alta', '`config_delegated_admin_and_org_aggregator_all_regions`, `organizations_scp_check_deny_regions`', '1 + 1', 'No aplica: requieren AWS Organizations (cuenta individual)'],
  ], [800, 3500, 760, 4300]),
  p('ScoutSuite coincide en lo esencial. Sus 6 reglas en peligro son: usuarios sin MFA (3 de 3), uso reciente de la cuenta root, una política administrada que permite todas las acciones, RDS en una sola zona de disponibilidad y grupos de seguridad con SSH (2) y MongoDB abiertos a Internet. Estos últimos **no pertenecen al proyecto** —los grupos de seguridad de SecureNotes no tienen reglas de entrada desde Internet—: son recursos preexistentes de la cuenta que la evaluación CSPM permitió descubrir y que deben eliminarse.'),
  h2('Excepciones y riesgos aceptados'),
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
    ['CVE-2023-29827 (EJS)', 'Disputada por el mantenedor; sin versión corregida', 'La app no pasa datos del usuario como opciones de plantilla; supresión documentada'],
    ['Usuarios IAM sin MFA y con AdministratorAccess', 'Cuenta personal de laboratorio usada para desplegar', 'Acción manual pendiente: MFA y acceso con SSO o rol de despliegue'],
  ], [2700, 3000, 3660]),
  h2('Análisis'),
  p('Los resultados muestran que integrar controles en cada etapa del ciclo de vida es efectivo: en las tres capas se eliminaron los hallazgos de severidad alta y crítica, con evidencia objetiva y reproducible. Cada técnica aportó información que las demás no ofrecían: SAST localizó la línea exacta del fallo, SCA identificó el riesgo heredado de librerías de terceros (hasta 33 CVE sin una sola línea de código propio) y DAST verificó en ejecución la configuración de seguridad de las respuestas HTTP. Comparar herramientas del mismo tipo también fue revelador: Semgrep y SonarQube, o Dependency-Check y `npm audit`, reportaron conjuntos distintos, lo que justifica combinar varias fuentes.'),
  p('En la infraestructura, el escaneo de políticas como código permitió corregir configuraciones peligrosas antes de crear un solo recurso en la nube, y el endurecimiento de la imagen redujo simultáneamente la superficie de ataque, el tamaño y el riesgo de exposición de secretos. En la nube, la evaluación CSPM no se limitó a lo desplegado por Terraform: también expuso problemas preexistentes de la cuenta (usuarios sin MFA, grupos de seguridad ajenos al proyecto con SSH y MongoDB abiertos), lo que demuestra su valor como control continuo de toda la cuenta y no solo del código de infraestructura.'),
  p('Las incidencias del despliegue aportaron aprendizajes adicionales: las restricciones del plan de la cuenta condicionan los controles disponibles, los controles de seguridad (etiquetas inmutables en ECR, secretos fuera del estado) pueden interferir con la automatización y deben contemplarse en los scripts, y el registro estructurado de eventos de la aplicación (V12) fue decisivo para diagnosticar el fallo de despliegue desde CloudWatch.'),
];

const sec8 = [
  h1('Conclusiones y trabajos futuros'),
  h2('Conclusiones'),
  bullet('**Objetivo 1 (código):** se corrigieron las catorce vulnerabilidades sembradas, verificándolo con SAST, SCA y DAST: Semgrep pasó de 19 a 0 hallazgos, SonarQube de 2 vulnerabilidades a 0 (calificación D → A), `npm audit` de 16 a 0, Dependency-Check de 33 CVE a 1 disputada y ZAP de 3 alertas medias a 0, con pruebas automatizadas que respaldan las correcciones.'),
  bullet('**Objetivo 2 (IaC):** la infraestructura quedó definida como código, versionada y validada: Checkov pasó de 31 a 0 controles fallidos y la imagen de contenedor de 1360 MB ejecutándose como root con 425 CVE críticas o altas a 223 MB sin root y sin CVE críticas o altas.'),
  bullet('**Objetivo 3 (nube):** la aplicación se desplegó en AWS con controles de IAM, cifrado, red y monitoreo alineados con CIS AWS Foundations, y la postura se evaluó con dos herramientas CSPM independientes: 78,7 % de controles superados en Prowler, con los hallazgos críticos y altos clasificados y justificados.'),
  bullet('La seguridad dejó de ser una fase final y se integró en cada etapa, con herramientas de libre acceso y un proceso completamente reproducible.'),
  h2('Trabajos futuros'),
  bullet('Activar el pipeline de CI/CD con *quality gates* que bloqueen la integración ante hallazgos altos.'),
  bullet('Firmar las imágenes (cosign) y validar el SBOM y las atestaciones en el pipeline.'),
  bullet('Gestionar los secretos con rotación automática (AWS Secrets Manager) y estado remoto de Terraform cifrado.'),
  bullet('Habilitar GuardDuty, Security Hub y AWS Config con remediación automática en una cuenta de pago.'),
  bullet('Usar un dominio propio con certificado ACM para TLS de extremo a extremo hasta el origen.'),
];

const refs = [
  'Amazon Web Services. (s. f.-a). *AWS Well-Architected Framework: Security pillar*. Recuperado el 2 de noviembre de 2026, de https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html',
  'Amazon Web Services. (s. f.-b). *Shared responsibility model*. Recuperado el 2 de noviembre de 2026, de https://aws.amazon.com/compliance/shared-responsibility-model/',
  'Aqua Security. (s. f.). *Trivy* (Versión 0.76.1) [Software]. https://github.com/aquasecurity/trivy',
  'Bridgecrew. (s. f.). *Checkov* (Versión 3.4.0) [Software]. https://github.com/bridgecrewio/checkov',
  'Center for Internet Security. (2023). *CIS Docker Benchmark*. https://www.cisecurity.org/benchmark/docker',
  'Center for Internet Security. (2024). *CIS Amazon Web Services Foundations Benchmark v3.0.0*. https://www.cisecurity.org/benchmark/amazon_web_services',
  'Grassi, P. A., Fenton, J. L., Newton, E. M., Perlner, R. A., Regenscheid, A. R., Burr, W. E., Richer, J. P., Lefkovitz, N. B., Danker, J. M., Choong, Y.-Y., Greene, K. K. y Theofanos, M. F. (2017). *Digital identity guidelines: Authentication and lifecycle management* (NIST Special Publication 800-63B). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.SP.800-63b',
  'Hadolint. (s. f.). *Hadolint: Haskell Dockerfile linter* (Versión 2.15.1) [Software]. https://github.com/hadolint/hadolint',
  'HashiCorp. (s. f.). *Terraform documentation*. Recuperado el 2 de noviembre de 2026, de https://developer.hashicorp.com/terraform/docs',
  'Jones, M., Bradley, J. y Sakimura, N. (2015). *JSON Web Token (JWT)* (RFC 7519). Internet Engineering Task Force. https://doi.org/10.17487/RFC7519',
  'Krawczyk, H. y Eronen, P. (2010). *HMAC-based extract-and-expand key derivation function (HKDF)* (RFC 5869). Internet Engineering Task Force. https://doi.org/10.17487/RFC5869',
  'MITRE. (s. f.). *Common Weakness Enumeration (CWE)*. Recuperado el 2 de noviembre de 2026, de https://cwe.mitre.org/',
  'National Institute of Standards and Technology. (2023). *CVE-2023-29827 detail*. National Vulnerability Database. https://nvd.nist.gov/vuln/detail/CVE-2023-29827',
  'NCC Group. (s. f.). *ScoutSuite* (Versión 5.14.0) [Software]. https://github.com/nccgroup/ScoutSuite',
  'OWASP Foundation. (s. f.-a). *OWASP Cheat Sheet Series*. Recuperado el 2 de noviembre de 2026, de https://cheatsheetseries.owasp.org/',
  'OWASP Foundation. (s. f.-b). *OWASP Dependency-Check* (Versión 12.2.2) [Software]. https://owasp.org/www-project-dependency-check/',
  'OWASP Foundation. (2021a). *OWASP Application Security Verification Standard 4.0.3*. https://owasp.org/www-project-application-security-verification-standard/',
  'OWASP Foundation. (2021b). *OWASP Top 10:2021*. https://owasp.org/Top10/',
  'Percival, C. y Josefsson, S. (2016). *The scrypt password-based key derivation function* (RFC 7914). Internet Engineering Task Force. https://doi.org/10.17487/RFC7914',
  'Prowler. (s. f.). *Prowler* (Versión 5.47.0) [Software]. https://github.com/prowler-cloud/prowler',
  'Semgrep. (s. f.). *Semgrep* (Versión 1.183.0) [Software]. https://github.com/semgrep/semgrep',
  'SonarSource. (s. f.). *SonarQube Community Build* (Versión 26.10) [Software]. https://www.sonarsource.com/products/sonarqube/',
  'Souppaya, M., Scarfone, K. y Dodson, D. (2022). *Secure Software Development Framework (SSDF) version 1.1: Recommendations for mitigating the risk of software vulnerabilities* (NIST Special Publication 800-218). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.SP.800-218',
  'ZAP. (s. f.). *Zed Attack Proxy (ZAP)* (Versión 2.16.1) [Software]. https://www.zaproxy.org/',
];
function refPara(r) {
  // cursiva entre *...*
  const parts = r.split(/(\*[^*]+\*)/g).filter(Boolean);
  return new Paragraph({
    indent: { left: INDENT, hanging: INDENT }, spacing: DOUBLE,
    children: parts.map((s) => (s.startsWith('*') ? new TextRun({ text: s.slice(1, -1), italics: true }) : new TextRun(s))),
  });
}
const sec9 = [h1('Referencias', true), ...refs.map(refPara)];

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
  (setAnnex('A'), annexHeading('Anexo A', 'Módulo 1: Seguridad en el código')),
  p('**Objetivo:** analizar y corregir las vulnerabilidades del código fuente aplicando SAST, SCA y DAST. **Entregable:** código corregido en el repositorio Git e informe de hallazgos y remediación.'),
  h2('Comandos ejecutados'),
  ...code([
    './scripts/m1-semgrep.sh v1   && ./scripts/m1-semgrep.sh v2    # SAST',
    './scripts/m1-sca.sh v1       && ./scripts/m1-sca.sh v2        # SCA',
    './scripts/m1-sonarqube.sh v1 && ./scripts/m1-sonarqube.sh v2  # SAST',
    './scripts/m1-zap.sh v1       && ./scripts/m1-zap.sh v2        # DAST (baseline)',
    'cd app && npm test                                            # pruebas',
  ]),
  p('Los reportes quedan en `reports/m1/v1/` y `reports/m1/v2/` (JSON, SARIF, HTML y texto).'),
  h2('Resultados detallados por herramienta'),
  h3('Semgrep (v1): 19 hallazgos en 14 reglas'),
  ...table('Hallazgos de Semgrep sobre v1 por regla', ['Regla', 'Hallazgos', 'Vulnerabilidad'], [
    ['`ejs-unescaped-output`', '3', 'V03 · XSS'],
    ['`hardcoded-secret-in-config`', '2', 'V06 · Secretos embebidos'],
    ['`sql-string-concatenation`', '2', 'V01, V02 · Inyección SQL'],
    ['`tainted-sql-string`', '2', 'V01, V02 · Inyección SQL'],
    ['`child-process-exec-user-input`', '1', 'V04 · Inyección de comandos'],
    ['`weak-password-hash`', '1', 'V05 · MD5 sin sal'],
    ['`jwt-sign-without-expiration`', '1', 'V07 · JWT sin expiración'],
    ['`jwt-verify-without-algorithms`', '1', 'V07 · JWT sin algoritmo fijo'],
    ['`cookie-without-security-flags`', '1', 'V07 · Cookie insegura'],
    ['`mass-assignment-from-request-body`', '1', 'V09 · Asignación masiva'],
    ['`express-missing-helmet`', '1', 'V10 · Sin cabeceras de seguridad'],
    ['`stack-trace-exposed-to-client`', '1', 'V11 · Exposición de trazas'],
    ['`password-written-to-log`', '1', 'V12 · Registro inseguro'],
    ['`missing-user`', '1', 'Dockerfile sin usuario no root (Módulo 2)'],
  ], [4000, 1300, 4060], { right: [1] }),
  h3('SonarQube Community (v1): 2 vulnerabilidades'),
  ...table('Vulnerabilidades reportadas por SonarQube sobre v1', ['Regla', 'Archivo', 'Severidad', 'Descripción'], [
    ['S4790', '`src/security/password.js`', 'Alta', 'Uso de un algoritmo de hash débil (MD5) en un contexto sensible (V05)'],
    ['S5689', '`src/app.js`', 'Baja', 'El framework divulga su versión por defecto, cabecera `X-Powered-By` (V10)'],
  ], [1100, 2700, 1100, 4460]),
  p('Calificación de seguridad: D (4.0) en v1 y A (1.0) en v2, con 0 vulnerabilidades y 0 security hotspots.'),
  h3('OWASP Dependency-Check: 33 CVE en v1, 1 en v2'),
  p('En v1, las 33 CVE únicas se distribuyen en 2 críticas, 10 altas, 14 medias y 7 bajas, procedentes de las versiones antiguas de Express, jsonwebtoken, EJS, lodash, pg y morgan. En v2 solo permanece CVE-2023-29827 (EJS 7.0.2), disputada por el mantenedor y sin versión corregida (véase Resultados, Módulo 1).'),
  h3('OWASP ZAP baseline: alertas en v1 y v2'),
  ...table('Alertas del escaneo pasivo de OWASP ZAP', ['Alerta', 'Riesgo', 'Inst. v1', 'Inst. v2'], [
    ['Absence of Anti-CSRF Tokens', 'Medio', '6', '0'],
    ['Content Security Policy (CSP) Header Not Set', 'Medio', '10', '0'],
    ['Missing Anti-clickjacking Header', 'Medio', '8', '0'],
    ['Cookie No HttpOnly Flag', 'Bajo', '1', '0'],
    ['Cookie without SameSite Attribute', 'Bajo', '1', '0'],
    ['Insufficient Site Isolation Against Spectre Vulnerability', 'Bajo', '20', '0'],
    ['Permissions Policy Header Not Set', 'Bajo', '10', '0'],
    ['Server Leaks Information via "X-Powered-By"', 'Bajo', '11', '0'],
    ['X-Content-Type-Options Header Missing', 'Bajo', '10', '0'],
    ['ZAP is Out of Date (aviso de la herramienta)', 'Bajo', '1', '1'],
  ], [5160, 1400, 1400, 1400], { right: [2, 3] }),
  h2('Detalle de hallazgos y remediación'),
  ...vulnDetail.flatMap(([title, where, impact, fix]) => [
    h3(title),
    bullet(`**En v1:** ${where}`),
    bullet(`**Impacto:** ${impact}`),
    bullet(`**Corrección:** ${fix}`),
  ]),
  h2('Evidencias'),
  ...capture('Semgrep sobre v1: 19 hallazgos (SARIF Viewer de VS Code o semgrep.txt).', 'm1-semgrep-v1.png'),
  ...capture('Semgrep sobre v2: 0 hallazgos.', 'm1-semgrep-v2.png'),
  ...capture('npm audit sobre v1 (16 vulnerabilidades) y v2 (0), salida de m1-sca.sh.', 'm1-npm-audit.png'),
  ...capture('Reporte HTML de OWASP Dependency-Check sobre v1: 33 CVE (dependency-check-report.html).', 'm1-depcheck-v1.png'),
  ...capture('Reporte HTML de OWASP Dependency-Check sobre v2: solo CVE-2023-29827 (EJS).', 'm1-depcheck-v2.png'),
  ...capture('Panel de SonarQube del proyecto v1: 2 vulnerabilidades, calificación de seguridad D.', 'm1-sonarqube-v1.png'),
  ...capture('Panel de SonarQube del proyecto v2: 0 vulnerabilidades, calificación A.', 'm1-sonarqube-v2.png'),
  ...capture('Reporte de OWASP ZAP baseline sobre v1 (zap-baseline.html): 3 alertas medias y 7 bajas.', 'm1-zap-v1.png'),
  ...capture('Reporte de OWASP ZAP baseline sobre v2: sin alertas de la aplicación.', 'm1-zap-v2.png'),
  ...capture('Ejecución de npm test: 8 de 8 pruebas de seguridad en verde.', 'm1-tests.png'),
  ...capture('Historial de Git con las etiquetas v1.0-vulnerable y v2.0-secure y los commits fix(M1/…).', 'm1-git-log.png'),
];

// ---------- Anexo B ----------
const anexoB = [
  (setAnnex('B'), annexHeading('Anexo B', 'Módulo 2: Infraestructura como código')),
  p('**Objetivo:** definir la infraestructura como código y verificar su seguridad con escaneo de configuración y de contenedores. **Entregable:** archivos IaC y su explicación paso a paso.'),
  h2('Comandos ejecutados'),
  ...code([
    './scripts/m2-iac-scan.sh v1   && ./scripts/m2-iac-scan.sh v2    # IaC',
    './scripts/m2-image-scan.sh v1 && ./scripts/m2-image-scan.sh v2  # imagen',
    './scripts/m2-runtime-check.sh v2                                # runtime',
  ]),
  h2('Archivos de infraestructura como código'),
  ...table('Qué se define como código', ['Capa', 'Archivos', 'Qué describe'], [
    ['Imagen', '`app/Dockerfile`, `app/.dockerignore`', 'Empaquetado de la aplicación'],
    ['Orquestación local', '`infra/docker/docker-compose.yml`, `Caddyfile`', 'App + PostgreSQL + proxy TLS endurecidos'],
    ['Nube (aplicación)', '`infra/terraform/app/*.tf`', 'VPC, CloudFront + WAF, EC2, RDS, KMS, ECR, SSM, IAM y monitoreo'],
    ['Nube (cuenta)', '`infra/terraform/account-baseline/*.tf`', 'Línea base CIS: CloudTrail, alarmas, IAM, cifrado por defecto'],
  ], [2000, 3700, 3660]),
  h2('Hallazgos de Hadolint sobre el Dockerfile v1'),
  ...table('Advertencias de Hadolint (v1)', ['Regla', 'Línea', 'Descripción'], [
    ['DL3064', '7', 'Datos potencialmente sensibles en `ARG`/`ENV` (`JWT_SECRET`)'],
    ['DL3064', '8', 'Datos potencialmente sensibles en `ARG`/`ENV` (`DB_PASSWORD`)'],
    ['DL3025', '11', 'Usar notación JSON (forma exec) en `CMD`'],
  ], [1600, 1200, 6560]),
  h2('Hallazgos de Trivy config'),
  p('En v1, Trivy reportó 4 fallos en el Dockerfile (2 críticos por secretos en `ENV`, 1 alto por ejecutar como root y 1 bajo) y 16 en Terraform (2 críticos, 8 altos, 1 medio y 5 bajos), entre ellos IMDSv1, contraseña en texto plano en `user_data` y bucket S3 sin bloqueo de acceso público. En v2 queda un único fallo medio, AWS-0077 (retención de backups de RDS de 1 día), impuesto por el Free plan.'),
  h2('Configuración de los contenedores en ejecución (v2)'),
  ...table('Evidencia de m2-runtime-check.sh (runtime-config.md)', ['Servicio', 'Usuario', 'FS solo lectura', 'cap_drop', 'no-new-priv.', 'Puertos', 'Memoria', 'Secretos en ENV'], [
    ['app', '65532', 'sí', 'ALL', 'sí', 'ninguno', '512 MiB', 'ninguno'],
    ['db', '70', 'sí', 'ALL', 'sí', 'ninguno', '512 MiB', 'ninguno'],
    ['proxy', 'root', 'sí', 'ALL (+NET_BIND)', 'sí', '127.0.0.1:8443', '128 MiB', 'ninguno'],
  ], [1000, 900, 1100, 1500, 1100, 1560, 1000, 1200]),
  p('Redes: `backend` interna (sin salida a Internet) y `frontend`. El proxy conserva root únicamente para enlazar el puerto TLS, con todas las demás capacidades eliminadas.'),
  h2('Excepciones justificadas en Checkov'),
  p('La versión v2 obtiene 0 controles fallidos y 443 superados, con 30 omisiones (23 controles distintos) justificadas por escrito en el propio código (`#checkov:skip=…:motivo`). Las principales son: Multi-AZ y Performance Insights de RDS desactivados para permanecer en la capa gratuita; política TLS mínima de CloudFront y TLS hasta el origen, que requieren dominio propio con certificado ACM; y la salida HTTPS de la EC2 sin NAT ni VPC endpoints por costo.'),
  h2('Evidencias'),
  ...capture('Checkov sobre v1: 31 controles fallidos (checkov.txt).', 'm2-checkov-v1.png'),
  ...capture('Checkov sobre v2: 0 fallidos, 443 superados.', 'm2-checkov-v2.png'),
  ...capture('Trivy config sobre v1 (trivy-config.txt).', 'm2-trivy-config-v1.png'),
  ...capture('Hadolint sobre el Dockerfile v1: 3 advertencias.', 'm2-hadolint-v1.png'),
  ...capture('Trivy imagen v1: 19 CRITICAL y 406 HIGH (trivy-image.txt).', 'm2-trivy-image-v1.png'),
  ...capture('Trivy imagen v2: 0 CRITICAL y 0 HIGH.', 'm2-trivy-image-v2.png'),
  ...capture('Comparación de imágenes (docker images): 1360 MB frente a 223 MB.', 'm2-image-size.png'),
  ...capture('Configuración en ejecución de los contenedores v2 (runtime-config.md).', 'm2-runtime-v2.png'),
];

// ---------- Anexo C ----------
const anexoC = [
  (setAnnex('C'), annexHeading('Anexo C', 'Módulo 3: Seguridad en la nube')),
  p('**Objetivo:** desplegar la aplicación en un entorno de nube real aplicando controles de seguridad y evaluar la postura con herramientas CSPM. **Entregable:** despliegue funcional, informe de configuración de seguridad y reporte CSPM.'),
  h2('Secuencia de despliegue y evaluación'),
  ...code([
    'export AWS_REGION=us-east-1',
    './scripts/m3-apply.sh account      # línea base de la cuenta',
    './scripts/m3-apply.sh app          # imagen en ECR + infraestructura',
    './scripts/m3-verify.sh             # evidencia de los controles',
    './scripts/m3-prowler.sh after      # evaluación CSPM con Prowler',
    './scripts/m3-scoutsuite.sh after   # evaluación CSPM con ScoutSuite',
    './scripts/summarize.sh             # tabla consolidada',
    './scripts/m3-destroy.sh all        # eliminar recursos al final',
  ]),
  h2('Parámetros ajustados al plan de la cuenta'),
  ...table('Variables de Terraform ajustadas (terraform.tfvars)', ['Variable', 'Valor', 'Motivo'], [
    ['`enable_guardduty` (account-baseline)', 'false', 'GuardDuty no disponible en el Free plan'],
    ['`enable_securityhub`, `enable_config`', 'false', 'Evitar costos de evaluación'],
    ['`db_backup_retention_days` (app)', '1', 'Máximo permitido por el Free plan'],
    ['`region`', 'us-east-1', 'Región requerida por CloudFront/WAF y la línea base'],
  ], [3600, 1300, 4460]),
  h2('Verificación del despliegue'),
  p('El script `m3-verify.sh` consultó la configuración real de los recursos en AWS y generó `reports/m3/despliegue/verificacion.md`. Resultados obtenidos:'),
  ...table('Verificación de los controles desplegados (m3-verify.sh)', ['Dominio', 'Control verificado', 'Resultado observado'], [
    ['Red / TLS', 'HTTPS en CloudFront con cabeceras de seguridad', 'HTTP 200 con CSP, HSTS, X-Frame-Options DENY, nosniff, COOP/COEP, Permissions-Policy y cookie `__Host-csrf` (HttpOnly, Secure, SameSite=Strict)'],
    ['Red / TLS', 'HTTP se redirige a HTTPS', 'HTTP 301'],
    ['Red', 'Acceso directo al origen EC2', 'Bloqueado: tiempo de conexión agotado (solo CloudFront)'],
    ['Red', 'Grupo de seguridad de la EC2', 'Entrada: solo puerto 80 desde la prefix list de CloudFront; salida: 443 y 5432 hacia el SG de RDS; sin SSH'],
    ['Datos', 'Instancia RDS', 'No pública, cifrada con KMS, autenticación IAM habilitada, protección contra borrado activa'],
    ['Datos / TLS', 'TLS obligatorio en PostgreSQL', '`rds.force_ssl = 1`'],
    ['Cómputo', 'Instancia EC2', 'IMDSv2 obligatorio (hop limit 1), sin llave SSH, perfil IAM propio'],
    ['Cifrado', 'Volúmenes EBS y cifrado por defecto', 'Volumen cifrado con la CMK; cifrado EBS por defecto activo en la cuenta'],
    ['IAM', 'Rol de la EC2', 'Una única política en línea de mínimo privilegio (`securenotes-runtime`)'],
    ['IAM', 'Política de contraseñas', '14 caracteres mínimo, mayúsculas, minúsculas, números y símbolos, caducidad de 90 días, historial de 24'],
    ['IAM', 'Administración sin SSH', 'Agente de Session Manager en línea'],
    ['Secretos', 'Parámetros en SSM', '4 parámetros SecureString cifrados con la CMK (BD, JWT, admin, encabezado de origen)'],
    ['Registro', 'Repositorio ECR', 'Etiquetas inmutables, escaneo al publicar y cifrado KMS'],
    ['Monitoreo', 'Log groups', 'Cifrados con KMS, retención de 365 días (app y VPC Flow Logs)'],
    ['Monitoreo', 'CloudTrail', 'Multirregión, validación de integridad y cifrado KMS'],
    ['Monitoreo', 'IAM Access Analyzer', 'Activo a nivel de cuenta'],
    ['Monitoreo', 'Alarmas de CloudWatch', '20 alarmas en estado OK: 15 CIS (4.1–4.15) y 5 de la aplicación (login fallido, eventos de seguridad, errores 5xx, estado EC2, CPU RDS)'],
    ['Aplicación', 'AWS WAF', 'Web ACL `securenotes-demo-web-acl` asociada a CloudFront'],
    ['Detección', 'GuardDuty', 'No disponible: SubscriptionRequiredException (Free plan)'],
  ], [1400, 2800, 5160]),
  h2('Evidencias'),
  ...capture('Salida de terraform apply de la aplicación con los outputs (app_url, instance_id, rds_endpoint).', 'm3-terraform-apply.png'),
  ...capture('SecureNotes abierta por HTTPS en la URL de CloudFront (candado visible).', 'm3-app-https.png'),
  ...capture('Inicio de sesión como administrador y creación de una nota en la nube.', 'm3-app-login.png'),
  ...capture('Acceso directo al origen EC2 bloqueado.', 'm3-origin-blocked.png'),
  ...capture('Parámetros SecureString en SSM Parameter Store (sin mostrar valores).', 'm3-ssm-parameters.png'),
  ...capture('Instancia RDS: no pública, cifrada con KMS.', 'm3-rds.png'),
  ...capture('Web ACL de AWS WAF asociada a CloudFront.', 'm3-waf.png'),
  ...capture('Trail de CloudTrail multirregión con validación de integridad.', 'm3-cloudtrail.png'),
  ...capture('Alarmas CIS y de la aplicación en CloudWatch.', 'm3-alarmas.png'),
  ...capture('Eventos JSON de la aplicación en CloudWatch Logs (logger del Módulo 1).', 'm3-cloudwatch-logs.png'),
  ...capture('Reporte de Prowler: 352 PASS y 95 FAIL (prowler-after.html).', 'm3-prowler-after.png'),
  ...capture('Detalle de los hallazgos críticos y altos en Prowler.', 'm3-prowler-criticos.png'),
  ...capture('Panel de ScoutSuite: 6 reglas en peligro y 15 de advertencia (securenotes-after.html).', 'm3-scoutsuite-after.png'),
  ...capture('Destrucción de los recursos con m3-destroy.sh al finalizar.', 'm3-destroy.png'),
];

// ---------- documento ----------
const doc = new Document({
  creator: 'Proyecto Final Integrador',
  title: 'Plataforma web segura: del código a la nube',
  description: 'Informe final del proyecto integrador DevSecOps (SecureNotes)',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: SZ }, paragraph: { spacing: DOUBLE } } },
    paragraphStyles: [
      // Nivel 1: centrado, negrita · Nivel 2: alineado a la izquierda, negrita · Nivel 3: izquierda, negrita cursiva (APA 7, 2.27)
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: SZ, bold: true, color: '000000' },
        paragraph: { alignment: AlignmentType.CENTER, spacing: DOUBLE, outlineLevel: 0, keepNext: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: SZ, bold: true, color: '000000' },
        paragraph: { alignment: AlignmentType.LEFT, spacing: DOUBLE, outlineLevel: 1, keepNext: true } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: SZ, bold: true, italics: true, color: '000000' },
        paragraph: { alignment: AlignmentType.LEFT, spacing: DOUBLE, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1800, hanging: 360 } } } },
      ] },
      { reference: 'numbers', levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
      ] },
    ],
  },
  sections: [{
    properties: {
      page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
    },
    // Trabajo de estudiante: solo el número de página, arriba a la derecha, en todas las páginas (APA 7, 2.18)
    headers: {
      default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: SINGLE,
        children: [new TextRun({ children: [PageNumber.CURRENT] })] })] }),
    },
    children: [
      ...portada, ...indice, ...resumen, ...sec1, ...sec2, ...sec3, ...sec4, ...sec5, ...sec6, ...sec7, ...sec8, ...sec9,
      ...anexoA, ...anexoB, ...anexoC,
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('OK', OUT, buf.length); });
