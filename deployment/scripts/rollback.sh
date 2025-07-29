#!/bin/bash
set -e

echo "Rolling back StellarBridge Fusion+ deployment..."

kubectl rollout undo deployment/stellarbridge-relayer -n stellarbridge
kubectl rollout undo deployment/stellarbridge-frontend -n stellarbridge

echo "Rollback complete."
