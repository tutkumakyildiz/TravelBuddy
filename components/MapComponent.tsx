import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MapView, Camera, UserLocation } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import OfflineMapService from '../services/OfflineMapService';

interface MapComponentProps {
  style?: any;
  onMapPress?: (coordinates: { latitude: number; longitude: number }) => void;
  currentLocation?: {
    latitude: number;
    longitude: number;
    placeName?: string;
  };
}

const MapComponent: React.FC<MapComponentProps> = ({ 
  style, 
  onMapPress, 
  currentLocation 
}) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userLocationEnabled, setUserLocationEnabled] = useState(true);
  const [offlineMapService] = useState(() => OfflineMapService.getInstance());
  const [tilesDownloaded, setTilesDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ progress: 0, isDownloading: false });
  
  // Using MapLibre demo tiles for initial setup
  const mapStyleUrl = 'https://demotiles.maplibre.org/style.json';
  
  // Amsterdam center coordinates as default
  const amsterdamCenter = { latitude: 52.3676, longitude: 4.9041 };

  useEffect(() => {
    console.log('🗺️ MapComponent initialized with offline-first configuration');
    initializeOfflineMap();
  }, []);

  const initializeOfflineMap = async () => {
    try {
      // Initialize offline map service
      await offlineMapService.initialize();
      
      // Check if Amsterdam tiles are already downloaded
      const tilesExist = await offlineMapService.areAmsterdamTilesDownloaded();
      setTilesDownloaded(tilesExist);
      
      console.log(tilesExist ? '✅ Amsterdam tiles available offline' : '📡 Using online tiles');
    } catch (error) {
      console.error('❌ Failed to initialize offline map:', error);
    }
  };

  const handleDownloadAmsterdamTiles = async () => {
    try {
      Alert.alert(
        'Download Amsterdam Maps',
        'This will download offline map tiles for Amsterdam (~50MB).\n\nRequires internet connection for initial download.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Download', 
            onPress: async () => {
              console.log('🗺️ Starting Amsterdam tiles download...');
              setDownloadProgress({ progress: 0, isDownloading: true });
              
              // Start download
              const success = await offlineMapService.downloadAmsterdamTiles();
              
              if (success) {
                setTilesDownloaded(true);
                console.log('✅ Amsterdam tiles downloaded successfully');
                
                // Tiles downloaded successfully (in future versions we'll use these for offline)
                
                // Stop monitoring progress
                setDownloadProgress({ progress: 1, isDownloading: false });
              } else {
                console.log('❌ Failed to download Amsterdam tiles');
                setDownloadProgress({ progress: 0, isDownloading: false });
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ Error downloading tiles:', error);
      Alert.alert('Download Error', `Failed to download tiles: ${error.message}`);
    }
  };

  // Monitor download progress
  useEffect(() => {
    if (downloadProgress.isDownloading) {
      const interval = setInterval(() => {
        const progress = offlineMapService.getDownloadProgress();
        setDownloadProgress({
          progress: progress.progress,
          isDownloading: progress.isDownloading
        });
        
        if (!progress.isDownloading) {
          clearInterval(interval);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [downloadProgress.isDownloading]);

  const handleMapPress = (feature: any) => {
    if (onMapPress && feature.geometry && feature.geometry.coordinates) {
      const [longitude, latitude] = feature.geometry.coordinates;
      onMapPress({ latitude, longitude });
    }
  };

  const handleMapLoaded = () => {
    console.log('✅ MapLibre map loaded successfully');
    setMapLoaded(true);
  };

  const handleMapError = () => {
    console.error('❌ MapLibre map error');
    Alert.alert(
      'Map Error',
      'Failed to load map. Please check your internet connection or download offline tiles.',
      [{ text: 'OK' }]
    );
  };

  const centerOnAmsterdam = () => {
    console.log('🎯 Centering on Amsterdam');
  };

  const centerOnCurrentLocation = () => {
    if (currentLocation) {
      console.log('🎯 Centering on current location:', currentLocation);
    }
  };

  const toggleUserLocation = () => {
    setUserLocationEnabled(!userLocationEnabled);
  };

  const handleClearTiles = async () => {
    Alert.alert(
      'Clear Offline Maps',
      'This will delete all downloaded tiles and free up storage space.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            const success = await offlineMapService.clearAllTiles();
            if (success) {
              setTilesDownloaded(false);
              Alert.alert('Success', 'Offline tiles cleared');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, style]}>
      <MapView
        style={styles.map}
        onPress={handleMapPress}
        onDidFinishLoadingMap={handleMapLoaded}
        onDidFailLoadingMap={handleMapError}
      >
        <Camera
          zoomLevel={14}
          centerCoordinate={
            currentLocation 
              ? [currentLocation.longitude, currentLocation.latitude]
              : [amsterdamCenter.longitude, amsterdamCenter.latitude]
          }
          animationDuration={1000}
        />
        
        {userLocationEnabled && (
          <UserLocation
            visible={true}
            showsUserHeadingIndicator={true}
            animated={true}
          />
        )}
      </MapView>

      {/* Map controls overlay */}
      <View style={styles.controlsOverlay}>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={centerOnCurrentLocation}
        >
          <Ionicons name="location" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.locationButton}
          onPress={centerOnAmsterdam}
        >
          <Ionicons name="map" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.locationToggle,
            { backgroundColor: userLocationEnabled ? '#007AFF' : '#666' }
          ]}
          onPress={toggleUserLocation}
        >
          <Ionicons 
            name={userLocationEnabled ? "radio-button-on" : "radio-button-off"} 
            size={20} 
            color="#fff" 
          />
        </TouchableOpacity>
      </View>

      {/* Download controls */}
      <View style={styles.downloadOverlay}>
        {!tilesDownloaded && !downloadProgress.isDownloading && (
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={handleDownloadAmsterdamTiles}
          >
            <Ionicons name="download" size={20} color="#fff" />
            <Text style={styles.downloadButtonText}>Download Amsterdam</Text>
          </TouchableOpacity>
        )}

        {downloadProgress.isDownloading && (
          <View style={styles.downloadProgress}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.downloadProgressText}>
              {(downloadProgress.progress * 100).toFixed(0)}%
            </Text>
          </View>
        )}

        {tilesDownloaded && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearTiles}
          >
            <Ionicons name="trash" size={16} color="#fff" />
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Map info overlay */}
      <View style={styles.mapInfoOverlay}>
        <Text style={styles.mapInfoText}>
          {currentLocation?.placeName || 'Amsterdam, Netherlands'}
        </Text>
        <Text style={styles.mapInfoSubtext}>
          {mapLoaded 
            ? (tilesDownloaded ? 'Offline Maps Ready' : 'Online Maps')
            : 'Loading MapLibre...'
          }
        </Text>
      </View>

      {/* Attribution */}
      <View style={styles.attributionOverlay}>
        <Text style={styles.attributionText}>
          {tilesDownloaded 
            ? '© OpenStreetMap contributors'
            : '© MapLibre • © OpenStreetMap contributors'
          }
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'column',
    alignItems: 'center',
  },
  locationButton: {
    backgroundColor: '#007AFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  locationToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  downloadOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  downloadButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  downloadProgress: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  downloadProgressText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  clearButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  mapInfoOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 12,
    borderRadius: 8,
  },
  mapInfoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mapInfoSubtext: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 2,
  },
  attributionOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 4,
    borderRadius: 4,
  },
  attributionText: {
    color: '#fff',
    fontSize: 10,
  },
});

export default MapComponent; 