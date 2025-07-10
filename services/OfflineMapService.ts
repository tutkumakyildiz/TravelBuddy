import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

interface TileDownloadProgress {
  totalTiles: number;
  downloadedTiles: number;
  progress: number;
  isDownloading: boolean;
}

interface AttractionDownloadProgress {
  totalAttractions: number;
  downloadedAttractions: number;
  progress: number;
  isDownloading: boolean;
}

interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface Attraction {
  id: string;
  name: string;
  type: string;
  category: string;
  latitude: number;
  longitude: number;
  tags: { [key: string]: string };
  description?: string;
  website?: string;
  address?: string;
  openingHours?: string;
  phone?: string;
  rating?: number;
  imageUrl?: string;
}

interface AttractionsData {
  attractions: Attraction[];
  lastUpdated: string;
  totalCount: number;
  categories: string[];
}

class OfflineMapService {
  private static instance: OfflineMapService;
  private isDownloading: boolean = false;
  private isDownloadingAttractions: boolean = false;
  private isPaused: boolean = false;
  private downloadProgress: TileDownloadProgress = {
    totalTiles: 0,
    downloadedTiles: 0,
    progress: 0,
    isDownloading: false
  };
  private attractionDownloadProgress: AttractionDownloadProgress = {
    totalAttractions: 0,
    downloadedAttractions: 0,
    progress: 0,
    isDownloading: false
  };

  // Amsterdam bounding box coordinates
  private readonly AMSTERDAM_BBOX: BoundingBox = {
    north: 52.431,   // North of Amsterdam
    south: 52.317,   // South of Amsterdam  
    east: 5.014,     // East of Amsterdam
    west: 4.728      // West of Amsterdam
  };

  // Using OpenStreetMap tile server with proper rate limiting
  private readonly TILE_SERVER = 'https://tile.openstreetmap.org';
  
  // Zoom levels to download (reduced for testing - 12-14 covers core city detail)
  private readonly ZOOM_LEVELS = [12, 13, 14];

  private constructor() {}

  public static getInstance(): OfflineMapService {
    if (!OfflineMapService.instance) {
      OfflineMapService.instance = new OfflineMapService();
    }
    return OfflineMapService.instance;
  }

  /**
   * Initialize offline map service and create directories
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🗺️ Initializing Offline Map Service...');
      
      // Create tiles directory
      const tilesDir = `${FileSystem.documentDirectory}tiles/`;
      const dirInfo = await FileSystem.getInfoAsync(tilesDir);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(tilesDir, { intermediates: true });
        console.log('📁 Created tiles directory');
      }
      
      // Create attractions directory
      const attractionsDir = `${FileSystem.documentDirectory}attractions/`;
      const attractionsDirInfo = await FileSystem.getInfoAsync(attractionsDir);
      
      if (!attractionsDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(attractionsDir, { intermediates: true });
        console.log('📁 Created attractions directory');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize offline map service:', error);
      return false;
    }
  }

  /**
   * Download complete offline data (maps + attractions)
   */
  async downloadCompleteOfflineData(): Promise<boolean> {
    try {
      console.log('📥 Starting complete offline data download...');
      
      Alert.alert(
        'Complete Offline Download',
        'This will download map tiles and attractions for Amsterdam.\n\nThis may take 10-15 minutes and requires ~100MB storage.\n\nYou can use your phone while this downloads in the background.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Download', onPress: this.performCompleteDownload.bind(this) }
        ]
      );
      
      return true;
    } catch (error) {
      console.error('❌ Failed to start complete download:', error);
      return false;
    }
  }

  private async performCompleteDownload(): Promise<void> {
    try {
      // Step 1: Download map tiles
      console.log('🗺️ Step 1: Downloading map tiles...');
      await this.downloadAmsterdamTiles();
      
      // Step 2: Download attractions
      console.log('🎯 Step 2: Downloading attractions...');
      await this.downloadAmsterdamAttractions();
      
      Alert.alert(
        'Download Complete!',
        'Amsterdam maps and attractions are now available offline!\n\nYou can explore the city without internet connection.',
        [{ text: 'Awesome!' }]
      );
      
    } catch (error) {
      console.error('❌ Complete download failed:', error);
      Alert.alert(
        'Download Failed',
        `Failed to download offline data: ${error.message}`,
        [{ text: 'OK' }]
      );
    }
  }

  /**
   * Download Amsterdam map tiles for offline use
   */
  async downloadAmsterdamTiles(): Promise<boolean> {
    if (this.isDownloading) {
      console.log('Download already in progress');
      return false;
    }

    try {
      this.isDownloading = true;
      this.downloadProgress.isDownloading = true;
      
      console.log('📥 Starting Amsterdam map tiles download...');
      console.log('📍 Area: Amsterdam city center and surroundings');
      console.log('🔍 Zoom levels: 10-16');
      
      // Calculate total tiles needed
      const totalTiles = this.calculateTotalTiles();
      this.downloadProgress.totalTiles = totalTiles;
      this.downloadProgress.downloadedTiles = 0;
      
      console.log(`📊 Total tiles to download: ${totalTiles}`);
      
      // Show user what we're doing
      Alert.alert(
        'Downloading Amsterdam Maps',
        `Downloading ${totalTiles} tiles for offline use.\n\nThis will take 5-10 minutes and requires ~50MB storage.\n\nThe app will notify you when complete.`,
        [{ text: 'OK' }]
      );

      let downloadedCount = 0;
      
      // Download tiles for each zoom level
      for (const zoom of this.ZOOM_LEVELS) {
        const tiles = this.getTilesForZoom(zoom);
        
        console.log(`📥 Downloading zoom level ${zoom} (${tiles.length} tiles)`);
        
                  // Download tiles sequentially to be respectful to OSM servers
          for (const tile of tiles) {
            // Check if download is paused
            while (this.isPaused && this.isDownloading) {
              console.log('⏸️ Download paused, waiting...');
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Check if download was cancelled
            if (!this.isDownloading) {
              console.log('❌ Download cancelled');
              return false;
            }
            
            try {
              const success = await this.downloadTile(tile.x, tile.y, zoom);
              if (success) {
                downloadedCount++;
                this.downloadProgress.downloadedTiles = downloadedCount;
                this.downloadProgress.progress = downloadedCount / totalTiles;
              }
            } catch (error) {
              console.error(`Failed to download tile ${tile.x}/${tile.y}/${zoom}:`, error);
            }
            
            // Respectful delay between each tile download (1 second)
            await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Log progress
          if (downloadedCount % 50 === 0) {
            console.log(`📊 Progress: ${downloadedCount}/${totalTiles} tiles (${(this.downloadProgress.progress * 100).toFixed(1)}%)`);
          }
        }
      }
      
      console.log('✅ Amsterdam tiles download completed!');
      
      Alert.alert(
        'Maps Downloaded!',
        `Successfully downloaded ${downloadedCount} tiles for Amsterdam.\n\nOffline maps are now available!`,
        [{ text: 'Great!' }]
      );
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to download Amsterdam tiles:', error);
      Alert.alert(
        'Download Error',
        `Failed to download map tiles: ${error.message}`,
        [{ text: 'OK' }]
      );
      return false;
    } finally {
      this.isDownloading = false;
      this.downloadProgress.isDownloading = false;
    }
  }

  /**
   * Download Amsterdam attractions using Overpass API
   */
  async downloadAmsterdamAttractions(): Promise<boolean> {
    if (this.isDownloadingAttractions) {
      console.log('Attractions download already in progress');
      return false;
    }

    try {
      this.isDownloadingAttractions = true;
      this.attractionDownloadProgress.isDownloading = true;
      
      console.log('🎯 Starting Amsterdam attractions download...');
      
      // Overpass API query for Amsterdam attractions
      const overpassQuery = `
        [out:json][timeout:120];
        (
          // Museums
          nwr["tourism"="museum"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
          
          // Attractions & viewpoints
          nwr["tourism"="attraction"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
          nwr["tourism"="viewpoint"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
          
          // Historic sites
          nwr["historic"~"^(monument|castle|palace|church|building|archaeological_site)$"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
          
          // Parks & gardens
          nwr["leisure"="park"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
          nwr["leisure"="garden"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
          
          // Theaters, cinemas & arts
          nwr["amenity"="theatre"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
          nwr["amenity"="cinema"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
          nwr["amenity"="arts_centre"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
          
          // Places of worship
          nwr["amenity"="place_of_worship"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
          
          // Markets & shopping
          nwr["amenity"="marketplace"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
          nwr["shop"="mall"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
          
          // Popular restaurants & cafes
          nwr["amenity"="restaurant"]["name"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
          nwr["amenity"="cafe"]["name"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
          
          // Transportation hubs
          nwr["railway"="station"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
          nwr["amenity"="ferry_terminal"](${this.AMSTERDAM_BBOX.south},${this.AMSTERDAM_BBOX.west},${this.AMSTERDAM_BBOX.north},${this.AMSTERDAM_BBOX.east});
        );
        out geom;
      `;

      const encodedQuery = encodeURIComponent(overpassQuery);
      const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodedQuery}`;
      
      console.log('📡 Fetching attractions from Overpass API...');
      
      const response = await fetch(overpassUrl, {
        headers: {
          'User-Agent': 'LocalTravelBuddy/1.0 (Development Build)',
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Process the data
      const attractions = this.processOverpassData(data);
      this.attractionDownloadProgress.totalAttractions = attractions.length;
      
      // Save to local storage
      await this.saveAttractionsToLocal(attractions);
      
      console.log(`✅ Downloaded ${attractions.length} attractions for Amsterdam`);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to download attractions:', error);
      return false;
    } finally {
      this.isDownloadingAttractions = false;
      this.attractionDownloadProgress.isDownloading = false;
    }
  }

  /**
   * Process raw Overpass API data into attractions
   */
  private processOverpassData(data: any): Attraction[] {
    const attractions: Attraction[] = [];
    
    data.elements.forEach((element: any) => {
      if (!element.tags || !element.tags.name) return;
      
      let lat: number, lon: number;
      
      // Handle different geometry types
      if (element.lat && element.lon) {
        lat = element.lat;
        lon = element.lon;
      } else if (element.center) {
        lat = element.center.lat;
        lon = element.center.lon;
      } else if (element.geometry && element.geometry.length > 0) {
        // For ways, use the first point
        lat = element.geometry[0].lat;
        lon = element.geometry[0].lon;
      } else {
        return; // Skip if no coordinates
      }
      
      // Skip if coordinates are outside Amsterdam bounds
      if (lat < this.AMSTERDAM_BBOX.south || lat > this.AMSTERDAM_BBOX.north ||
          lon < this.AMSTERDAM_BBOX.west || lon > this.AMSTERDAM_BBOX.east) {
        return;
      }
      
      // Determine attraction type and category
      const { type, category } = this.getAttractionTypeAndCategory(element.tags);
      
      const attraction: Attraction = {
        id: element.id.toString(),
        name: element.tags.name || 'Unknown',
        type: type,
        category: category,
        latitude: lat,
        longitude: lon,
        tags: element.tags,
        description: element.tags.description || element.tags['description:en'],
        website: element.tags.website || element.tags['contact:website'],
        address: this.formatAddress(element.tags),
        openingHours: element.tags.opening_hours || element.tags['opening_hours:covid19'],
        phone: element.tags.phone || element.tags['contact:phone'],
        rating: this.extractRating(element.tags)
      };
      
      attractions.push(attraction);
    });
    
    return attractions;
  }

  /**
   * Determine attraction type and category from OSM tags
   */
  private getAttractionTypeAndCategory(tags: any): { type: string; category: string } {
    // Museums
    if (tags.tourism === 'museum') {
      return { type: 'museum', category: 'Culture' };
    }
    
    // Tourism attractions
    if (tags.tourism === 'attraction') {
      return { type: 'attraction', category: 'Tourism' };
    }
    
    if (tags.tourism === 'viewpoint') {
      return { type: 'viewpoint', category: 'Tourism' };
    }
    
    // Historic sites
    if (tags.historic) {
      return { type: tags.historic, category: 'Historic' };
    }
    
    // Parks & nature
    if (tags.leisure === 'park') {
      return { type: 'park', category: 'Nature' };
    }
    
    if (tags.leisure === 'garden') {
      return { type: 'garden', category: 'Nature' };
    }
    
    // Entertainment
    if (tags.amenity === 'theatre') {
      return { type: 'theater', category: 'Entertainment' };
    }
    
    if (tags.amenity === 'cinema') {
      return { type: 'cinema', category: 'Entertainment' };
    }
    
    if (tags.amenity === 'arts_centre') {
      return { type: 'arts_center', category: 'Culture' };
    }
    
    // Religious sites
    if (tags.amenity === 'place_of_worship') {
      return { type: 'religious', category: 'Religious' };
    }
    
    // Shopping
    if (tags.amenity === 'marketplace') {
      return { type: 'market', category: 'Shopping' };
    }
    
    if (tags.shop === 'mall') {
      return { type: 'mall', category: 'Shopping' };
    }
    
    // Food & drink
    if (tags.amenity === 'restaurant') {
      return { type: 'restaurant', category: 'Food & Drink' };
    }
    
    if (tags.amenity === 'cafe') {
      return { type: 'cafe', category: 'Food & Drink' };
    }
    
    // Transportation
    if (tags.railway === 'station') {
      return { type: 'train_station', category: 'Transportation' };
    }
    
    if (tags.amenity === 'ferry_terminal') {
      return { type: 'ferry_terminal', category: 'Transportation' };
    }
    
    return { type: 'other', category: 'Other' };
  }

  /**
   * Format address from OSM tags
   */
  private formatAddress(tags: any): string {
    const parts = [];
    
    if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
    if (tags['addr:street']) parts.push(tags['addr:street']);
    if (tags['addr:postcode']) parts.push(tags['addr:postcode']);
    if (tags['addr:city']) parts.push(tags['addr:city']);
    
    return parts.join(', ') || '';
  }

  /**
   * Extract rating from tags (if available)
   */
  private extractRating(tags: any): number | undefined {
    if (tags.stars) {
      return parseFloat(tags.stars);
    }
    return undefined;
  }

  /**
   * Save attractions to local storage
   */
  private async saveAttractionsToLocal(attractions: Attraction[]): Promise<void> {
    try {
      // Group attractions by category
      const categories = [...new Set(attractions.map(a => a.category))];
      
      const attractionsData: AttractionsData = {
        attractions: attractions,
        lastUpdated: new Date().toISOString(),
        totalCount: attractions.length,
        categories: categories
      };
      
      const attractionsPath = `${FileSystem.documentDirectory}attractions/attractions.json`;
      await FileSystem.writeAsStringAsync(
        attractionsPath, 
        JSON.stringify(attractionsData, null, 2)
      );
      
      // Save attractions by category for faster filtering
      for (const category of categories) {
        const categoryAttractions = attractions.filter(a => a.category === category);
        const categoryPath = `${FileSystem.documentDirectory}attractions/${category.toLowerCase().replace(/\s+/g, '_')}.json`;
        await FileSystem.writeAsStringAsync(
          categoryPath,
          JSON.stringify(categoryAttractions, null, 2)
        );
      }
      
      console.log('💾 Saved attractions to local storage');
    } catch (error) {
      console.error('Failed to save attractions:', error);
      throw error;
    }
  }

  /**
   * Download a single tile
   */
  private async downloadTile(x: number, y: number, z: number): Promise<boolean> {
    try {
      const tileUrl = `${this.TILE_SERVER}/${z}/${x}/${y}.png`;
      const tileDir = `${FileSystem.documentDirectory}tiles/${z}/${x}/`;
      const tilePath = `${tileDir}${y}.png`;
      
      // Create directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(tileDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(tileDir, { intermediates: true });
      }
      
      // Check if tile already exists
      const tileInfo = await FileSystem.getInfoAsync(tilePath);
      if (tileInfo.exists) {
        return true; // Already downloaded
      }
      
      // Download the tile with proper headers
      const downloadResult = await FileSystem.downloadAsync(tileUrl, tilePath, {
        headers: {
          'User-Agent': 'LocalTravelBuddy/1.0 (Development Build)',
          'Accept': 'image/png,image/jpeg,image/webp,*/*',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (downloadResult.status === 200) {
        return true;
      } else {
        console.error(`Failed to download tile ${x}/${y}/${z}: HTTP ${downloadResult.status}`);
        return false;
      }
      
    } catch (error) {
      console.error(`Error downloading tile ${x}/${y}/${z}:`, error);
      return false;
    }
  }

  /**
   * Calculate total tiles needed for Amsterdam
   */
  private calculateTotalTiles(): number {
    let total = 0;
    
    for (const zoom of this.ZOOM_LEVELS) {
      const tiles = this.getTilesForZoom(zoom);
      total += tiles.length;
    }
    
    return total;
  }

  /**
   * Get tile coordinates for a specific zoom level
   */
  private getTilesForZoom(zoom: number): Array<{x: number, y: number}> {
    const tiles: Array<{x: number, y: number}> = [];
    
    // Convert bounding box to tile coordinates
    const minX = this.lonToTileX(this.AMSTERDAM_BBOX.west, zoom);
    const maxX = this.lonToTileX(this.AMSTERDAM_BBOX.east, zoom);
    const minY = this.latToTileY(this.AMSTERDAM_BBOX.north, zoom);
    const maxY = this.latToTileY(this.AMSTERDAM_BBOX.south, zoom);
    
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ x, y });
      }
    }
    
    return tiles;
  }

  /**
   * Convert longitude to tile X coordinate
   */
  private lonToTileX(lon: number, zoom: number): number {
    return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  }

  /**
   * Convert latitude to tile Y coordinate
   */
  private latToTileY(lat: number, zoom: number): number {
    return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  }

  /**
   * Check if Amsterdam tiles are downloaded
   */
  async areAmsterdamTilesDownloaded(): Promise<boolean> {
    try {
      const tilesDir = `${FileSystem.documentDirectory}tiles/`;
      const dirInfo = await FileSystem.getInfoAsync(tilesDir);
      
      if (!dirInfo.exists) {
        return false;
      }
      
      // Check if we have tiles for the main zoom level (14)
      const zoom14Dir = `${tilesDir}14/`;
      const zoom14Info = await FileSystem.getInfoAsync(zoom14Dir);
      
      return zoom14Info.exists;
    } catch (error) {
      console.error('Error checking tile existence:', error);
      return false;
    }
  }

  /**
   * Get download progress
   */
  getDownloadProgress(): TileDownloadProgress {
    return { ...this.downloadProgress };
  }

  /**
   * Get offline tile URL template for react-native-maps
   */
  getOfflineTileUrlTemplate(): string {
    return `file://${FileSystem.documentDirectory}tiles/{z}/{x}/{y}.png`;
  }

  /**
   * Check if a specific tile exists locally
   */
  async isTileAvailable(x: number, y: number, z: number): Promise<boolean> {
    try {
      const tilePath = `${FileSystem.documentDirectory}tiles/${z}/${x}/${y}.png`;
      const tileInfo = await FileSystem.getInfoAsync(tilePath);
      return tileInfo.exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Load attractions from local storage
   */
  async getLocalAttractions(): Promise<Attraction[]> {
    try {
      const attractionsPath = `${FileSystem.documentDirectory}attractions/attractions.json`;
      const fileInfo = await FileSystem.getInfoAsync(attractionsPath);
      
      if (!fileInfo.exists) {
        return [];
      }
      
      const data = await FileSystem.readAsStringAsync(attractionsPath);
      const attractionsData: AttractionsData = JSON.parse(data);
      
      // Filter out Food & Drink attractions
      return attractionsData.attractions.filter(attraction => 
        attraction.category !== 'Food & Drink'
      );
    } catch (error) {
      console.error('Failed to load local attractions:', error);
      return [];
    }
  }

  /**
   * Get attractions by category
   */
  async getAttractionsByCategory(category: string): Promise<Attraction[]> {
    try {
      const categoryPath = `${FileSystem.documentDirectory}attractions/${category.toLowerCase().replace(/\s+/g, '_')}.json`;
      const fileInfo = await FileSystem.getInfoAsync(categoryPath);
      
      if (!fileInfo.exists) {
        return [];
      }
      
      const data = await FileSystem.readAsStringAsync(categoryPath);
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load attractions by category:', error);
      return [];
    }
  }

  /**
   * Search attractions by name or type
   */
  async searchLocalAttractions(query: string): Promise<Attraction[]> {
    const attractions = await this.getLocalAttractions();
    const lowercaseQuery = query.toLowerCase();
    
    return attractions.filter(attraction =>
      attraction.name.toLowerCase().includes(lowercaseQuery) ||
      attraction.type.toLowerCase().includes(lowercaseQuery) ||
      attraction.category.toLowerCase().includes(lowercaseQuery) ||
      (attraction.description && attraction.description.toLowerCase().includes(lowercaseQuery))
    );
  }

  /**
   * Get available categories
   */
  async getAvailableCategories(): Promise<string[]> {
    try {
      const attractionsPath = `${FileSystem.documentDirectory}attractions/attractions.json`;
      const fileInfo = await FileSystem.getInfoAsync(attractionsPath);
      
      if (!fileInfo.exists) {
        return [];
      }
      
      const data = await FileSystem.readAsStringAsync(attractionsPath);
      const attractionsData: AttractionsData = JSON.parse(data);
      
      return attractionsData.categories;
    } catch (error) {
      console.error('Failed to load categories:', error);
      return [];
    }
  }

  /**
   * Check if attractions are downloaded
   */
  async areAttractionsDownloaded(): Promise<boolean> {
    try {
      const attractionsPath = `${FileSystem.documentDirectory}attractions/attractions.json`;
      const fileInfo = await FileSystem.getInfoAsync(attractionsPath);
      return fileInfo.exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get attractions info
   */
  async getAttractionsInfo(): Promise<{ count: number; lastUpdated: string; categories: string[] }> {
    try {
      const attractionsPath = `${FileSystem.documentDirectory}attractions/attractions.json`;
      const fileInfo = await FileSystem.getInfoAsync(attractionsPath);
      
      if (!fileInfo.exists) {
        return { count: 0, lastUpdated: '', categories: [] };
      }
      
      const data = await FileSystem.readAsStringAsync(attractionsPath);
      const attractionsData: AttractionsData = JSON.parse(data);
      
      return {
        count: attractionsData.totalCount,
        lastUpdated: attractionsData.lastUpdated,
        categories: attractionsData.categories
      };
    } catch (error) {
      console.error('Failed to get attractions info:', error);
      return { count: 0, lastUpdated: '', categories: [] };
    }
  }

  /**
   * Get attractions download progress
   */
  getAttractionsDownloadProgress(): AttractionDownloadProgress {
    return { ...this.attractionDownloadProgress };
  }

  /**
   * Get offline data status
   */
  async getOfflineDataStatus(): Promise<{
    tilesDownloaded: boolean;
    attractionsDownloaded: boolean;
    attractionCount: number;
    lastUpdated: string;
    categories: string[];
  }> {
    try {
      const tilesDownloaded = await this.areAmsterdamTilesDownloaded();
      const attractionsDownloaded = await this.areAttractionsDownloaded();
      const attractionsInfo = await this.getAttractionsInfo();
      
      return {
        tilesDownloaded,
        attractionsDownloaded,
        attractionCount: attractionsInfo.count,
        lastUpdated: attractionsInfo.lastUpdated,
        categories: attractionsInfo.categories
      };
    } catch (error) {
      console.error('Error getting offline data status:', error);
      return {
        tilesDownloaded: false,
        attractionsDownloaded: false,
        attractionCount: 0,
        lastUpdated: '',
        categories: []
      };
    }
  }

  /**
   * Get the tiles directory path
   */
  getTilesDirectory(): string {
    return `${FileSystem.documentDirectory}tiles/`;
  }

  /**
   * Clear all downloaded attractions
   */
  async clearAllAttractions(): Promise<boolean> {
    try {
      const attractionsDir = `${FileSystem.documentDirectory}attractions/`;
      const dirInfo = await FileSystem.getInfoAsync(attractionsDir);
      
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(attractionsDir);
        console.log('🗑️ Cleared all offline attractions');
      }
      
      return true;
    } catch (error) {
      console.error('Error clearing attractions:', error);
      return false;
    }
  }

  /**
   * Clear all downloaded tiles
   */
  async clearAllTiles(): Promise<boolean> {
    try {
      const tilesDir = `${FileSystem.documentDirectory}tiles/`;
      const dirInfo = await FileSystem.getInfoAsync(tilesDir);
      
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(tilesDir);
        console.log('🗑️ Cleared all offline tiles');
      }
      
      return true;
    } catch (error) {
      console.error('Error clearing tiles:', error);
      return false;
    }
  }

  /**
   * Pause the current download
   */
  pauseDownload(): void {
    if (this.isDownloading) {
      this.isPaused = true;
      console.log('⏸️ Download paused');
    }
  }

  /**
   * Resume the paused download
   */
  resumeDownload(): void {
    if (this.isDownloading && this.isPaused) {
      this.isPaused = false;
      console.log('▶️ Download resumed');
    }
  }

  /**
   * Check if download is paused
   */
  isDownloadPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Cancel the current download
   */
  cancelDownload(): void {
    this.isDownloading = false;
    this.isPaused = false;
    this.downloadProgress = {
      totalTiles: 0,
      downloadedTiles: 0,
      progress: 0,
      isDownloading: false
    };
    console.log('❌ Download cancelled');
  }
}

export default OfflineMapService; 