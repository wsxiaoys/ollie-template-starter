#!/bin/bash

PROMPT="$1"

if [ -z "$PROMPT" ]; then
  echo "Usage: $0 <prompt>"
  exit 1
fi

run() {
pochi -p "$PROMPT" --model google/gemini-2.5-pro
}

eval() {
bun dev &> logs/dev.log &
bun ollie -u http://localhost:3000 -d $PWD -q "$PROMPT" -- --model google/gemini-2.5-pro --stream-json > logs/ollie.log
tail -n 1 logs/ollie.log | jq '.parts[] | select(.type == "tool-attemptCompletion") | .input.result' -r | jq
}

killDevServer() {
  pkill -P $$
}

trap killDevServer SIGINT SIGTERM EXIT

run
eval