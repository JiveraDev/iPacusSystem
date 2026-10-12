#!/bin/sh

set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
PHP_COMMAND=${PHP_COMMAND:-php}
RUNS_PER_MINUTE=${MAIL_WORKER_RUNS_PER_MINUTE:-5}
INTERVAL_SECONDS=${MAIL_WORKER_INTERVAL_SECONDS:-10}
LOCK_FILE=${MAIL_WORKER_LOCK_FILE:-"/tmp/ipawcus-mail-worker-${USER:-site}.lock"}
LOCK_DIR="${LOCK_FILE}.d"

run_worker_loop() {
    run_number=1
    while [ "$run_number" -le "$RUNS_PER_MINUTE" ]; do
        "$PHP_COMMAND" "$PROJECT_ROOT/php/mail_queue_worker.php" --quiet
        run_number=$((run_number + 1))

        if [ "$run_number" -le "$RUNS_PER_MINUTE" ]; then
            sleep "$INTERVAL_SECONDS"
        fi
    done
}

if command -v flock >/dev/null 2>&1; then
    (
        flock -n 9 || exit 0
        run_worker_loop
    ) 9>"$LOCK_FILE"
else
    if ! mkdir "$LOCK_DIR" 2>/dev/null; then
        existing_pid=''
        if [ -f "$LOCK_DIR/pid" ]; then
            existing_pid=$(sed -n '1p' "$LOCK_DIR/pid" 2>/dev/null || true)
        fi

        if [ -n "$existing_pid" ] && kill -0 "$existing_pid" 2>/dev/null; then
            exit 0
        fi

        rm -f "$LOCK_DIR/pid"
        rmdir "$LOCK_DIR" 2>/dev/null || exit 0
        mkdir "$LOCK_DIR" 2>/dev/null || exit 0
    fi

    printf '%s\n' "$$" >"$LOCK_DIR/pid"
    trap 'rm -f "$LOCK_DIR/pid"; rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT INT TERM
    run_worker_loop
fi
