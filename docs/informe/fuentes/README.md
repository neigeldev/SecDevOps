# Fuentes del informe en Word

Regeneran `docs/informe/Informe-Final-SecureNotes.docx`:

```bash
node docs/informe/fuentes/shot.js          # diagramas (Playwright) -> flujo.png, arquitectura.png
node docs/informe/fuentes/build.js docs/informe/Informe-Final-SecureNotes.docx
python3 docs/informe/fuentes/fix.py docs/informe/Informe-Final-SecureNotes.docx
```

Requiere el paquete npm `docx`. Las marcas `[COMPLETAR: …]` (resaltadas en amarillo) y
los recuadros `[INSERTAR CAPTURA …]` se completan a mano en Word.
