import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, TouchableOpacity, Alert, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function App() {
  const [isRecording, setIsRecording] = useState(false);

  const handleMicrophonePress = () => {
    setIsRecording(!isRecording);
    // TODO: Implement voice recording with Gemma 3n AI processing
    Alert.alert('Voice Input', 'Voice recording functionality will be implemented with Google Gemma 3n');
  };

  const handleCameraPress = () => {
    // TODO: Implement camera functionality with Gemma 3n AI processing
    Alert.alert('Camera Input', 'Camera functionality will be implemented with Google Gemma 3n');
  };

  return (
    <View style={styles.container}>
      {/* Map Placeholder - Main area */}
      <View style={styles.mapContainer}>
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
          </View>
        </View>
      </View>

      {/* Control Panel - Bottom overlay with microphone and camera */}
      <View style={styles.controlPanel}>
        {/* Microphone Button */}
        <TouchableOpacity 
          style={[styles.controlButton, isRecording && styles.recordingButton]} 
          onPress={handleMicrophonePress}
        >
          <Ionicons 
            name={isRecording ? "mic" : "mic-outline"} 
            size={32} 
            color={isRecording ? "#ff4444" : "#ffffff"} 
          />
        </TouchableOpacity>

        {/* Camera Button */}
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={handleCameraPress}
        >
          <Ionicons 
            name="camera-outline" 
            size={32} 
            color="#ffffff" 
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
});
