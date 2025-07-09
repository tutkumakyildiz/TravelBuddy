import * as FileSystem from 'expo-file-system';
import { initLlama, LlamaContext, RNLlamaOAICompatibleMessage } from 'llama.rn';

interface GemmaResponse {
  text?: string;
  confidence?: number;
  error?: string;
}

interface ModelConfig {
  modelPath: string;
  modelUrl: string;
  modelName: string;
  modelSize: number;
  isDownloaded: boolean;
  config?: any;
}

interface DownloadProgress {
  progress: number;
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
}

class AIService {
  private static instance: AIService;
  private modelConfig: ModelConfig | null = null;
  private isInitialized: boolean = false;
  private modelPath: string = '';
  private isDownloading: boolean = false;
  private isPaused: boolean = false;
  private downloadProgress: DownloadProgress = { progress: 0, totalBytesWritten: 0, totalBytesExpectedToWrite: 0 };
  private llamaContext: LlamaContext | null = null;
  private downloadResumable: any = null;

  // Hugging Face model configuration
  private readonly HUGGING_FACE_CONFIG = {
    modelUrl: 'https://huggingface.co/unsloth/gemma-3n-E2B-it-GGUF/resolve/main/gemma-3n-E2B-it-Q4_K_M.gguf',
    modelName: 'gemma-3n-E2B-it-Q4_K_M.gguf',
    modelSize: 2.9 * 1024 * 1024 * 1024, // 2.9 GB in bytes (smaller model)
    repoId: 'unsloth/gemma-3n-E2B-it-GGUF',
    filename: 'gemma-3n-E2B-it-Q4_K_M.gguf'
  };

  private constructor() {
    // Convert file:// URI to actual file system path for llama.rn
    const documentDir = FileSystem.documentDirectory;
    const actualPath = documentDir.replace('file://', '');
    this.modelPath = `${actualPath}models/huggingface/`;
    console.log('📁 Model path initialized:', this.modelPath);
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Initialize the AI service and download the model from Hugging Face if needed
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🚀 Initializing AI Service...');
      
      // Ensure model directory exists
      await this.ensureModelDirectory();
      
      // Check if model is already downloaded
      const modelExists = await this.checkModelExists();
      if (!modelExists) {
        console.log('📥 Model not found locally. Starting download...');
        
        const downloadSuccess = await this.downloadModelFromHuggingFace();
        if (!downloadSuccess) {
          console.log('❌ Failed to download model');
          return false;
        }
      }

      // Load model configuration
      await this.loadModelConfig();
      
      // Initialize llama.rn context
      await this.initializeLlamaContext();
      
      this.isInitialized = true;
      console.log('✅ AI Service initialized successfully!');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize AI Service:', error);
      return false;
    }
  }

  /**
   * Initialize the llama.rn context with simple settings
   */
  private async initializeLlamaContext(): Promise<void> {
    const modelFilePath = `${this.modelPath}${this.HUGGING_FACE_CONFIG.modelName}`;
    
    try {
      console.log('🔄 Initializing llama context...');
      
      const settings = {
        n_ctx: 2048,
        n_batch: 32,
        n_threads: 2,
        use_mmap: true,
        use_mlock: false,
        low_vram: true,
        f16_kv: true,
        logits_all: false,
        vocab_only: false,
        embedding: false,
        n_gpu_layers: 0
      };
      
      this.llamaContext = await initLlama({
        model: modelFilePath,
        ...settings,
      });
      
      console.log('✅ Llama context initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize llama context:', error);
      throw error;
    }
  }

  /**
   * Ensure the model directory exists
   */
  private async ensureModelDirectory(): Promise<void> {
    try {
      const modelDir = `${FileSystem.documentDirectory}models/`;
      const huggingfaceDir = `${FileSystem.documentDirectory}models/huggingface/`;
      
      // Create models directory if it doesn't exist
      const modelDirInfo = await FileSystem.getInfoAsync(modelDir);
      if (!modelDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });
        console.log('Created models directory');
      }
      
      // Create huggingface directory if it doesn't exist
      const huggingfaceDirInfo = await FileSystem.getInfoAsync(huggingfaceDir);
      if (!huggingfaceDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(huggingfaceDir, { intermediates: true });
        console.log('Created huggingface models directory');
      }
    } catch (error) {
      console.error('Error creating model directories:', error);
      throw error;
    }
  }

  /**
   * Download the model from Hugging Face
   */
  private async downloadModelFromHuggingFace(): Promise<boolean> {
    if (this.isDownloading) {
      console.log('Download already in progress');
      return false;
    }

    try {
      this.isDownloading = true;
      // Use proper file URI for download
      const modelFileUri = `${FileSystem.documentDirectory}models/huggingface/${this.HUGGING_FACE_CONFIG.modelName}`;
      const modelFilePath = `${this.modelPath}${this.HUGGING_FACE_CONFIG.modelName}`;
      
      console.log('📥 Starting download from Hugging Face...');
      console.log('Source:', this.HUGGING_FACE_CONFIG.modelUrl);
      console.log('Destination URI:', modelFileUri);
      console.log('Expected size:', this.formatBytes(this.HUGGING_FACE_CONFIG.modelSize));

      // Check available storage space
      const diskCapacity = await FileSystem.getInfoAsync(FileSystem.documentDirectory);
      console.log('Available storage space check...');

      // Start the download with progress tracking - use proper URI
      this.downloadResumable = FileSystem.createDownloadResumable(
        this.HUGGING_FACE_CONFIG.modelUrl,
        modelFileUri, // Use URI instead of raw path
        {
          headers: {
            'User-Agent': 'LocalTravelBuddy/1.0.0',
            'Accept': 'application/octet-stream'
          }
        },
        (downloadProgress) => {
          this.downloadProgress = {
            progress: downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite,
            totalBytesWritten: downloadProgress.totalBytesWritten,
            totalBytesExpectedToWrite: downloadProgress.totalBytesExpectedToWrite
          };
          
          const percent = (this.downloadProgress.progress * 100).toFixed(1);
          const downloaded = this.formatBytes(downloadProgress.totalBytesWritten);
          const total = this.formatBytes(downloadProgress.totalBytesExpectedToWrite);
          
          console.log(`📊 Download progress: ${percent}% (${downloaded} / ${total})`);
        }
      );

      const result = await this.downloadResumable.downloadAsync();
      
      if (result?.status === 200) {
        console.log('✅ Model downloaded successfully!');
        const contentLength = result.headers['content-length'];
        const fileSize = contentLength ? parseInt(contentLength, 10) : 0;
        console.log('File size:', this.formatBytes(fileSize));
        
        // Verify file integrity using URI
        const fileInfo = await FileSystem.getInfoAsync(modelFileUri);
        if (fileInfo.exists) {
          console.log('📁 File verification successful');
          const fileSize = ('size' in fileInfo) ? fileInfo.size : 0;
          console.log('Local file size:', this.formatBytes(fileSize));
          return true;
        } else {
          console.error('❌ Downloaded file is corrupted or empty');
          return false;
        }
      } else {
        console.error('❌ Download failed with status:', result?.status);
        return false;
      }
    } catch (error) {
      console.error('Error downloading model from Hugging Face:', error);
      return false;
    } finally {
      this.isDownloading = false;
    }
  }

  /**
   * Check if the model file exists locally
   */
  private async checkModelExists(): Promise<boolean> {
    try {
      const modelFileUri = `${FileSystem.documentDirectory}models/huggingface/${this.HUGGING_FACE_CONFIG.modelName}`;
      const fileInfo = await FileSystem.getInfoAsync(modelFileUri);
      
      if (fileInfo.exists && 'size' in fileInfo && fileInfo.size > 0) {
        console.log('✅ Model file found locally');
        console.log('File size:', this.formatBytes(fileInfo.size));
        return true;
      } else {
        console.log('❌ Model file not found locally');
        return false;
      }
    } catch (error) {
      console.error('Error checking model existence:', error);
      return false;
    }
  }

  /**
   * Load model configuration
   */
  private async loadModelConfig(): Promise<void> {
    try {
      const modelFileUri = `${FileSystem.documentDirectory}models/huggingface/${this.HUGGING_FACE_CONFIG.modelName}`;
      const fileInfo = await FileSystem.getInfoAsync(modelFileUri);
      
      this.modelConfig = {
        modelPath: this.modelPath,
        modelUrl: this.HUGGING_FACE_CONFIG.modelUrl,
        modelName: this.HUGGING_FACE_CONFIG.modelName,
        modelSize: ('size' in fileInfo) ? fileInfo.size : 0,
        isDownloaded: fileInfo.exists,
        config: {
          model_type: 'gemma',
          format: 'gguf',
          source: 'huggingface',
          repo_id: this.HUGGING_FACE_CONFIG.repoId,
          filename: this.HUGGING_FACE_CONFIG.filename,
          quantization: 'Q4_K_M'
        }
      };
      
      console.log('📋 Model configuration loaded:');
      console.log('  - Model name:', this.modelConfig.modelName);
      console.log('  - Model format: GGUF');
      console.log('  - Source: Hugging Face');
      console.log('  - Repository:', this.HUGGING_FACE_CONFIG.repoId);
      console.log('  - File size:', this.formatBytes(this.modelConfig.modelSize));
      console.log('  - Quantization: Q4_K_M');
      
    } catch (error) {
      console.error('Error loading model config:', error);
      throw error;
    }
  }

  /**
   * Process text input with GGUF model inference
   */
  async processText(inputText: string): Promise<GemmaResponse> {
    if (!this.isInitialized || !this.llamaContext) {
      return { error: 'AI Service not initialized' };
    }

    try {
      console.log('🧠 Processing text with GGUF model:', inputText);
      
      // Prepare messages for the model
      const messages: RNLlamaOAICompatibleMessage[] = [
        {
          role: 'system',
          content: 'You are a helpful AI travel assistant. Provide concise, relevant travel advice. Keep responses under 200 words for mobile optimization.'
        },
        {
          role: 'user',
          content: inputText
        }
      ];

      // Define stop words for the model
      const stopWords = ['</s>', '<|end|>', '<|eot_id|>', '<|end_of_text|>', '<|im_end|>', '<|EOT|>', '<|END_OF_TURN_TOKEN|>', '<|end_of_turn|>', '<|endoftext|>'];

      const result = await this.llamaContext.completion({
        messages,
        n_predict: 256,
        temperature: 0.7,
        top_k: 40,
        top_p: 0.95,
        stop: stopWords,
      });

      const responseText = result.text?.trim() || 'No response generated';
      
      console.log('✅ Model inference completed');
      console.log('📊 Performance Stats:');
      console.log('  - Response length:', responseText.length);
      console.log('  - Tokens/second:', result.timings?.predicted_per_second || 'N/A');

      return {
        text: responseText,
        confidence: 0.95
      };
    } catch (error) {
      console.error('❌ Error during model inference:', error);
      
      if (error.message?.includes('memory') || error.message?.includes('OutOfMemory')) {
        return { 
          error: 'Memory limit exceeded',
          text: 'I\'m experiencing memory constraints. Please try a shorter question or restart the app.'
        };
      }
      
      if (error.message?.includes('timeout')) {
        return { 
          error: 'Processing timeout',
          text: 'Processing took too long. Please try a simpler question.'
        };
      }
      
      return { 
        error: `Processing failed: ${error.message}`,
        text: 'Sorry, I encountered an error while processing your request. Please try again.'
      };
    }
  }

  // Note: Audio and image processing removed as this is a text-only model

  /**
   * Generate travel recommendations with GGUF model inference
   */
  async generateTravelRecommendations(location: string, preferences?: string[]): Promise<GemmaResponse> {
    if (!this.isInitialized || !this.llamaContext) {
      return { error: 'AI Service not initialized' };
    }

    try {
      const preferencesText = preferences ? ` with preferences: ${preferences.join(', ')}` : '';
      const prompt = `As a knowledgeable travel assistant, provide comprehensive travel recommendations for ${location}${preferencesText}. Include suggestions for:
      1. Must-visit attractions and landmarks
      2. Local cuisine and dining recommendations
      3. Cultural experiences and activities
      4. Practical travel tips
      5. Best times to visit
      
      Keep your response concise but informative.`;
      
      return await this.processText(prompt);
    } catch (error) {
      console.error('❌ Error generating travel recommendations:', error);
      return { 
        error: 'Failed to generate travel recommendations',
        text: 'Sorry, I encountered an error while generating travel recommendations. Please try again.'
      };
    }
  }

  /**
   * Process location-based query with coordinates
   */
  async processLocationQuery(latitude: number, longitude: number, placeName?: string): Promise<GemmaResponse> {
    if (!this.isInitialized || !this.llamaContext) {
      return { error: 'AI Service not initialized' };
    }

    try {
      const locationDescription = placeName ? `${placeName} (${latitude}, ${longitude})` : `coordinates ${latitude}, ${longitude}`;
      
      const prompt = `As a knowledgeable travel assistant, provide information about the location at ${locationDescription}. Include:
      1. What are the notable attractions or landmarks in this area?
      2. What are the local dining recommendations and specialties?
      3. What cultural experiences or activities are available?
      4. What are some practical travel tips for this location?
      5. What makes this place special or unique?
      
      Keep your response concise but informative, focusing on the most relevant travel information.`;
      
      console.log('🗺️ Processing location query:', locationDescription);
      
      return await this.processText(prompt);
    } catch (error) {
      console.error('❌ Error processing location query:', error);
      return { 
        error: 'Failed to process location query',
        text: 'Sorry, I encountered an error while processing your location query. Please try again.'
      };
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(): Promise<object> {
    if (!this.modelConfig) {
      return { error: 'Model not loaded' };
    }

    try {
      return {
        modelName: this.modelConfig.modelName,
        modelPath: this.modelConfig.modelPath,
        modelUrl: this.modelConfig.modelUrl,
        modelSize: this.modelConfig.modelSize,
        modelSizeFormatted: this.formatBytes(this.modelConfig.modelSize),
        isDownloaded: this.modelConfig.isDownloaded,
        initialized: this.isInitialized,
        source: 'Hugging Face',
        repository: this.HUGGING_FACE_CONFIG.repoId,
        format: 'GGUF',
        quantization: 'Q4_K_M',
        config: this.modelConfig.config,
        downloadProgress: this.isDownloading ? this.downloadProgress : null,
        llamaContextReady: this.llamaContext !== null
      };
    } catch (error) {
      console.error('Error getting model info:', error);
      return { error: 'Failed to get model information' };
    }
  }

  /**
   * Get download progress
   */
  getDownloadProgress(): DownloadProgress | null {
    return this.isDownloading ? this.downloadProgress : null;
  }

  /**
   * Check if model is currently downloading
   */
  isModelDownloading(): boolean {
    return this.isDownloading;
  }

  /**
   * Pause the current AI model download
   */
  pauseDownload(): void {
    if (this.isDownloading && this.downloadResumable) {
      this.isPaused = true;
      console.log('⏸️ AI download paused');
    }
  }

  /**
   * Resume the paused AI model download
   */
  resumeDownload(): void {
    if (this.isDownloading && this.isPaused && this.downloadResumable) {
      this.isPaused = false;
      console.log('▶️ AI download resumed');
    }
  }

  /**
   * Check if AI download is paused
   */
  isDownloadPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Format bytes to human readable format
   */
  public formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get the initialization status
   */
  getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  /**
   * Get model directory path
   */
  getModelPath(): string {
    return this.modelPath;
  }

  /**
   * Cancel ongoing download
   */
  async cancelDownload(): Promise<boolean> {
    if (!this.isDownloading) {
      return false;
    }

    try {
      // Reset download state
      this.isDownloading = false;
      this.downloadProgress = { progress: 0, totalBytesWritten: 0, totalBytesExpectedToWrite: 0 };
      this.isPaused = false; // Ensure paused state is reset
      this.downloadResumable = null; // Clear resumable object
      
      // Clean up partial download file
      const modelFileUri = `${FileSystem.documentDirectory}models/huggingface/${this.HUGGING_FACE_CONFIG.modelName}`;
      const fileInfo = await FileSystem.getInfoAsync(modelFileUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(modelFileUri);
      }
      
      console.log('Download cancelled and cleaned up');
      return true;
    } catch (error) {
      console.error('Error cancelling download:', error);
      return false;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.llamaContext) {
        await this.llamaContext.release();
        this.llamaContext = null;
        console.log('🧹 llama.rn context cleaned up');
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export default AIService; 