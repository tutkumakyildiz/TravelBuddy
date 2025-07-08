import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotoAnalyzed: (response: string) => void;
}

export default function CameraModal({ visible, onClose, onPhotoAnalyzed }: CameraModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible]);

  const handleCameraReady = () => {
    setCameraReady(true);
  };

  const takePicture = async () => {
    if (!cameraRef.current || !cameraReady || isProcessing) return;

    try {
      setIsProcessing(true);
      
      // Take photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (!photo?.uri) {
        Alert.alert('Error', 'Failed to capture photo');
        return;
      }

      // Clean up the temporary photo
      try {
        await FileSystem.deleteAsync(photo.uri, { idempotent: true });
      } catch (cleanupError) {
        console.warn('Failed to cleanup photo:', cleanupError);
      }

      // Since this is a text-only model, provide helpful guidance
      const response = `📸 Photo captured successfully!

The current AI model is text-only and cannot analyze images. However, I can help you with travel information if you:

1. Tap on the map to get location-based recommendations
2. Ask questions about travel destinations
3. Get suggestions for activities, food, and attractions

For image analysis, a multimodal AI model would be needed in a future version.`;

      onPhotoAnalyzed(response);
      onClose();
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Camera Error', 'Failed to take picture');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return; // Prevent closing while processing
    onClose();
  };

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide">
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera" size={64} color="#666" />
            <Text style={styles.permissionText}>Camera access is required</Text>
            <Text style={styles.permissionSubtext}>
              Please grant camera permission to take photos for AI analysis
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            onCameraReady={handleCameraReady}
          />
          
          {/* Header with close button */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.headerButton} 
              onPress={handleClose}
              disabled={isProcessing}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Camera Feature</Text>
            <View style={styles.headerButton} />
          </View>

          {/* Camera overlay */}
          <View style={styles.overlay}>
            {/* AI Status */}
            <View style={styles.aiStatusContainer}>
              <Text style={styles.aiStatusText}>
                📸 Camera Ready
              </Text>
              <Text style={styles.aiStatusSubtext}>
                Text-only AI model (image analysis not available)
              </Text>
            </View>

            {/* Loading overlay */}
            {isProcessing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.processingText}>Processing photo...</Text>
                <Text style={styles.processingSubtext}>Saving and preparing response</Text>
              </View>
            )}
          </View>

          {/* Bottom controls */}
          <View style={styles.controls}>
            <View style={styles.controlsRow}>
              {/* Cancel button */}
              <TouchableOpacity 
                style={[styles.controlButton, isProcessing && styles.disabledButton]} 
                onPress={handleClose}
                disabled={isProcessing}
              >
                <Ionicons name="close" size={24} color={isProcessing ? "#666" : "#fff"} />
              </TouchableOpacity>

              {/* Capture button */}
              <TouchableOpacity
                style={[
                  styles.captureButton,
                  (!cameraReady || isProcessing) && styles.disabledCaptureButton
                ]}
                onPress={takePicture}
                disabled={!cameraReady || isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View style={styles.captureButtonInner} />
                )}
              </TouchableOpacity>

              {/* Placeholder for symmetry */}
              <View style={styles.controlButton} />
            </View>

            {/* Instructions */}
            <Text style={styles.instructionText}>
              {isProcessing ? 'Processing photo...' : 'Tap to capture photo'}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  aiStatusContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  aiStatusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  aiStatusSubtext: {
    color: '#ccc',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  processingSubtext: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 8,
  },
  controls: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingBottom: 40,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 20,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  disabledCaptureButton: {
    backgroundColor: '#666',
    borderColor: '#444',
  },
  captureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  instructionText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    marginHorizontal: 20,
  },
  // Permission denied styles
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#000',
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  permissionSubtext: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
  closeButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 30,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 