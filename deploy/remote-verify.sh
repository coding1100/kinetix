#!/usr/bin/env bash
python3 -c "import json; open('/tmp/login.json','w').write(json.dumps({'email':'owner@demo.com','password':'password123'}))"
echo "=== health ==="
curl -s http://127.0.0.1/health
echo
echo "=== login local ==="
curl -s -w "\nHTTP=%{http_code}\n" -X POST http://127.0.0.1/api/v1/auth/login -H "Content-Type: application/json" --data-binary @/tmp/login.json
echo "=== login public ==="
curl -s -w "\nHTTP=%{http_code}\n" -X POST http://3.140.5.67/api/v1/auth/login -H "Content-Type: application/json" --data-binary @/tmp/login.json
echo "=== docker ps ==="
docker ps --format 'table {{.Names}}\t{{.Status}}'
