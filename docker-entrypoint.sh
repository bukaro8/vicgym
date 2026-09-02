#!/bin/sh
set -eu

echo "VicGym startup: applying database migrations"
npm run db:migrate:deploy

echo "VicGym startup: seeding the verified catalogue"
npm run db:seed

if [ "$#" -eq 0 ]; then
  set -- node .next/standalone/server.js
fi

echo "VicGym startup: launching $*"
exec "$@"
