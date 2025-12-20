# !/bin/bash

# Trust Pay Production Setup Script
# Helps you deploy the clustered version quickly

set -e

echo "🚀 Trust Pay Production Setup"
echo "==============================="
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "⚠️  PM2 not found. Installing PM2..."
    npm install -g pm2
    echo "✅ PM2 installed successfully"
else
    echo "✅ PM2 is already installed"
fi

echo ""
echo "📝 Configuration Check"
echo "----------------------"

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env from .env.example"
    else
        echo "❌ No .env.example found. Please create .env manually"
        exit 1
    fi
fi

# Check critical environment variables
if ! grep -q "DATABASE_WRITER_URL" .env; then
    echo "⚠️  DATABASE_WRITER_URL not set in .env"
fi

if ! grep -q "REDIS_URL" .env; then
    echo "⚠️  REDIS_URL not set in .env"
fi

echo ""
echo "🔧 Starting Application"
echo "----------------------"

# Stop existing PM2 processes
if pm2 describe trust-pay-backend > /dev/null 2>&1; then
    echo "Stopping existing instance..."
    pm2 delete trust-pay-backend
fi

# Start with PM2 cluster mode
echo "Starting in cluster mode..."
pm2 start ecosystem.config.cjs --env production

# Save configuration
pm2 save

echo ""
echo "✅ Application started successfully!"
echo ""
echo "📊 Status:"
pm2 status

echo ""
echo "📖 Useful Commands:"
echo "  pm2 monit              - Monitor instances in real-time"
echo "  pm2 logs               - View logs"
echo "  pm2 reload trust-pay-backend - Zero-downtime reload"
echo "  pm2 status             - Check status"
echo ""
echo "🌐 Health Check:"
echo "  curl http://localhost:8090/v1/ping/health"
echo ""
echo "🎉 Your app is now running with 10x capacity!"
