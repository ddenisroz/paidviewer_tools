# 📋 Версии зависимостей

## Bot Service (основной сервис)

### Требования:
- **Python:** 3.10+
- **Node.js:** 18+
- **Database:** SQLite (dev) / PostgreSQL (prod)
- **GPU:** НЕ требуется ✅

### Основные зависимости:
```
FastAPI 0.121.2
SQLAlchemy 2.0.44
Pydantic 2.10.6
React 19
```

---

## TTS Service Simple (F5-TTS)

### Требования:
- **Python:** 3.10+
- **GPU:** NVIDIA с VRAM ≥ 6 GB (RTX 2060/3060+)
- **CUDA:** 11.8 или 12.x
- **RAM:** 16 GB

### Основные зависимости:
```
PyTorch 2.4.0
CUDA 12.4 (рекомендуется) или 11.8
F5-TTS 0.1.0+
FastAPI 0.104.1
```

### Установка PyTorch:

#### CUDA 12.4 (рекомендуется):
```bash
pip install torch==2.4.0+cu124 torchaudio==2.4.0+cu124 torchvision==0.19.0+cu124 --extra-index-url https://download.pytorch.org/whl/cu124
```

#### CUDA 11.8:
```bash
pip install torch==2.4.0+cu118 torchaudio==2.4.0+cu118 torchvision==0.19.0+cu118 --extra-index-url https://download.pytorch.org/whl/cu118
```

#### CPU (без GPU):
```bash
pip install torch==2.4.0 torchaudio==2.4.0 torchvision==0.19.0
```

---

## Проверка версий

### Python:
```bash
python --version
# Должен быть 3.10 или выше
```

### Node.js:
```bash
node --version
# Должен быть 18 или выше
```

### CUDA (если используете F5-TTS):
```bash
nvidia-smi
# Покажет версию CUDA и GPU
```

### PyTorch (если используете F5-TTS):
```bash
python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA available: {torch.cuda.is_available()}')"
```

---

## Совместимость

### Bot Service:
- ✅ Работает на любой машине (Windows, Linux, Mac)
- ✅ Не требует GPU
- ✅ Минимальные требования: 2GB RAM

### TTS Service Simple:
- ⚠️ Требует NVIDIA GPU
- ⚠️ Требует CUDA 11.8 или 12.x
- ⚠️ Рекомендуется: 6GB+ VRAM, 16GB RAM

---

## Обновление зависимостей

### Bot Service:
```bash
cd bot_service
pip install -r requirements.txt --upgrade
```

### Frontend:
```bash
cd frontend
npm update
```

### TTS Service Simple:
```bash
cd tts_service_simple
pip install -r requirements.txt --upgrade
```

---

**Дата:** 15 ноября 2025  
**Версия проекта:** 0.03
