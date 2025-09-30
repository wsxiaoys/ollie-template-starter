#!/bin/bash

export POCHI_LIVEKIT_NO_SYNC=1

pochi -p "$1" --model google/gemini-2.5-pro

bun dev & PID=$!

echo "Started dev server with PID: $PID"

killDevServer() {
  echo "Killing dev server"
  kill -9 $PID
  clear
}

trap killDevServer SIGINT SIGTERM

bun ollie -u http://localhost:3000 -d $PWD -q "$1" -- --model google/gemini-2.5-pro &> ollie.log

killDevServer

# Extract content after TaskCompleted
content=$(grep -A 1000000000 "Task Completed" ollie.log | tail -n +2)
echo $content