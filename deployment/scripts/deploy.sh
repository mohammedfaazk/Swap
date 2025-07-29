#!/bin/bash
set -e

echo "Deploying StellarBridge Fusion+ to Kubernetes..."

kubectl apply -f ../kubernetes/namespace.yaml
kubectl apply -f ../kubernetes/database-deployment.yaml
kubectl apply -f ../kubernetes/relayer-deployment.yaml
kubectl apply -f ../kubernetes/frontend-deployment.yaml
kubectl apply -f ../kubernetes/ingress.yaml

echo "Deployment complete."
