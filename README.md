# GoldKit Prism

**Professional Pro Tools session stem extraction tool**

Prism extracts individual audio tracks (stems) from Pro Tools sessions, preserving timeline alignment and original audio quality. Built for music producers, audio engineers, and post-production professionals who need reliable stem extraction from `.ptx` session files.

## Features

### 🎯 **Timeline-Accurate Export**
- Maintains exact Pro Tools session timing and positioning
- Supports both aligned (timeline-based) and raw (source file) export modes
- Automatically handles sample rate conversion and scaling

### 🔧 **Pro Tools Compatibility**  
- Supports Pro Tools 5-12 session formats
- Robust parsing with multiple fallback methods
- Built on the proven `ptformat` library

### 🎵 **Professional Audio Quality**
- Preserves original WAV file bit depth and sample rates
- Intelligent tail silence trimming
- Handles mono, stereo, and multi-channel tracks

### 🖥️ **Modern Interface**
- Clean, intuitive Electron-based desktop app  
- Drag-and-drop session loading
- Real-time export progress tracking
- Built-in debug panel for troubleshooting

## Installation

### Download Pre-built Releases
1. Go to [Releases](../../releases)
2. For the latest studio build, download from the **[Prism Beta](../../releases/tag/beta)** prerelease (updated on every `main` push):
   - **Windows**: `Prism-*-Setup.exe`
   - **macOS (Intel)**: `Prism-*-mac-x64.dmg`
3. Versioned tags (`v*`) also publish as prereleases (e.g. `v1.0.0-beta.1`) for frozen snapshots.
4. Run the installer and follow the setup instructions

### System Requirements
- **Windows**: Windows 10 or later (x64)
- **macOS**: macOS 10.14+ (Intel and Apple Silicon)
- **Memory**: 4GB RAM minimum, 8GB+ recommended for large sessions
- **Storage**: 500MB free space for installation

## Usage

### Basic Workflow

1. **Load Session**: Drag a `.ptx` file into Prism or use File → Open
2. **Review Tracks**: Verify detected tracks and source audio files
3. **Choose Export Mode**:
   - **Aligned**: Timeline-based stems (recommended for mixing)
   - **Raw**: Source audio files (fallback for compatibility)
4. **Configure Output**: Select destination folder and options
5. **Export**: Click "Export Stems" and monitor progress

### Export Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Aligned** | Exports tracks positioned exactly as they appear on the Pro Tools timeline | Mixing, mastering, collaborative work |
| **Raw** | Copies original source audio files without timeline processing | Backup, archival, compatibility issues |

### Supported Formats
- **Input**: Pro Tools session files (`.ptx`)
- **Output**: WAV files (16/24/32-bit, various sample rates)
- **Source Audio**: WAV files (AIFF support planned)

## Development

### Prerequisites
- **Node.js** 18+ 
- **npm** 8+
- **Git**
- **CMake** 3.16+ (for native modules)
- **C++ compiler** (MSVC on Windows, Clang on macOS)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/goldkit-prism.git
cd goldkit-prism

# Install dependencies
npm install

# Build native modules and assets
npm run build:native
npm run build:icon

# Start development server
npm run dev
```

### Build Commands

```bash
# Development
npm run dev                    # Start Electron in dev mode
npm test                       # Run unit tests

# Production builds  
npm run build                  # Build renderer and main processes
npm run dist                   # Create platform-specific installer
npm run dist:win               # Windows installer only
npm run dist:mac               # macOS Intel (x64) DMG only

# Native modules
npm run build:ptformat         # Verify win32 ptformat or compile darwin-x64 from source
npm run build:native           # build:ptformat + ptx-json cmake build
npm run copy:ptformat-dlls     # Copy required Windows DLLs
npm run build:icon             # Generate app icon from PNG source
```

On macOS, `npm run build:ptformat` compiles `ptftool` from `native/ptx-json/ptformat` via `arch -x86_64 make` and installs it as `resources/ptformat/darwin-x64/ptformat`. GitHub Actions runs the same step before packaging the Intel DMG.

Platform-specific ptformat binaries are bundled per target:

- Windows: `resources/ptformat/win32/ptformat.exe`
- macOS Intel: `resources/ptformat/darwin-x64/ptformat`
- macOS Apple Silicon (optional): `resources/ptformat/darwin-arm64/ptformat`

### Project Structure

```
src/
├── main/                      # Electron main process
│   ├── pro-tools/            # Pro Tools session parsing
│   ├── audio/                # Audio processing and export
│   └── security/             # Path allowlisting and validation
├── renderer/                  # React frontend
│   ├── components/           # UI components
│   ├── hooks/                # React hooks
│   └── store/                # Zustand state management
├── preload/                  # Electron preload script
└── shared/                   # Shared TypeScript types

native/
└── ptx-json/                 # C++ wrapper around ptformat library

resources/
├── bin/                      # Compiled native binaries
└── ptformat/                 # Platform-specific ptformat binaries
    ├── win32/
    ├── darwin-x64/
    └── darwin-arm64/
```

### Architecture

Prism uses a **multi-process architecture**:

- **Main Process** (Node.js): File I/O, native binary execution, audio processing
- **Renderer Process** (React): User interface, isolated for security  
- **Preload Script**: Secure IPC bridge between main and renderer

**Session Parsing Pipeline**:
1. `ptx-json` (preferred): Custom C++ wrapper with JSON output
2. `ptformat` (fallback): Original ptformat CLI tool with text parsing
3. Raw discovery: Scans `Audio Files/` directory as last resort

## Contributing

### Development Guidelines
- Follow the existing TypeScript/React patterns
- Add tests for new audio processing features
- Update type definitions in `src/shared/types.ts`
- Use the provided ESLint and Prettier configurations

### Native Module Development
The `ptx-json` wrapper is built with CMake and requires:
- C++17 compiler
- `ptformat` submodule (included)
- Platform-specific build tools

## Security & Privacy

- **Sandboxed renderer**: Web content runs in isolated context
- **Path allowlisting**: File access restricted to user-selected directories  
- **No telemetry**: All processing happens locally on your machine
- **Open source**: Full source code available for audit

## Technical Details

### Audio Processing
- Uses `wavefile` library for WAV I/O
- Supports Float32 internal processing
- Handles sample rate mismatches with validation warnings
- Implements smart tail silence detection and trimming

### Pro Tools Integration  
- Based on `ptformat` library by Damien Zammit and Robin Gareus
- Supports encrypted and unencrypted session files
- Handles timeline positioning with sample-accurate precision
- Compatible with Pro Tools 5 through 12 session formats

## Troubleshooting

### Common Issues

**"Timeline alignment unavailable"**
- Your session may use unsupported Pro Tools features
- Try Raw export mode as a fallback
- Check the debug panel for detailed parsing information

**"Missing source files"**
- Ensure audio files are in the expected `Audio Files/` directory
- Check that WAV files haven't been moved or renamed
- Use absolute paths if the session was created on a different system

**Export crashes or freezes**
- Large sessions may require more RAM  
- Close other applications during export
- Check available disk space in the output directory

### Debug Information
Use **Tools → Debug Panel** to view:
- `ptformat` execution details and exit codes
- Session parsing mode (JSON, text, or raw fallback)  
- File validation results and warnings

## License

MIT License - see [LICENSE](LICENSE) for details.

### Third-Party Components
- **ptformat**: LGPL-2.1+ (used as external subprocess)
- **Electron, React, and npm dependencies**: Various open source licenses
- See `node_modules/` for complete dependency licensing

---

**Disclaimer**: GoldKit Prism is an independent tool and is not affiliated with or endorsed by Avid Technology or Pro Tools.

## Support

- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)  
- **Documentation**: [Wiki](../../wiki)

Built with ❤️ for the audio production community.