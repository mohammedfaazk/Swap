#!/bin/bash
set -e

echo "Running test suite (unit, integration, e2e, performance)..."

pnpm test

echo "All tests completed."
