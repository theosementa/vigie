#!/bin/sh
# Dev mode only: creates the database used by the pytest suite (first init of
# the volume only; the test fixtures also create it on demand).
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE vigie_test"
