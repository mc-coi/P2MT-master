#!/bin/sh
# Sync, then run every suite and the static checks. Exits non-zero on any failure.
set -e
cd "$(dirname "$0")"
./sync.sh
status=0
for f in *_test.mjs; do
  printf '%-24s ' "$f"
  out=$(node "$f" 2>&1) || status=1
  pass=$(printf '%s' "$out" | grep -c '^PASS' || true)
  fail=$(printf '%s' "$out" | grep -c '^FAIL' || true)
  printf '%s pass, %s fail\n' "$pass" "$fail"
  if [ "$fail" -ne 0 ]; then status=1; printf '%s\n' "$out" | grep '^FAIL'; fi
done
python3 ../extract.py || status=1
exit $status
