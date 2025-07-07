# LocalTravelBuddy 🗺️

An offline-first travel companion app built with Expo and React Native, featuring AI-powered assistance through Google Gemma 3n.

## Features

- 🗺️ **Map Interface**: Clean map placeholder for MVP (real maps to be added later)
- 🎤 **Voice Input**: Microphone integration for voice commands (powered by Gemma 3n)
- 📷 **Visual AI**: Camera integration for visual assistance (powered by Gemma 3n)
- 📱 **Simple UI**: Clean, single-page interface focused on essential travel needs

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- Expo CLI (`npm install -g expo-cli`)
- Mobile device with Expo Go app installed

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd LocalTravelBuddy-
   npm install
   ```

2. **Run the app:**
   ```bash
   # Start the development server
   npm start

   # Run on specific platforms
   npm run android    # Android
   npm run ios        # iOS
   npm run web        # Web browser
   ```

## Android Setup for GGUF Model Inference

### Requirements
- Android device with at least 6GB RAM (recommended 8GB+)
- Android 7.0+ (API level 24+)
- arm64-v8a architecture support
- At least 8GB free storage for model download

### Android-Specific Configuration

The app has been optimized for Android with the following configurations:

#### 1. Memory Optimization
- **Large Heap**: Enabled in AndroidManifest.xml for AI model processing
- **Context Size**: Reduced to 1024 tokens for Android memory constraints
- **Inference Limit**: Maximum 256 tokens per response for performance

#### 2. Performance Settings
- **CPU Only**: Uses CPU inference (no GPU acceleration on Android)
- **Memory Lock**: Disabled for Android compatibility
- **Architecture**: Optimized for arm64-v8a only

#### 3. Error Handling
- **Memory Constraints**: Graceful handling of OutOfMemory errors
- **Storage Issues**: Automatic detection of file access problems
- **Performance Monitoring**: Real-time tracking of inference speed

### Building for Android

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build APK**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

3. **Install on Device**
   ```bash
   adb install app/build/outputs/apk/release/app-release.apk
   ```

### Testing on Android

1. **First Launch**: The app will download the 4.87GB Gemma model
2. **Model Storage**: Located in `${FileSystem.documentDirectory}models/huggingface/`
3. **Performance**: Expect 2-10 seconds per response depending on device
4. **Memory Usage**: Monitor with `adb shell dumpsys meminfo [package_name]`

### Android Performance Tips

- **Free Memory**: Close other apps before using AI features
- **Storage**: Ensure 8GB+ free space for model download
- **Battery**: Keep device plugged in during first model download
- **Network**: Stable internet connection required for initial setup

### Troubleshooting Android Issues

#### Memory Errors
- Restart the app
- Clear other apps from memory
- Use shorter input questions

#### Model Download Fails
- Check internet connection
- Verify storage space
- Check file permissions

#### Slow Performance
- Normal on older devices
- Try shorter questions
- Restart app if performance degrades

### Android Architecture Details

- **NDK Version**: As specified in build.gradle
- **Target Architecture**: arm64-v8a only
- **Proguard**: Configured to preserve llama.rn native code
- **Permissions**: File system access for model storage

## Project Architecture

This is a **Minimum Viable Product (MVP)** following these core principles:

- **Offline First**: All functionality works without internet connectivity
- **Simple UI**: Single-page application with essential controls only
- **AI Integration**: Google Gemma 3n for multimodal AI processing
- **React Native Maps**: For reliable mapping functionality

## Development Notes

- Built with Expo for easy development and testing
- No Android Studio required for development
- TypeScript for better code quality
- Follows cursor rules defined in `.cursorrules`

## Next Steps

- [ ] Implement Google Gemma 3n AI integration
- [ ] Implement voice recording and processing
- [ ] Add camera capture and AI analysis
- [ ] Replace map placeholder with real maps (when moving to development build)
- [ ] Add offline map functionality
- [ ] Test offline functionality

## Cursor Rules

This project follows specific development guidelines defined in `.cursorrules` to ensure consistency with the offline-first, MVP approach. 