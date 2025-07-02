# AI Models Directory

## Google Gemma 3n Model Setup

This directory should contain the Google Gemma 3n model files for offline operation.

### Required Files Structure:
```
models/
├── gemma3n/
│   ├── model.json          # Model architecture and metadata
│   ├── model_weights.bin   # Model weights (or multiple .bin files)
│   ├── tokenizer.json      # Tokenizer configuration
│   ├── vocab.json          # Vocabulary file
│   └── config.json         # Model configuration
└── README.md              # This file
```

### How to Install Gemma 3n Model:

1. **Download from Kaggle:**
   - Go to https://www.kaggle.com/models/google/gemma-3n
   - Sign in to your Kaggle account
   - Accept the model usage terms
   - Download the model files

2. **Extract and Place Files:**
   - Create a `gemma3n` folder in this `models` directory
   - Extract all downloaded model files into `models/gemma3n/`
   - Ensure the file structure matches the requirement above

3. **File Size Considerations:**
   - Gemma 3n model files can be several GB in size
   - Ensure you have sufficient device storage
   - Consider using model quantization for smaller file sizes if available

### Supported Formats:
- TensorFlow.js format (.json + .bin files)
- If you have other formats (PyTorch, etc.), you may need to convert them to TensorFlow.js format

### Model Capabilities:
- **Text Generation:** Natural language processing and generation
- **Multimodal:** Text, image, and audio processing (depending on variant)
- **Offline Operation:** Runs entirely on-device without internet

### Troubleshooting:
- If the app shows "Gemma 3n model not found", ensure all files are in the correct location
- Check file permissions if the model fails to load
- Monitor device memory usage during model loading
- Consider reducing model size if performance is poor on your device

### Security Note:
- Model files are stored locally on the device
- No data is sent to external servers when using the offline model
- All AI processing happens on-device for privacy 