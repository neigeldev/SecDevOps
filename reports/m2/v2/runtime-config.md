# Configuración en ejecución · SecureNotes v2

| Servicio | Usuario | FS solo lectura | Capacidades eliminadas | Capacidades añadidas | Privilegiado | no-new-privileges | Puertos publicados | Límite memoria | Variables con secretos |
|---|---|---|---|---|---|---|---|---|---|
| app | 65532:65532 | sí | ALL | ninguna | no | sí | ninguno | 512 MiB | ninguna |
| db | 70:70 | sí | ALL | ninguna | no | sí | ninguno | 512 MiB | ninguna |
| proxy | root | sí | ALL | CAP_NET_BIND_SERVICE | no | sí | 127.0.0.1:8443->443/tcp | 128 MiB | ninguna |

## Redes

- `securenotes-v2_backend`: internal=true
- `securenotes-v2_frontend`: internal=false
