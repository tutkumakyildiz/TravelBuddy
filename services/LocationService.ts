import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocationData {
  latitude: number;
  longitude: number;
  placeName: string;
  timestamp: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface LocationServiceConfig {
  enableHighAccuracy: boolean;
  enableCaching: boolean;
  cacheExpiryMinutes: number;
  requestTimeoutMs: number;
}

class LocationService {
  private static instance: LocationService;
  private currentLocation: LocationData | null = null;
  private isLocationLoading = false;
  private watchSubscription: Location.LocationSubscription | null = null;
  
  private config: LocationServiceConfig = {
    enableHighAccuracy: true,
    enableCaching: true,
    cacheExpiryMinutes: 30, // Cache location for 30 minutes
    requestTimeoutMs: 15000, // 15 second timeout
  };

  private constructor() {}

  public static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Initialize location services with permissions
   */
  public async initialize(): Promise<boolean> {
    try {
      console.log('📍 Initializing LocationService...');
      
      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        console.log('❌ Location services are disabled on device');
        return false;
      }

      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('❌ Location permission denied');
        return false;
      }

      console.log('✅ Location permissions granted');
      return true;
    } catch (error) {
      console.error('❌ LocationService initialization failed:', error);
      return false;
    }
  }

  /**
   * Get current location with caching support
   */
  public async getCurrentLocation(forceRefresh = false): Promise<LocationData | null> {
    if (this.isLocationLoading) {
      console.log('📍 Location request already in progress...');
      return this.currentLocation;
    }

    try {
      this.isLocationLoading = true;

      // Try to use cached location first (if not forcing refresh)
      if (!forceRefresh && this.config.enableCaching) {
        const cachedLocation = await this.getCachedLocation();
        if (cachedLocation) {
          console.log('📍 Using cached location:', cachedLocation.placeName);
          this.currentLocation = cachedLocation;
          return cachedLocation;
        }
      }

      console.log('📍 Getting fresh location from GPS...');

      // Get fresh location from GPS
      const locationData = await Promise.race([
        this.fetchLocationFromGPS(),
        this.createTimeoutPromise()
      ]);

      if (locationData) {
        // Get place name via reverse geocoding
        const placeName = await this.reverseGeocode(
          locationData.latitude, 
          locationData.longitude
        );

        const location: LocationData = {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          placeName,
          timestamp: Date.now(),
          accuracy: locationData.accuracy,
          altitude: locationData.altitude,
          heading: locationData.heading,
          speed: locationData.speed,
        };

        // Cache the location
        if (this.config.enableCaching) {
          await this.cacheLocation(location);
        }

        this.currentLocation = location;
        console.log('✅ Got fresh location:', location.placeName);
        return location;
      }

      console.log('❌ Failed to get location');
      return null;

    } catch (error) {
      console.error('❌ Error getting location:', error);
      
      // Fallback to cached location if available
      const cachedLocation = await this.getCachedLocation();
      if (cachedLocation) {
        console.log('📍 Falling back to cached location');
        this.currentLocation = cachedLocation;
        return cachedLocation;
      }
      
      return null;
    } finally {
      this.isLocationLoading = false;
    }
  }

  /**
   * Start watching location changes
   */
  public async startLocationWatch(
    callback: (location: LocationData) => void
  ): Promise<boolean> {
    try {
      if (this.watchSubscription) {
        console.log('📍 Location watch already active');
        return true;
      }

      console.log('📍 Starting location watch...');
      
      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: this.config.enableHighAccuracy 
            ? Location.Accuracy.BestForNavigation 
            : Location.Accuracy.Balanced,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        async (locationUpdate) => {
          const placeName = await this.reverseGeocode(
            locationUpdate.coords.latitude,
            locationUpdate.coords.longitude
          );

          const location: LocationData = {
            latitude: locationUpdate.coords.latitude,
            longitude: locationUpdate.coords.longitude,
            placeName,
            timestamp: Date.now(),
            accuracy: locationUpdate.coords.accuracy,
            altitude: locationUpdate.coords.altitude,
            heading: locationUpdate.coords.heading,
            speed: locationUpdate.coords.speed,
          };

          this.currentLocation = location;
          
          // Cache updated location
          if (this.config.enableCaching) {
            await this.cacheLocation(location);
          }

          callback(location);
        }
      );

      console.log('✅ Location watch started');
      return true;
    } catch (error) {
      console.error('❌ Failed to start location watch:', error);
      return false;
    }
  }

  /**
   * Stop watching location changes
   */
  public stopLocationWatch(): void {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
      console.log('📍 Location watch stopped');
    }
  }

  /**
   * Get last known location (cached or current)
   */
  public getLastKnownLocation(): LocationData | null {
    return this.currentLocation;
  }

  /**
   * Check if location services are available and permitted
   */
  public async isLocationAvailable(): Promise<boolean> {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      const { status } = await Location.getForegroundPermissionsAsync();
      return enabled && status === 'granted';
    } catch {
      return false;
    }
  }

  // Private helper methods

  private async fetchLocationFromGPS(): Promise<Location.LocationObjectCoords | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: this.config.enableHighAccuracy 
          ? Location.Accuracy.BestForNavigation 
          : Location.Accuracy.Balanced,
      });
      return location.coords;
    } catch (error) {
      console.error('GPS fetch error:', error);
      return null;
    }
  }

  private createTimeoutPromise(): Promise<null> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Location request timeout'));
      }, this.config.requestTimeoutMs);
    });
  }

  private async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses.length > 0) {
        const address = addresses[0];
        const parts = [
          address.name,
          address.city || address.subregion,
          address.region,
          address.country
        ].filter(Boolean);
        
        return parts.length > 0 ? parts.join(', ') : 'Unknown Location';
      }
      return 'Unknown Location';
    } catch (error) {
      console.log('Reverse geocoding failed, using coordinates');
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
  }

  private async cacheLocation(location: LocationData): Promise<void> {
    try {
      await AsyncStorage.setItem('cached_location', JSON.stringify(location));
    } catch (error) {
      console.warn('Failed to cache location:', error);
    }
  }

  private async getCachedLocation(): Promise<LocationData | null> {
    try {
      const cached = await AsyncStorage.getItem('cached_location');
      if (cached) {
        const location: LocationData = JSON.parse(cached);
        const age = Date.now() - location.timestamp;
        const maxAge = this.config.cacheExpiryMinutes * 60 * 1000;
        
        if (age < maxAge) {
          return location;
        } else {
          console.log('📍 Cached location expired');
          await AsyncStorage.removeItem('cached_location');
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to get cached location:', error);
      return null;
    }
  }

  /**
   * Update service configuration
   */
  public updateConfig(newConfig: Partial<LocationServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('📍 LocationService config updated:', this.config);
  }

  /**
   * Clear cached location data
   */
  public async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem('cached_location');
      console.log('📍 Location cache cleared');
    } catch (error) {
      console.warn('Failed to clear location cache:', error);
    }
  }
}

export default LocationService; 