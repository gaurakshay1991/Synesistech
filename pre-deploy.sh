#!/bin/bash

# SYNESIS Platform - Production Deployment Checklist

echo "🚀 SYNESIS PRODUCTION DEPLOYMENT CHECKLIST"
echo "=========================================="
echo ""

# Configuration Check
echo "📋 CONFIGURATION CHECK"
echo "====================="

check_env() {
    if [ -z "$1" ]; then
        echo "  ❌ $2 not set"
        return 1
    else
        echo "  ✅ $2 is set"
        return 0
    fi
}

check_env "$DATABASE_URL" "DATABASE_URL"
check_env "$JWT_SECRET" "JWT_SECRET"
check_env "$DATA_ENCRYPTION_KEY" "DATA_ENCRYPTION_KEY"
check_env "$BOOTSTRAP_ADMIN_EMAIL" "BOOTSTRAP_ADMIN_EMAIL"
check_env "$BOOTSTRAP_ADMIN_PASSWORD" "BOOTSTRAP_ADMIN_PASSWORD"

echo ""
echo "🔒 SECURITY CHECK"
echo "================="

# Check JWT_SECRET length
if [ -n "$JWT_SECRET" ]; then
    jwt_len=${#JWT_SECRET}
    if [ $jwt_len -ge 32 ]; then
        echo "  ✅ JWT_SECRET is $jwt_len chars (min 32)"
    else
        echo "  ❌ JWT_SECRET is only $jwt_len chars (min 32 required)"
    fi
fi

# Check DATA_ENCRYPTION_KEY length
if [ -n "$DATA_ENCRYPTION_KEY" ]; then
    key_len=${#DATA_ENCRYPTION_KEY}
    if [ $key_len -ge 32 ]; then
        echo "  ✅ DATA_ENCRYPTION_KEY is $key_len chars (min 32)"
    else
        echo "  ❌ DATA_ENCRYPTION_KEY is only $key_len chars (min 32 required)"
    fi
fi

# Check if keys are different
if [ "$JWT_SECRET" = "$DATA_ENCRYPTION_KEY" ]; then
    echo "  ❌ JWT_SECRET and DATA_ENCRYPTION_KEY must be different"
else
    echo "  ✅ JWT_SECRET and DATA_ENCRYPTION_KEY are different"
fi

echo ""
echo "🗄️  DATABASE CHECK"
echo "=================="

# Check database connection
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
        echo "  ✅ Database connection successful"
    else
        echo "  ❌ Cannot connect to database"
        echo "     Check DATABASE_URL: $DATABASE_URL"
    fi
else
    echo "  ⚠️  psql not installed, skipping database check"
fi

echo ""
echo "📦 BUILD CHECK"
echo "=============="

# Check if frontend is built
if [ -d "client/dist" ]; then
    echo "  ✅ Frontend build exists (client/dist)"
else
    echo "  ⚠️  Frontend not built. Run: npm run build"
fi

echo ""
echo "🧪 TEST CHECK"
echo "============="

# Run tests
if npm run test > /dev/null 2>&1; then
    echo "  ✅ All tests passing"
else
    echo "  ⚠️  Some tests may be failing. Check logs."
fi

echo ""
echo "✅ DEPLOYMENT READY CHECKLIST"
echo "============================="
echo ""
echo "Before deploying to production, verify:"
echo ""
echo "[ ] Staging environment tested successfully"
echo "[ ] All environment variables configured"
echo "[ ] Database backups configured"
echo "[ ] SSL/TLS certificate is valid"
echo "[ ] Rate limiting configured"
echo "[ ] CORS origins whitelisted"
echo "[ ] Audit logging enabled"
echo "[ ] Monitoring and alerting configured"
echo "[ ] Incident response plan documented"
echo "[ ] Team trained on operations"
echo ""
echo "🚀 Ready to deploy! Use your platform's deployment tool:"
echo "   - Vercel: git push origin main"
echo "   - Render: Connect GitHub repo"
echo "   - Docker: docker build -t synesis . && docker run ..."
echo ""
