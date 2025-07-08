import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

interface TileDownloadProgress {
  totalTiles: number;
  downloadedTiles: number;
  progress: number;
  isDownloading: boolean;
}

interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

class OfflineMapService {
  private static instance: OfflineMapService;
  private isDownloading: boolean = false;
  private downloadProgress: TileDownloadProgress = {
    totalTiles: 0,
    downloadedTiles: 0,
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
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize offline map service:', error);
      return false;
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
   * Get offline map style that uses local tiles
   */
  getOfflineMapStyle(): object {
    return {
      version: 8,
      sources: {
        'offline-tiles': {
          type: 'raster',
          tiles: [`${FileSystem.documentDirectory}tiles/{z}/{x}/{y}.png`],
          tileSize: 256,
          minzoom: 10,
          maxzoom: 16
        }
      },
      layers: [
        {
          id: 'offline-tiles',
          type: 'raster',
          source: 'offline-tiles',
          paint: {}
        }
      ]
    };
  }

  /**
   * Get the tiles directory path
   */
  getTilesDirectory(): string {
    return `${FileSystem.documentDirectory}tiles/`;
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
}

export default OfflineMapService; 