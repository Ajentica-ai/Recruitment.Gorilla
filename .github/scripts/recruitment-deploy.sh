#!/usr/bin/env bash
#
# Server-side half of the Recruitment.Gorilla CD workflow
# (.github/workflows/cd.yml), modelled on gorillahr-deploy.sh. It is not run
# from a checkout on the server: the workflow streams it over SSH
#
#   ssh <host> 'bash -s -- <action> [args]' < .github/scripts/recruitment-deploy.sh
#
# Actions:
#   preflight <bootstrap>   read-only checks and current state
#   dump                    mysqldump to /root/recruitment-cd-dumps, keep newest 20
#   rowcounts <label>       save per-table row counts (label: before | after)
#   rowcount-compare        list tables that have fewer rows after than before
#   snapshot                bootstrap only: tag running images, back up the
#                           hand-modified docker-compose.yml and nginx config
#   prune <base64-list>     remove files the new commit no longer tracks
#   shipped-sha             print which commit the tree holds now
#   mark-shipped <sha>      record which commit the tree now holds
#   apply                   memory gate, secret guards and admin-hash guard, build
#                           api and web, up -d --no-deps api web, then nginx -t and
#                           nginx -s reload in the web container
#   wait-healthy <seconds>  wait for db healthy, api and web running and stable
#   site-check              web on 127.0.0.1:8090, POST /api/auth/logout must be
#                           204, POST /api/auth/refresh must be 401 JSON, the site
#                           through host nginx, and no startup exception in the api log
#   cert-expiry             days until the served TLS certificate expires
#   migrations              print "<count>:<last EF migration id>"
#   record <prev> <new> <migrations-before> <migrations-after>
#   diagnose                container state and filtered logs
#
# Lines starting with REC_ are parsed by the workflow.
#
# Scope: compose project recruitment-gorilla in /opt/recruitment/Recruitment.Gorilla
# only. Never touch the db service, the GorillaHR project, the host nginx or
# certbot. Never add down, -v, volume or system prune, or rm with a wildcard:
# the database lives in the db-data volume and uploads in api-uploads. The
# only removals are the validated file list in `prune`, a dump this script
# just wrote that failed verification, and old dumps matched by exact name.
#
# Never create or copy a .env: the app runs on the committed compose defaults
# and the guards below refuse any change to them.
#
# This repository is public, so everything printed here ends up in a public
# log: no secret values, no hashes of the stored password, no user data.
#
# Every action that changes the server requires the droplet deploy lock
# (/var/lock/droplet-deploy.lock), which the workflow holds for the whole
# deploy through a separate SSH session.

set -euo pipefail

# Overridable only so the script can be exercised locally against a fake tree.
DEPLOY_PATH="${REC_DEPLOY_PATH:-/opt/recruitment/Recruitment.Gorilla}"
DUMP_DIR="${REC_DUMP_DIR:-/root/recruitment-cd-dumps}"
LOCK_FILE="${REC_LOCK_FILE:-/var/lock/droplet-deploy.lock}"
MEMINFO="${REC_MEMINFO:-/proc/meminfo}"
PROJECT=recruitment-gorilla
SITE_HOST=recruitment.ajentica.ai
LOCAL_URL=http://127.0.0.1:8090
KEEP_DUMPS=20
# Free memory plus free swap needed before building: the api build runs the
# .NET SDK and the web build runs npm ci and vite, next to the live containers
# and the GorillaHR project on the same droplet.
MIN_HEADROOM_MB="${REC_MIN_HEADROOM_MB:-1536}"
COMPOSE=(docker compose -p "$PROJECT" -f docker-compose.yml)
DB=recruitment-gorilla-db-1
API=recruitment-gorilla-api-1
WEB=recruitment-gorilla-web-1
CONTAINERS=("$DB" "$API" "$WEB")
SHA_RE='^[0-9a-f]{40}$'
MIG_RE='^[0-9]+:[A-Za-z0-9_-]+$'
HASH_RE='^[A-Za-z0-9+/=.$_-]+$'
EMAIL_RE='^[A-Za-z0-9._%+@-]+$'
DUMP_RE='^recruitment-[0-9]{8}T[0-9]{6}Z\.sql\.gz$'
# Log lines that may carry credentials, tokens or keys are dropped from
# diagnostics; email addresses are masked separately.
SECRET_LOG_FILTER='[Pp]assword|PASSWORD|[Ss]ecret|SECRET|[Tt]oken|[Kk]ey|Jwt|JWT|Authorization|Cookie|ConnectionString'

die() {
  echo "ERROR: $*" >&2
  exit 1
}

emit() {
  echo "REC_$1=$2"
}

write_atomic() {
  printf '%s\n' "$2" > "$1.tmp"
  mv "$1.tmp" "$1"
}

require_lock() {
  # Succeeding here would mean nobody holds the lock, so no deploy session
  # is open: refuse to change anything outside one.
  if flock -n "$LOCK_FILE" true 2> /dev/null; then
    die "the droplet deploy lock ($LOCK_FILE) is not held; changes run only inside a CD deploy"
  fi
}

container_state() {
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1" 2> /dev/null || echo missing
}

print_states() {
  local c
  for c in "${CONTAINERS[@]}"; do
    printf '  %-28s %s\n' "$c" "$(container_state "$c")"
  done
}

print_ps() {
  docker compose -p "$PROJECT" ps -a 2> /dev/null \
    || docker ps -a --filter "label=com.docker.compose.project=$PROJECT"
}

container_env() {
  # One variable of a container's own environment, or empty. Never printed.
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$1" 2> /dev/null \
    | sed -n "s/^$2=//p" | head -n 1
}

sha_of() {
  printf '%s' "$1" | sha256sum | cut -d' ' -f1
}

migration_state() {
  # "<applied count>:<newest EF migration id>". The mysql client runs inside
  # the db container as root, with the password and database name taken from
  # that container's own environment (password via MYSQL_PWD, never printed).
  local out
  out=$(docker exec "$DB" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -N -B "$MYSQL_DATABASE" -e "SELECT CONCAT(COUNT(*), CHAR(58), IFNULL(MAX(MigrationId), CHAR(45))) FROM __EFMigrationsHistory"' 2> /dev/null) || out=""
  if [[ $out =~ $MIG_RE ]]; then
    echo "$out"
  else
    echo unknown
  fi
}

admin_state() {
  # Trap: the API seeds its Super Admin on every start and overwrites that
  # account's PasswordHash when it differs from Auth__PasswordHash. A restart
  # is only a no-op while the stored hash equals the configured one. Compares
  # the RUNNING api configuration with the database and prints only
  # equal | different | missing | unconfigured | unchecked | unknown.
  local cfg email q out rows match
  cfg=$(container_env "$API" Auth__PasswordHash)
  email=$(container_env "$API" Auth__SeedAdminEmail)
  if [ -z "$cfg" ] || [ -z "$email" ]; then
    echo unconfigured
    return 0
  fi
  if ! [[ $cfg =~ $HASH_RE ]] || ! [[ $email =~ $EMAIL_RE ]]; then
    echo unchecked
    return 0
  fi
  q="SELECT COUNT(*), COALESCE(SUM(CAST(PasswordHash AS BINARY) = CAST('$cfg' AS BINARY)), 0) FROM Users WHERE Email = '$email';"
  out=$(printf '%s\n' "$q" | docker exec -i "$DB" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -N -B "$MYSQL_DATABASE"' 2> /dev/null) || out=""
  rows="" match=""
  read -r rows match <<< "$out" || true
  if ! [[ $rows =~ ^[0-9]+$ ]] || ! [[ $match =~ ^[0-9]+$ ]]; then
    echo unknown
  elif [ "$rows" -eq 0 ]; then
    echo missing
  elif [ "$rows" -eq 1 ] && [ "$match" -eq 1 ]; then
    echo equal
  else
    echo different
  fi
}

read_sha_file() {
  local value
  [ -f "$1" ] || return 1
  value=$(tr -d '[:space:]' < "$1")
  [[ $value =~ $SHA_RE ]] || die "$1 does not hold a 40-character SHA"
  echo "$value"
}

meminfo_mb() {
  awk -v key="$1:" '$1 == key { printf "%d", $2 / 1024; found = 1 } END { if (!found) print 0 }' "$MEMINFO"
}

memory_summary() {
  echo "MemAvailable=$(meminfo_mb MemAvailable) SwapTotal=$(meminfo_mb SwapTotal) SwapFree=$(meminfo_mb SwapFree)"
}

memory_gate() {
  local avail swap_total swap_free headroom
  avail=$(meminfo_mb MemAvailable)
  swap_total=$(meminfo_mb SwapTotal)
  swap_free=$(meminfo_mb SwapFree)
  headroom=$((avail + swap_free))
  echo "memory before build (MB): MemAvailable=$avail SwapTotal=$swap_total SwapFree=$swap_free headroom=$headroom (minimum $MIN_HEADROOM_MB)"
  [ "$swap_total" -gt 0 ] || die "the droplet has no swap; refusing to build (an out-of-memory build can take down the live containers)"
  [ "$headroom" -ge "$MIN_HEADROOM_MB" ] || die "only ${headroom} MB of memory plus free swap; refusing to build (minimum $MIN_HEADROOM_MB MB)"
}

preflight() {
  local bootstrap="$1" prev shipped mig admin c
  cd "$DEPLOY_PATH"

  echo "== disk free on /"
  df -h /
  echo "== memory (MB): $(memory_summary)"

  prev=$(read_sha_file .deployed-sha) || prev=none
  shipped=$(read_sha_file .shipped-sha) || shipped="$prev"
  echo "== last healthy deploy (.deployed-sha): $prev"
  echo "== code in the tree (.shipped-sha): $shipped"
  if [ "$prev" = none ] && [ "$bootstrap" != true ]; then
    die "no .deployed-sha in $DEPLOY_PATH: the first deploy must be a manual run with bootstrap=true"
  fi
  if [ "$prev" != none ] && [ "$bootstrap" = true ]; then
    echo "NOTE: bootstrap=true has no effect, this server was already deployed by CD"
  fi

  [ -f docker-compose.yml ] || die "docker-compose.yml is missing in $DEPLOY_PATH"
  # CD always uses `-f docker-compose.yml`, so an override file would be
  # silently ignored while the running containers may have been built with it.
  [ ! -e docker-compose.override.yml ] \
    || die "docker-compose.override.yml exists; CD ignores override files. Merge it into docker-compose.yml deliberately first"
  command -v python3 > /dev/null || die "python3 is not installed on the server (needed to compare secrets without printing them)"
  command -v curl > /dev/null || die "curl is not installed on the server"
  if [ -f .env ]; then
    echo "== .env present (not read; compose uses it for interpolation)"
  else
    echo "== no .env (expected: the app runs on the committed compose defaults)"
  fi

  for c in "${CONTAINERS[@]}"; do
    [ "$(container_state "$c")" != missing ] || die "$c does not exist; this script only redeploys an existing stack"
  done

  mig=$(migration_state)
  echo "== EF migrations (applied:newest): $mig"
  admin=$(admin_state)
  echo "== seed admin password hash vs running configuration: $admin"
  if [ "$admin" != equal ]; then
    echo "WARNING: apply will refuse to deploy unless this is 'equal' (a restart could reset the Super Admin password)"
  fi

  echo "== containers"
  print_ps
  echo "== health"
  print_states

  emit PREV_SHA "$prev"
  emit SHIPPED_SHA "$shipped"
  emit MIGRATIONS "$mig"
  emit ADMIN "$admin"
}

prune_old_dumps() {
  # Only names this script writes are counted or removed; anything else in
  # the directory is left alone.
  local name
  while IFS= read -r name; do
    [[ $name =~ $DUMP_RE ]] || continue
    rm -f -- "${DUMP_DIR:?}/$name"
    echo "removed old dump $name"
  done < <(find "$DUMP_DIR" -maxdepth 1 -type f -name 'recruitment-*.sql.gz' -printf '%f\n' \
    | { grep -E "$DUMP_RE" || true; } | sort -r | tail -n +$((KEEP_DUMPS + 1)))
}

dump() {
  local file tables size bytes
  require_lock
  umask 077
  mkdir -p "$DUMP_DIR"
  file="$DUMP_DIR/recruitment-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
  [ ! -e "$file" ] || die "$file already exists"
  # Single transaction: reads only, does not lock the live tables. A dump that
  # fails verification is the only file removed here besides the rotation
  # below; it was written a moment ago and is not a usable backup.
  if ! docker exec "$DB" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --triggers --events --set-gtid-purged=OFF --databases "$MYSQL_DATABASE"' \
    | gzip > "$file"; then
    rm -f -- "$file"
    die "mysqldump failed, deploy aborted"
  fi
  if ! gzip -t "$file" 2> /dev/null; then
    rm -f -- "$file"
    die "dump is not a valid gzip file, deploy aborted"
  fi
  tables=$(gzip -dc "$file" | grep -c '^CREATE TABLE' || true)
  if [ "${tables:-0}" -lt 1 ]; then
    rm -f -- "$file"
    die "dump contains no CREATE TABLE statement, deploy aborted"
  fi
  if ! gzip -dc "$file" | tail -n 3 | grep '^-- Dump completed' > /dev/null; then
    rm -f -- "$file"
    die "dump has no completion marker (truncated?), deploy aborted"
  fi
  bytes=$(stat -c %s "$file")
  if [ "$bytes" -lt 10240 ]; then
    rm -f -- "$file"
    die "dump is only $bytes bytes, far too small for this database; deploy aborted"
  fi
  size=$(du -h "$file" | cut -f1)
  echo "database dump: $file ($size, $tables CREATE TABLE statements, completion marker present)"
  prune_old_dumps
  emit DUMP_FILE "$file"
  emit DUMP_SIZE "$size"
}

rowcounts() {
  local label="$1" file n
  [ "$label" = before ] || [ "$label" = after ] || die "label must be before or after"
  require_lock
  umask 077
  mkdir -p "$DUMP_DIR"
  file="$DUMP_DIR/rowcounts-$label.tsv"
  docker exec -i "$DB" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -N -B "$MYSQL_DATABASE"' > "$file.tmp" <<'SQL'
SET SESSION group_concat_max_len = 1000000;
SELECT GROUP_CONCAT(CONCAT('SELECT ''', table_name, ''' AS t, COUNT(*) AS n FROM `', table_name, '`') SEPARATOR ' UNION ALL ') INTO @q FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE';
SET @q = CONCAT(@q, ' ORDER BY t');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SQL
  n=$(wc -l < "$file.tmp")
  if [ "$n" -lt 1 ]; then
    rm -f -- "$file.tmp"
    die "row count query returned no tables"
  fi
  mv "$file.tmp" "$file"
  echo "row counts ($label) saved: $n tables in $file"
  emit TABLES "$n"
}

rowcount_compare() {
  # Informational: users delete rows legitimately, so a shrinking table is a
  # warning for a person to look at, not a reason to fail the deploy.
  local before="$DUMP_DIR/rowcounts-before.tsv" after="$DUMP_DIR/rowcounts-after.tsv" lost n
  if [ ! -f "$before" ] || [ ! -f "$after" ]; then
    echo "row count files missing, nothing to compare"
    emit ROWLOSS unknown
    return 0
  fi
  lost=$(awk -F'\t' 'NR == FNR { b[$1] = $2; next } ($1 in b) && ($2 + 0) < (b[$1] + 0) { printf "%s %d->%d\n", $1, b[$1], $2 }' "$before" "$after")
  if [ -n "$lost" ]; then
    n=$(wc -l <<< "$lost")
    echo "WARNING: $n table(s) have fewer rows after the deploy than before:"
    printf '%s\n' "$lost"
  else
    n=0
    echo "no table has fewer rows than before"
  fi
  emit ROWLOSS "$n"
}

snapshot() {
  # Bootstrap only. The first CD deploy overwrites the server's hand-modified
  # docker-compose.yml and client/nginx.standalone.conf and rebuilds the
  # images, so keep what is running now for a manual rollback. The image is
  # taken from .Config.Image (the reference), never .Image: with the
  # containerd image store the latter is an ID that cannot be run or tagged.
  local stamp c svc image base container_id tag_id f
  require_lock
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  cd "$DEPLOY_PATH"
  for svc in api web; do
    c="recruitment-gorilla-$svc-1"
    image=$(docker inspect -f '{{.Config.Image}}' "$c" 2> /dev/null) || image=""
    if [ -n "$image" ]; then
      container_id=$(docker inspect -f '{{.Image}}' "$c" 2> /dev/null) || container_id=""
      tag_id=$(docker image inspect -f '{{.Id}}' "$image" 2> /dev/null) || tag_id=""
      if [ -n "$container_id" ] && [ -n "$tag_id" ] && [ "$container_id" != "$tag_id" ]; then
        echo "WARNING: $c runs a different image than the current tag '$image'; the pre-cd tag would not capture what is running"
      fi
      base="${image%%:*}"
      docker tag "$image" "$base:pre-cd-$stamp"
      echo "tagged image of $c ($image) as $base:pre-cd-$stamp"
    else
      echo "WARNING: $c not found, no pre-cd image tag for $svc"
    fi
  done
  for f in docker-compose.yml client/nginx.standalone.conf; do
    if [ -f "$f" ]; then
      cp -p "$f" "$f.pre-cd-$stamp"
      echo "backed up $f to $f.pre-cd-$stamp"
    else
      echo "WARNING: $f not found, nothing to back up"
    fi
  done
}

is_protected() {
  case "$1" in
    .env | docker-compose.override.yml) return 0 ;;
    .deployed-sha | .shipped-sha | .deploy-history) return 0 ;;
    .git | .git/*) return 0 ;;
  esac
  return 1
}

prune_path_ok() {
  local path="$1" root="$2" real
  [ -n "$path" ] || return 1
  # [ and ] are allowed (paths are always quoted, never glob-expanded).
  case "$path" in
    /* | *..* | *'*'* | *'?'* | *\\*) return 1 ;;
  esac
  [[ $path =~ [[:cntrl:]] ]] && return 1
  case "/$path/" in */./* | *//*) return 1 ;; esac
  is_protected "$path" && return 1
  # Resolve symlinks so a tracked link cannot point the removal elsewhere.
  real=$(realpath -m -- "$root/$path") || return 1
  [[ $real == "$root"/* ]] || return 1
  is_protected "${real#"$root"/}" && return 1
  return 0
}

prune() {
  local encoded="$1" list root path dir removed=0 rejected=0
  local -a paths=()
  require_lock
  [[ $encoded =~ ^[A-Za-z0-9+/=]+$ ]] || die "prune list is not base64"
  list=$(printf '%s' "$encoded" | base64 -d) || die "prune list does not decode"
  cd "$DEPLOY_PATH"
  root=$(pwd -P)
  while IFS= read -r path; do
    [ -n "$path" ] && paths+=("$path")
  done <<< "$list"
  [ "${#paths[@]}" -gt 0 ] || die "prune list is empty"

  # Validate everything first: one bad entry rejects the whole list.
  for path in "${paths[@]}"; do
    if ! prune_path_ok "$path" "$root"; then
      echo "REJECTED: $path" >&2
      rejected=$((rejected + 1))
    fi
  done
  [ "$rejected" -eq 0 ] || die "prune list rejected ($rejected invalid path(s)), nothing removed"

  for path in "${paths[@]}"; do
    if [ -d "$path" ] && [ ! -L "$path" ]; then
      echo "skipped directory $path"
      continue
    fi
    if [ -e "$path" ] || [ -L "$path" ]; then
      rm -f -- "$path"
      removed=$((removed + 1))
      echo "removed $path"
    fi
    # Drop parent directories only once they are empty.
    dir=$(dirname -- "$path")
    while [ "$dir" != . ] && rmdir -- "$dir" 2> /dev/null; do
      dir=$(dirname -- "$dir")
    done
  done
  echo "pruned $removed of ${#paths[@]} listed file(s)"
}

shipped_sha() {
  # What the tree holds right now. A deploy that failed before mark-shipped
  # leaves the previous value, so rollback must ask instead of assuming.
  local value=none
  cd "$DEPLOY_PATH"
  if [ -f .shipped-sha ]; then
    value=$(tr -d '[:space:]' < .shipped-sha)
    [[ $value =~ $SHA_RE ]] || value=unknown
  fi
  emit SHIPPED_SHA "$value"
}

mark_shipped() {
  [[ $1 =~ $SHA_RE ]] || die "bad SHA"
  require_lock
  cd "$DEPLOY_PATH"
  write_atomic .shipped-sha "$1"
  echo "tree now holds $1"
}

secret_guards() {
  # CD never sets or changes the JWT key, the encryption key, the database
  # credentials or the seed admin settings. The committed compose defaults ARE
  # the production secrets (there is no .env), so a changed default in a new
  # commit would silently change production. Values are compared as hashes
  # and never printed. ENCRYPTION_KEY in particular must never change: stored
  # SMTP secrets become undecryptable.
  local resolved entry service key container new old state
  resolved=$("${COMPOSE[@]}" config --format json 2> /dev/null | python3 -c '
import hashlib, json, sys
services = json.load(sys.stdin)["services"]
wanted = {
    "api": ["Jwt__Key", "Encryption__Key", "ConnectionStrings__DefaultConnection", "Auth__PasswordHash", "Auth__SeedAdminEmail"],
    "db": ["MYSQL_ROOT_PASSWORD", "MYSQL_PASSWORD", "MYSQL_USER", "MYSQL_DATABASE"],
}
for service, keys in wanted.items():
    env = services[service].get("environment") or {}
    for key in keys:
        value = env.get(key)
        digest = hashlib.sha256(str(value).encode()).hexdigest() if value is not None else "unset"
        print(service + ":" + key + "=" + digest)
') || die "could not resolve the new compose configuration"

  for entry in \
    api:Jwt__Key api:Encryption__Key api:ConnectionStrings__DefaultConnection \
    api:Auth__PasswordHash api:Auth__SeedAdminEmail \
    db:MYSQL_ROOT_PASSWORD db:MYSQL_PASSWORD db:MYSQL_USER db:MYSQL_DATABASE; do
    service="${entry%%:*}"
    key="${entry#*:}"
    case "$service" in
      api) container="$API" ;;
      db) container="$DB" ;;
    esac
    new=$(sed -n "s/^$service:$key=//p" <<< "$resolved")
    old=$(container_env "$container" "$key")
    if [ -n "$old" ]; then old=$(sha_of "$old"); else old="unset"; fi
    [ "$new" = "$old" ] || die "$entry would change with this deploy (running and new values differ); CD never changes it"
    echo "$entry: unchanged"
  done

  # With the configured hash unchanged, the stored hash must equal it, or the
  # API restart would overwrite the Super Admin's password.
  state=$(admin_state)
  echo "seed admin password hash vs configuration: $state"
  [ "$state" = equal ] \
    || die "the seed admin's stored password hash does not equal the configured one ($state); restarting the API would reset it. Not deploying"
}

apply() {
  local attempt
  require_lock
  cd "$DEPLOY_PATH"
  [ -f docker-compose.yml ] || die "docker-compose.yml is missing in $DEPLOY_PATH"
  [ ! -e docker-compose.override.yml ] || die "docker-compose.override.yml exists; CD ignores override files"
  command -v python3 > /dev/null || die "python3 is not installed on the server"
  memory_gate
  secret_guards
  # Build first: the running containers keep serving until up -d swaps them.
  # The db service is never named, so a deploy cannot recreate or restart it,
  # and --no-deps stops compose from touching it as a dependency. A change to
  # the db service in docker-compose.yml needs a manual step on the server.
  # EF migrations run inside the api container at its start.
  "${COMPOSE[@]}" build api web
  "${COMPOSE[@]}" up -d --no-deps api web
  # nginx in the web container resolves api:8081 once, at startup or reload,
  # so a recreated api would keep getting requests at its old address. Test
  # the config, then reload.
  for attempt in 1 2 3 4 5; do
    docker exec "$WEB" nginx -t 2> /dev/null && break
    [ "$attempt" -lt 5 ] || die "nginx -t failed in $WEB"
    sleep 2
  done
  docker exec "$WEB" nginx -s reload || die "nginx reload failed in $WEB"
}

wait_healthy() {
  local timeout="$1" deadline db api web restarting count1 count2
  deadline=$(($(date +%s) + timeout))
  while :; do
    db=$(container_state "$DB")
    api=$(container_state "$API")
    web=$(container_state "$WEB")
    restarting=$(docker inspect -f '{{.State.Restarting}}' "$API" 2> /dev/null || echo true)
    # The api and web services have no healthcheck; running is the best they
    # report. The probes in site-check are the real test.
    if [ "$db" = healthy ] && [ "$api" = running ] && [ "$web" = running ] && [ "$restarting" = false ]; then
      count1=$(docker inspect -f '{{.RestartCount}}' "$API" 2> /dev/null || echo x)
      sleep 10
      count2=$(docker inspect -f '{{.RestartCount}}' "$API" 2> /dev/null || echo y)
      if [ "$count1" = "$count2" ] && [ "$(container_state "$API")" = running ]; then
        echo "db healthy, api and web running (api restart count stable at $count2)"
        print_states
        return 0
      fi
      echo "api restarted while waiting (restart count $count1 -> $count2)"
    fi
    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "containers not ready after ${timeout}s:"
      print_states
      return 1
    fi
    sleep 10
  done
}

probe() {
  # probe <method> <url> <want-code> <tries> [extra curl args...]
  # Prints "<code> <bytes> <content-type>" of the last attempt, retrying every
  # 5 seconds until the wanted code appears.
  local method="$1" url="$2" want="$3" tries="$4" out="" code i
  local -a extra=()
  shift 4
  [ "$method" = POST ] && extra=(-d '')
  for ((i = 0; i < tries; i++)); do
    out=$(curl -s -o /dev/null -X "$method" "${extra[@]}" -w '%{http_code} %{size_download} %{content_type}' --max-time 10 "$@" "$url" || true)
    code="${out%% *}"
    [ "$code" = "$want" ] && break
    sleep 5
  done
  echo "$out"
}

site_check() {
  # All on this host, so neither DNS nor the public certificate can fail or
  # pass a deploy on its own. There is no /health endpoint: /health falls
  # through to the SPA and returns 200 even with the api down, so the api is
  # proven by two unauthenticated auth routes that touch no user data.
  local out code size ctype n
  command -v curl > /dev/null || die "curl is not installed on the server"

  out=$(probe GET "$LOCAL_URL/" 200 12)
  read -r code size ctype <<< "$out" || true
  echo "GET $LOCAL_URL/ (web) -> ${code:-none}"
  [ "${code:-}" = 200 ] || return 1

  # With no cookie this clears nothing and answers 204 with an empty body.
  # 200 or 405 would mean the request fell through to the SPA, and 502/504
  # mean the api is down.
  out=$(probe POST "$LOCAL_URL/api/auth/logout" 204 36)
  read -r code size ctype <<< "$out" || true
  echo "POST $LOCAL_URL/api/auth/logout -> ${code:-none} (body bytes: ${size:-?})"
  [ "${code:-}" = 204 ] && [ "${size:-}" = 0 ] || return 1

  # With no cookie: 401 with a JSON body, proof that the auth pipeline runs.
  out=$(probe POST "$LOCAL_URL/api/auth/refresh" 401 12)
  read -r code size ctype <<< "$out" || true
  echo "POST $LOCAL_URL/api/auth/refresh -> ${code:-none} (${ctype:-no content type})"
  [ "${code:-}" = 401 ] && [[ ${ctype:-} == *json* ]] || return 1

  out=$(probe GET "https://$SITE_HOST/" 200 12 -k --resolve "$SITE_HOST:443:127.0.0.1")
  read -r code size ctype <<< "$out" || true
  echo "GET https://$SITE_HOST/ (host nginx, loopback) -> ${code:-none}"
  [ "${code:-}" = 200 ] || return 1

  n=$(docker logs --tail 300 "$API" 2>&1 | grep -ciE 'application startup exception|terminated unexpectedly' || true)
  echo "startup exceptions in the api log: ${n:-0}"
  [ "${n:-0}" -eq 0 ] || return 1
}

cert_expiry() {
  # Reads the certificate the host nginx serves; no access to certbot's files.
  local end days=unknown
  if end=$(echo | openssl s_client -connect 127.0.0.1:443 -servername "$SITE_HOST" 2> /dev/null \
    | openssl x509 -noout -enddate 2> /dev/null); then
    end=${end#notAfter=}
    days=$((($(date -d "$end" +%s) - $(date +%s)) / 86400))
    echo "certificate for $SITE_HOST expires $end ($days days left)"
  else
    echo "could not read the certificate served for $SITE_HOST"
  fi
  emit CERT_DAYS "$days"
}

record() {
  local prev="$1" new="$2" before="$3" after="$4"
  [[ $prev =~ $SHA_RE ]] || [ "$prev" = none ] || die "bad previous SHA"
  [[ $new =~ $SHA_RE ]] || die "bad new SHA"
  [[ $before =~ $MIG_RE ]] || [ "$before" = unknown ] || die "bad migrations-before value"
  [[ $after =~ $MIG_RE ]] || [ "$after" = unknown ] || die "bad migrations-after value"
  require_lock
  cd "$DEPLOY_PATH"
  write_atomic .deployed-sha "$new"
  printf '%s\t%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$prev" "$new" "$before" "$after" \
    >> .deploy-history
  echo "recorded $new in $DEPLOY_PATH/.deployed-sha"
}

filtered_logs() {
  # This repository is public: drop credential-like lines and mask emails.
  { docker logs --tail "$2" "$1" 2>&1 || true; } \
    | { grep -vE "$SECRET_LOG_FILTER" || true; } \
    | sed -E 's/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/<email>/g'
}

diagnose() {
  echo "== containers"
  print_ps || true
  echo "== health"
  print_states
  echo "== $WEB logs (last 30, filtered)"
  filtered_logs "$WEB" 30
  echo "== $API logs (last 60, filtered)"
  filtered_logs "$API" 60
}

usage() {
  [ "$1" -eq "$2" ] || die "usage: $3"
}

action="${1:-}"
case "$action" in
  preflight)
    usage $# 2 "preflight <true|false>"
    [ "$2" = true ] || [ "$2" = false ] || die "bootstrap must be true or false"
    preflight "$2"
    ;;
  dump) usage $# 1 dump; dump ;;
  rowcounts) usage $# 2 "rowcounts <before|after>"; rowcounts "$2" ;;
  rowcount-compare) usage $# 1 rowcount-compare; rowcount_compare ;;
  snapshot) usage $# 1 snapshot; snapshot ;;
  prune) usage $# 2 "prune <base64-list>"; prune "$2" ;;
  shipped-sha) usage $# 1 shipped-sha; shipped_sha ;;
  mark-shipped) usage $# 2 "mark-shipped <sha>"; mark_shipped "$2" ;;
  apply) usage $# 1 apply; apply ;;
  wait-healthy)
    usage $# 2 "wait-healthy <seconds>"
    [[ $2 =~ ^[0-9]+$ ]] || die "seconds must be a number"
    wait_healthy "$2"
    ;;
  site-check) usage $# 1 site-check; site_check ;;
  cert-expiry) usage $# 1 cert-expiry; cert_expiry ;;
  migrations) usage $# 1 migrations; emit MIGRATIONS "$(migration_state)" ;;
  record)
    usage $# 5 "record <prev> <new> <migrations-before> <migrations-after>"
    record "$2" "$3" "$4" "$5"
    ;;
  diagnose) usage $# 1 diagnose; diagnose ;;
  *) die "unknown action '${action}'" ;;
esac
