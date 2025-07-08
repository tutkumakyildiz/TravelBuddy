import React, { useState, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Animated,
  Text,
  Dimensions,
  PanResponder,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DraggableLocationProps {
  onDrop: (coordinates: { x: number; y: number }) => void;
  mapViewRef?: any;
  style?: any;
}

const DraggableLocation: React.FC<DraggableLocationProps> = ({ 
  onDrop, 
  mapViewRef, 
  style 
}) => {
  const [dragPosition] = useState(new Animated.ValueXY());
  const [isDragging, setIsDragging] = useState(false);
  const initialPosition = useRef({ x: 0, y: 0 });

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      setIsDragging(true);
      initialPosition.current = {
        x: event.nativeEvent.pageX,
        y: event.nativeEvent.pageY
      };
      console.log('🎯 Started dragging place symbol');
    },
    onPanResponderMove: Animated.event(
      [
        null,
        {
          dx: dragPosition.x,
          dy: dragPosition.y,
        },
      ],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: (event) => {
      setIsDragging(false);
      
      // Calculate final position
      const finalX = event.nativeEvent.pageX;
      const finalY = event.nativeEvent.pageY;
      
      console.log('🎯 Place symbol dropped at:', { x: finalX, y: finalY });
      
      // Reset position with animation
      Animated.spring(dragPosition, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: false,
      }).start();
      
      // Trigger AI processing
      onDrop({ x: finalX, y: finalY });
    },
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.draggableContainer,
          {
            transform: [
              { translateX: dragPosition.x },
              { translateY: dragPosition.y }
            ]
          },
          isDragging && styles.draggingContainer
        ]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.symbolContainer, isDragging && styles.draggingSymbol]}>
          <Ionicons 
            name="location" 
            size={isDragging ? 32 : 24} 
            color={isDragging ? "#ff6b6b" : "#007bff"} 
          />
        </View>
        
        <Text style={[styles.label, isDragging && styles.draggingLabel]}>
          {isDragging ? "Drop on map" : "Drag me!"}
        </Text>
      </Animated.View>
      
      {isDragging && (
        <View style={styles.instructionOverlay}>
          <Text style={styles.instructionText}>
            🎯 Drop the symbol on the map to explore that location with AI
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    zIndex: 1000,
  },
  draggableContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  draggingContainer: {
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  symbolContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 25,
    padding: 8,
    borderWidth: 2,
    borderColor: '#007bff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  draggingSymbol: {
    backgroundColor: '#fff5f5',
    borderColor: '#ff6b6b',
    borderWidth: 3,
  },
  label: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007bff',
    textAlign: 'center',
  },
  draggingLabel: {
    color: '#ff6b6b',
    fontSize: 14,
  },
  instructionOverlay: {
    position: 'absolute',
    top: -50,
    left: -80,
    right: -80,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  instructionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default DraggableLocation; 