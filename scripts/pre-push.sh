#!/bin/sh
# TRABA ANTES DE PUBLICAR (26/11/2026, regla de Franco: «la estética jamás se puede perder»).
# Todo lo que llega a main sale en vivo en laburo.somosder.ar. Antes de dejar pasar el
# push se compila el sitio en una carpeta aparte (.next-verify, para no pisar el `.next`
# de un `next dev` que esté corriendo), se lo levanta en un puerto libre y se recorren
# las páginas PÚBLICAS del mapa del sitio en un navegador real
# (scripts/control-visual.mjs), en escritorio y celular. Si hay un título partido, una
# grilla con huecos, algo que se sale de la pantalla o una foto rota, el push NO sale y
# Franco recibe el aviso por Telegram (salvo que exista CONTROL_SIN_AVISO).
# El control solo abre y mide páginas públicas: nunca paneles ni nada con sesión, y no
# hace clic ni envía formularios. Las fichas se leen de la base (solo lectura) con las
# claves de .env.local, igual que en vivo.
# Se instala con: ln -sf ../../scripts/pre-push.sh .git/hooks/pre-push
# Prohibido saltearlo con --no-verify sin el OK de Franco.
cd "$(git rev-parse --show-toplevel)" || exit 1
publica_main=0
cambia_web=0
while read -r _ local_sha remote_ref remote_sha; do
  case "$remote_ref" in refs/heads/main) publica_main=1 ;; *) continue ;; esac
  [ "$local_sha" = "0000000000000000000000000000000000000000" ] && continue
  base="$remote_sha"
  [ "$base" = "0000000000000000000000000000000000000000" ] && base="$(git merge-base "$local_sha" origin/main 2>/dev/null)"
  if git diff --name-only "$base" "$local_sha" 2>/dev/null | grep -Eq '^(app/|components/|lib/|content/|public/|middleware\.ts|next\.config|postcss\.config|package\.json|package-lock\.json|scripts/(control-visual|pre-push))'; then cambia_web=1; fi
done
[ "$publica_main" = 1 ] && [ "$cambia_web" = 1 ] || exit 0

avisar() {
  [ -z "$CONTROL_SIN_AVISO" ] && [ -x /usr/bin/python3 ] && [ -f /root/scripts/tg-orden.py ] && /usr/bin/python3 -I /root/scripts/tg-orden.py telegram-franco "$1" >/dev/null 2>&1
  return 0
}

# Se revisa lo que se va a publicar, no lo que haya a medio editar en la carpeta.
if [ -n "$(git status --porcelain --untracked-files=no -- app components lib content public middleware.ts next.config.ts)" ]; then
  echo "pre-push: aviso: hay cambios sin commitear en el sitio; el control los incluye." >&2
fi

echo "pre-push: compilando y revisando cómo se ve el sitio (unos 4 minutos)…" >&2
salida="$(mktemp)"
tsconfig="$(mktemp)"
registro="$(mktemp)"
cp tsconfig.json "$tsconfig"
servidor=""
limpiar() {
  [ -n "$servidor" ] && kill "$servidor" 2>/dev/null
  # `next build` con otra carpeta de salida reescribe tsconfig.json: se deja como estaba.
  cmp -s "$tsconfig" tsconfig.json || cp "$tsconfig" tsconfig.json
  rm -f "$salida" "$tsconfig" "$registro"
}
trap limpiar EXIT
trap 'exit 1' INT TERM

export NEXT_DIST_DIR=.next-verify
export NEXT_TELEMETRY_DISABLED=1
if ! npx next build >"$salida" 2>&1; then
  tail -25 "$salida" >&2
  echo "pre-push: el sitio no compila. No se publica." >&2
  avisar "🛑 LABURO: frené una publicación en laburo.somosder.ar porque el sitio no compila. No salió nada en vivo; lo corrijo antes de publicar."
  exit 1
fi

puerto="$(node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
node node_modules/next/dist/bin/next start -H 127.0.0.1 -p "$puerto" >"$registro" 2>&1 &
servidor=$!
base_local="http://127.0.0.1:$puerto"
i=0
while [ $i -lt 60 ] && ! curl -s -o /dev/null "$base_local/robots.txt"; do sleep 0.5; i=$((i + 1)); done
if ! curl -s -o /dev/null "$base_local/robots.txt"; then
  cat "$registro" >&2
  echo "pre-push: no pude levantar el sitio en local para revisarlo. No se publica." >&2
  exit 1
fi

# Todas las páginas del mapa del sitio (unas 700) más las públicas que no figuran ahí.
if node scripts/control-visual.mjs --base "$base_local" --por-grupo 1000 --trabajadores 6 --mas /empleos,/licitaciones,/entrar >"$salida" 2>&1; then
  cat "$salida" >&2
  exit 0
fi
cat "$salida" >&2
resumen="$(grep '^✗' "$salida" | head -5)"
avisar "🛑 LABURO: frené una publicación en laburo.somosder.ar porque se veía mal. No salió nada en vivo; lo corrijo antes de publicar.
$resumen"
echo "pre-push: el control visual falló. No se publica hasta corregirlo." >&2
exit 1
