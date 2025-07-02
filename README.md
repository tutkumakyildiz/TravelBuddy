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