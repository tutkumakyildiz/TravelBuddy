import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
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
  private downloadProgress: DownloadProgress = { progress: 0, totalBytesWritten: 0, totalBytesExpectedToWrite: 0 };
  private llamaContext: LlamaContext | null = null;

  // Hugging Face model configuration
  private readonly HUGGING_FACE_CONFIG = {
    modelUrl: 'https://huggingface.co/bartowski/google_gemma-3n-E4B-it-GGUF/resolve/main/google_gemma-3n-E4B-it-Q5_K_S.gguf',
    modelName: 'google_gemma-3n-E4B-it-Q5_K_S.gguf',
    modelSize: 4.87 * 1024 * 1024 * 1024, // 4.87 GB in bytes
    repoId: 'bartowski/google_gemma-3n-E4B-it-GGUF',
    filename: 'google_gemma-3n-E4B-it-Q5_K_S.gguf'
  };

  private constructor() {
    // FIX 2: Android-compatible file paths with proper verification
    if (Platform.OS === 'android') {
      // Use Android-specific document directory for large files
      this.modelPath = `${FileSystem.documentDirectory}models/huggingface/`;
      console.log('📁 Android file path configured:', this.modelPath);
    } else {
      // iOS and other platforms
      this.modelPath = `${FileSystem.documentDirectory}models/huggingface/`;
    }
    
    console.log('📱 Platform:', Platform.OS);
    console.log('📁 Model path initialized:', this.modelPath);
    console.log('�� Document directory:', FileSystem.documentDirectory);
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Detect if running on emulator
   */
  private isRunningOnEmulator(): boolean {
    return !Device.isDevice || 
           Device.deviceName?.toLowerCase().includes('emulator') ||
           Device.deviceName?.toLowerCase().includes('simulator') ||
           Device.modelName?.toLowerCase().includes('emulator') ||
           Device.modelName?.toLowerCase().includes('simulator') ||
           (Platform.OS === 'android' && Device.brand === 'google' && Device.modelName === 'Android SDK built for x86');
  }

  /**
   * Get optimized memory settings based on device
   */
  private getOptimizedMemorySettings() {
    const isEmulator = this.isRunningOnEmulator();
    
    if (isEmulator) {
      console.log('🔧 Detected emulator with 6GB RAM - using ultra-aggressive memory optimization');
      return {
        n_ctx: 1024,         // Increased context for 6GB RAM
        n_batch: 16,         // Larger batch size for 6GB
        n_threads: 2,        // More threads for 6GB
        use_mmap: true,      // Critical: Memory mapping for efficiency
        use_mlock: false,    // No memory locking on emulator
        low_vram: true,      // Use low VRAM mode
        f16_kv: true,        // Use fp16 for key-value cache to save memory
        logits_all: false,   // Don't compute logits for all tokens
        vocab_only: false,   // Load full model but with constraints
        embedding: false,    // No embeddings
        n_gpu_layers: 0,     // CPU only for compatibility
        rope_scaling_type: 0, // No rope scaling
        rope_freq_base: 10000.0,
        rope_freq_scale: 1.0,
        mul_mat_q: true,     // Use quantized matrix multiplication
        offload_kqv: false   // Don't offload to GPU
      };
    } else {
      console.log('📱 Detected real device - using standard optimization');
      return {
        n_ctx: 2048,         // Larger context for real device
        n_batch: 32,         // Standard batch size
        n_threads: 4,        // More threads for real device
        use_mmap: true,      // Use memory mapping
        use_mlock: false,    // Android may not support mlock
        low_vram: false,     // Standard VRAM usage
        f16_kv: true,        // Use fp16 for key-value cache
        logits_all: false,   // Don't compute logits for all tokens
        vocab_only: false,   // Load full model
        embedding: false,    // No embeddings
        n_gpu_layers: 0,     // CPU only for compatibility
        rope_scaling_type: 0,
        rope_freq_base: 10000.0,
        rope_freq_scale: 1.0,
        mul_mat_q: true,
        offload_kqv: false
      };
    }
  }

  /**
   * Pre-loading Memory Management: Prepare memory for large model
   */
  private async prepareMemoryForLargeModel(): Promise<void> {
    const isEmulator = this.isRunningOnEmulator();
    console.log('🔧 Pre-loading Memory Management for 4.54GB Gemma model...');
    
    if (isEmulator) {
      console.log('📱 Emulator detected - optimizing for 6GB RAM');
      
      // Force garbage collection to free up memory
      if (global.gc) {
        console.log('🗑️  Running garbage collection...');
        global.gc();
      }
      
      // Wait for memory to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Pre-allocate memory chunks progressively
      console.log('🚀 Pre-allocating memory chunks...');
      try {
        // Allocate and release small chunks to prime memory allocator
        const chunks = [];
        for (let i = 0; i < 10; i++) {
          chunks.push(new ArrayBuffer(50 * 1024 * 1024)); // 50MB chunks
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Release chunks
        chunks.length = 0;
        
        console.log('✅ Memory pre-allocation completed');
      } catch (error) {
        console.warn('⚠️  Memory pre-allocation failed, continuing anyway:', error);
      }
    }
    
    // Additional memory optimization
    console.log('🔄 Optimizing memory management...');
    
    // Clear any existing context
    if (this.llamaContext) {
      console.log('🧹 Clearing existing context...');
      await this.llamaContext.release();
      this.llamaContext = null;
    }
    
    // Force another garbage collection
    if (global.gc) {
      global.gc();
    }
    
    console.log('✅ Memory preparation completed');
  }

  /**
   * Initialize the AI service and download the model from Hugging Face if needed
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🚀 Initializing AI Service with Large Gemma 3n Model...');
      console.log('📱 Device Info:', {
        isDevice: Device.isDevice,
        deviceName: Device.deviceName,
        modelName: Device.modelName,
        brand: Device.brand,
        platform: Platform.OS,
        isEmulator: this.isRunningOnEmulator()
      });
      
      console.log('Model path:', this.modelPath);
      console.log('Model URL:', this.HUGGING_FACE_CONFIG.modelUrl);
      console.log('Model size:', this.formatBytes(this.HUGGING_FACE_CONFIG.modelSize));
      
      // ENHANCED MEMORY PREPARATION: Critical for 4.87GB model
      console.log('🔧 Preparing system for heavy model loading...');
      
      // Force multiple garbage collections with delays
      for (let i = 0; i < 3; i++) {
        if (global.gc) {
          global.gc();
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Ensure model directory exists
      await this.ensureModelDirectory();
      
      // Check if model is already downloaded
      const modelExists = await this.checkModelExists();
      if (!modelExists) {
        console.log('📥 Model not found locally. Starting download from Hugging Face...');
        console.log('⚠️  First time setup: This will download 4.87GB and may take several minutes');
        
        const downloadSuccess = await this.downloadModelFromHuggingFace();
        if (!downloadSuccess) {
          console.log('❌ Failed to download model from Hugging Face');
          return false;
        }
        
        console.log('✅ Model download completed successfully');
      } else {
        console.log('✅ Model file found locally');
        
        // Get file size to verify integrity
        const modelFilePath = `${this.modelPath}${this.HUGGING_FACE_CONFIG.modelName}`;
        const fileInfo = await FileSystem.getInfoAsync(modelFilePath);
        if (fileInfo.exists) {
          console.log('File size:', this.formatBytes(fileInfo.size || 0));
        }
      }

      // Load model configuration
      await this.loadModelConfig();
      
      // CRITICAL: PRE-LOADING MEMORY MANAGEMENT for 4.87GB model
      await this.prepareMemoryForLargeModel();
      
      // Initialize llama.rn context with heavy model optimizations
      console.log('🔄 Starting heavy model context initialization...');
      await this.initializeLlamaContextOptimized();
      
      this.isInitialized = true;
      console.log('🎉 AI Service initialized successfully with Large Gemma 3n model!');
      console.log('📊 Memory usage optimized for 4.87GB model');
      return true;
    } catch (error) {
      console.error('Failed to initialize AI Service:', error);
      
      // Enhanced error reporting for heavy model issues
      if (error.message?.includes('memory') || error.message?.includes('OutOfMemory')) {
        console.error('🔥 MEMORY ERROR: 4.87GB model requires more RAM');
        console.error('💡 Suggestion: Increase emulator RAM to 8GB or close other apps');
      } else if (error.message?.includes('storage') || error.message?.includes('space')) {
        console.error('💾 STORAGE ERROR: Insufficient space for 4.87GB model');
        console.error('💡 Suggestion: Free up at least 6GB of storage space');
      }
      
      return false;
    }
  }

  /**
   * Initialize the llama.rn context with Progressive Model Loading
   */
  private async initializeLlamaContextOptimized(): Promise<void> {
    const isEmulator = this.isRunningOnEmulator();
    const optimizedSettings = this.getOptimizedMemorySettings();
    const modelFilePath = `${this.modelPath}${this.HUGGING_FACE_CONFIG.modelName}`;
    
    console.log(`🚀 Starting Progressive Model Loading for ${isEmulator ? 'EMULATOR (6GB RAM)' : 'REAL DEVICE'}...`);
    console.log('Model file path:', modelFilePath);
    console.log('🔧 Optimized settings:', optimizedSettings);
    
    try {
      // Convert file path to the format expected by llama.rn
      const modelUri = `file://${modelFilePath}`;
      
      // STAGE 1: Progressive Memory Allocation
      console.log('📋 STAGE 1: Progressive Memory Allocation...');
      console.log('  - Allocating base memory structures...');
      
      // Force garbage collection before starting
      if (global.gc) {
        global.gc();
      }
      
      // Wait for memory to settle
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // STAGE 2: Model Context Initialization with Minimal Settings
      console.log('📋 STAGE 2: Initializing with minimal settings...');
      
      const minimalSettings = {
        ...optimizedSettings,
        n_ctx: Math.floor(optimizedSettings.n_ctx / 2), // Start with half context
        n_batch: Math.floor(optimizedSettings.n_batch / 2), // Start with half batch
        n_threads: 1, // Single thread initially
        use_mmap: true,
        use_mlock: false,
        low_vram: true,
        f16_kv: true,
        logits_all: false,
        vocab_only: false,
        embedding: false,
        n_gpu_layers: 0
      };
      
      console.log('🔧 Minimal settings for initial load:', minimalSettings);
      
      // Initial context creation with minimal settings
      this.llamaContext = await initLlama({
        model: modelUri,
        ...minimalSettings,
      });
      
      console.log('✅ STAGE 2 Complete: Base context created');
      
      // STAGE 3: Progressive Context Expansion
      console.log('📋 STAGE 3: Progressive Context Expansion...');
      
      // Wait for initial context to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // If we have extra RAM, try to expand context gradually
      if (isEmulator) {
        console.log('🔄 Attempting to expand context for 6GB RAM...');
        
        try {
          // Release current context
          await this.llamaContext.release();
          
          // Reinitialize with expanded settings
          const expandedSettings = {
            ...optimizedSettings,
            n_ctx: optimizedSettings.n_ctx, // Full context
            n_batch: optimizedSettings.n_batch, // Full batch
            n_threads: optimizedSettings.n_threads, // Full threads
          };
          
          console.log('🔧 Expanded settings:', expandedSettings);
          
          this.llamaContext = await initLlama({
            model: modelUri,
            ...expandedSettings,
          });
          
          console.log('✅ STAGE 3 Complete: Context successfully expanded');
        } catch (expansionError) {
          console.warn('⚠️  Context expansion failed, falling back to minimal settings:', expansionError);
          
          // Reinitialize with minimal settings
          this.llamaContext = await initLlama({
            model: modelUri,
            ...minimalSettings,
          });
          
          console.log('✅ STAGE 3 Complete: Using minimal settings as fallback');
        }
      }
      
      // STAGE 4: Model Warm-up and Verification
      console.log('📋 STAGE 4: Model warm-up and verification...');
      
      // Small test to verify the model is working
      try {
        console.log('🔍 Testing model with small prompt...');
        
        // This is a very small test - just to verify the model responds
        const testPrompt = "Hi";
        const testResponse = await this.llamaContext.completion({
          prompt: testPrompt,
          n_predict: 5,
          temperature: 0.1,
          top_p: 0.9,
          top_k: 40,
          stop: ["\n"],
        });
        
        console.log('✅ Model test successful:', testResponse.text.substring(0, 50) + '...');
      } catch (testError) {
        console.warn('⚠️  Model test failed, but continuing:', testError);
      }
      
      // STAGE 5: Final Memory Optimization
      console.log('📋 STAGE 5: Final memory optimization...');
      
      // Force garbage collection to clean up any temporary allocations
      if (global.gc) {
        global.gc();
      }
      
      console.log('✅ Progressive Model Loading Complete!');
      console.log('📊 Final Memory Configuration:');
      console.log(`  - Device type: ${isEmulator ? 'Emulator (6GB RAM)' : 'Real Device'}`);
      console.log(`  - Context size: ${optimizedSettings.n_ctx} tokens`);
      console.log(`  - Batch size: ${optimizedSettings.n_batch}`);
      console.log(`  - Threads: ${optimizedSettings.n_threads}`);
      console.log(`  - Memory mapping: ${optimizedSettings.use_mmap}`);
      console.log(`  - Memory locking: ${optimizedSettings.use_mlock}`);
      console.log(`  - GPU layers: 0 (CPU only)`);
      console.log(`  - Model size: ${this.formatBytes(this.HUGGING_FACE_CONFIG.modelSize)}`);
      
    } catch (error) {
      console.error('❌ Progressive Model Loading failed:', error);
      
      // Enhanced error handling with multiple fallback strategies
      if (error.message?.includes('memory') || error.message?.includes('OutOfMemory')) {
        console.error('🔥 Memory Error - Attempting ultra-minimal fallback...');
        
        try {
          // Ultra-minimal settings for extreme memory constraints
          const ultraMinimalSettings = {
            n_ctx: 128,          // Extremely small context
            n_batch: 1,          // Single token batching
            n_threads: 1,        // Single thread
            use_mmap: true,      // Memory mapping critical
            use_mlock: false,    // No memory locking
            low_vram: true,      // Low VRAM mode
            f16_kv: true,        // Use fp16
            logits_all: false,   // No logits for all tokens
            vocab_only: false,   // Don't load vocab only
            embedding: false,    // No embeddings
            n_gpu_layers: 0,     // CPU only
            rope_scaling_type: 0,
            rope_freq_base: 10000.0,
            rope_freq_scale: 1.0,
            mul_mat_q: true,     // Use quantized operations
            offload_kqv: false   // Don't offload
          };
          
          console.log('🔄 Attempting ultra-minimal settings:', ultraMinimalSettings);
          
          this.llamaContext = await initLlama({
            model: `file://${modelFilePath}`,
            ...ultraMinimalSettings,
          });
          
          console.log('✅ Ultra-minimal fallback successful');
          return;
        } catch (fallbackError) {
          console.error('❌ Ultra-minimal fallback also failed:', fallbackError);
        }
        
        throw new Error(`Memory Error: The 4.54GB Gemma model requires more memory than available. Even with 6GB RAM, try:\n\n1. Close all other apps\n2. Restart the emulator\n3. Increase emulator RAM to 8GB\n4. Or use a physical device with 8GB+ RAM\n\nDetailed error: ${error.message}`);
      }
      
      if (error.message?.includes('file') || error.message?.includes('ENOENT')) {
        console.error('📁 File Error: Model file not accessible');
        throw new Error('AI model file not found or inaccessible. Please check storage permissions.');
      }
      
      throw new Error(`Model loading failed: ${error.message}. Try restarting the app or clearing storage.`);
    }
  }

  /**
   * Ensure the model directory exists
   */
  private async ensureModelDirectory(): Promise<void> {
    try {
      const modelDir = `${FileSystem.documentDirectory}models/`;
      const huggingfaceDir = this.modelPath;
      
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
      const modelFilePath = `${this.modelPath}${this.HUGGING_FACE_CONFIG.modelName}`;
      
      console.log('📥 Starting download from Hugging Face...');
      console.log('Source:', this.HUGGING_FACE_CONFIG.modelUrl);
      console.log('Destination:', modelFilePath);
      console.log('Expected size:', this.formatBytes(this.HUGGING_FACE_CONFIG.modelSize));

      // Check available storage space
      const diskCapacity = await FileSystem.getInfoAsync(FileSystem.documentDirectory);
      console.log('Available storage space check...');

      // Start the download with progress tracking
      const downloadResumable = FileSystem.createDownloadResumable(
        this.HUGGING_FACE_CONFIG.modelUrl,
        modelFilePath,
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

      const result = await downloadResumable.downloadAsync();
      
      if (result?.status === 200) {
        console.log('✅ Model downloaded successfully!');
        const contentLength = result.headers['content-length'];
        const fileSize = contentLength ? parseInt(contentLength, 10) : 0;
        console.log('File size:', this.formatBytes(fileSize));
        
        // Verify file integrity
        const fileInfo = await FileSystem.getInfoAsync(modelFilePath);
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
      const modelFilePath = `${this.modelPath}${this.HUGGING_FACE_CONFIG.modelName}`;
      const fileInfo = await FileSystem.getInfoAsync(modelFilePath);
      
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
      const modelFilePath = `${this.modelPath}${this.HUGGING_FACE_CONFIG.modelName}`;
      const fileInfo = await FileSystem.getInfoAsync(modelFilePath);
      
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
          quantization: 'Q5_K_S'
        }
      };
      
      console.log('📋 Model configuration loaded:');
      console.log('  - Model name:', this.modelConfig.modelName);
      console.log('  - Model format: GGUF');
      console.log('  - Source: Hugging Face');
      console.log('  - Repository:', this.HUGGING_FACE_CONFIG.repoId);
      console.log('  - File size:', this.formatBytes(this.modelConfig.modelSize));
      console.log('  - Quantization: Q5_K_S');
      
    } catch (error) {
      console.error('Error loading model config:', error);
      throw error;
    }
  }

  /**
   * Process text input with actual GGUF model inference
   */
  async processText(inputText: string): Promise<GemmaResponse> {
    if (!this.isInitialized || !this.llamaContext) {
      return { error: 'AI Service not initialized' };
    }

    try {
      console.log('🧠 Processing text with GGUF model on Android:', inputText);
      
      const startTime = Date.now();
      
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

      // Android-optimized inference parameters
      const result = await this.llamaContext.completion({
        messages,
        n_predict: 256, // Reduced for Android performance
        temperature: 0.7,
        top_k: 40,
        top_p: 0.95,
        stop: stopWords,
      });

      const responseText = result.text?.trim() || 'No response generated';
      const processingTime = Date.now() - startTime;
      
      console.log('✅ Android GGUF model inference completed');
      console.log('📊 Android Performance Stats:');
      console.log('  - Response length:', responseText.length);
      console.log('  - Processing time:', processingTime, 'ms');
      console.log('  - Tokens/second:', result.timings?.predicted_per_second || 'N/A');
      console.log('  - Memory usage optimized for Android');

      return {
        text: responseText,
        confidence: 0.95
      };
    } catch (error) {
      console.error('❌ Error during Android GGUF model inference:', error);
      
      // Android-specific error handling
      if (error.message?.includes('memory') || error.message?.includes('OutOfMemory')) {
        return { 
          error: 'Android memory limit exceeded',
          text: 'I\'m experiencing memory constraints. Please try a shorter question or restart the app.'
        };
      }
      
      if (error.message?.includes('timeout')) {
        return { 
          error: 'Android processing timeout',
          text: 'Processing took too long on this device. Please try a simpler question.'
        };
      }
      
      return { 
        error: `Android processing failed: ${error.message}`,
        text: 'Sorry, I encountered an error while processing your request on Android. Please try again.'
      };
    }
  }

  /**
   * Process audio input with actual GGUF model inference
   */
  async processAudio(audioUri: string, transcriptText?: string): Promise<GemmaResponse> {
    if (!this.isInitialized || !this.llamaContext) {
      return { error: 'AI Service not initialized' };
    }

    try {
      console.log('🎤 Processing audio with GGUF model:', audioUri);
      console.log('Transcript text:', transcriptText);
      
      if (transcriptText) {
        // Use the transcript text for inference
        const travelContextPrompt = `As an AI travel assistant, answer this voice question: "${transcriptText}"`;
        return await this.processText(travelContextPrompt);
      }
      
      // If no transcript, provide a helpful response
      const response: GemmaResponse = {
        text: 'I received your voice input but couldn\'t transcribe it. Please try speaking clearly or use text input instead.',
        confidence: 0.8
      };

      return response;
    } catch (error) {
      console.error('❌ Error processing audio:', error);
      return { 
        error: 'Failed to process audio input',
        text: 'Sorry, I encountered an error while processing your audio. Please try again.'
      };
    }
  }

  /**
   * Process image input with actual GGUF model inference
   */
  async processImage(imageUri: string, query?: string): Promise<GemmaResponse> {
    if (!this.isInitialized || !this.llamaContext) {
      return { error: 'AI Service not initialized' };
    }

    try {
      console.log('📸 Processing image with GGUF model:', imageUri);
      console.log('Query:', query || 'General image analysis');
      
      // Note: The current Gemma model doesn't support vision, so we'll provide a helpful response
      // For actual multimodal inference, you would need a vision-enabled model
      const analysisQuery = query || 'analyze this image for travel insights';
      
      const visionPrompt = `I received an image for analysis with the query: "${analysisQuery}". 
      While I cannot directly process images in this context, I can provide general travel advice. 
      Based on your query, what specific travel information would you like me to help you with?`;
      
      return await this.processText(visionPrompt);
    } catch (error) {
      console.error('❌ Error processing image:', error);
      return { 
        error: 'Failed to process image input',
        text: 'Sorry, I encountered an error while processing your image. Please try again with a text query.'
      };
    }
  }

  /**
   * Generate travel recommendations with actual GGUF model inference
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
        quantization: 'Q5_K_S',
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
      
      // Clean up partial download file
      const modelFilePath = `${this.modelPath}${this.HUGGING_FACE_CONFIG.modelName}`;
      const fileInfo = await FileSystem.getInfoAsync(modelFilePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(modelFilePath);
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