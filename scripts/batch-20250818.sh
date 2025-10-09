#!/bin/bash

set -ex

LOG_DIR=./batches/batch-20250818

run() {
  git checkout src/
  ./scripts/run-and-eval.ts "$1" --run-only --model google/gemini-2.5-flash --logs-dir "$LOG_DIR/$2"
  ./scripts/run-and-eval.ts "$1" --eval-only --model google/gemini-2.5-pro --logs-dir "$LOG_DIR/$2"
}

run_k() {
  local prompt=$1
  local base_dir=$2
  local k=$3
  
  for i in $(seq 1 $k); do
    local padded_num=$(printf "%02d" $i)
    run "$prompt" "$base_dir/$padded_num"
  done
}

run1() {
run_k 'Write a piece of code for visualizing a family tree' family-tree 3
run_k 'How many "r"s are in the word "strawberrrrry"? Make a cute little card!' straw-berry-card 3
run_k 'Write a fruit e-commerce website.' fruit-e-commerce 3
run_k 'Create a social networking website with a RedNote-style design.' rednote-style-social-network 3
}

run2() {
run_k 'Create a personal portfolio website.' personal-portfolio 3
run_k 'Design a weather application.' weather-app 3
run_k 'Build a simple blog.' simple-blog 3
run_k 'Create a to-do list application.' todo-list-app 3
run_k 'Develop a recipe book application.' recipe-book 3
run_k 'Design a music player UI.' music-player-ui 3
run_k 'Create a 3D model of a solar system.' solar-system-3d 3
run_k 'Visualize a DNA helix in 3D.' dna-helix-3d 3
run_k 'Create an interactive 3D product viewer.' product-viewer-3d 3
}

run3() {
run_k 'build a bottom navigation bar in style of glass with light breaking ans refraction' glass-nav 3
}


mkdir -p $LOG_DIR
# run1 &> $LOG_DIR/run-batch.log
# run2 &> $LOG_DIR/run-batch.log
run3 > $LOG_DIR/run-batch.log