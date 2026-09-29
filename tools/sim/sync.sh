#!/bin/sh
# The suites import the REAL modules, with only js/db.js swapped for the
# Firestore stub in this directory. Copying rather than importing across
# directories is what makes that swap possible: js/tmiEngine.js does
# `import … from './db.js'`, which has to resolve to the stub.
#
# Run this after changing anything in js/, before running the suites.
set -e
cd "$(dirname "$0")"
cp ../../js/attendance.js ../../js/tmiEngine.js ../../js/data.js ../../js/utils.js .
echo "synced js/ modules into tools/sim/"
