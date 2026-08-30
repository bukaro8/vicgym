#!/bin/sh
set -eu

npm run db:migrate:deploy
npm run db:seed
exec node server.js
