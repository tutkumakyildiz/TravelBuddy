import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, TouchableOpacity, Alert, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AIService from './services/AIService';

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [aiInitialized, setAiInitialized] = useState(false);
  const [aiLoading, setAiLoading] = useState(true);
  const [lastAiResponse, setLastAiResponse] = useState<string>('');

  // Initialize AI service on app start
  useEffect(() => {
    initializeAI();
  }, []);

  const initializeAI = async () => {
    try {
      setAiLoading(true);
      const aiService = AIService.getInstance();
      const initialized = await aiService.initialize();
      
      if (initialized) {
        setAiInitialized(true);
        Alert.alert('AI Ready', 'Quantized Gemma 3n is ready for offline use!');
      } else {
        setAiInitialized(false);
        Alert.alert(
          'AI Not Ready', 
          'Quantized Gemma 3n model not found. The app will automatically set up the model files for offline use.'
        );
      }
    } catch (error) {
      console.error('AI initialization error:', error);
      setAiInitialized(false);
      Alert.alert('AI Error', 'Failed to initialize AI service. Check console for details.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleMicrophonePress = async () => {
    setIsRecording(!isRecording);
    
    if (!aiInitialized) {
      Alert.alert('AI Not Ready', 'Please ensure Quantized Gemma 3n model is properly installed.');
      return;
    }

    if (!isRecording) {
      // Start recording
      try {
        // TODO: Implement actual voice recording
        // For now, simulate with a test prompt
        const aiService = AIService.getInstance();
        const response = await aiService.processText("What are the best travel destinations nearby?");
        
        if (response.error) {
          Alert.alert('AI Error', response.error);
        } else {
          setLastAiResponse(response.text || '');
          Alert.alert('AI Response', response.text || 'No response generated');
        }
      } catch (error) {
        console.error('Voice processing error:', error);
        Alert.alert('Error', 'Failed to process voice input');
      }
    } else {
      // Stop recording
      Alert.alert('Voice Recording', 'Recording stopped (functionality to be implemented)');
    }
  };

  const handleCameraPress = async () => {
    if (!aiInitialized) {
      Alert.alert('AI Not Ready', 'Please ensure Quantized Gemma 3n model is properly installed.');
      return;
    }

    try {
      // TODO: Implement actual camera capture
      // For now, simulate with a test image analysis
      const aiService = AIService.getInstance();
      const response = await aiService.processImage('placeholder_image_uri', 'What interesting places can you see in this image?');
      
      if (response.error) {
        Alert.alert('AI Error', response.error);
      } else {
        setLastAiResponse(response.text || '');
        Alert.alert('AI Image Analysis', response.text || 'No analysis available');
      }
    } catch (error) {
      console.error('Image processing error:', error);
      Alert.alert('Error', 'Failed to process image');
    }
  };

  const handleMapPress = async () => {
    if (!aiInitialized) {
      Alert.alert('AI Not Ready', 'Please ensure Quantized Gemma 3n model is properly installed.');
      return;
    }

    try {
      const aiService = AIService.getInstance();
      const response = await aiService.generateTravelRecommendations('Current Location', ['outdoor', 'culture', 'food']);
      
      if (response.error) {
        Alert.alert('AI Error', response.error);
      } else {
        setLastAiResponse(response.text || '');
        Alert.alert('Travel Recommendations', response.text || 'No recommendations available');
      }
    } catch (error) {
      console.error('Travel recommendations error:', error);
      Alert.alert('Error', 'Failed to generate travel recommendations');
    }
  };

  return (
    <View style={styles.container}>
      {/* Map Placeholder - Main area */}
      <TouchableOpacity style={styles.mapContainer} onPress={handleMapPress} activeOpacity={0.8}>
        <View style={styles.mapPlaceholder}>
          <View style={styles.mapGrid}>
            {/* Grid lines to simulate map appearance */}
            {Array.from({ length: 10 }, (_, i) => (
              <View key={`h-${i}`} style={[styles.gridLine, styles.horizontalLine, { top: `${i * 10}%` }]} />
            ))}
            {Array.from({ length: 10 }, (_, i) => (
              <View key={`v-${i}`} style={[styles.gridLine, styles.verticalLine, { left: `${i * 10}%` }]} />
            ))}
          </View>
          
          {/* Location marker */}
          <View style={styles.locationMarker}>
            <Ionicons name="location" size={24} color="#ff4444" />
          </View>
          
          {/* Map info overlay */}
          <View style={styles.mapInfo}>
            <Text style={styles.mapInfoText}>📍 Current Location</Text>
            <Text style={styles.mapInfoSubtext}>LocalTravelBuddy MVP</Text>
            <Text style={styles.mapInfoSubtext}>Tap for AI recommendations</Text>
          </View>

          {/* AI Status indicator */}
          <View style={styles.aiStatus}>
            {aiLoading ? (
              <View style={styles.aiStatusContent}>
                <ActivityIndicator size="small" color="#666" />
                <Text style={styles.aiStatusText}>Loading AI...</Text>
              </View>
            ) : (
              <View style={styles.aiStatusContent}>
                <View style={[styles.aiStatusDot, { backgroundColor: aiInitialized ? '#4CAF50' : '#F44336' }]} />
                <Text style={styles.aiStatusText}>
                  AI {aiInitialized ? 'Ready' : 'Not Ready'}
                </Text>
              </View>
            )}
          </View>

          {/* Last AI Response Display */}
          {lastAiResponse && (
            <View style={styles.responseOverlay}>
              <Text style={styles.responseText} numberOfLines={3}>
                🤖 {lastAiResponse}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Control Panel - Bottom overlay with microphone and camera */}
      <View style={styles.controlPanel}>
        {/* Microphone Button */}
        <TouchableOpacity 
          style={[
            styles.controlButton, 
            isRecording && styles.recordingButton,
            !aiInitialized && styles.disabledButton
          ]} 
          onPress={handleMicrophonePress}
          disabled={!aiInitialized && !aiLoading}
        >
          <Ionicons 
            name={isRecording ? "mic" : "mic-outline"} 
            size={32} 
            color={isRecording ? "#ff4444" : (!aiInitialized ? "#666" : "#ffffff")} 
          />
        </TouchableOpacity>

        {/* Camera Button */}
        <TouchableOpacity 
          style={[
            styles.controlButton,
            !aiInitialized && styles.disabledButton
          ]} 
          onPress={handleCameraPress}
          disabled={!aiInitialized && !aiLoading}
        >
          <Ionicons 
            name="camera-outline" 
            size={32} 
            color={!aiInitialized ? "#666" : "#ffffff"} 
          />
        </TouchableOpacity>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapContainer: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#e8f4f8',
    position: 'relative',
  },
  mapGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(100, 150, 200, 0.2)',
  },
  horizontalLine: {
    left: 0,
    right: 0,
    height: 1,
  },
  verticalLine: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  locationMarker: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  mapInfo: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  mapInfoText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  mapInfoSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  aiStatus: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 8,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  aiStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  aiStatusText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  responseOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
  },
  responseText: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 16,
  },
  controlPanel: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  recordingButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    borderColor: '#ff4444',
  },
  disabledButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
});
