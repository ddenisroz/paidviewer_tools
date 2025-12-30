# PyTorch Installation Guide

## Current Configuration

- **Python**: 3.12.0
- **PyTorch**: 2.8.0+cu128
- **CUDA**: 12.8
- **Platform**: Windows

## Installation Command

```bash
# Activate virtual environment first
.venv\Scripts\activate

# Install PyTorch with CUDA 12.8 support
pip install torch==2.8.0 torchaudio==2.8.0 torchvision==0.23.0 torchdiffeq==0.2.5 --extra-index-url https://download.pytorch.org/whl/cu128
```

## Verification

```bash
# Check PyTorch version and CUDA availability
python -c "import torch; print('PyTorch:', torch.__version__); print('CUDA available:', torch.cuda.is_available())"
```

Expected output:
```
PyTorch: 2.8.0+cu128
CUDA available: True
```

## Troubleshooting

### Issue: CUDA not available

1. Check NVIDIA driver version:
   ```bash
   nvidia-smi
   ```

2. Ensure CUDA 12.8 is installed

3. Verify GPU is detected:
   ```python
   import torch
   print(torch.cuda.device_count())
   print(torch.cuda.get_device_name(0))
   ```

### Issue: Version conflicts

If you get dependency conflicts:

1. Uninstall all PyTorch packages:
   ```bash
   pip uninstall torch torchaudio torchvision torchdiffeq -y
   ```

2. Reinstall with exact versions:
   ```bash
   pip install torch==2.8.0 torchaudio==2.8.0 torchvision==0.23.0 torchdiffeq==0.2.5 --extra-index-url https://download.pytorch.org/whl/cu128
   ```

### Issue: Wrong PyTorch version installed

Make sure to use `--extra-index-url` (not `--index-url`) to allow pip to find both PyPI packages and PyTorch CUDA builds.

## Alternative CUDA Versions

### CUDA 12.4
```bash
pip install torch torchaudio torchvision --extra-index-url https://download.pytorch.org/whl/cu124
```

### CUDA 11.8
```bash
pip install torch torchaudio torchvision --extra-index-url https://download.pytorch.org/whl/cu118
```

### CPU Only
```bash
pip install torch torchaudio torchvision
```

## Requirements.txt Format

For `requirements.txt`, use:

```txt
torch==2.8.0+cu128
torchaudio==2.8.0+cu128
torchvision==0.23.0+cu128
torchdiffeq==0.2.5
```

Then install with:
```bash
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cu128
```

## Performance Notes

PyTorch 2.8.0 with CUDA 12.8 provides:
- Improved memory efficiency
- Faster training and inference
- Better support for modern GPUs (RTX 40xx series)
- Enhanced mixed precision training

## Related Documentation

- [PyTorch Official Installation](https://pytorch.org/get-started/locally/)
- [CUDA Compatibility](https://pytorch.org/get-started/previous-versions/)
- Project migration: `PYTHON_312_MIGRATION_COMPLETE.md`
