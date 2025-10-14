#!/bin/bash

# React Native Android Full Startup Script
# This script starts Metro and builds/runs the Android app in one command

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up background processes..."
    if [ ! -z "$METRO_PID" ]; then
        kill $METRO_PID 2>/dev/null || true
        log_info "Stopped Metro bundler"
    fi
}

# Set trap for cleanup on exit
trap cleanup EXIT INT TERM

# Navigate to script directory
cd "$(dirname "$0")"

log_info "Starting React Native Android development..."
echo ""

# Step 1: Set up Node.js
log_info "Step 1/7: Setting up Node.js environment..."
if [ -f ~/.nvm/nvm.sh ]; then
    source ~/.nvm/nvm.sh
    if [ -f ../../.nvmrc ]; then
        nvm use
        log_success "Node.js $(node --version) activated"
    else
        log_warning "No .nvmrc found, using current Node version: $(node --version)"
    fi
else
    log_warning "NVM not found, using system Node: $(node --version)"
fi
echo ""

# Step 2: Set up Java
log_info "Step 2/7: Setting up Java environment..."
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home
if [ -d "$JAVA_HOME" ]; then
    export PATH=$JAVA_HOME/bin:$PATH
    log_success "Java 17 (Zulu) configured"
    $JAVA_HOME/bin/java -version 2>&1 | head -1
else
    log_error "Java 17 not found at $JAVA_HOME"
    log_error "Please install Zulu JDK 17 from https://www.azul.com/downloads/"
    exit 1
fi
echo ""

# Step 3: Set up Android SDK
log_info "Step 3/7: Setting up Android SDK..."
if [ ! -z "$ANDROID_HOME" ]; then
    log_success "Android SDK found at: $ANDROID_HOME"
elif [ -d "$HOME/Library/Android/sdk" ]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
    export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH
    log_success "Android SDK found at: $ANDROID_HOME"
else
    log_error "ANDROID_HOME not set and SDK not found at default location"
    log_info "Please install Android SDK and set ANDROID_HOME in your shell config"
    exit 1
fi
echo ""

# Step 4: Check dependencies
log_info "Step 4/7: Verifying dependencies..."
if [ ! -d "node_modules" ]; then
    log_warning "node_modules not found. Installing dependencies..."
    npm install --legacy-peer-deps
    log_success "Dependencies installed"
else
    log_success "Dependencies verified"
fi
echo ""

# Step 5: Check for running emulator or device
log_info "Step 5/7: Checking for Android device/emulator..."
DEVICE_COUNT=$(adb devices | grep -E "device$" | wc -l | tr -d ' ')
if [ "$DEVICE_COUNT" -eq "0" ]; then
    log_warning "No Android device or emulator detected"
    log_info "Please start an emulator or connect a device"
    log_info "Available emulators:"
    emulator -list-avds 2>/dev/null || log_warning "Could not list emulators"
    exit 1
else
    log_success "Found $DEVICE_COUNT Android device(s)"
    adb devices | grep -E "device$"
fi
echo ""

# Step 6: Start Metro bundler in background with terminal output
log_info "Step 6/7: Starting Metro bundler..."
# Use --no-interactive to avoid DevTools prompt and tee to show logs in terminal
npm start -- --no-interactive 2>&1 | tee /tmp/metro-bundler.log &
METRO_PID=$!

# Wait for Metro to start
log_info "Waiting for Metro to start..."
for i in {1..30}; do
    if lsof -i :8081 | grep -q LISTEN 2>/dev/null; then
        log_success "Metro bundler started on port 8081"
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "Metro bundler failed to start after 30 seconds"
        cat /tmp/metro-bundler.log
        exit 1
    fi
    sleep 1
done
echo ""

# Step 7: Set up port forwarding and run Android app
log_info "Step 7/7: Setting up port forwarding and launching app..."
adb reverse tcp:8081 tcp:8081
log_success "Port forwarding configured"
echo ""

log_info "Building and running Android app..."
log_info "This may take a few minutes on first run..."
echo ""

# Run the Android app
npm run android

# Keep script running
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "App is running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Metro bundler: http://localhost:8081"
echo "📋 Metro logs are shown above and saved to: /tmp/metro-bundler.log"
echo ""
log_info "Metro is running in the background. Press Ctrl+C to stop and exit"
echo ""

# Keep script running - Metro logs are already showing via tee
# Wait for Metro process
wait $METRO_PID

