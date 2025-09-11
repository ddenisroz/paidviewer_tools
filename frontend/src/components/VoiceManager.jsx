import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';

const VoiceManager = () => {
  const api = useApi();
  const [voices, setVoices] = useState([]);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  // Загружаем голоса и информацию об ограничениях
  useEffect(() => {
    Promise.all([loadVoices(), loadUploadInfo()]);
  }, []);

  const loadVoices = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/voices');
      setVoices(response.data.voices || []);
    } catch (error) {
      setError('Ошибка загрузки списка голосов');
      console.error('Error loading voices:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUploadInfo = async () => {
    try {
      const response = await api.get('/api/voices/info');
      setUploadInfo(response.data);
    } catch (error) {
      console.error('Error loading upload info:', error);
    }
  };

  const handleFileSelect = (files) => {
    if (files.length === 0) return;
    
    const file = files[0];
    uploadFile(file);
  };

  const uploadFile = async (file) => {
    if (!uploadInfo) return;

    // Валидация размера
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > uploadInfo.max_file_size_mb) {
      setError(`Файл слишком большой! Максимальный размер: ${uploadInfo.max_file_size_mb}МБ`);
      return;
    }

    // Валидация формата
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!uploadInfo.supported_formats.includes(extension)) {
      setError(`Неподдерживаемый формат! Поддерживаемые: ${uploadInfo.supported_formats.join(', ')}`);
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setError('');
      setSuccess('');

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/api/voices/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      setSuccess(`Голос "${response.data.voice_name}" успешно загружен!`);
      
      // Показываем информацию об обработке
      const info = response.data.info;
      if (info?.was_trimmed) {
        setSuccess(prev => prev + ` Файл был обрезан с ${info.original_duration}с до ${info.final_duration}с.`);
      }

      await loadVoices(); // Перезагружаем список

    } catch (error) {
      console.error('Upload error:', error);
      const message = error.response?.data?.detail || 'Ошибка загрузки файла';
      setError(message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const deleteVoice = async (voiceName) => {
    if (!confirm(`Удалить голос "${voiceName}"?`)) return;

    try {
      setLoading(true);
      await api.delete(`/api/voices/${voiceName}`);
      setSuccess(`Голос "${voiceName}" удален`);
      await loadVoices();
    } catch (error) {
      const message = error.response?.data?.detail || 'Ошибка удаления голоса';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Drag & Drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '—';
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-800 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Управление голосами</h2>
        <div className="text-sm text-slate-400">
          {voices.length} голосов
        </div>
      </div>

      {/* Информация об ограничениях */}
      {uploadInfo && (
        <div className="bg-slate-700 rounded-md p-4 text-sm text-slate-300">
          <div className="font-medium text-slate-200 mb-2">Требования к файлам:</div>
          <ul className="space-y-1">
            <li>• Максимальный размер: {uploadInfo.max_file_size_mb}МБ</li>
            <li>• Максимальная длительность: {uploadInfo.max_duration_seconds}с (файл будет обрезан)</li>
            <li>• Поддерживаемые форматы: {uploadInfo.supported_formats.join(', ')}</li>
            <li>• Автоматическая конвертация в WAV, моно, 22kHz</li>
          </ul>
        </div>
      )}

      {/* Зона загрузки */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-purple-400 bg-purple-400/10' 
            : 'border-slate-600 hover:border-slate-500'
        } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,.flac,.m4a,.ogg,.aac,.wma,.opus,.mp4,.webm"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        {uploading ? (
          <div className="space-y-4">
            <div className="text-purple-400 font-medium">Загружается...</div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="text-sm text-slate-400">{uploadProgress}%</div>
          </div>
        ) : (
          <>
            <div className="text-2xl mb-4">🎤</div>
            <div className="text-white font-medium mb-2">
              Перетащите аудио файл сюда или 
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-purple-400 hover:text-purple-300 ml-1 underline"
              >
                выберите файл
              </button>
            </div>
            <div className="text-sm text-slate-400">
              Файл будет автоматически конвертирован в подходящий формат
            </div>
          </>
        )}
      </div>

      {/* Сообщения об ошибках и успехе */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3 text-red-400">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-md p-3 text-green-400">
          {success}
        </div>
      )}

      {/* Список голосов */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Загруженные голоса</h3>
        
        {loading ? (
          <div className="text-center py-8 text-slate-400">
            Загружается...
          </div>
        ) : voices.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            Голоса не найдены. Загрузите первый голос!
          </div>
        ) : (
          <div className="space-y-3">
            {voices.map((voice, index) => (
              <div key={index} className="bg-slate-700 rounded-md p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-white">{voice.name}</div>
                  <div className="text-sm text-slate-400">
                    {voice.size_kb}КБ • {formatDuration(voice.duration)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteVoice(voice.name)}
                    disabled={loading}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Информация о том, как использовать голоса */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-4">
        <div className="font-medium text-blue-300 mb-2">💡 Как использовать:</div>
        <div className="text-sm text-blue-200">
          Загруженные голоса можно использовать в чате командой: <code className="bg-slate-800 px-1 rounded">!voice название_голоса</code>
        </div>
      </div>
    </div>
  );
};

export default VoiceManager;

