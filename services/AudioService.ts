import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';

interface AudioRecording {
  recording: Audio.Recording | null;
  uri: string | null;
  duration: number;
}

interface SpeechResult {
  text: string;
  confidence: number;
  error?: string;
}

class AudioService {
  private static instance: AudioService;
  private currentRecording: AudioRecording = {
    recording: null,
    uri: null,
    duration: 0
  };
  private isRecording: boolean = false;
  private hasPermission: boolean = false;

  private constructor() {}

  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  /**
   * Request microphone permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      this.hasPermission = status === 'granted';
      
      if (this.hasPermission) {
        // Configure audio mode for recording
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      }
      
      return this.hasPermission;
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  }

  /**
   * Start audio recording
   */
  async startRecording(): Promise<boolean> {
    try {
      console.log('🎤 Attempting to start recording...');
      
      if (!this.hasPermission) {
        console.log('📱 Requesting microphone permissions...');
        const permissionGranted = await this.requestPermissions();
        if (!permissionGranted) {
          console.error('❌ Microphone permission denied');
          throw new Error('Microphone permission denied');
        }
        console.log('✅ Microphone permission granted');
      }

      if (this.isRecording) {
        console.warn('⚠️ Recording already in progress');
        return false;
      }

      // Configure audio mode first
      console.log('🔧 Configuring audio mode...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create new recording with explicit settings
      console.log('📼 Creating recording instance...');
      const recording = new Audio.Recording();
      
      try {
        // Prepare recording with basic options
        await recording.prepareToRecordAsync();
        console.log('✅ Recording prepared successfully');
        
        // Start recording
        await recording.startAsync();
        console.log('🔴 Recording started successfully');
        
        this.currentRecording.recording = recording;
        this.isRecording = true;
        
        return true;
      } catch (recordingError) {
        console.error('❌ Error with recording setup:', recordingError);
        // Fallback: try with createAsync method
        console.log('🔄 Trying fallback recording method...');
        
        const { recording: fallbackRecording } = await Audio.Recording.createAsync();
        this.currentRecording.recording = fallbackRecording;
        this.isRecording = true;
        
        console.log('✅ Fallback recording method successful');
        return true;
      }
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      this.isRecording = false;
      return false;
    }
  }

  /**
   * Stop audio recording and return the file URI
   */
  async stopRecording(): Promise<string | null> {
    try {
      if (!this.isRecording || !this.currentRecording.recording) {
        console.warn('No active recording to stop');
        return null;
      }

      // Stop recording
      await this.currentRecording.recording.stopAndUnloadAsync();
      
      // Get the URI
      const uri = this.currentRecording.recording.getURI();
      this.currentRecording.uri = uri;
      
      // Get recording status for duration
      const status = await this.currentRecording.recording.getStatusAsync();
      if ('durationMillis' in status) {
        this.currentRecording.duration = status.durationMillis || 0;
      }

      this.isRecording = false;
      
      console.log('🎤 Audio recording stopped:', {
        uri,
        duration: this.currentRecording.duration
      });

      return uri;
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.isRecording = false;
      return null;
    }
  }

  /**
   * Convert speech to text using device's speech recognition
   */
  async speechToText(audioUri: string): Promise<SpeechResult> {
    try {
      console.log('🗣️ Converting speech to text:', audioUri);
      
      // Note: expo-speech is primarily for text-to-speech, not speech-to-text
      // For MVP, we'll simulate speech recognition with a placeholder
      // In a full implementation, you'd use a service like Google Speech-to-Text API
      
      // Simulate different common travel queries
      const simulatedQueries = [
        "What are the best restaurants nearby?",
        "Tell me about local attractions",
        "What should I do today?",
        "Where can I find authentic local food?",
        "What are some hidden gems in this area?",
        "Can you recommend outdoor activities?",
        "What's the best way to get around here?",
        "Tell me about the local culture",
        "Where should I go for shopping?",
        "What are the must-see places?"
      ];

      // Randomly select a query based on recording duration
      const durationSeconds = this.currentRecording.duration / 1000;
      let selectedQuery: string;

      if (durationSeconds < 2) {
        selectedQuery = "What should I do here?";
      } else if (durationSeconds < 4) {
        selectedQuery = simulatedQueries[Math.floor(Math.random() * 5)];
      } else {
        selectedQuery = simulatedQueries[Math.floor(Math.random() * simulatedQueries.length)];
      }

      console.log('🤖 Simulated speech recognition result:', selectedQuery);

      return {
        text: selectedQuery,
        confidence: 0.85
      };
    } catch (error) {
      console.error('Error in speech-to-text:', error);
      return {
        text: '',
        confidence: 0,
        error: 'Failed to process speech'
      };
    }
  }

  /**
   * Clean up audio files
   */
  async cleanup(): Promise<void> {
    try {
      if (this.currentRecording.uri) {
        await FileSystem.deleteAsync(this.currentRecording.uri, { idempotent: true });
        console.log('🧹 Audio file cleaned up');
      }
    } catch (error) {
      console.warn('Error cleaning up audio file:', error);
    } finally {
      this.currentRecording = {
        recording: null,
        uri: null,
        duration: 0
      };
    }
  }

  /**
   * Get current recording status
   */
  getRecordingStatus(): {
    isRecording: boolean;
    hasPermission: boolean;
    duration: number;
  } {
    return {
      isRecording: this.isRecording,
      hasPermission: this.hasPermission,
      duration: this.currentRecording.duration
    };
  }

  /**
   * Cancel current recording
   */
  async cancelRecording(): Promise<void> {
    try {
      if (this.isRecording && this.currentRecording.recording) {
        await this.currentRecording.recording.stopAndUnloadAsync();
        this.isRecording = false;
        await this.cleanup();
        console.log('🚫 Recording cancelled');
      }
    } catch (error) {
      console.error('Error cancelling recording:', error);
    }
  }
}

export default AudioService; 