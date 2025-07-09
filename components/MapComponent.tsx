import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Alert, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  Platform,
  ScrollView,
  Modal
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import OfflineMapService, { Attraction } from '../services/OfflineMapService';

interface MapComponentProps {
  style?: any;
  onMapPress?: (coordinates: { latitude: number; longitude: number; attraction?: string; attractionData?: any }) => void;
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
  const webViewRef = useRef<WebView>(null);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [attractionsLoaded, setAttractionsLoaded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [showAttractionsModal, setShowAttractionsModal] = useState(false);
  const [offlineDataStatus, setOfflineDataStatus] = useState({
    tilesDownloaded: false,
    attractionsDownloaded: false,
    attractionCount: 0,
    lastUpdated: '',
    categories: []
  });
  const [isZooming, setIsZooming] = useState(false);
  
  // Amsterdam center coordinates as default
  const amsterdamCenter = { latitude: 52.3676, longitude: 4.9041 };

  useEffect(() => {
    console.log('🗺️ MapComponent initialized with WebView + OpenStreetMap');
    initializeMap();
  }, []);

  const initializeMap = async () => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        try {
          // Get current location
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced
          });
          setUserLocation(location);
          console.log('📍 User location obtained:', location.coords);
        } catch (locationError) {
          console.log('⚠️ Could not get current location:', locationError);
        }
      }
      
      // Initialize offline map service
      const offlineMapService = OfflineMapService.getInstance();
      await offlineMapService.initialize();
      
      // Load offline data status
      await loadOfflineDataStatus();
      
      // Load attractions if available
      await loadAttractions();
      
      console.log('📡 Using online tiles');
    } catch (error) {
      console.error('❌ Failed to initialize map:', error);
    }
  };

  const loadOfflineDataStatus = async () => {
    try {
      const offlineMapService = OfflineMapService.getInstance();
      const status = await offlineMapService.getOfflineDataStatus();
      setOfflineDataStatus(status);
      setCategories(status.categories);
      console.log('📊 Offline data status:', status);
    } catch (error) {
      console.error('Failed to load offline data status:', error);
    }
  };

  const loadAttractions = async () => {
    try {
      const offlineMapService = OfflineMapService.getInstance();
      const localAttractions = await offlineMapService.getLocalAttractions();
      setAttractions(localAttractions);
      setAttractionsLoaded(true);
      console.log(`🎯 Loaded ${localAttractions.length} attractions from local storage`);
    } catch (error) {
      console.error('Failed to load attractions:', error);
    }
  };

  const downloadOfflineData = async () => {
    try {
      const offlineMapService = OfflineMapService.getInstance();
      await offlineMapService.downloadCompleteOfflineData();
      
      // Reload status and attractions after download
      setTimeout(async () => {
        await loadOfflineDataStatus();
        await loadAttractions();
      }, 1000);
    } catch (error) {
      console.error('Failed to download offline data:', error);
    }
  };

  const filterAttractionsByCategory = async (category: string) => {
    try {
      const offlineMapService = OfflineMapService.getInstance();
      
      if (category === '' || category === 'All') {
        const allAttractions = await offlineMapService.getLocalAttractions();
        setAttractions(allAttractions);
        setSelectedCategory('');
      } else {
        const filteredAttractions = await offlineMapService.getAttractionsByCategory(category);
        setAttractions(filteredAttractions);
        setSelectedCategory(category);
      }
      
      console.log(`🔍 Filtered attractions by category: ${category}`);
    } catch (error) {
      console.error('Failed to filter attractions:', error);
    }
  };

  const handleMapPress = (coordinates: { latitude: number; longitude: number; attraction?: string; attractionData?: any }) => {
    console.log('🎯 Map pressed at:', coordinates);
    
    if (onMapPress) {
      onMapPress(coordinates);
    }
  };



  const zoomIn = () => {
    console.log('🔍 Zoom In button pressed');
    
    // Prevent rapid clicking
    if (isZooming) {
      console.log('⚠️ Zoom already in progress');
      return;
    }
    
    if (webViewRef.current && mapLoaded) {
      setIsZooming(true);
      const message = JSON.stringify({
        action: 'zoomIn'
      });
      console.log('📤 Sending zoom in message:', message);
      
      try {
        webViewRef.current.postMessage(message);
      } catch (error) {
        console.error('Error sending zoom in message:', error);
      }
      
      // Reset zooming state after a short delay
      setTimeout(() => {
        setIsZooming(false);
      }, 300);
    } else {
      console.log('⚠️ WebView ref not available or map not loaded');
    }
  };

  const zoomOut = () => {
    console.log('🔍 Zoom Out button pressed');
    
    // Prevent rapid clicking
    if (isZooming) {
      console.log('⚠️ Zoom already in progress');
      return;
    }
    
    if (webViewRef.current && mapLoaded) {
      setIsZooming(true);
      const message = JSON.stringify({
        action: 'zoomOut'
      });
      console.log('📤 Sending zoom out message:', message);
      
      try {
        webViewRef.current.postMessage(message);
      } catch (error) {
        console.error('Error sending zoom out message:', error);
      }
      
      // Reset zooming state after a short delay
      setTimeout(() => {
        setIsZooming(false);
      }, 300);
    } else {
      console.log('⚠️ WebView ref not available or map not loaded');
    }
  };





  // Generate the initial map position
  const getInitialCenter = () => {
    if (currentLocation) {
      return { latitude: currentLocation.latitude, longitude: currentLocation.longitude };
    } else if (userLocation) {
      return { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude };
    } else {
      return amsterdamCenter;
    }
  };

  // Handle messages from WebView
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.action === 'mapClick') {
        const clickData = {
          latitude: data.latitude,
          longitude: data.longitude,
          attraction: data.attraction || null,
          attractionData: data.attractionData || null
        };
        handleMapPress(clickData);
      } else if (data.action === 'mapLoaded') {
        setMapLoaded(true);
        console.log('✅ OpenStreetMap loaded successfully');
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };

  // Create the HTML content for the map
  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>OpenStreetMap</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100vw; }
        .marker-popup { font-size: 14px; }
        .attraction-marker { 
          background-color: #ff6b6b; 
          color: white; 
          border: 2px solid #ff4757; 
          border-radius: 50%; 
          text-align: center;
          font-weight: bold;
          font-size: 12px;
          width: 30px;
          height: 30px;
          line-height: 26px;
        }
        .click-indicator {
          position: absolute;
          width: 20px;
          height: 20px;
          background-color: #007bff;
          border: 2px solid #fff;
          border-radius: 50%;
          z-index: 1000;
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const initialCenter = ${JSON.stringify(getInitialCenter())};
        const currentLocation = ${JSON.stringify(currentLocation)};
        const userLocation = ${JSON.stringify(userLocation ? userLocation.coords : null)};
        
        // Create map
        const map = L.map('map').setView([initialCenter.latitude, initialCenter.longitude], 14);
        
        // Add tile layer
        const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
        
        L.tileLayer(tileUrl, {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 18
        }).addTo(map);
        
        // Attractions from local storage
        const attractions = ${JSON.stringify(attractions)};
        
        // Add attraction markers
        attractions.forEach(attraction => {
          const markerIcon = L.divIcon({
            html: getCategoryIcon(attraction.category),
            className: 'attraction-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15]
          });
          
          const marker = L.marker([attraction.latitude, attraction.longitude], {
            icon: markerIcon
          }).addTo(map);
          
          const popupContent = \`
            <div class="marker-popup">
              <h3>\${attraction.name}</h3>
              <p><strong>Category:</strong> \${attraction.category}</p>
              <p><strong>Type:</strong> \${attraction.type}</p>
              \${attraction.description ? \`<p><strong>Description:</strong> \${attraction.description}</p>\` : ''}
              \${attraction.address ? \`<p><strong>Address:</strong> \${attraction.address}</p>\` : ''}
              \${attraction.openingHours ? \`<p><strong>Hours:</strong> \${attraction.openingHours}</p>\` : ''}
              \${attraction.phone ? \`<p><strong>Phone:</strong> \${attraction.phone}</p>\` : ''}
              \${attraction.website ? \`<p><strong>Website:</strong> <a href="\${attraction.website}" target="_blank">\${attraction.website}</a></p>\` : ''}
              <button onclick="askAI('\${attraction.name}', '\${attraction.category}', '\${attraction.type}', '\${attraction.description || ''}', '\${attraction.address || ''}', \${attraction.latitude}, \${attraction.longitude})" 
                      style="background-color: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                Ask AI about this place
              </button>
            </div>
          \`;
          
          marker.bindPopup(popupContent);
          
          // Handle attraction marker clicks
          marker.on('click', function(e) {
            // Send attraction click to React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({
              action: 'mapClick',
              latitude: attraction.latitude,
              longitude: attraction.longitude,
              attraction: attraction.name,
              attractionData: {
                name: attraction.name,
                category: attraction.category,
                type: attraction.type,
                description: attraction.description || '',
                address: attraction.address || '',
                openingHours: attraction.openingHours || '',
                phone: attraction.phone || '',
                website: attraction.website || ''
              }
            }));
          });
        });
        
        // Function to get category icon
        function getCategoryIcon(category) {
          const iconMap = {
            'Culture': '🎭',
            'Tourism': '🏛️',
            'Historic': '🏰',
            'Nature': '🌳',
            'Entertainment': '🎪',
            'Religious': '⛪',
            'Shopping': '🛍️',
            'Food & Drink': '🍽️',
            'Transportation': '🚉',
            'Other': '📍'
          };
          return iconMap[category] || '📍';
        }
        
        // Function to ask AI about an attraction
        function askAI(name, category, type, description, address, latitude, longitude) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            action: 'mapClick',
            latitude: latitude,
            longitude: longitude,
            attraction: name,
            attractionData: {
              name: name,
              category: category,
              type: type,
              description: description,
              address: address,
              openingHours: '',
              phone: '',
              website: ''
            }
          }));
        }
        
        // Add location markers
        let currentLocationMarker = null;
        let userLocationMarker = null;
        
        if (currentLocation) {
          currentLocationMarker = L.marker([currentLocation.latitude, currentLocation.longitude])
            .addTo(map)
            .bindPopup('<div class="marker-popup"><b>Current Location</b><br/>' + (currentLocation.placeName || 'You are here') + '</div>');
        }
        
        if (userLocation && !currentLocation) {
          userLocationMarker = L.marker([userLocation.latitude, userLocation.longitude])
            .addTo(map)
            .bindPopup('<div class="marker-popup"><b>Your Location</b><br/>GPS Location</div>');
        }
        
        // Handle map clicks
        map.on('click', function(e) {
          // Add visual click indicator
          const clickIndicator = L.divIcon({
            className: 'click-indicator',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          
          const clickMarker = L.marker([e.latlng.lat, e.latlng.lng], { icon: clickIndicator })
            .addTo(map);
          
          // Remove click indicator after 2 seconds
          setTimeout(() => {
            map.removeLayer(clickMarker);
          }, 2000);
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            action: 'mapClick',
            latitude: e.latlng.lat,
            longitude: e.latlng.lng
          }));
        });
        
        // Handle messages from React Native
        function handleMessage(messageData) {
          try {
            const data = JSON.parse(messageData);
            console.log('WebView received message:', data);
            
            // Check if map is initialized
            if (!map) {
              console.error('Map not initialized yet');
              return;
            }
            
            if (data.action === 'centerMap') {
              console.log('Centering map at:', data.latitude, data.longitude);
              map.setView([data.latitude, data.longitude], 15);
            } else if (data.action === 'zoomIn') {
              console.log('Zooming in...');
              const currentZoom = map.getZoom();
              console.log('Current zoom level:', currentZoom);
              
              // Check if we can zoom in further
              if (currentZoom < map.getMaxZoom()) {
                map.zoomIn();
                console.log('New zoom level:', map.getZoom());
              } else {
                console.log('Already at maximum zoom level');
              }
            } else if (data.action === 'zoomOut') {
              console.log('Zooming out...');
              const currentZoom = map.getZoom();
              console.log('Current zoom level:', currentZoom);
              
              // Check if we can zoom out further
              if (currentZoom > map.getMinZoom()) {
                map.zoomOut();
                console.log('New zoom level:', map.getZoom());
              } else {
                console.log('Already at minimum zoom level');
              }
            }
          } catch (error) {
            console.error('Error parsing WebView message:', error);
          }
        }
        
        // Multiple message listeners for cross-platform compatibility
        document.addEventListener('message', function(event) {
          handleMessage(event.data);
        });
        
        window.addEventListener('message', function(event) {
          handleMessage(event.data);
        });
        
        // React Native specific message handling
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.onMessage = function(event) {
            handleMessage(event.data);
          };
        }
        
        // Notify React Native when map is loaded
        map.whenReady(function() {
          console.log('Map is ready!');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            action: 'mapLoaded'
          }));
          
          // Add a small delay to ensure everything is fully loaded
          setTimeout(function() {
            console.log('Map fully initialized and ready for interactions');
          }, 500);
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: mapHTML }}
        style={styles.webView}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007bff" />
            <Text style={styles.loadingText}>Loading OpenStreetMap...</Text>
          </View>
        )}
      />

      {/* Attractions Modal */}
      <Modal
        visible={showAttractionsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAttractionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attractions</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowAttractionsModal(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {/* Offline Status */}
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>
                {offlineDataStatus.attractionsDownloaded
                  ? `✅ ${offlineDataStatus.attractionCount} attractions available offline`
                  : '❌ No offline attractions available'}
              </Text>
              {offlineDataStatus.lastUpdated && (
                <Text style={styles.statusSubText}>
                  Last updated: {new Date(offlineDataStatus.lastUpdated).toLocaleDateString()}
                </Text>
              )}
            </View>
            
            {/* Download button */}
            {!offlineDataStatus.attractionsDownloaded && (
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={downloadOfflineData}
              >
                <Ionicons name="download" size={20} color="#fff" />
                <Text style={styles.downloadButtonText}>Download Amsterdam Attractions</Text>
              </TouchableOpacity>
            )}
            
            {/* Category Filter */}
            {categories.length > 0 && (
              <View style={styles.categoryContainer}>
                <Text style={styles.categoryTitle}>Filter by Category:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[
                      styles.categoryButton,
                      selectedCategory === '' && styles.categoryButtonActive
                    ]}
                    onPress={() => filterAttractionsByCategory('All')}
                  >
                    <Text style={[
                      styles.categoryButtonText,
                      selectedCategory === '' && styles.categoryButtonTextActive
                    ]}>All</Text>
                  </TouchableOpacity>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        selectedCategory === category && styles.categoryButtonActive
                      ]}
                      onPress={() => filterAttractionsByCategory(category)}
                    >
                      <Text style={[
                        styles.categoryButtonText,
                        selectedCategory === category && styles.categoryButtonTextActive
                      ]}>{category}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            
            {/* Attractions List */}
            <ScrollView style={styles.attractionsList}>
              {attractions.map((attraction) => (
                <TouchableOpacity
                  key={attraction.id}
                  style={styles.attractionItem}
                  onPress={() => {
                    // Center map on attraction
                    if (webViewRef.current) {
                      webViewRef.current.postMessage(JSON.stringify({
                        action: 'centerMap',
                        latitude: attraction.latitude,
                        longitude: attraction.longitude
                      }));
                    }
                    setShowAttractionsModal(false);
                  }}
                >
                  <View style={styles.attractionHeader}>
                    <Text style={styles.attractionName}>{attraction.name}</Text>
                    <Text style={styles.attractionCategory}>{attraction.category}</Text>
                  </View>
                  {attraction.description && (
                    <Text style={styles.attractionDescription}>
                      {attraction.description.substring(0, 100)}
                      {attraction.description.length > 100 ? '...' : ''}
                    </Text>
                  )}
                  {attraction.address && (
                    <Text style={styles.attractionAddress}>📍 {attraction.address}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Debug info */}
      <View style={styles.debugInfo}>
        <Text style={styles.debugText}>Map Loaded: {mapLoaded ? 'Yes' : 'No'}</Text>
        <Text style={styles.debugText}>Zooming: {isZooming ? 'Yes' : 'No'}</Text>
      </View>




    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  controlsOverlay: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'column',
    gap: 10,
  },
  locationButton: {
    backgroundColor: '#007bff',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
    opacity: 0.6,
  },
  debugInfo: {
    position: 'absolute',
    top: 140,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  statusContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusSubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  downloadButton: {
    backgroundColor: '#28a745',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  categoryContainer: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  categoryButton: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  categoryButtonActive: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  categoryButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  attractionsList: {
    flex: 1,
  },
  attractionItem: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  attractionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  attractionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  attractionCategory: {
    fontSize: 12,
    color: '#007bff',
    backgroundColor: '#e7f3ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontWeight: '500',
  },
  attractionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 5,
  },
  attractionAddress: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
});

export default MapComponent; 