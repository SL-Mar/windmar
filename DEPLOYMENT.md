# WINDMAR Deployment Guide

Production deployment guide for the WINDMAR Maritime Route Optimizer.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start with Docker Compose](#quick-start-with-docker-compose)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Authentication Setup](#authentication-setup)
- [Production Deployment](#production-deployment)
- [Monitoring and Logging](#monitoring-and-logging)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker 24.0+ and Docker Compose 2.0+
- OR: Python 3.11+, Node.js 20+, PostgreSQL 16+, Redis 7+
- 4GB+ RAM
- 10GB+ disk space

## Quick Start with Docker Compose

### 1. Clone and Configure

```bash
git clone https://github.com/yourusername/windmar.git
cd windmar

# Copy environment template
cp .env.example .env
```

### 2. Update Environment Variables

Edit `.env` file with your configuration:

```bash
# CRITICAL: Change these in production!
DB_PASSWORD=your_secure_database_password_here
REDIS_PASSWORD=your_secure_redis_password_here
API_SECRET_KEY=your_long_random_string_here
```

Generate a secure API secret key:
```bash
openssl rand -hex 32
```

### 3. Start Services

```bash
# Start all services
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f api
```

### 4. Create Initial API Key

```bash
# Access the API container
docker-compose exec api python

# In Python shell:
from api.database import get_db_context
from api.auth import create_api_key_in_db

with get_db_context() as db:
    key, obj = create_api_key_in_db(
        db,
        name="Production Key",
        rate_limit=1000
    )
    print(f"API Key: {key}")
    print(f"Save this key securely - it won't be shown again!")
```

### 5. Access Services

- **API Documentation**: http://localhost:8000/api/docs
- **Frontend**: http://localhost:3000
- **API Health Check**: http://localhost:8000/api/health

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname
DB_USER=windmar
DB_PASSWORD=<secure-password>
DB_NAME=windmar
DB_HOST=db
DB_PORT=5432

# Redis
REDIS_URL=redis://:password@host:6379/0
REDIS_PASSWORD=<secure-password>

# API Security
API_SECRET_KEY=<generated-secret-key>
API_KEY_HEADER=X-API-Key

# CORS (comma-separated origins)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Application
ENVIRONMENT=production
LOG_LEVEL=info
AUTH_ENABLED=true
RATE_LIMIT_ENABLED=true
```

### Optional Configuration

```bash
# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=1000

# Workers
WORKERS=4

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
METRICS_ENABLED=true
```

## Database Setup

### Using Alembic Migrations

```bash
# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Create new migration (after model changes)
alembic revision --autogenerate -m "description"

# Rollback one migration
alembic downgrade -1
```

### Manual Database Initialization

```bash
# Using Docker
docker-compose exec db psql -U windmar -d windmar

# Run initialization script
\i /docker-entrypoint-initdb.d/init.sql
```

### Database Backup

```bash
# Backup
docker-compose exec db pg_dump -U windmar windmar > backup_$(date +%Y%m%d).sql

# Restore
docker-compose exec -T db psql -U windmar windmar < backup_20260115.sql
```

## Authentication Setup

### API Key Management

**Create API Key:**

```python
from api.database import get_db_context
from api.auth import create_api_key_in_db

with get_db_context() as db:
    key, obj = create_api_key_in_db(
        db,
        name="Client Name",
        rate_limit=1000,  # requests per hour
        expires_at=None,  # or datetime object
        metadata={"client": "acme-corp"}
    )
    print(f"New API Key: {key}")
```

**Revoke API Key:**

```python
from api.database import get_db_context
from api.auth import revoke_api_key

with get_db_context() as db:
    revoke_api_key(db, "key-uuid-here")
```

**Using API Keys:**

```bash
# cURL example
curl -H "X-API-Key: your_api_key_here" \
     http://localhost:8000/api/vessels

# JavaScript example
fetch('http://localhost:8000/api/vessels', {
  headers: {
    'X-API-Key': 'your_api_key_here'
  }
})
```

### Disable Authentication (Development Only)

```bash
# In .env file
AUTH_ENABLED=false
```

## Production Deployment

### 1. AWS Deployment (Example)

**Using ECS with Docker:**

```bash
# Build and push images
docker build -t windmar-api:latest .
docker tag windmar-api:latest your-registry/windmar-api:latest
docker push your-registry/windmar-api:latest

# Similar for frontend
cd frontend
docker build -t windmar-frontend:latest .
docker tag windmar-frontend:latest your-registry/windmar-frontend:latest
docker push your-registry/windmar-frontend:latest
```

**Using RDS and ElastiCache:**

Update `.env`:
```bash
DATABASE_URL=postgresql://user:pass@your-rds-endpoint:5432/windmar
REDIS_URL=redis://your-elasticache-endpoint:6379/0
```

### 2. Kubernetes Deployment

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: windmar-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: windmar-api
  template:
    metadata:
      labels:
        app: windmar-api
    spec:
      containers:
      - name: api
        image: your-registry/windmar-api:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: windmar-secrets
              key: database-url
        # ... other env vars
```

### 3. Health Checks

Configure load balancer health checks:

- **Path**: `/api/health`
- **Expected Status**: 200
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Healthy Threshold**: 2
- **Unhealthy Threshold**: 3

### 4. SSL/TLS Configuration

Use a reverse proxy (nginx, Traefik, AWS ALB):

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring and Logging

### Application Logs

```bash
# Docker Compose
docker-compose logs -f api
docker-compose logs -f frontend

# Kubernetes
kubectl logs -f deployment/windmar-api

# Local filesystem
tail -f logs/windmar.log
```

### Log Levels

Set via environment variable:
```bash
LOG_LEVEL=debug   # Verbose logging
LOG_LEVEL=info    # Standard logging (default)
LOG_LEVEL=warning # Warnings and errors only
LOG_LEVEL=error   # Errors only
```

### Metrics Endpoint

Enable metrics:
```bash
METRICS_ENABLED=true
```

Access Prometheus-compatible metrics:
```
GET /api/metrics
```

### Error Tracking with Sentry

Configure Sentry DSN:
```bash
SENTRY_DSN=https://your-sentry-dsn-here
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs api
docker-compose logs db

# Check environment variables
docker-compose exec api env | grep DATABASE

# Test database connection
docker-compose exec api python -c "from api.database import engine; print(engine.connect())"
```

### Database Connection Errors

```bash
# Verify PostgreSQL is running
docker-compose ps db

# Test connection manually
docker-compose exec db psql -U windmar -d windmar

# Check network
docker-compose exec api ping db
```

### Authentication Issues

```bash
# Verify API key exists
docker-compose exec api python
>>> from api.database import get_db_context
>>> from api.models import APIKey
>>> with get_db_context() as db:
...     keys = db.query(APIKey).filter(APIKey.is_active == True).all()
...     print([k.name for k in keys])

# Temporarily disable auth for testing
# In .env:
AUTH_ENABLED=false
```

### Rate Limiting Issues

```bash
# Check Redis connection
docker-compose exec redis redis-cli ping

# Temporarily disable rate limiting
# In .env:
RATE_LIMIT_ENABLED=false

# Check current limits
curl http://localhost:8000/api/rate-limit-status
```

### Performance Issues

```bash
# Increase workers
WORKERS=8

# Enable caching
CACHE_ENABLED=true
CACHE_TTL=3600

# Check resource usage
docker stats
```

### Frontend Not Connecting to API

```bash
# Check API URL in frontend
docker-compose exec frontend env | grep NEXT_PUBLIC_API_URL

# Verify CORS settings
# In .env:
CORS_ORIGINS=https://frontend-domain.com

# Check browser console for CORS errors
```

## Security Checklist

Before production deployment:

- [ ] Change all default passwords
- [ ] Generate new API_SECRET_KEY
- [ ] Enable authentication (AUTH_ENABLED=true)
- [ ] Enable rate limiting (RATE_LIMIT_ENABLED=true)
- [ ] Configure proper CORS origins (remove localhost)
- [ ] Set up SSL/TLS certificates
- [ ] Enable firewall rules
- [ ] Set up database backups
- [ ] Configure error tracking (Sentry)
- [ ] Review and restrict API key permissions
- [ ] Set up monitoring and alerts
- [ ] Enable audit logging
- [ ] Review environment variables for sensitive data
- [ ] Use secrets management (AWS Secrets Manager, etc.)

## Scaling

### Horizontal Scaling

```bash
# Docker Compose
docker-compose up --scale api=3

# Kubernetes
kubectl scale deployment windmar-api --replicas=5
```

### Database Connection Pooling

Configure in `api/database.py`:
```python
engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=40
)
```

### Caching Strategy

Enable Redis caching:
```bash
CACHE_ENABLED=true
CACHE_TTL=3600  # 1 hour
```

## Maintenance

### Regular Tasks

1. **Database Backups**: Daily automated backups
2. **Log Rotation**: Configure log rotation to prevent disk fill
3. **Dependency Updates**: Monthly security updates
4. **API Key Rotation**: Quarterly key rotation
5. **Certificate Renewal**: Automated with Let's Encrypt

### Update Procedure

```bash
# 1. Backup database
docker-compose exec db pg_dump -U windmar windmar > backup.sql

# 2. Pull latest code
git pull origin main

# 3. Rebuild images
docker-compose build

# 4. Run migrations
docker-compose exec api alembic upgrade head

# 5. Restart services
docker-compose up -d

# 6. Verify health
curl http://localhost:8000/api/health
```

## Support

For issues and questions:

- GitHub Issues: https://github.com/yourusername/windmar/issues
- Documentation: https://windmar.readthedocs.io
- Email: support@yourdomain.com
