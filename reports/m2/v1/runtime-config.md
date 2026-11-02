# Configuración en ejecución · SecureNotes v1

| Servicio | Usuario | FS solo lectura | Capacidades eliminadas | Capacidades añadidas | Privilegiado | no-new-privileges | Puertos publicados | Límite memoria | Variables con secretos |
|---|---|---|---|---|---|---|---|---|---|
| app | root | no | ninguna | ninguna | no | no | 0.0.0.0:3000->3000/tcp | sin límite | JWT_SECRET, DB_PASSWORD |
| db | root | no | ninguna | ninguna | no | no | 0.0.0.0:5432->5432/tcp | sin límite | POSTGRES_PASSWORD |

## Redes

- `securenotes-v1_default`: internal=false
