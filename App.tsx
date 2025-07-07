import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, TouchableOpacity, Alert, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AIService from './services/AIService';
import AudioService from './services/AudioService';
import CameraModal from './components/CameraModal';

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [aiInitialized, setAiInitialized] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [lastAiResponse, setLastAiResponse] = useState<string>('');
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [initializationAttempted, setInitializationAttempted] = useState(false);
  
  // Temporary debug mode - set to true to test UI flow without actual recording
  const [debugMode] = useState(true);

  // NO LONGER INITIALIZE AI ON STARTUP - Use lazy loading instead
  useEffect(() => {
    console.log('🚀 App started - AI will be initialized when needed (lazy loading)');
    console.log('📱 This prevents startup crashes and improves app launch time');
  }, []);

  // LAZY AI INITIALIZATION - Only when actually needed
  const initializeAILazily = async (): Promise<boolean> => {
    if (aiInitialized) {
      return true; // Already initialized
    }

    if (aiLoading) {
      console.log('🔄 AI already being initialized...');
      return false; // Already loading
    }

    try {
      setAiLoading(true);
      setInitializationAttempted(true);
      console.log('🤖 Starting mandatory AI initialization in dedicated background context...');
      
      // IMPROVED BACKGROUND PROCESSING: Use Promise with proper async isolation
      const backgroundInitialization = new Promise<boolean>((resolve, reject) => {
        // Use multiple setTimeout calls to ensure proper background execution
        const scheduleBackgroundWork = () => {
          setTimeout(async () => {
            try {
              console.log('🧵 AI initialization now running in isolated background context...');
              
              const aiService = AIService.getInstance();
              
              // Show user that we're starting the heavy download/initialization
              Alert.alert(
                'Loading AI Model', 
                'LocalTravelBuddy is loading the Gemma 3n AI model (4.87GB).\n\nFirst time setup may take 5-10 minutes.\n\nThe app will notify you when ready.',
                [{ text: 'OK', style: 'default' }]
              );
              
              // Add comprehensive progress monitoring
              const progressMonitor = setInterval(() => {
                try {
                  const progress = aiService.getDownloadProgress();
                  const isDownloading = aiService.isModelDownloading();
                  
                  if (isDownloading && progress && progress.progress > 0) {
                    console.log(`📊 Download Progress: ${(progress.progress * 100).toFixed(1)}% (${aiService.formatBytes(progress.totalBytesWritten)} / ${aiService.formatBytes(progress.totalBytesExpectedToWrite)})`);
                  } else if (!isDownloading) {
                    console.log('🔄 Model loading and initialization in progress...');
                  }
                } catch (monitorError) {
                  console.warn('Progress monitoring error:', monitorError);
                }
              }, 5000); // Every 5 seconds
              
              // Initialize with enhanced error handling
              const initialized = await aiService.initialize();
              clearInterval(progressMonitor);
              
              if (initialized) {
                console.log('✅ Heavy AI model initialized successfully in background');
                resolve(true);
              } else {
                console.error('❌ AI initialization returned false');
                reject(new Error('AI initialization failed'));
              }
              
            } catch (error) {
              console.error('❌ Background AI initialization failed:', error);
              reject(error);
            }
          }, 50); // Minimal delay for background execution
        };
        
        // Schedule the work
        scheduleBackgroundWork();
      });
      
      const initialized = await backgroundInitialization;
      
      if (initialized) {
        setAiInitialized(true);
        console.log('✅ Gemma 3n AI model fully loaded and ready');
        Alert.alert(
          'AI Ready', 
          'LocalTravelBuddy AI (Gemma 3n) is now fully loaded and ready!\n\nAll voice and camera features are available.',
          [{ text: 'Great!', style: 'default' }]
        );
        return true;
      } else {
        console.log('❌ AI initialization failed');
        return false;
      }
    } catch (error) {
      console.error('AI initialization error:', error);
      
      // Enhanced error handling for heavy model loading
      if (error.message?.includes('memory') || error.message?.includes('OutOfMemory')) {
        Alert.alert(
          'Memory Error', 
          'Insufficient memory to load the 4.87GB Gemma AI model.\n\nFor Android Emulator:\n• Increase RAM to 8GB\n• Close other apps\n• Restart emulator\n\nFor real device:\n• Close all other apps\n• Restart device',
          [{ text: 'OK', style: 'default' }]
        );
      } else if (error.message?.includes('storage') || error.message?.includes('space')) {
        Alert.alert(
          'Storage Error', 
          'Insufficient storage space for the 4.87GB model.\n\nRequired: 6GB+ free space\n\nPlease free up storage and try again.',
          [{ text: 'OK', style: 'default' }]
        );
      } else if (error.message?.includes('network') || error.message?.includes('download')) {
        Alert.alert(
          'Download Error', 
          'Failed to download the AI model from Hugging Face.\n\nPlease check your internet connection and try again.',
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        Alert.alert(
          'AI Initialization Error', 
          `Failed to initialize Gemma AI model:\n\n${error.message}\n\nThis is required for the app to function.`,
          [{ text: 'OK', style: 'default' }]
        );
      }
      
      return false;
    } finally {
      setAiLoading(false);
    }
  };

  const handleMicrophonePress = async () => {
    // Mandatory AI initialization - only initialize when user actually needs it
    if (!aiInitialized && !initializationAttempted) {
      console.log('🔄 User requested AI feature - starting mandatory AI initialization...');
      const initialized = await initializeAILazily();
      if (!initialized) {
        Alert.alert(
          'AI Required', 
          'Failed to initialize AI. Please try again.',
          [{ text: 'Retry', onPress: () => handleMicrophonePress() }]
        );
        return;
      }
    }

    // If AI is still loading, show status and wait
    if (aiLoading) {
      Alert.alert(
        'AI Loading', 
        'AI model is still loading in the background. Please wait a moment and try again.\n\nThis may take several minutes on first use.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    // AI must be ready to proceed
    if (!aiInitialized) {
      Alert.alert('AI Required', 'AI must be initialized to use voice features.');
      return;
    }

    const audioService = AudioService.getInstance();

    // Debug mode for testing UI flow
    if (debugMode) {
      if (!isRecording) {
        console.log('🐛 DEBUG: Simulating recording start');
        setIsRecording(true);
        return;
      } else {
        console.log('🐛 DEBUG: Simulating recording stop and processing');
        setIsRecording(false);
        setIsProcessingAudio(true);
        
        // Simulate processing with real AI
        setTimeout(async () => {
          const aiService = AIService.getInstance();
          const response = await aiService.processAudio('debug://fake-uri', 'What are the best restaurants nearby?');
          
          setLastAiResponse(response.text || '');
          Alert.alert('AI Voice Response', response.text || 'No response generated');
          setIsProcessingAudio(false);
        }, 2000);
        return;
      }
    }

    if (!isRecording) {
      // Start recording
      try {
        console.log('🎤 Starting voice recording...');
        const recordingStarted = await audioService.startRecording();
        
        if (recordingStarted) {
          setIsRecording(true);
          console.log('🔴 Recording started successfully - UI state updated');
          
          // Auto-stop recording after 30 seconds to prevent hanging
          setTimeout(async () => {
            if (audioService.getRecordingStatus().isRecording) {
              console.log('⏰ Auto-stopping recording after 30 seconds');
              handleMicrophonePress(); // This will trigger the stop logic
            }
          }, 30000);
        } else {
          console.error('❌ Recording failed to start');
          Alert.alert(
            'Recording Error', 
            'Unable to start recording. Please check microphone permissions in your device settings.',
            [{ text: 'OK', style: 'default' }]
          );
        }
      } catch (error) {
        console.error('❌ Exception during recording start:', error);
        Alert.alert('Recording Error', `Failed to start voice recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Stop recording and process
      try {
        console.log('⏹️ Stopping voice recording...');
        setIsRecording(false);
        setIsProcessingAudio(true);
        
        const audioUri = await audioService.stopRecording();
        
        if (audioUri) {
          console.log('🎵 Audio saved to:', audioUri);
          
          // Process with AI (mandatory - no fallback)
          const aiService = AIService.getInstance();
          const response = await aiService.processAudio(audioUri);
          setLastAiResponse(response.text || '');
          Alert.alert('AI Voice Response', response.text || 'No response generated');
        } else {
          console.error('❌ No audio URI returned');
          Alert.alert('Recording Error', 'Failed to save audio recording');
        }
      } catch (error) {
        console.error('❌ Exception during recording stop:', error);
        Alert.alert('Recording Error', `Failed to process voice recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsProcessingAudio(false);
      }
    }
  };

  const handleCameraPress = async () => {
    // Mandatory AI initialization for camera features
    if (!aiInitialized && !initializationAttempted) {
      console.log('🔄 User requested camera AI feature - starting mandatory AI initialization...');
      const initialized = await initializeAILazily();
      if (!initialized) {
        Alert.alert(
          'AI Required', 
          'Failed to initialize AI. Please try again.',
          [{ text: 'Retry', onPress: () => handleCameraPress() }]
        );
        return;
      }
    }

    // If AI is still loading, show status and wait
    if (aiLoading) {
      Alert.alert(
        'AI Loading', 
        'AI model is still loading in the background. Please wait a moment and try again.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    // AI must be ready to proceed
    if (!aiInitialized) {
      Alert.alert('AI Required', 'AI must be initialized to use camera features.');
      return;
    }
    
    setCameraModalVisible(true);
  };

  const handlePhotoAnalyzed = (response: string) => {
    setLastAiResponse(response);
    Alert.alert('AI Photo Analysis', response);
  };

  const handleCloseCameraModal = () => {
    setCameraModalVisible(false);
  };

  const handleMapPress = async () => {
    // Lazy initialization for map AI features
    if (!aiInitialized && !initializationAttempted) {
      console.log('🔄 User requested map AI feature - starting lazy initialization...');
      await initializeAILazily();
    }
    
    // For now, just show a placeholder
    Alert.alert(
      'Map Feature', 
      'Map integration coming soon!\n\nCurrent status:\n• AI Ready: ' + (aiInitialized ? 'Yes' : 'Loading...') + '\n• Offline Maps: Coming soon',
      [{ text: 'OK', style: 'default' }]
    );
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
          {lastAiResponse && !isRecording && !isProcessingAudio && (
            <View style={styles.responseOverlay}>
              <Text style={styles.responseText} numberOfLines={3}>
                🤖 {lastAiResponse}
              </Text>
            </View>
          )}

          {/* Recording Status Display */}
          {isRecording && (
            <View style={styles.recordingOverlay}>
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>🎤 Listening...</Text>
              </View>
              <Text style={styles.recordingSubtext}>Tap microphone to stop</Text>
            </View>
          )}

          {/* Processing Status Display */}
          {isProcessingAudio && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.processingText}>🗣️ Processing speech...</Text>
              <Text style={styles.processingSubtext}>Converting voice to text</Text>
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
            isProcessingAudio && styles.processingButton,
            !aiInitialized && styles.disabledButton
          ]} 
          onPress={handleMicrophonePress}
          disabled={!aiInitialized || isProcessingAudio}
        >
          {isProcessingAudio ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons 
              name={isRecording ? "mic" : "mic-outline"} 
              size={32} 
              color={isRecording ? "#ff4444" : (!aiInitialized ? "#666" : "#ffffff")} 
            />
          )}
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

      {/* Camera Modal */}
      <CameraModal
        visible={cameraModalVisible}
        onClose={handleCloseCameraModal}
        onPhotoAnalyzed={handlePhotoAnalyzed}
      />

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
  processingButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    borderColor: '#007AFF',
  },
  disabledButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  // Recording status styles
  recordingOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 68, 68, 0.9)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    marginRight: 8,
  },
  recordingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  recordingSubtext: {
    color: '#ffffff',
    fontSize: 12,
    opacity: 0.9,
  },
  // Processing status styles
  processingOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  processingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  processingSubtext: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.9,
  },
});
