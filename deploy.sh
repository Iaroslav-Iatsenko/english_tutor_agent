#!/usr/bin/env bash
# Usage: ./deploy.sh
# Requires: aws CLI configured, docker, jq
set -euo pipefail

REGION=$(aws configure get region)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_BASE="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "Account: ${ACCOUNT_ID}  Region: ${REGION}"

# ── Authenticate Docker to ECR ───────────────────────────────────────────────
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$ECR_BASE"

# ── Build & push images ──────────────────────────────────────────────────────
docker build -f Dockerfile.backend -t english-tutor-backend .
docker build -f Dockerfile.frontend -t english-tutor-frontend .

docker tag english-tutor-backend:latest "${ECR_BASE}/english-tutor-backend:latest"
docker tag english-tutor-frontend:latest "${ECR_BASE}/english-tutor-frontend:latest"

docker push "${ECR_BASE}/english-tutor-backend:latest"
docker push "${ECR_BASE}/english-tutor-frontend:latest"

# ── Register ECS task definition ─────────────────────────────────────────────
sed \
  -e "s|__ACCOUNT_ID__|${ACCOUNT_ID}|g" \
  -e "s|__REGION__|${REGION}|g" \
  ecs-task-definition.json > /tmp/ecs-task-resolved.json

aws ecs register-task-definition \
  --cli-input-json file:///tmp/ecs-task-resolved.json \
  --region "$REGION"

echo "Done. Task definition registered."
