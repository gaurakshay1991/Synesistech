#!/bin/bash
set -e

echo "🚀 SYNESIS Platform - Quick Start"
echo "=================================="

echo "✓ Checking Node.js version..."
node -v

if [ ! -f .env ]; then
    echo "✓ Creating .env from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration"
fi

echo "✓ Installing dependencies..."
npm install --legacy-peer-deps

echo "✓ Running database migrations..."
npm run db:migrate || echo "Note: Database setup required"

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Starting SYNESIS Platform..."
echo "   Frontend: http://localhost:5173"
echo "   API: http://localhost:3000"
echo ""

npm run dev
