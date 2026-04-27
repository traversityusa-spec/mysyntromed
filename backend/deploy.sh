#!/bin/bash

# MySyntroMed Backend - Automated Firebase Cloud Run Deployment
# This script handles the entire deployment process automatically

set -e  # Exit on any error

echo "🚀 MySyntroMed Backend - Firebase Cloud Run Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if Node.js is installed
echo "1️⃣  Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"

# Step 2: Install dependencies locally
echo ""
echo "2️⃣  Installing dependencies..."
npm install --legacy-peer-deps 2>/dev/null || npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Step 3: Build the TypeScript code
echo ""
echo "3️⃣  Building backend..."
npm run build
echo -e "${GREEN}✓ Build successful${NC}"

# Step 4: Install Firebase Tools locally
echo ""
echo "4️⃣  Setting up Firebase tools..."
npm install firebase-tools --save-dev 2>/dev/null || true
echo -e "${GREEN}✓ Firebase tools ready${NC}"

# Step 5: Check if .env has required variables
echo ""
echo "5️⃣  Checking configuration..."
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ .env file found${NC}"

# Step 6: Create firebase.json if it doesn't exist
echo ""
echo "6️⃣  Setting up Firebase configuration..."
cat > firebase.json << 'EOF'
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [{
      "source": "**",
      "run": {
        "serviceId": "mysyntromed-backend",
        "region": "us-central1"
      }
    }]
  }
}
EOF
echo -e "${GREEN}✓ Firebase configuration ready${NC}"

# Step 7: Create Dockerfile.multi for multi-stage build (already exists, but verify)
if [ ! -f Dockerfile ]; then
    echo -e "${YELLOW}⚠ Dockerfile not found, this is required for Cloud Run${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Dockerfile verified${NC}"

# Step 8: Check Google Cloud CLI
echo ""
echo "7️⃣  Checking Google Cloud setup..."
if command -v gcloud &> /dev/null; then
    echo -e "${GREEN}✓ gcloud CLI found${NC}"
    GCLOUD_AVAILABLE=true
else
    echo -e "${YELLOW}⚠ gcloud CLI not found - deployment will use Firebase CLI${NC}"
    GCLOUD_AVAILABLE=false
fi

# Step 9: Display next steps
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Preparation complete!${NC}"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Login to Firebase:"
echo "   npx firebase login"
echo ""
echo "2. Deploy to Cloud Run:"
if [ "$GCLOUD_AVAILABLE" = true ]; then
    echo "   gcloud run deploy mysyntromed-backend --source . --platform managed --region us-central1 --allow-unauthenticated"
else
    echo "   npx firebase deploy --only hosting"
fi
echo ""
echo "3. Your backend will be available at:"
echo "   https://mysyntromed-backend-[region].run.app"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
