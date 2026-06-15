#!/usr/bin/env bash
# scripts/parallel_debug.sh - Isolated hypothesis testing script
set -euo pipefail

COMMAND=$1
HYPO_ID=$2
TEST_CMD=$3

BRANCH_NAME="debug/hypo-${HYPO_ID}"

case "$COMMAND" in
    "start")
        echo "Creating isolated branch: $BRANCH_NAME"
        git checkout -b "$BRANCH_NAME"
        ;;
    "verify")
        echo "Running test in $BRANCH_NAME: $TEST_CMD"
        if eval "$TEST_CMD"; then
            echo "RESULT: SUCCESS"
        else
            echo "RESULT: FAILURE"
            exit 1
        fi
        ;;
    "cleanup")
        echo "Cleaning up $BRANCH_NAME"
        git checkout -
        git branch -D "$BRANCH_NAME"
        ;;
    *)
        echo "Usage: $0 {start|verify|cleanup} <hypo_id> <test_cmd>"
        exit 1
        ;;
esac
