#!/bin/bash
set -e

REGISTRY="donutshop"
TAG="${1:-latest}"

echo "============================================"
echo "  Building & Pushing DonutShop Images"
echo "  Registry: docker.io/$REGISTRY"
echo "  Tag: $TAG"
echo "============================================"

# Backend
echo ""
echo ">>> Building backend..."
docker build -t $REGISTRY/donutshop-api:$TAG ./backend
echo ">>> Pushing backend..."
docker push $REGISTRY/donutshop-api:$TAG

# Frontend
echo ""
echo ">>> Building frontend..."
docker build -t $REGISTRY/donutshop-web:$TAG ./frontend
echo ">>> Pushing frontend..."
docker push $REGISTRY/donutshop-web:$TAG

echo ""
echo "============================================"
echo "  Done!"
echo "  Images pushed:"
echo "    $REGISTRY/donutshop-api:$TAG"
echo "    $REGISTRY/donutshop-web:$TAG"
echo "============================================"
