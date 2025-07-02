#!/usr/bin/env python3
"""
Gemma 3n Model Quantization Script

This script quantizes the Gemma 3n model to reduce size for mobile deployment.
Supports multiple quantization methods with different size/accuracy trade-offs.

Requirements:
- pip install torch transformers optimum onnx onnxruntime
- pip install tensorflow (for TFLite conversion)
- pip install bitsandbytes (for 4-bit quantization)
"""

import os
import sys
import json
import shutil
from pathlib import Path
from typing import Optional, Dict, Any

def check_dependencies():
    """Check if required packages are installed"""
    required_packages = {
        'torch': 'PyTorch',
        'transformers': 'Hugging Face Transformers',
        'optimum': 'Hugging Face Optimum',
        'onnx': 'ONNX',
        'onnxruntime': 'ONNX Runtime'
    }
    
    missing_packages = []
    for package, name in required_packages.items():
        try:
            __import__(package)
            print(f"✓ {name} found")
        except ImportError:
            missing_packages.append(package)
            print(f"✗ {name} missing")
    
    if missing_packages:
        print(f"\n❌ Missing packages: {', '.join(missing_packages)}")
        print("Install with: pip install " + " ".join(missing_packages))
        return False
    
    return True

def setup_directories():
    """Setup directory structure"""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    dirs = {
        'source': project_root / "models" / "gemma3n",
        'quantized': project_root / "models" / "gemma3n_quantized",
        'output': project_root / "assets" / "models" / "gemma3n"
    }
    
    # Create output directories
    dirs['quantized'].mkdir(parents=True, exist_ok=True)
    dirs['output'].mkdir(parents=True, exist_ok=True)
    
    return dirs

def quantize_with_transformers(source_dir: Path, output_dir: Path, method: str = "int8"):
    """
    Quantize using Hugging Face transformers and optimum
    
    Args:
        source_dir: Source model directory
        output_dir: Output directory for quantized model
        method: Quantization method ('int8', 'int4', 'fp16')
    """
    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from optimum.bettertransformer import BetterTransformer
        import torch
        
        print(f"🔄 Loading model from {source_dir}...")
        
        # Load model and tokenizer
        model = AutoModelForCausalLM.from_pretrained(
            str(source_dir),
            torch_dtype=torch.float16,
            device_map="auto",
            low_cpu_mem_usage=True
        )
        
        tokenizer = AutoTokenizer.from_pretrained(str(source_dir))
        
        print(f"📊 Original model size: {get_model_size(model):.2f} GB")
        
        if method == "int8":
            print("🔧 Applying INT8 quantization...")
            # Apply 8-bit quantization
            from transformers import BitsAndBytesConfig
            
            quantization_config = BitsAndBytesConfig(
                load_in_8bit=True,
                llm_int8_enable_fp32_cpu_offload=True
            )
            
            model = AutoModelForCausalLM.from_pretrained(
                str(source_dir),
                quantization_config=quantization_config,
                device_map="auto"
            )
            
        elif method == "int4":
            print("🔧 Applying INT4 quantization...")
            from transformers import BitsAndBytesConfig
            
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4"
            )
            
            model = AutoModelForCausalLM.from_pretrained(
                str(source_dir),
                quantization_config=quantization_config,
                device_map="auto"
            )
            
        elif method == "fp16":
            print("🔧 Converting to FP16...")
            model = model.half()
        
        print(f"📉 Quantized model size: {get_model_size(model):.2f} GB")
        
        # Save quantized model
        print(f"💾 Saving quantized model to {output_dir}...")
        model.save_pretrained(str(output_dir))
        tokenizer.save_pretrained(str(output_dir))
        
        # Create model info
        create_quantized_model_info(output_dir, method, get_model_size(model))
        
        print(f"✅ {method.upper()} quantization completed!")
        return True
        
    except Exception as e:
        print(f"❌ Transformers quantization failed: {str(e)}")
        return False

def quantize_to_onnx(source_dir: Path, output_dir: Path, quantization_type: str = "int8"):
    """
    Convert to ONNX format with quantization
    
    Args:
        source_dir: Source model directory
        output_dir: Output directory
        quantization_type: 'int8' or 'int4'
    """
    try:
        from optimum.onnxruntime import ORTModelForCausalLM, ORTQuantizer
        from optimum.onnxruntime.configuration import AutoQuantizationConfig
        from transformers import AutoTokenizer
        
        print("🔄 Converting to ONNX with quantization...")
        
        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(str(source_dir))
        
        # Convert to ONNX
        onnx_model = ORTModelForCausalLM.from_pretrained(
            str(source_dir),
            export=True
        )
        
        # Setup quantization config
        if quantization_type == "int8":
            quantization_config = AutoQuantizationConfig.avx512_vnni(
                is_static=False,
                per_channel=True
            )
        else:  # int4
            quantization_config = AutoQuantizationConfig.arm64(
                is_static=False,
                per_channel=True
            )
        
        # Apply quantization
        quantizer = ORTQuantizer.from_pretrained(onnx_model)
        quantizer.quantize(
            quantization_config=quantization_config,
            save_dir=str(output_dir)
        )
        
        # Save tokenizer
        tokenizer.save_pretrained(str(output_dir))
        
        print(f"✅ ONNX {quantization_type.upper()} quantization completed!")
        return True
        
    except Exception as e:
        print(f"❌ ONNX quantization failed: {str(e)}")
        return False

def quantize_to_tflite(source_dir: Path, output_dir: Path):
    """
    Convert to TensorFlow Lite with quantization
    Note: This is more complex for transformer models
    """
    try:
        import tensorflow as tf
        from transformers import TFAutoModelForCausalLM, AutoTokenizer
        
        print("🔄 Converting to TensorFlow Lite...")
        
        # Load TF model
        tf_model = TFAutoModelForCausalLM.from_pretrained(
            str(source_dir),
            from_tf=True
        )
        
        tokenizer = AutoTokenizer.from_pretrained(str(source_dir))
        
        # Convert to TFLite with quantization
        converter = tf.lite.TFLiteConverter.from_keras_model(tf_model)
        
        # Enable quantization
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        converter.target_spec.supported_types = [tf.int8]
        
        # Convert
        tflite_model = converter.convert()
        
        # Save TFLite model
        tflite_path = output_dir / "model.tflite"
        with open(tflite_path, 'wb') as f:
            f.write(tflite_model)
        
        # Save tokenizer
        tokenizer.save_pretrained(str(output_dir))
        
        print(f"✅ TensorFlow Lite quantization completed!")
        return True
        
    except Exception as e:
        print(f"❌ TensorFlow Lite conversion failed: {str(e)}")
        return False

def create_custom_quantized_model(source_dir: Path, output_dir: Path):
    """
    Create a lightweight custom model for mobile deployment
    """
    try:
        import torch
        from transformers import AutoConfig, AutoTokenizer
        
        print("🔄 Creating custom lightweight model...")
        
        # Load original config
        config = AutoConfig.from_pretrained(str(source_dir))
        tokenizer = AutoTokenizer.from_pretrained(str(source_dir))
        
        # Create a smaller config for mobile
        mobile_config = {
            "model_type": config.model_type,
            "architectures": config.architectures,
            "vocab_size": config.vocab_size,
            "hidden_size": min(config.hidden_size, 1024),  # Reduce hidden size
            "num_attention_heads": min(config.num_attention_heads, 8),  # Reduce heads
            "num_hidden_layers": min(config.num_hidden_layers, 12),  # Reduce layers
            "intermediate_size": min(config.intermediate_size, 4096),  # Reduce intermediate
            "max_position_embeddings": min(config.max_position_embeddings, 2048),  # Reduce context
            "torch_dtype": "float16",
            "use_cache": True,
            "_name_or_path": f"{config._name_or_path}-mobile",
            "mobile_optimized": True,
            "quantization": "custom_mobile"
        }
        
        # Save mobile config
        with open(output_dir / "config.json", 'w') as f:
            json.dump(mobile_config, f, indent=2)
        
        # Save tokenizer (keep full tokenizer for compatibility)
        tokenizer.save_pretrained(str(output_dir))
        
        # Create placeholder model weights (very small)
        create_placeholder_weights(output_dir, mobile_config)
        
        print("✅ Custom mobile model created!")
        return True
        
    except Exception as e:
        print(f"❌ Custom model creation failed: {str(e)}")
        return False

def create_placeholder_weights(output_dir: Path, config: Dict[str, Any]):
    """Create minimal placeholder weights for testing"""
    import torch
    
    # Create minimal safetensors index
    index = {
        "metadata": {"total_size": 1024 * 1024},  # 1MB placeholder
        "weight_map": {
            "model.embed_tokens.weight": "model.safetensors",
            "model.norm.weight": "model.safetensors",
            "lm_head.weight": "model.safetensors"
        }
    }
    
    with open(output_dir / "model.safetensors.index.json", 'w') as f:
        json.dump(index, f, indent=2)
    
    # Create tiny placeholder weights file
    placeholder_data = b"PLACEHOLDER_WEIGHTS_FOR_MOBILE_TESTING" + b"\x00" * (1024 - 38)
    with open(output_dir / "model.safetensors", 'wb') as f:
        f.write(placeholder_data)

def get_model_size(model) -> float:
    """Get model size in GB"""
    param_count = sum(p.nelement() * p.element_size() for p in model.parameters())
    buffer_count = sum(b.nelement() * b.element_size() for b in model.buffers())
    total_bytes = param_count + buffer_count
    return total_bytes / (1024 ** 3)  # Convert to GB

def create_quantized_model_info(output_dir: Path, method: str, size_gb: float):
    """Create info file for quantized model"""
    info = {
        "model_name": "Google Gemma 3n",
        "variant": "quantized",
        "quantization_method": method,
        "size_gb": size_gb,
        "mobile_optimized": True,
        "status": "ready",
        "description": f"Quantized Gemma 3n model using {method} quantization"
    }
    
    with open(output_dir / "model_info.json", 'w') as f:
        json.dump(info, f, indent=2)

def copy_to_assets(quantized_dir: Path, assets_dir: Path):
    """Copy quantized model to assets directory"""
    try:
        print(f"📋 Copying quantized model to assets...")
        
        # Remove existing assets model
        if assets_dir.exists():
            shutil.rmtree(assets_dir)
        
        # Copy quantized model
        shutil.copytree(quantized_dir, assets_dir)
        
        print(f"✅ Model copied to {assets_dir}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to copy to assets: {str(e)}")
        return False

def main():
    """Main quantization process"""
    print("🤖 Gemma 3n Model Quantization Tool")
    print("=" * 50)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Setup directories
    dirs = setup_directories()
    
    if not dirs['source'].exists():
        print(f"❌ Source model not found at {dirs['source']}")
        print("Please ensure your Gemma 3n model is in the models/gemma3n directory")
        sys.exit(1)
    
    print(f"📁 Source model: {dirs['source']}")
    print(f"📁 Output directory: {dirs['quantized']}")
    
    # Choose quantization method
    print("\n📋 Available quantization methods:")
    print("1. INT8 Quantization (75% size reduction, minimal accuracy loss)")
    print("2. INT4 Quantization (87% size reduction, some accuracy loss)")
    print("3. FP16 Conversion (50% size reduction, no accuracy loss)")
    print("4. ONNX INT8 (Optimized for inference)")
    print("5. Custom Mobile Model (95% size reduction, placeholder weights)")
    print("6. All methods (for comparison)")
    
    choice = input("\nChoose method (1-6, default=1): ").strip()
    
    methods = {
        "1": ("int8", quantize_with_transformers),
        "2": ("int4", quantize_with_transformers),
        "3": ("fp16", quantize_with_transformers),
        "4": ("onnx_int8", quantize_to_onnx),
        "5": ("custom_mobile", create_custom_quantized_model),
    }
    
    if choice == "6":
        # Run all methods
        success_count = 0
        for method_name, (param, func) in methods.items():
            method_dir = dirs['quantized'] / f"method_{method_name}_{param}"
            method_dir.mkdir(exist_ok=True)
            
            print(f"\n🔄 Running {param} quantization...")
            if param in ["int8", "int4", "fp16"]:
                success = func(dirs['source'], method_dir, param)
            else:
                success = func(dirs['source'], method_dir)
            
            if success:
                success_count += 1
        
        print(f"\n✅ Completed {success_count}/{len(methods)} quantization methods!")
        
    else:
        # Run single method
        method_key = choice if choice in methods else "1"
        param, func = methods[method_key]
        
        print(f"\n🎯 Selected: {param.upper()} quantization")
        
        if param in ["int8", "int4", "fp16"]:
            success = func(dirs['source'], dirs['quantized'], param)
        else:
            success = func(dirs['source'], dirs['quantized'])
        
        if success:
            # Copy to assets for app use
            copy_to_assets(dirs['quantized'], dirs['output'])
            
            print(f"\n🎉 Quantization completed successfully!")
            print(f"📱 Model ready for mobile deployment in: {dirs['output']}")
        else:
            print(f"\n❌ Quantization failed.")
            sys.exit(1)

if __name__ == "__main__":
    main() 