import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Alert, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator
} from 'react-native';
import { WebView } from 'react-native-webview';
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

interface MapComponentRef {
  refreshAttractions: () => Promise<void>;
}

const MapComponent = forwardRef<MapComponentRef, MapComponentProps>(({ 
  style, 
  onMapPress, 
  currentLocation
}, ref) => {
  const webViewRef = useRef<WebView>(null);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [offlineDataStatus, setOfflineDataStatus] = useState({
    tilesDownloaded: false,
    attractionsDownloaded: false,
    attractionCount: 0,
    categories: []
  });
  
  // Amsterdam center coordinates as default fallback
  const amsterdamCenter = { latitude: 52.3676, longitude: 4.9041 };

  useEffect(() => {
    console.log('🗺️ MapComponent initialized with WebView + OpenStreetMap');
    initializeMap();
  }, []);

  // Effect to handle location changes and update map center
  useEffect(() => {
    if (mapLoaded) {
      updateMapCenter();
      updateLocationMarker();
    }
  }, [mapLoaded, currentLocation, userLocation, offlineDataStatus]);

  // Expose refreshAttractions method through ref
  useImperativeHandle(ref, () => ({
    refreshAttractions: async () => {
      console.log('🔄 Refreshing attractions after download...');
      await loadAttractions();
      await loadOfflineDataStatus();
    }
  }), []);

  // Create a key that changes when attractions are loaded to force WebView reload
  const webViewKey = `map-current-${attractions.length}`;

  const initializeMap = async () => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
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
      console.log(`🎯 Loaded ${localAttractions.length} attractions from local storage`);
      
      if (localAttractions.length > 0) {
        console.log('🗺️ Sample attraction:', localAttractions[0].name, 'at', localAttractions[0].latitude, localAttractions[0].longitude);
      }
    } catch (error) {
      console.error('Failed to load attractions:', error);
    }
  };

  const handleMapPress = (coordinates: { latitude: number; longitude: number; attraction?: string; attractionData?: any }) => {
    console.log('🎯 Map pressed at:', coordinates);
    
    if (onMapPress) {
      onMapPress(coordinates);
    }
  };

  // Update map center based on current location
  const updateMapCenter = () => {
    if (webViewRef.current && mapLoaded) {
      const center = getActiveCenter();
      const message = JSON.stringify({
        action: 'updateCenter',
        latitude: center.latitude,
        longitude: center.longitude,
        zoom: 14
      });
      webViewRef.current.postMessage(message);
      console.log('📍 Updated map center to:', center);
    }
  };

  // Update location marker with GPS data
  const updateLocationMarker = () => {
    if (webViewRef.current && mapLoaded) {
      let locationData = null;
      
      if (currentLocation) {
        locationData = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          heading: (currentLocation as any).heading,
          accuracy: (currentLocation as any).accuracy
        };
      } else if (userLocation) {
        locationData = {
          latitude: userLocation.coords.latitude,
          longitude: userLocation.coords.longitude,
          heading: userLocation.coords.heading,
          accuracy: userLocation.coords.accuracy
        };
      }
      
      if (locationData) {
        const message = JSON.stringify({
          action: 'updateLocation',
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          heading: locationData.heading,
          accuracy: locationData.accuracy
        });
        webViewRef.current.postMessage(message);
        console.log('📍 Updated location marker - heading:', locationData.heading, 'accuracy:', locationData.accuracy);
      }
    }
  };

  // Get active center - prioritize currentLocation, then userLocation, then Amsterdam as fallback
  const getActiveCenter = () => {
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
      
      if (data.action === 'longPress') {
        // Handle long press for AI queries
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
        
        /* Google Maps style current location indicator */
        .google-location-marker {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: rgba(66, 133, 244, 0.3);
          border: 2px solid #4285f4;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse-location 2s infinite;
        }
        
        .google-location-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background-color: #4285f4;
          border: 2px solid #ffffff;
          position: absolute;
          z-index: 2;
        }
        
        .google-location-direction {
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 12px solid #4285f4;
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 3;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        }
        
        @keyframes pulse-location {
          0% { 
            transform: scale(1); 
            opacity: 1; 
          }
          50% { 
            transform: scale(1.1); 
            opacity: 0.8; 
          }
          100% { 
            transform: scale(1); 
            opacity: 1; 
          }
        }
        
        /* Google Maps style attraction circles */
        .attraction-circle {
          background-color: #4285f4;
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
        }
        
        .attraction-circle:hover {
          background-color: #1a73e8;
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        
        /* Different colors for different categories */
        .attraction-circle.culture { background-color: #9c27b0; }
        .attraction-circle.tourism { background-color: #ff9800; }
        .attraction-circle.historic { background-color: #8bc34a; }
        .attraction-circle.nature { background-color: #4caf50; }
        .attraction-circle.entertainment { background-color: #e91e63; }
        .attraction-circle.religious { background-color: #795548; }
        .attraction-circle.shopping { background-color: #2196f3; }
        .attraction-circle.transportation { background-color: #607d8b; }
        
        /* AI processing visual feedback */
        .attraction-circle.ai-processing {
          background-color: #ff9800 !important;
          animation: pulse-ai-processing 1s infinite;
        }
        
        @keyframes pulse-ai-processing {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
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
        const initialCenter = ${JSON.stringify(getActiveCenter())};
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
        
        // Interaction variables
        let isZooming = false;
        
        // Track zoom operations to prevent accidental clicks
        map.on('zoomstart', function() {
          isZooming = true;
        });
        
        map.on('zoomend', function() {
          // Keep zooming flag for a short time to prevent accidental clicks
          setTimeout(() => {
            isZooming = false;
          }, 300);
        });
        
        // Attractions from local storage
        const attractions = ${JSON.stringify(attractions)};
        console.log('🎯 Attractions loaded in map:', attractions.length);
        
        // Add attraction circles (Google Maps style) - only if attractions exist
        if (attractions && attractions.length > 0) {
          console.log('🗺️ Adding', attractions.length, 'attractions to map');
          attractions.forEach(attraction => {
            // Create circle marker instead of icon marker
            const circleMarker = L.circleMarker([attraction.latitude, attraction.longitude], {
              radius: 12,
              fillColor: getCategoryColor(attraction.category),
              color: '#ffffff',
              weight: 3,
              fillOpacity: 0.9,
              className: 'attraction-circle-leaflet'
            }).addTo(map);
            
            // Add category icon inside the circle
            const categoryIcon = getCategoryIcon(attraction.category);
            const divIcon = L.divIcon({
              html: \`<div class="attraction-circle \${getCategoryClass(attraction.category)}" style="width: 24px; height: 24px; font-size: 12px;">\${categoryIcon}</div>\`,
              className: 'attraction-circle-container',
              iconSize: [24, 24],
              iconAnchor: [12, 12],
              popupAnchor: [0, -12]
            });
            
            const iconMarker = L.marker([attraction.latitude, attraction.longitude], {
              icon: divIcon
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
              </div>
            \`;
            
            // Bind popup to both markers
            circleMarker.bindPopup(popupContent);
            iconMarker.bindPopup(popupContent);
            
            // Handle attraction marker interactions
            function handleAttractionTouch(e, marker) {
              e.originalEvent.preventDefault();
              e.originalEvent.stopPropagation();
              
              if (isZooming) {
                return;
              }
              
              console.log('Attraction clicked:', attraction.name);
              
              // Show popup immediately
              marker.openPopup();
              
              // Add visual feedback for AI query
              const markerElement = marker.getElement();
              if (markerElement) {
                markerElement.classList.add('ai-processing');
                setTimeout(() => {
                  markerElement.classList.remove('ai-processing');
                }, 1000);
              }
              
              // Send AI query immediately on single tap
              window.ReactNativeWebView.postMessage(JSON.stringify({
                action: 'longPress',
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
            }
            
            // Add click event listeners for both markers
            iconMarker.on('click', (e) => handleAttractionTouch(e, iconMarker));
            circleMarker.on('click', (e) => handleAttractionTouch(e, circleMarker));
          });
        } else {
          console.log('🎯 No attractions to display on map');
        }
        
        // Function to get category color
        function getCategoryColor(category) {
          const colorMap = {
            'Culture': '#9c27b0',
            'Tourism': '#ff9800',
            'Historic': '#8bc34a',
            'Nature': '#4caf50',
            'Entertainment': '#e91e63',
            'Religious': '#795548',
            'Shopping': '#2196f3',
            'Transportation': '#607d8b',
            'Other': '#4285f4'
          };
          return colorMap[category] || '#4285f4';
        }
        
        // Function to get category class
        function getCategoryClass(category) {
          const classMap = {
            'Culture': 'culture',
            'Tourism': 'tourism',
            'Historic': 'historic',
            'Nature': 'nature',
            'Entertainment': 'entertainment',
            'Religious': 'religious',
            'Shopping': 'shopping',
            'Transportation': 'transportation',
            'Other': 'other'
          };
          return classMap[category] || 'other';
        }
        
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
            'Transportation': '🚉',
            'Other': '📍'
          };
          return iconMap[category] || '📍';
        }
        
        // Function to create Google Maps-style location marker
        function createGoogleLocationMarker(lat, lng, heading, accuracy) {
          const locationData = currentLocation || userLocation;
          let directionElement = '';
          
          // Add direction arrow if heading is available
          if (heading !== null && heading !== undefined && !isNaN(heading)) {
            directionElement = '<div class="google-location-direction"></div>';
          }
          
          const googleLocationHtml = \`
            <div class="google-location-marker">
              <div class="google-location-dot"></div>
              \${directionElement}
            </div>
          \`;
          
          const googleLocationIcon = L.divIcon({
            html: googleLocationHtml,
            className: 'google-location-container',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -20]
          });
          
          const marker = L.marker([lat, lng], {
            icon: googleLocationIcon
          }).addTo(map);
          
          // Rotate the direction arrow based on heading
          if (heading !== null && heading !== undefined && !isNaN(heading)) {
            const markerElement = marker.getElement();
            if (markerElement) {
              const directionArrow = markerElement.querySelector('.google-location-direction');
              if (directionArrow) {
                // Convert heading to CSS rotation (0° = North, 90° = East, etc.)
                const rotationAngle = heading;
                directionArrow.style.transform = \`translateX(-50%) rotate(\${rotationAngle}deg)\`;
              }
            }
          }
          
          // Create popup content
          const popupContent = \`
            <div class="marker-popup">
              <b>📍 Current Location</b><br/>
              \${locationData && locationData.placeName ? locationData.placeName : 'You are here'}<br/>
              <small>GPS Connected</small>
              \${accuracy ? \`<br/><small>Accuracy: \${Math.round(accuracy)}m</small>\` : ''}
              \${heading !== null && heading !== undefined ? \`<br/><small>Direction: \${Math.round(heading)}°</small>\` : ''}
            </div>
          \`;
          
          marker.bindPopup(popupContent);
          
          return marker;
        }
        
        // Add Google Maps-style location markers
        if (currentLocation) {
          const heading = currentLocation.heading;
          const accuracy = currentLocation.accuracy;
          console.log('📍 Adding current location marker with heading:', heading, 'accuracy:', accuracy);
          
          currentLocationMarker = createGoogleLocationMarker(
            currentLocation.latitude, 
            currentLocation.longitude,
            heading,
            accuracy
          );
        } else if (userLocation) {
          const heading = userLocation.heading;
          const accuracy = userLocation.accuracy;
          console.log('📍 Adding user location marker with heading:', heading, 'accuracy:', accuracy);
          
          currentLocationMarker = createGoogleLocationMarker(
            userLocation.latitude, 
            userLocation.longitude,
            heading,
            accuracy
          );
        }
        
        // Handle map double tap for general locations
        let lastMapTapTime = 0;
        let mapClickIndicator = null;
        
        map.on('click', function(e) {
          if (isZooming) return;
          
          const now = Date.now();
          const timeSinceLastTap = now - lastMapTapTime;
          
          if (timeSinceLastTap < 300) { // 300ms window for double tap
            console.log('Map double tap detected');
            
            // Add visual indicator
            const clickIndicator = L.divIcon({
              className: 'click-indicator',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });
            
            mapClickIndicator = L.marker([e.latlng.lat, e.latlng.lng], { icon: clickIndicator })
              .addTo(map);
            
            // Send AI query for general location
            window.ReactNativeWebView.postMessage(JSON.stringify({
              action: 'longPress',
              latitude: e.latlng.lat,
              longitude: e.latlng.lng
            }));
            
            // Remove indicator after 2 seconds
            setTimeout(() => {
              if (mapClickIndicator) {
                map.removeLayer(mapClickIndicator);
                mapClickIndicator = null;
              }
            }, 2000);
            
            lastMapTapTime = 0;
          } else {
            lastMapTapTime = now;
          }
        });
        
        // Store current location marker for updates
        let currentLocationMarker = null;
        
        // Handle messages from React Native
        function handleMessage(messageData) {
          try {
            const data = JSON.parse(messageData);
            
            if (!map) {
              console.error('Map not initialized yet');
              return;
            }
            
            if (data.action === 'updateCenter') {
              console.log('Updating map center to:', data.latitude, data.longitude, 'with zoom:', data.zoom);
              map.setView([data.latitude, data.longitude], data.zoom);
            } else if (data.action === 'updateLocation') {
              // Update location marker with new position and heading
              console.log('Updating location marker to:', data.latitude, data.longitude, 'heading:', data.heading);
              
              // Remove existing marker if exists
              if (currentLocationMarker) {
                map.removeLayer(currentLocationMarker);
              }
              
              // Create new marker with updated location and heading
              currentLocationMarker = createGoogleLocationMarker(
                data.latitude, 
                data.longitude,
                data.heading,
                data.accuracy
              );
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
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, style]}>
      <WebView
        key={webViewKey}
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

      {/* View Mode Toggle */}
      {/* Removed View Mode Toggle */}
    </View>
  );
});

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

});

export default MapComponent;
export type { MapComponentRef }; 