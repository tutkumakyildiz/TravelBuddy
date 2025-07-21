import * as FileSystem from 'expo-file-system';
import { initLlama, LlamaContext, RNLlamaOAICompatibleMessage } from 'llama.rn';

interface GemmaResponse {
  text?: string;
  confidence?: number;
  error?: string;
}

interface DownloadProgress {
  progress: number;
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
}

interface QueuedRequest {
  inputText: string;
  resolve: (response: GemmaResponse) => void;
  reject: (error: any) => void;
  timestamp: number;
}

class AIService {
  private static instance: AIService;
  private isInitialized: boolean = false;
  private modelPath: string = '';
  private isDownloading: boolean = false;
  private isPaused: boolean = false;
  private downloadProgress: DownloadProgress = { progress: 0, totalBytesWritten: 0, totalBytesExpectedToWrite: 0 };
  private llamaContext: LlamaContext | null = null;
  private downloadResumable: any = null;
  
  // Request queue system to handle concurrent requests
  private requestQueue: QueuedRequest[] = [];
  private isProcessing: boolean = false;
  private currentRequestId: string | null = null;

  // Hugging Face model configuration
  private readonly HUGGING_FACE_CONFIG = {
    modelUrl: 'https://huggingface.co/unsloth/gemma-3n-E2B-it-GGUF/resolve/main/gemma-3n-E2B-it-Q4_K_M.gguf',
    modelName: 'gemma-3n-E2B-it-Q4_K_M.gguf',
    modelSize: 2.9 * 1024 * 1024 * 1024, // 2.9 GB in bytes
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
   * Process text input with GGUF model inference (with request queue)
   */
  async processText(inputText: string): Promise<GemmaResponse> {
    if (!this.isInitialized || !this.llamaContext) {
      return { error: 'AI Service not initialized' };
    }

    // Return a promise that will be resolved by the queue processor
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        inputText,
        resolve,
        reject,
        timestamp: Date.now()
      };

      // Add to queue
      this.requestQueue.push(queuedRequest);
      console.log(`📝 Request queued. Queue length: ${this.requestQueue.length}`);
      
      // Start processing if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the request queue one by one
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log('🔄 Starting queue processing...');

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) continue;

      // Check if request is too old (timeout after 2 minutes)
      const age = Date.now() - request.timestamp;
      if (age > 120000) { // 2 minutes
        console.log('⏰ Request timeout - skipping old request');
        request.resolve({ error: 'Request timeout' });
        continue;
      }

      try {
        console.log(`🧠 Processing queued request: ${request.inputText.substring(0, 50)}...`);
        
        // Set current request ID for tracking
        this.currentRequestId = `req_${Date.now()}`;
        
        const response = await this.executeTextProcessing(request.inputText);
        request.resolve(response);
        
        console.log(`✅ Request processed successfully. Queue remaining: ${this.requestQueue.length}`);
      } catch (error) {
        console.error('❌ Error processing queued request:', error);
        request.reject(error);
      } finally {
        this.currentRequestId = null;
        
        // Small delay between requests to prevent overwhelming the model
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.isProcessing = false;
    console.log('✅ Queue processing completed');
  }

  /**
   * Execute the actual text processing with the model
   */
  private async executeTextProcessing(inputText: string): Promise<GemmaResponse> {
    if (!this.llamaContext) {
      throw new Error('Llama context not initialized');
    }

    try {
      console.log('🧠 Processing text with GGUF model:', inputText);
      
      // Prepare messages for the model
      const messages: RNLlamaOAICompatibleMessage[] = [
        {
          role: 'system',
          content: 'You are an expert travel guide. You provide historical, touristic, and interesting facts about places user selected. Also, user can ask you about translations. You respond in a friendly tone.'
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
        n_predict: 512,
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
      console.log('  - Tokens predicted:', result.timings?.predicted_n || 'N/A');
      console.log('  - Response ends with:', responseText.slice(-50));
      
      // Check if response might be truncated
      const lastChar = responseText.slice(-1);
      if (lastChar && !['.', '!', '?', ':', ';'].includes(lastChar)) {
        console.log('⚠️ Response may be truncated - does not end with punctuation');
      }

      return {
        text: responseText,
        confidence: 0.95
      };
    } catch (error) {
      console.error('❌ Error during model inference:', error);
      
      if (error.message?.includes('memory') || error.message?.includes('OutOfMemory')) {
        return { 
          error: 'Memory limit exceeded',
          text: 'Memory limit exceeded. Please try a shorter question or restart the app.'
        };
      }
      
      if (error.message?.includes('timeout')) {
        return { 
          error: 'Processing timeout',
          text: 'Processing took too long. Please try a simpler question.'
        };
      }
      
      // Handle "Context is busy" error
      if (error.message?.includes('Context is busy') || error.message?.includes('busy')) {
        return { 
          error: 'Context busy',
          text: 'AI model is busy. Please wait a moment and try again.'
        };
      }
      
      return { 
        error: `Processing failed: ${error.message}`,
        text: 'Sorry, an error occurred while processing your request. Please try again.'
      };
    }
  }

  /**
   * Get current processing status
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.requestQueue.length;
  }

  /**
   * Clear the request queue (emergency stop)
   */
  clearQueue(): void {
    console.log('🚨 Clearing request queue...');
    
    // Resolve all pending requests with error
    this.requestQueue.forEach(request => {
      request.resolve({ error: 'Request cancelled' });
    });
    
    this.requestQueue = [];
    this.isProcessing = false;
    this.currentRequestId = null;
    
    console.log('✅ Request queue cleared');
  }

  /**
   * Get download progress
   */
  getDownloadProgress(): DownloadProgress | null {
    return this.isDownloading ? this.downloadProgress : null;
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
   * Check if model is currently downloading
   */
  isModelDownloading(): boolean {
    return this.isDownloading;
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
      
      console.log('📥 Starting download from Hugging Face...');
      console.log('Source:', this.HUGGING_FACE_CONFIG.modelUrl);
      console.log('Destination URI:', modelFileUri);
      console.log('Expected size:', this.formatBytes(this.HUGGING_FACE_CONFIG.modelSize));

      // Start the download with progress tracking
      this.downloadResumable = FileSystem.createDownloadResumable(
        this.HUGGING_FACE_CONFIG.modelUrl,
        modelFileUri,
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
        
        // Verify file integrity
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
   * Format bytes to human readable format
   */
  public formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default AIService; 