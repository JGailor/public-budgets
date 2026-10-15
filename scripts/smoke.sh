#!/usr/bin/env bash
# Checks a deployed site answers the way the routing promises.
# Usage: scripts/smoke.sh https://pr-3-wherethemoneywent.example.workers.dev
set -euo pipefail

base=${1:?usage: smoke.sh <base-url>}
base=${base%/}
fail=0

expect() {
  local want=$1 path=$2 got
  got=$(curl -sS -o /dev/null -w '%{http_code}' -L --max-time 20 "$base$path")
  if [[ $got == "$want" ]]; then
    echo "ok   $got $path"
  else
    echo "FAIL $path: expected $want, got $got"
    fail=1
  fi
}

expect 200 /
expect 200 /us/ca/berkeley/
expect 200 /us/ca/berkeley
expect 200 /us/ca/berkeley/gap/
expect 200 /us/ca/berkeley/departments/
expect 200 /us/ca/berkeley/sources/
expect 404 /us/ca/nowhere/
expect 404 /us/ca/nowhere
expect 404 /us/ca/berkeley/no-such-page/

# The 404 must be our page, not a platform default.
if curl -sS --max-time 20 "$base/us/ca/nowhere/" | grep -q 'Page not found'; then
  echo "ok   404 body is ours"
else
  echo "FAIL 404 body is not dist/404.html"
  fail=1
fi

# On the production domain, www must 301 to the apex with the path intact.
if [[ $base == https://wherethemoneywent.com ]]; then
  loc=$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 "https://www.wherethemoneywent.com/us/ca/berkeley/")
  if [[ $loc == "301 https://wherethemoneywent.com/us/ca/berkeley/" ]]; then
    echo "ok   www redirects to apex"
  else
    echo "FAIL www: expected '301 https://wherethemoneywent.com/us/ca/berkeley/', got '$loc'"
    fail=1
  fi
fi

exit $fail
