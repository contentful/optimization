#!/bin/bash

# Script to run e2e tests with all required services
# This script manages emulator, Metro bundler, Appium server, and test execution

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# PID tracking
EMULATOR_PID=""
METRO_PID=""
APPIUM_PID=""

# Cleanup function to kill all spawned processes
cleanup() {
    echo ""
    echo -e "${YELLOW}🧹 Cleaning up processes...${NC}"
    
    if [ -n "$APPIUM_PID" ]; then
        echo -e "${BLUE}Stopping Appium server (PID: $APPIUM_PID)${NC}"
        kill $APPIUM_PID 2>/dev/null || true
    fi
    
    if [ -n "$METRO_PID" ]; then
        echo -e "${BLUE}Stopping Metro bundler (PID: $METRO_PID)${NC}"
        kill $METRO_PID 2>/dev/null || true
    fi
    
    # Kill any remaining Appium processes
    pkill -f "appium.*--port 4723" 2>/dev/null || true
    
    # Kill any remaining Metro processes
    pkill -f "react-native.*start" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Set up trap to cleanup on exit
trap cleanup EXIT INT TERM

# Function to check if a port is in use
check_port() {
    local port=$1
    lsof -i :$port >/dev/null 2>&1
}

# Function to wait for a port to be available
wait_for_port() {
    local port=$1
    local service=$2
    local max_attempts=60
    local attempt=0
    
    echo -e "${BLUE}⏳ Waiting for $service on port $port...${NC}"
    
    while [ $attempt -lt $max_attempts ]; do
        if check_port $port; then
            echo -e "${GREEN}✅ $service is ready${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    
    echo -e "${RED}❌ Timeout waiting for $service${NC}"
    return 1
}

# Function to wait for Metro bundler to be ready
wait_for_metro() {
    local max_attempts=60
    local attempt=0
    
    echo -e "${BLUE}⏳ Waiting for Metro bundler to be ready...${NC}"
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:8081/status | grep -q "packager-status:running"; then
            echo -e "${GREEN}✅ Metro bundler is ready${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    
    echo -e "${RED}❌ Timeout waiting for Metro bundler${NC}"
    return 1
}

# Function to wait for emulator to be ready
wait_for_emulator() {
    local max_attempts=120
    local attempt=0
    
    echo -e "${BLUE}⏳ Waiting for emulator to boot...${NC}"
    
    while [ $attempt -lt $max_attempts ]; do
        local boot_completed=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
        if [ "$boot_completed" = "1" ]; then
            echo -e "${GREEN}✅ Emulator is ready${NC}"
            # Wait an additional 5 seconds for system to stabilize
            sleep 5
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    echo -e "${RED}❌ Timeout waiting for emulator to boot${NC}"
    return 1
}

echo -e "${GREEN}🚀 Starting e2e test environment${NC}"
echo ""

# Set up Node.js version using nvm
echo -e "${BLUE}Setting up Node.js version with nvm...${NC}"
source ~/.nvm/nvm.sh
cd "$(dirname "$0")/../../.."
nvm use
cd - > /dev/null

# Verify Node.js version
CURRENT_NODE_VERSION=$(node --version)
echo -e "${BLUE}Using Node version: $CURRENT_NODE_VERSION${NC}"

# Set JAVA_HOME - Use Java 17 for Gradle 8.x compatibility
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home
echo -e "${BLUE}Using JAVA_HOME: $JAVA_HOME${NC}"

# Step 1: Check if emulator is already running
echo ""
echo -e "${YELLOW}📱 Step 1: Checking Android Emulator${NC}"
if adb devices | grep -q "emulator.*device"; then
    echo -e "${GREEN}✅ Emulator already running${NC}"
else
    echo -e "${BLUE}Starting Android Emulator...${NC}"
    
    # Check if AVD exists
    if ! $ANDROID_HOME/emulator/emulator -list-avds | grep -q "Pixel_8_Pro_API_33"; then
        echo -e "${RED}❌ AVD 'Pixel_8_Pro_API_33' not found${NC}"
        echo -e "${YELLOW}Please create the AVD first or update the script with your AVD name${NC}"
        exit 1
    fi
    
    # Start emulator in background
    $ANDROID_HOME/emulator/emulator -avd Pixel_8_Pro_API_33 \
        -no-snapshot-save \
        -no-audio \
        -no-boot-anim \
        -gpu swiftshader_indirect \
        > /tmp/emulator.log 2>&1 &
    
    EMULATOR_PID=$!
    echo -e "${BLUE}Emulator started (PID: $EMULATOR_PID)${NC}"
    
    # Wait for emulator to be ready
    if ! wait_for_emulator; then
        echo -e "${RED}❌ Failed to start emulator${NC}"
        cat /tmp/emulator.log
        exit 1
    fi
fi

# Step 2: Ensure dependencies are installed
echo ""
echo -e "${YELLOW}📦 Step 2: Installing dependencies${NC}"
cd "$(dirname "$0")/.."

# This project is excluded from pnpm workspace, so we use npm
echo -e "${BLUE}Note: This project uses npm (excluded from pnpm workspace)${NC}"

# Clean node_modules if gradle.properties is missing
if [ ! -f "node_modules/react-native/ReactAndroid/gradle.properties" ]; then
    echo -e "${BLUE}React Native files missing, cleaning and reinstalling...${NC}"
    rm -rf node_modules
    rm -f package-lock.json
fi

if npm install --legacy-peer-deps; then
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${RED}❌ Dependency installation failed${NC}"
    exit 1
fi

# Verify react-native is properly installed
if [ ! -f "node_modules/react-native/ReactAndroid/gradle.properties" ]; then
    echo -e "${RED}❌ React Native Android files still missing after install${NC}"
    echo -e "${YELLOW}This is a critical error - React Native was not installed correctly${NC}"
    exit 1
fi

echo -e "${GREEN}✅ React Native properly installed${NC}"

# Step 3: Build the Android app
echo ""
echo -e "${YELLOW}🔨 Step 3: Building Android app${NC}"
if npm run android:build; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Step 4: Install the app on emulator
echo ""
echo -e "${YELLOW}📲 Step 4: Installing app on emulator${NC}"

# First, uninstall any existing version to avoid signature conflicts
echo -e "${BLUE}Checking for existing app installation...${NC}"
if adb shell pm list packages | grep -q "com.contentfuloptimizationrn"; then
    echo -e "${BLUE}Uninstalling existing app...${NC}"
    if adb uninstall com.contentfuloptimizationrn; then
        echo -e "${GREEN}✅ Existing app uninstalled${NC}"
    else
        echo -e "${YELLOW}⚠️  Failed to uninstall existing app, but continuing...${NC}"
    fi
else
    echo -e "${BLUE}No existing app found${NC}"
fi

# Install the fresh build
echo -e "${BLUE}Installing fresh build...${NC}"
if adb install android/app/build/outputs/apk/debug/app-debug.apk; then
    echo -e "${GREEN}✅ App installed${NC}"
else
    echo -e "${RED}❌ App installation failed${NC}"
    exit 1
fi

# Step 5: Start Metro bundler
echo ""
echo -e "${YELLOW}📦 Step 5: Starting Metro bundler${NC}"

# Kill any existing Metro processes
pkill -f "react-native.*start" 2>/dev/null || true
sleep 2

# Start Metro in background
npx react-native start --reset-cache > /tmp/metro.log 2>&1 &
METRO_PID=$!
echo -e "${BLUE}Metro bundler started (PID: $METRO_PID)${NC}"

# Wait for Metro to be ready
if ! wait_for_metro; then
    echo -e "${RED}❌ Failed to start Metro bundler${NC}"
    echo -e "${YELLOW}Metro log:${NC}"
    tail -50 /tmp/metro.log
    exit 1
fi

# Set up reverse port forwarding for Metro bundler
echo -e "${BLUE}Setting up port forwarding for Metro bundler...${NC}"
adb reverse tcp:8081 tcp:8081
adb reverse --list
echo -e "${GREEN}✅ Port forwarding configured${NC}"

# Verify Metro is accessible from host
echo -e "${BLUE}Verifying Metro status from host...${NC}"
if curl -s http://localhost:8081/status | grep -q "packager-status:running"; then
    echo -e "${GREEN}✅ Metro is running and accessible${NC}"
else
    echo -e "${RED}❌ Metro is not responding properly${NC}"
    exit 1
fi

# Launch the app to trigger initial bundle load
echo -e "${BLUE}Launching app to trigger Metro bundle...${NC}"
adb shell am start -n com.contentfuloptimizationrn/.MainActivity

# Wait for Metro to finish bundling
echo -e "${BLUE}Waiting for Metro to complete initial bundle...${NC}"
sleep 10

# Check Metro logs for errors
echo -e "${BLUE}Checking Metro bundler status...${NC}"
if tail -20 /tmp/metro.log | grep -q "BUNDLE_BUILD_DONE"; then
    echo -e "${GREEN}✅ Initial bundle loaded successfully${NC}"
elif tail -50 /tmp/metro.log | grep -q "error\|Error\|ERROR"; then
    echo -e "${RED}❌ Metro bundler encountered errors:${NC}"
    tail -50 /tmp/metro.log
    exit 1
else
    echo -e "${YELLOW}⚠️  Could not confirm bundle status, continuing...${NC}"
fi

# Step 6: Start Appium server
echo ""
echo -e "${YELLOW}🤖 Step 6: Starting Appium server${NC}"

# Kill any existing Appium processes
pkill -f "appium.*--port 4723" 2>/dev/null || true
lsof -ti :4723 | xargs kill -9 2>/dev/null || true
sleep 2

# Start Appium in background
./node_modules/.bin/appium \
    --base-path / \
    --address localhost \
    --port 4723 \
    --relaxed-security \
    > /tmp/appium.log 2>&1 &

APPIUM_PID=$!
echo -e "${BLUE}Appium server started (PID: $APPIUM_PID)${NC}"

# Wait for Appium to be ready
if ! wait_for_port 4723 "Appium server"; then
    echo -e "${RED}❌ Failed to start Appium server${NC}"
    echo -e "${YELLOW}Appium log:${NC}"
    tail -50 /tmp/appium.log
    exit 1
fi

# Give everything a moment to stabilize
echo ""
echo -e "${BLUE}⏳ Waiting for all services to stabilize...${NC}"
sleep 3

# Step 7: Run the tests
echo ""
echo -e "${YELLOW}🧪 Step 7: Running e2e tests${NC}"
echo ""

# Run tests and capture exit code
set +e
npm run test:e2e
TEST_EXIT_CODE=$?
set -e

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Tests passed!${NC}"
else
    echo -e "${RED}❌ Tests failed with exit code: $TEST_EXIT_CODE${NC}"
    echo ""
    echo -e "${YELLOW}Check logs for more details:${NC}"
    echo -e "${BLUE}  Metro: /tmp/metro.log${NC}"
    echo -e "${BLUE}  Appium: /tmp/appium.log${NC}"
    echo -e "${BLUE}  Emulator: /tmp/emulator.log${NC}"
fi

echo ""
echo -e "${YELLOW}Press Enter to cleanup and exit, or Ctrl+C to keep services running${NC}"
read -t 10 || true

exit $TEST_EXIT_CODE

