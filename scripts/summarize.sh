#!/usr/bin/env bash
# Atajo para generar la tabla de resultados consolidados.
exec node "$(dirname "$0")/summarize.mjs" "$@"
