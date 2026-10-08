#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# DevBrawl - Local Development Startup Script
# ──────────────────────────────────────────────────────────────────────────────

set -e

echo "🚀 Starting DevBrawl locally..."

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker Desktop."
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose."
    exit 1
fi

# Check for .env files
if [ ! -f Backend/.env ]; then
    echo "📝 Creating Backend/.env from template..."
    cp Backend/.env.example Backend/.env
    echo "⚠️  Please edit Backend/.env with your API keys before continuing!"
    echo "   Required: GEMINI_API_KEY, MONGODB_URI, JWT_SECRET"
    read -p "Press Enter after editing .env to continue..."
fi

if [ ! -f Frontend/.env.local ]; then
    echo "📝 Creating Frontend/.env.local from template..."
    cp Frontend/.env.example Frontend/.env.local
fi

# Start services
echo "🐳 Starting Docker services (MongoDB + Piston)..."
docker compose up -d mongodb piston

# Wait for services
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check health
echo "🔍 Checking service health..."
if curl -sf http://localhost:2000/health > /dev/null; then
    echo "✅ Piston is ready"
else
    echo "⚠️  Piston not responding yet, continuing anyway..."
fi

# Start backend in background
echo "🔧 Starting Backend..."
cd Backend
npm install
npm run dev &
BACKEND_PID=$!
cd ..

# Start frontend in background
echo "🎨 Starting Frontend..."
cd Frontend
npm install
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ DevBrawl is running!"
echo ""
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend API: http://localhost:8000"
echo "⚙️  Piston API: http://localhost:2000"
echo "🍃 MongoDB: mongodb://localhost:27017"
echo ""
echo "Press Ctrl+C to stop all services"

# Trap cleanup
trap "echo '🛑 Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker compose down; exit 0" INT TERM

# Wait for background processes
wait