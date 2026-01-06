#!/usr/bin/env bash
#
# setup-android-e2e.sh - Cross-platform Android E2E Testing Environment Setup
#
# This script prepares a fresh machine to run Android E2E tests for React Native.
# It installs all required dependencies and configures the Android development environment.
#
# Supported Platforms:
#   - macOS (primary)
#   - Linux (Debian/Ubuntu-based)
#
# Prerequisites:
#   - Internet connection
#   - sudo access (for some installations)
#
# What this script installs/configures:
#   1. Homebrew (macOS only)
#   2. Node.js (via nvm) - version from .nvmrc
#   3. pnpm - version from package.json packageManager field
#   4. Java 17 (required for Android development)
#   5. Android SDK (command-line tools, platform-tools, build-tools, emulator)
#   6. Android system images
#   7. Android Virtual Device (AVD) for testing
#   8. Project dependencies (via pnpm install)
#
# Usage:
#   ./scripts/setup-android-e2e.sh              # Interactive mode
#   ./scripts/setup-android-e2e.sh --ci         # Non-interactive CI mode
#   ./scripts/setup-android-e2e.sh --skip-emulator  # Skip AVD creation
#
# After running this script:
#   ./scripts/run-e2e-android.sh                # Run the E2E tests
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$RN_DIR/../.." && pwd)"

# Configuration
NODE_VERSION="24.11.1"
PNPM_VERSION="10.22.0"
JAVA_VERSION="17"
ANDROID_BUILD_TOOLS_VERSION="35.0.0"
ANDROID_PLATFORM_VERSION="35"
ANDROID_API_LEVEL="34"
ANDROID_EMULATOR_NAME="Pixel_7_API_34"
NDK_VERSION="26.1.10909125"

# Flags
CI_MODE="${CI:-false}"
SKIP_EMULATOR="false"
VERBOSE="false"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    else
        echo "unknown"
    fi
}

OS=$(detect_os)

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

log_step() {
    echo -e "${GREEN}→${NC} $1"
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --ci)
                CI_MODE="true"
                shift
                ;;
            --skip-emulator)
                SKIP_EMULATOR="true"
                shift
                ;;
            --verbose|-v)
                VERBOSE="true"
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Setup script for Android E2E testing environment.

Options:
  --ci              Run in CI mode (non-interactive, auto-accept licenses)
  --skip-emulator   Skip Android emulator (AVD) creation
  --verbose, -v     Enable verbose output
  --help, -h        Show this help message

Environment Variables:
  CI                Set to 'true' for CI mode
  ANDROID_HOME      Custom Android SDK location (default: ~/Android/Sdk or ~/Library/Android/sdk)

Examples:
  $(basename "$0")                    # Full interactive setup
  $(basename "$0") --ci               # CI mode with auto-accept
  $(basename "$0") --skip-emulator    # Skip AVD creation

EOF
}

# Check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Prompt user for confirmation (skipped in CI mode)
confirm() {
    local prompt="$1"
    if [[ "$CI_MODE" == "true" ]]; then
        return 0
    fi
    
    read -p "$prompt [y/N] " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# Export environment variables and add to shell profile
add_to_shell_profile() {
    local line="$1"
    local profile_files=()
    
    # Determine which shell profile to use
    if [[ -n "${ZSH_VERSION:-}" ]] || [[ "$SHELL" == *"zsh"* ]]; then
        profile_files+=("$HOME/.zshrc")
    fi
    if [[ -n "${BASH_VERSION:-}" ]] || [[ "$SHELL" == *"bash"* ]]; then
        if [[ "$OS" == "macos" ]]; then
            profile_files+=("$HOME/.bash_profile")
        else
            profile_files+=("$HOME/.bashrc")
        fi
    fi
    
    # Default to .profile if no specific shell found
    if [[ ${#profile_files[@]} -eq 0 ]]; then
        profile_files+=("$HOME/.profile")
    fi
    
    for profile_file in "${profile_files[@]}"; do
        if [[ -f "$profile_file" ]]; then
            if ! grep -qF "$line" "$profile_file" 2>/dev/null; then
                echo "$line" >> "$profile_file"
                log_step "Added to $profile_file: $line"
            fi
        else
            echo "$line" >> "$profile_file"
            log_step "Created $profile_file with: $line"
        fi
    done
}

# ═══════════════════════════════════════════════════════════════
# Installation Functions
# ═══════════════════════════════════════════════════════════════

install_homebrew() {
    if [[ "$OS" != "macos" ]]; then
        return 0
    fi
    
    log_section "Checking Homebrew"
    
    if command_exists brew; then
        log_info "Homebrew is already installed"
        brew --version
    else
        log_step "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add Homebrew to PATH for Apple Silicon Macs
        if [[ -f "/opt/homebrew/bin/brew" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
            add_to_shell_profile 'eval "$(/opt/homebrew/bin/brew shellenv)"'
        fi
        
        log_info "Homebrew installed successfully"
    fi
}

install_linux_dependencies() {
    if [[ "$OS" != "linux" ]]; then
        return 0
    fi
    
    log_section "Installing Linux Dependencies"
    
    log_step "Updating package lists..."
    sudo apt-get update
    
    log_step "Installing required packages..."
    sudo apt-get install -y \
        curl \
        wget \
        git \
        unzip \
        build-essential \
        openjdk-17-jdk \
        libgl1 \
        libpulse0 \
        libnss3 \
        libxkbcommon-x11-0 \
        libxcb-cursor0 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        libxtst6 \
        libxi6 \
        libasound2 \
        qemu-kvm \
        libvirt-daemon-system \
        libvirt-clients \
        bridge-utils
        
    # Add user to kvm group for hardware acceleration
    if groups "$USER" | grep -qv kvm; then
        log_step "Adding user to kvm group for hardware acceleration..."
        sudo usermod -aG kvm "$USER"
        log_warn "You may need to log out and back in for kvm group membership to take effect"
    fi
    
    log_info "Linux dependencies installed"
}

install_nvm_and_node() {
    log_section "Setting up Node.js"
    
    # Install nvm if not present
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    
    if [[ ! -d "$NVM_DIR" ]]; then
        log_step "Installing nvm..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
        
        # Source nvm
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        log_info "nvm installed successfully"
    else
        # Source nvm if already installed
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        log_info "nvm is already installed"
    fi
    
    # Verify nvm is available
    if ! command_exists nvm; then
        log_error "nvm is not available. Please restart your terminal and run this script again."
        exit 1
    fi
    
    # Install Node.js version from .nvmrc
    local nvmrc_file="$ROOT_DIR/.nvmrc"
    if [[ -f "$nvmrc_file" ]]; then
        NODE_VERSION=$(cat "$nvmrc_file" | tr -d '[:space:]')
        log_step "Installing Node.js $NODE_VERSION (from .nvmrc)..."
    else
        log_step "Installing Node.js $NODE_VERSION..."
    fi
    
    nvm install "$NODE_VERSION"
    nvm use "$NODE_VERSION"
    nvm alias default "$NODE_VERSION"
    
    log_info "Node.js $(node -v) installed and set as default"
}

install_pnpm() {
    log_section "Setting up pnpm"
    
    # Read pnpm version from package.json if available
    local package_json="$ROOT_DIR/package.json"
    if [[ -f "$package_json" ]]; then
        local pm_field=$(grep '"packageManager"' "$package_json" | head -1)
        if [[ -n "$pm_field" ]]; then
            PNPM_VERSION=$(echo "$pm_field" | sed -E 's/.*pnpm@([0-9]+\.[0-9]+\.[0-9]+).*/\1/')
        fi
    fi
    
    log_step "Installing pnpm@$PNPM_VERSION..."
    
    # Use corepack if available (Node.js 16.13+)
    if command_exists corepack; then
        corepack enable
        corepack prepare "pnpm@$PNPM_VERSION" --activate
    else
        npm install -g "pnpm@$PNPM_VERSION"
    fi
    
    log_info "pnpm $(pnpm -v) installed"
}

install_java() {
    log_section "Setting up Java $JAVA_VERSION"
    
    # Check if Java is already installed with correct version
    if command_exists java; then
        local current_java_version=$(java -version 2>&1 | head -1 | awk -F '"' '{print $2}' | cut -d'.' -f1)
        if [[ "$current_java_version" == "$JAVA_VERSION" ]]; then
            log_info "Java $JAVA_VERSION is already installed"
            java -version
            return 0
        fi
    fi
    
    if [[ "$OS" == "macos" ]]; then
        log_step "Installing OpenJDK $JAVA_VERSION via Homebrew..."
        brew install "openjdk@$JAVA_VERSION"
        
        # Create symlink for system Java wrappers
        local jdk_path="/opt/homebrew/opt/openjdk@$JAVA_VERSION"
        if [[ ! -d "$jdk_path" ]]; then
            jdk_path="/usr/local/opt/openjdk@$JAVA_VERSION"
        fi
        
        if [[ -d "$jdk_path" ]]; then
            sudo ln -sfn "$jdk_path/libexec/openjdk.jdk" "/Library/Java/JavaVirtualMachines/openjdk-$JAVA_VERSION.jdk" 2>/dev/null || true
            
            export JAVA_HOME="$jdk_path"
            add_to_shell_profile "export JAVA_HOME=\"$jdk_path\""
            add_to_shell_profile 'export PATH="$JAVA_HOME/bin:$PATH"'
        fi
        
    elif [[ "$OS" == "linux" ]]; then
        # Java was already installed in linux dependencies
        export JAVA_HOME="/usr/lib/jvm/java-$JAVA_VERSION-openjdk-amd64"
        if [[ ! -d "$JAVA_HOME" ]]; then
            # Try alternative path for ARM
            export JAVA_HOME="/usr/lib/jvm/java-$JAVA_VERSION-openjdk-arm64"
        fi
        if [[ -d "$JAVA_HOME" ]]; then
            add_to_shell_profile "export JAVA_HOME=\"$JAVA_HOME\""
        fi
    fi
    
    log_info "Java installed successfully"
    java -version
}

setup_android_sdk() {
    log_section "Setting up Android SDK"
    
    # Set ANDROID_HOME
    if [[ "$OS" == "macos" ]]; then
        export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
    else
        export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
    fi
    
    log_step "Android SDK location: $ANDROID_HOME"
    
    # Create SDK directory
    mkdir -p "$ANDROID_HOME"
    
    # Download command-line tools if not present
    local cmdline_tools_dir="$ANDROID_HOME/cmdline-tools/latest"
    
    if [[ ! -d "$cmdline_tools_dir" ]]; then
        log_step "Downloading Android command-line tools..."
        
        local cmdline_tools_url=""
        if [[ "$OS" == "macos" ]]; then
            cmdline_tools_url="https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip"
        else
            cmdline_tools_url="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
        fi
        
        local tmp_dir=$(mktemp -d)
        curl -L "$cmdline_tools_url" -o "$tmp_dir/cmdline-tools.zip"
        unzip -q "$tmp_dir/cmdline-tools.zip" -d "$tmp_dir"
        
        mkdir -p "$ANDROID_HOME/cmdline-tools"
        mv "$tmp_dir/cmdline-tools" "$cmdline_tools_dir"
        rm -rf "$tmp_dir"
        
        log_info "Android command-line tools downloaded"
    else
        log_info "Android command-line tools already installed"
    fi
    
    # Add to PATH
    export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
    
    # Add environment variables to shell profile
    add_to_shell_profile "export ANDROID_HOME=\"$ANDROID_HOME\""
    add_to_shell_profile "export ANDROID_SDK_ROOT=\"$ANDROID_HOME\""
    add_to_shell_profile 'export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"'
    
    # Accept licenses
    log_step "Accepting Android SDK licenses..."
    if [[ "$CI_MODE" == "true" ]]; then
        yes | sdkmanager --licenses > /dev/null 2>&1 || true
    else
        yes | sdkmanager --licenses || true
    fi
    
    # Install required SDK packages
    log_step "Installing Android SDK packages..."
    
    local packages=(
        "platform-tools"
        "platforms;android-$ANDROID_PLATFORM_VERSION"
        "build-tools;$ANDROID_BUILD_TOOLS_VERSION"
        "emulator"
        "system-images;android-$ANDROID_API_LEVEL;google_apis;x86_64"
        "ndk;$NDK_VERSION"
    )
    
    # For ARM Macs, also install ARM system image
    if [[ "$OS" == "macos" ]] && [[ "$(uname -m)" == "arm64" ]]; then
        packages+=("system-images;android-$ANDROID_API_LEVEL;google_apis;arm64-v8a")
    fi
    
    for package in "${packages[@]}"; do
        log_step "Installing $package..."
        sdkmanager "$package" || log_warn "Failed to install $package, continuing..."
    done
    
    log_info "Android SDK setup complete"
}

create_android_emulator() {
    if [[ "$SKIP_EMULATOR" == "true" ]]; then
        log_info "Skipping emulator creation (--skip-emulator flag)"
        return 0
    fi
    
    log_section "Creating Android Emulator"
    
    # Check if emulator already exists
    if avdmanager list avd 2>/dev/null | grep -q "$ANDROID_EMULATOR_NAME"; then
        log_info "Emulator '$ANDROID_EMULATOR_NAME' already exists"
        return 0
    fi
    
    # Determine system image based on architecture
    local system_image="system-images;android-$ANDROID_API_LEVEL;google_apis;x86_64"
    if [[ "$OS" == "macos" ]] && [[ "$(uname -m)" == "arm64" ]]; then
        system_image="system-images;android-$ANDROID_API_LEVEL;google_apis;arm64-v8a"
    fi
    
    log_step "Creating AVD: $ANDROID_EMULATOR_NAME..."
    
    echo "no" | avdmanager create avd \
        --name "$ANDROID_EMULATOR_NAME" \
        --package "$system_image" \
        --device "pixel_7" \
        --force
    
    # Configure emulator for better performance
    local avd_config="$HOME/.android/avd/${ANDROID_EMULATOR_NAME}.avd/config.ini"
    if [[ -f "$avd_config" ]]; then
        log_step "Optimizing emulator configuration..."
        
        # Add performance settings
        cat >> "$avd_config" << EOF
hw.ramSize=4096
hw.gpu.enabled=yes
hw.gpu.mode=auto
disk.dataPartition.size=6G
vm.heapSize=576
hw.keyboard=yes
EOF
    fi
    
    log_info "Emulator '$ANDROID_EMULATOR_NAME' created successfully"
    
    # Show available emulators
    log_step "Available emulators:"
    emulator -list-avds 2>/dev/null || avdmanager list avd -c
}

install_project_dependencies() {
    log_section "Installing Project Dependencies"
    
    cd "$ROOT_DIR"
    
    log_step "Installing monorepo dependencies with pnpm..."
    pnpm install
    
    log_info "Project dependencies installed"
}

verify_installation() {
    log_section "Verifying Installation"
    
    local all_good=true
    
    # Check Node.js
    if command_exists node; then
        log_info "✓ Node.js: $(node -v)"
    else
        log_error "✗ Node.js not found"
        all_good=false
    fi
    
    # Check pnpm
    if command_exists pnpm; then
        log_info "✓ pnpm: $(pnpm -v)"
    else
        log_error "✗ pnpm not found"
        all_good=false
    fi
    
    # Check Java
    if command_exists java; then
        local java_ver=$(java -version 2>&1 | head -1)
        log_info "✓ Java: $java_ver"
    else
        log_error "✗ Java not found"
        all_good=false
    fi
    
    # Check Android SDK
    if [[ -n "${ANDROID_HOME:-}" ]] && [[ -d "$ANDROID_HOME" ]]; then
        log_info "✓ Android SDK: $ANDROID_HOME"
    else
        log_error "✗ Android SDK not found"
        all_good=false
    fi
    
    # Check adb
    if command_exists adb; then
        log_info "✓ adb: $(adb --version | head -1)"
    else
        log_error "✗ adb not found"
        all_good=false
    fi
    
    # Check emulator
    if command_exists emulator; then
        log_info "✓ Android Emulator: available"
    else
        log_error "✗ Android Emulator not found"
        all_good=false
    fi
    
    # Check AVD
    if [[ "$SKIP_EMULATOR" != "true" ]]; then
        if avdmanager list avd 2>/dev/null | grep -q "$ANDROID_EMULATOR_NAME"; then
            log_info "✓ AVD: $ANDROID_EMULATOR_NAME"
        else
            log_warn "⚠ AVD '$ANDROID_EMULATOR_NAME' not found"
        fi
    fi
    
    echo ""
    
    if [[ "$all_good" == "true" ]]; then
        return 0
    else
        return 1
    fi
}

print_next_steps() {
    log_section "Setup Complete!"
    
    cat << EOF
${GREEN}Your machine is now ready to run Android E2E tests!${NC}

${YELLOW}Important:${NC} Please restart your terminal or run:
  source ~/.zshrc   # or ~/.bashrc for bash

${BLUE}To run the E2E tests:${NC}
  1. Start the Android emulator:
     emulator -avd $ANDROID_EMULATOR_NAME &
     
  2. Wait for the emulator to fully boot, then run:
     cd $RN_DIR
     ./scripts/run-e2e-android.sh

${BLUE}Or run in headless mode (CI):${NC}
  emulator -avd $ANDROID_EMULATOR_NAME -no-window -no-audio -no-boot-anim &
  adb wait-for-device
  ./scripts/run-e2e-android.sh

${BLUE}Environment variables set:${NC}
  ANDROID_HOME=$ANDROID_HOME
  JAVA_HOME=${JAVA_HOME:-"(system default)"}

${YELLOW}Troubleshooting:${NC}
  - If emulator doesn't start: Check that hardware virtualization is enabled
  - If build fails: Run 'cd android && ./gradlew clean' and try again
  - For more help: See $RN_DIR/E2E-TESTING.md

EOF
}

# ═══════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════

main() {
    parse_args "$@"
    
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     Android E2E Testing Environment Setup                     ║${NC}"
    echo -e "${BLUE}║     React Native Implementation                               ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    log_info "Operating System: $OS"
    log_info "CI Mode: $CI_MODE"
    log_info "Skip Emulator: $SKIP_EMULATOR"
    echo ""
    
    if [[ "$OS" == "unknown" ]]; then
        log_error "Unsupported operating system: $OSTYPE"
        log_error "This script supports macOS and Linux (Debian/Ubuntu)"
        exit 1
    fi
    
    # Run installation steps
    if [[ "$OS" == "macos" ]]; then
        install_homebrew
    elif [[ "$OS" == "linux" ]]; then
        install_linux_dependencies
    fi
    
    install_nvm_and_node
    install_pnpm
    install_java
    setup_android_sdk
    create_android_emulator
    install_project_dependencies
    
    # Verify everything is working
    if verify_installation; then
        print_next_steps
        exit 0
    else
        log_error "Some components failed to install. Please check the errors above."
        exit 1
    fi
}

main "$@"
