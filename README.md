# LocalTravelBuddy ��️

An offline-first, single-page travel companion app built with Expo, React Native, and TypeScript. Features AI-powered assistance via Google Gemma 3n (multimodal: text, image, audio). Designed as a Minimum Viable Product (MVP) with a focus on essential travel features and offline functionality.

## Demo

[![Watch the Android Demo](https://img.youtube.com/vi/Z4JCz_ihHAE/0.jpg)](https://youtu.be/Z4JCz_ihHAE)

Experience the app in action: [Android Demo Video](https://youtu.be/Z4JCz_ihHAE)

## Features

- **Offline Map (OpenStreetMap)**: View and interact with maps without an internet connection. The app uses OpenStreetMap data for offline navigation and exploration.
- **Attractions**: Discover local attractions, landmarks, and points of interest. Attraction data is sourced from [OpenStreetMap](https://www.openstreetmap.org/) and other open datasets, ensuring up-to-date and community-driven information.
- **Offline AI (Google Gemma 3n)**: Enjoy AI-powered assistance without needing an internet connection. Access the AI by double-clicking on any attraction or through the chat interface. The AI can answer questions, provide recommendations, and process text. 

## Tech Stack

- **Expo** & **React Native**
- **TypeScript**
- **Google Gemma 3n**

## Setup & Usage

### Prerequisites
- Node.js (v16 or higher)
- Expo CLI (`npm install -g expo-cli`)
- Mobile device with Expo Go app (for development)

### Installation
1. Clone the repository and install dependencies:
   ```bash
   git clone <your-repo-url>
   cd LocalTravelBuddy-
   npm install
   ```
2. Start the development server:
   ```bash
   npm start
   ```
3. Run on your device:
   - Android: `npm run android`
   - iOS: `npm run ios`
   - Web: `npm run web`

## Android Notes
- On first launch, the app will download the Gemma 3n model (requires ~5GB free space)
- Model stored in `${FileSystem.documentDirectory}models/huggingface/`
- Performance: 2-10 seconds per AI response (device-dependent)
- For best results: close other apps, ensure enough storage, and keep device charged during model download

---