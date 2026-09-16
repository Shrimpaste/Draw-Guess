#!/bin/sh
# Run from an extracted release directory; retain results across SSH disconnects.
set -eu
trap 'printf "%s\n" "$?" > validation.exit' EXIT
npm ci --registry=https://registry.npmjs.org
npm test
npm run build
npm run test:load
