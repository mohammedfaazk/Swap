#!/bin/bash
set -e

echo "Checking health of StellarBridge services..."

kubectl get pods -n stellarbridge

echo "Checking relayer health endpoint..."
curl -f http://localhost:8080/health && echo "Relayer is healthy" || echo "Relayer health check failed"

echo "Checking frontend health endpoint..."
curl -f http://localhost:3000 || echo "Frontend health check failed"
