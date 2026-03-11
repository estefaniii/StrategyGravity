#!/bin/bash
export SG_MODE=web
exec node node_modules/.bin/tsx src/index.ts --web
