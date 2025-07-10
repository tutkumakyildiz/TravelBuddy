import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, TouchableOpacity, Alert, Text, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AIService from './services/AIService';
import MapComponent from './components/MapComponent';
import LocationService, { LocationData } from './services/LocationService';
import OfflineMapService from './services/OfflineMapService';

export default function App() {
  const [aiInitialized, setAiInitialized] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [lastAiResponse, setLastAiResponse] = useState<string>('');
  const [isProcessingLocation, setIsProcessingLocation] = useState(false);
  const [initializationAttempted, setInitializationAttempted] = useState(false);
  
  // Map download state
  const [mapDownloaded, setMapDownloaded] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapPaused, setMapPaused] = useState(false);
  const [mapProgress, setMapProgress] = useState(0);
  const [mapInitialized, setMapInitialized] = useState(false);
  
  // AI download state
  const [aiPaused, setAiPaused] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);

  // Real location data using LocationService
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  // Map view mode control
  const [forceViewMode, setForceViewMode] = useState<'current' | 'amsterdam' | null>(null);
  
  const locationService = LocationService.getInstance();
  const offlineMapService = OfflineMapService.getInstance();

  // Initialize location service and check map status
  useEffect(() => {
    console.log('🚀 App started - LocalTravelBuddy');
    console.log('📱 Checking initial state...');
    
    // Initialize location service
    initializeLocationService();
    
    // Check if map data is already downloaded
    checkMapDownloadStatus();
    
    // Cleanup function to stop location watch
    return () => {
      locationService.stopLocationWatch();
    };
  }, []);

  // Poll for download progress
  useEffect(() => {
    const interval = setInterval(() => {
      if (mapLoading) {
        const progress = offlineMapService.getDownloadProgress();
        setMapProgress(progress.progress);
        setMapPaused(offlineMapService.isDownloadPaused());
      }
      
      if (aiLoading) {
        const aiService = AIService.getInstance();
        const progress = aiService.getDownloadProgress();
        if (progress) {
          setAiProgress(progress.progress);
        }
        setAiPaused(aiService.isDownloadPaused());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [mapLoading, aiLoading]);

  const checkMapDownloadStatus = async () => {
    try {
      console.log('🗺️ Checking map download status...');
      const status = await offlineMapService.getOfflineDataStatus();
      setMapDownloaded(status.tilesDownloaded && status.attractionsDownloaded);
      setMapInitialized(true);
      console.log('🗺️ Map status:', status);
    } catch (error) {
      console.error('❌ Failed to check map status:', error);
      setMapInitialized(true);
    }
  };

  const initializeLocationService = async () => {
    try {
      setLocationLoading(true);
      setLocationError(null);
      
      console.log('📍 Initializing location service...');
      
      // Reset location service to clear any cached Google locations
      await locationService.resetLocationService();
      
      // Initialize location service with permissions
      const initialized = await locationService.initialize();
      
      if (initialized) {
        console.log('✅ Location service initialized successfully');
        
        // Get current location (force refresh to avoid cache)
        const location = await locationService.getCurrentLocation(true);
        
        if (location) {
          setCurrentLocation(location);
          console.log('📍 Current location:', location.placeName);
          console.log('📍 Coordinates:', location.latitude, location.longitude);
          
          // Check if this is Amsterdam (fallback) or real location
          const isAmsterdam = Math.abs(location.latitude - 52.3676) < 0.001 && 
                             Math.abs(location.longitude - 4.9041) < 0.001;
          
          if (isAmsterdam) {
            console.log('📍 Using Amsterdam fallback location (GPS may not be available)');
            setLocationError('Using Amsterdam as fallback location. GPS may not be available.');
          } else {
            console.log('📍 Using real GPS location');
          }
          
          // Start watching location changes
          await locationService.startLocationWatch((newLocation) => {
            setCurrentLocation(newLocation);
            console.log('📍 Location updated:', newLocation.placeName);
          });
        } else {
          console.log('❌ Failed to get current location');
          setLocationError('Failed to get current location');
        }
      } else {
        console.log('❌ Location service initialization failed');
        setLocationError('Location permissions denied or services disabled');
      }
    } catch (error) {
      console.error('❌ Location service error:', error);
      setLocationError(`Location error: ${error.message}`);
    } finally {
      setLocationLoading(false);
    }
  };

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
                'LocalTravelBuddy is loading the Gemma 3n AI model (2.9GB).\n\nFirst time setup may take 5-10 minutes.\n\nThe app will notify you when ready.',
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
          'LocalTravelBuddy AI (Gemma 3n) is now fully loaded and ready!\n\nAll location features are available.',
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
          'Insufficient memory to load the 2.9GB Gemma AI model.\n\nFor Android Emulator:\n• Increase RAM to 8GB\n• Close other apps\n• Restart emulator\n\nFor real device:\n• Close all other apps\n• Restart device',
          [{ text: 'OK', style: 'default' }]
        );
      } else if (error.message?.includes('storage') || error.message?.includes('space')) {
        Alert.alert(
          'Storage Error', 
          'Insufficient storage space for the 2.9GB model.\n\nRequired: 4GB+ free space\n\nPlease free up storage and try again.',
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

  const handleDownloadAI = async () => {
    if (aiLoading) {
      // Toggle pause/resume
      if (aiPaused) {
        const aiService = AIService.getInstance();
        aiService.resumeDownload();
        setAiPaused(false);
      } else {
        const aiService = AIService.getInstance();
        aiService.pauseDownload();
        setAiPaused(true);
      }
      return;
    }

    if (aiInitialized) {
      Alert.alert('AI Already Ready', 'AI model is already downloaded and ready to use.');
      return;
    }

    Alert.alert(
      'Download AI Model',
      'This will download the Gemma 3n AI model (2.9GB).\n\nFirst time setup may take 5-10 minutes depending on your internet connection.\n\nYou can pause/resume anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Download', 
          onPress: async () => {
            console.log('🔄 User initiated AI model download...');
            setAiProgress(0);
            const initialized = await initializeAILazily();
            if (!initialized) {
              Alert.alert(
                'Download Failed', 
                'Failed to download AI model. Please check your internet connection and try again.',
                [{ text: 'OK', style: 'default' }]
              );
            }
          }
        }
      ]
    );
  };

  const handleDownloadMap = async () => {
    if (mapLoading) {
      // Toggle pause/resume
      if (mapPaused) {
        offlineMapService.resumeDownload();
        setMapPaused(false);
      } else {
        offlineMapService.pauseDownload();
        setMapPaused(true);
      }
      return;
    }

    if (mapDownloaded) {
      Alert.alert('Map Already Downloaded', 'Amsterdam map and attractions are already available offline.');
      return;
    }

    Alert.alert(
      'Download Amsterdam Map',
      'This will download Amsterdam map tiles and attraction points for offline use.\n\nSize: ~100MB\nTime: 5-10 minutes\n\nYou can pause/resume anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Download', 
          onPress: async () => {
            console.log('🗺️ User initiated map download...');
            setMapLoading(true);
            setMapProgress(0);
            
            try {
              const success = await offlineMapService.downloadCompleteOfflineData();
              if (success) {
                setMapDownloaded(true);
                Alert.alert(
                  'Amsterdam Map Downloaded! 🇳🇱',
                  'Amsterdam map and attractions are now available offline!\n\n🗺️ How to access Amsterdam:\n• Use the 🇳🇱 button (bottom-right)\n• Or tap the indicator at top-left of map\n\nYou can now explore Amsterdam offline!',
                  [{ text: 'Switch to Amsterdam View', onPress: () => {
                    setForceViewMode('amsterdam');
                    setTimeout(() => setForceViewMode(null), 1000);
                  } }, { text: 'Stay Here', style: 'cancel' }]
                );
              } else {
                Alert.alert('Download Failed', 'Failed to download map data. Please try again.');
              }
            } catch (error) {
              console.error('❌ Map download failed:', error);
              Alert.alert('Download Failed', `Error: ${error.message}`);
            } finally {
              setMapLoading(false);
              setMapProgress(0);
              setMapPaused(false);
            }
          }
        }
      ]
    );
  };



  const handleLocationRefresh = async () => {
    try {
      console.log('📍 User requested location refresh...');
      setLocationLoading(true);
      setLocationError(null);
      
      // Clear cache and get fresh location
      await locationService.clearCache();
      const location = await locationService.getCurrentLocation(true);
      
      if (location) {
        setCurrentLocation(location);
        console.log('📍 Location refreshed:', location.placeName);
        console.log('📍 Coordinates:', location.latitude, location.longitude);
        
        // Check if this is Amsterdam (fallback) or real location
        const isAmsterdam = Math.abs(location.latitude - 52.3676) < 0.001 && 
                           Math.abs(location.longitude - 4.9041) < 0.001;
        
        if (isAmsterdam) {
          Alert.alert(
            'Location Info',
            'Using Amsterdam as fallback location.\n\nThis happens when:\n• GPS is disabled\n• Using Android emulator\n• Location permissions not granted\n\nTo get your real location:\n• Enable GPS/Location Services\n• Grant location permissions\n• Use a real device with GPS',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Location Updated', `Found your location: ${location.placeName}`, [{ text: 'OK' }]);
        }
      } else {
        setLocationError('Failed to refresh location');
        Alert.alert('Location Error', 'Failed to get your location. Using Amsterdam as fallback.', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('❌ Location refresh error:', error);
      setLocationError(`Location refresh error: ${error.message}`);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleMapPress = async (clickData: { latitude: number; longitude: number; attraction?: string; attractionData?: any }) => {
    console.log('🗺️ Map pressed at coordinates:', clickData);
    
    // Only process AI if there's actually an attraction clicked
    if (!clickData.attractionData && !clickData.attraction) {
      console.log('ℹ️ No attraction data - skipping AI processing');
      return;
    }

    // Lazy initialization for map AI features
    if (!aiInitialized && !initializationAttempted) {
      console.log('🔄 User requested map AI feature - starting lazy initialization...');
      const initialized = await initializeAILazily();
      if (!initialized) {
        return;
      }
    }

    // If AI is still loading, return
    if (aiLoading) {
      return;
    }

    // AI must be ready to proceed
    if (!aiInitialized) {
      return;
    }

    try {
      setIsProcessingLocation(true);
      console.log('🗺️ Processing clicked attraction query...');
      
      const aiService = AIService.getInstance();
      
      // Create detailed query for AI based on attraction data
      let query = '';
      if (clickData.attractionData) {
        const attraction = clickData.attractionData;
        query = `Tell me about ${attraction.name} in Amsterdam. It's a ${attraction.type} in the ${attraction.category} category. `;
        if (attraction.description) {
          query += `Description: ${attraction.description}. `;
        }
        if (attraction.address) {
          query += `Address: ${attraction.address}. `;
        }
        query += `Please provide interesting facts, historical information, visitor tips, and recommendations for this location.`;
      } else if (clickData.attraction) {
        query = `Tell me about ${clickData.attraction} in Amsterdam. Please provide interesting facts, historical information, visitor tips, and recommendations for this location.`;
      }
      
      const response = await aiService.processText(query);
      
      setLastAiResponse(response.text || '');
      
      if (response.error) {
        Alert.alert('Error', response.error);
      } else {
        Alert.alert(
          clickData.attraction ? `🎯 ${clickData.attraction}` : 'Attraction Info',
          `${response.text || 'No information available'}`,
          [{ text: 'Great!', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Error processing attraction query:', error);
      Alert.alert('Error', 'Failed to process attraction query. Please try again.');
    } finally {
      setIsProcessingLocation(false);
    }
  };



  return (
    <View style={styles.container}>
      {/* Real MapLibre Map */}
      <View style={styles.mapContainer}>
        <MapComponent 
          style={styles.map}
          currentLocation={currentLocation}
          forceViewMode={forceViewMode}
          onMapPress={(clickData) => {
            console.log('🗺️ Map pressed at:', clickData);
            handleMapPress(clickData);
          }}
        />
        
        {/* Last AI Response Display */}
        {lastAiResponse && !isProcessingLocation && (
          <View style={styles.responseOverlay}>
            <ScrollView style={styles.responseScrollView} showsVerticalScrollIndicator={true}>
              <Text style={styles.responseText}>
                🤖 {parseFormattedText(lastAiResponse).map((part, index) => (
                  <Text key={index} style={part.bold ? styles.boldText : null}>
                    {part.text}
                  </Text>
                ))}
              </Text>
            </ScrollView>
          </View>
        )}

        

        {/* Download Status Bar */}
        {(!mapDownloaded || !aiInitialized) && (
          <View style={styles.downloadStatusBar}>
            
            {/* Map Download Status */}
            {!mapDownloaded && (
              <TouchableOpacity 
                style={styles.downloadStatusItem}
                onPress={handleDownloadMap}
              >
                <View style={styles.downloadStatusContent}>
                  <Ionicons 
                    name={mapLoading ? (mapPaused ? "play" : "pause") : "map-outline"} 
                    size={20} 
                    color="#4CAF50" 
                  />
                  <View style={styles.downloadStatusText}>
                    <Text style={styles.downloadStatusName}>
                      {mapLoading ? (mapPaused ? 'Resume Map' : 'Pause Map') : 'Download Map'}
                    </Text>

                  </View>
                </View>
                {mapLoading && !mapPaused && (
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${mapProgress * 100}%` }]} />
                  </View>
                )}
              </TouchableOpacity>
            )}
            
            {/* AI Download Status */}
            {!aiInitialized && (
              <TouchableOpacity 
                style={styles.downloadStatusItem}
                onPress={handleDownloadAI}
              >
                <View style={styles.downloadStatusContent}>
                  <Ionicons 
                    name={aiLoading ? (aiPaused ? "play" : "pause") : "hardware-chip-outline"} 
                    size={20} 
                    color="#FF9800" 
                  />
                  <View style={styles.downloadStatusText}>
                    <Text style={styles.downloadStatusName}>
                      {aiLoading ? (aiPaused ? 'Resume AI' : 'Pause AI') : 'Download AI'}
                    </Text>

                  </View>
                </View>
                {aiLoading && !aiPaused && (
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${aiProgress * 100}%` }]} />
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Amsterdam View Button - Show when map is downloaded */}
        {mapDownloaded && (
          <TouchableOpacity 
            style={[
              styles.floatingButton,
              styles.amsterdamButton,
            ]} 
            onPress={() => {
              // Force the map to show Amsterdam
              console.log('🇳🇱 Switching to Amsterdam view...');
              setForceViewMode('amsterdam');
              
              // Reset after a short delay so user can toggle again
              setTimeout(() => {
                setForceViewMode(null);
              }, 1000);
            }}
          >
            <Text style={styles.amsterdamButtonText}>🇳🇱</Text>
          </TouchableOpacity>
        )}

        {/* Location Refresh Button - Only show when ready */}
        {mapDownloaded && aiInitialized && (
          <TouchableOpacity 
            style={[
              styles.floatingButton,
              styles.locationButton,
              locationLoading && styles.disabledButton
            ]} 
            onPress={handleLocationRefresh}
            disabled={locationLoading}
          >
            <Ionicons 
              name="location-outline" 
              size={24} 
              color={locationLoading ? "#666" : "#ffffff"} 
            />
          </TouchableOpacity>
        )}

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
  map: {
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
  locationStatusOverlay: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 8,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  locationStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  locationStatusText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  aiStatusOverlay: {
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
    maxHeight: 120,
  },
  responseScrollView: {
    maxHeight: 96,
  },
  responseText: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 16,
  },
  boldText: {
    fontWeight: 'bold',
  },
  controlPanel: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
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
  locationButton: {
    backgroundColor: 'rgba(255, 152, 0, 0.7)',
    marginRight: 20,
  },
  downloadButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.7)',
    marginRight: 20,
  },
  disabledButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  
  // Download Panel Styles
  downloadPanel: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  downloadPanelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  downloadPanelSubtitle: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 20,
    textAlign: 'center',
  },
  downloadPanelButton: {
    width: '100%',
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
  },
  mapDownloadButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
  },
  aiDownloadButton: {
    backgroundColor: 'rgba(255, 152, 0, 0.8)',
  },
  downloadButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadButtonText: {
    marginLeft: 12,
    flex: 1,
  },
  downloadButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  downloadButtonSubtitle: {
    fontSize: 12,
    color: '#cccccc',
    marginTop: 2,
  },
  
  // Download Status Bar Styles
  downloadStatusBar: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 12,
    padding: 16,
  },
  downloadStatusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  downloadStatusItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  downloadStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadStatusText: {
    marginLeft: 12,
    flex: 1,
  },
  downloadStatusName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  downloadStatusSubtext: {
    fontSize: 12,
    color: '#cccccc',
    marginTop: 2,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  
  // Floating Button Styles
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  amsterdamButton: {
    backgroundColor: 'rgba(255, 102, 0, 0.9)',
    bottom: 90,
  },
  amsterdamButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
});
