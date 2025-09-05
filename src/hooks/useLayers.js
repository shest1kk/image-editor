import { useState, useCallback, useRef } from 'react';

const useLayers = (initialImage = null) => {
  const [layers, setLayers] = useState([]);
  const [activeLayerId, setActiveLayerId] = useState(null);
  const canvasRef = useRef(null);

  // Инициализация с начальным изображением
  const initializeWithImage = useCallback((imageUrl, imageName = 'Слой 1') => {
    const baseLayer = {
      id: 'base-layer',
      name: 'Слой 1', // Базовый слой всегда "Слой 1"
      visible: true,
      opacity: 100,
      blendMode: 'normal',
      type: 'image',
      data: imageUrl,
      preview: null,
      alphaChannel: null,
      position: { x: 0, y: 0 } // Добавляем позицию для базового слоя
    };

    // Создаем превью для базового слоя
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 64;
      canvas.height = 64;
      
      const scale = Math.min(64 / img.width, 64 / img.height);
      const width = img.width * scale;
      const height = img.height * scale;
      const x = (64 - width) / 2;
      const y = (64 - height) / 2;
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 64, 64);
      ctx.drawImage(img, x, y, width, height);
      
      const preview = canvas.toDataURL();
      
      setLayers([{ ...baseLayer, preview }]);
      setActiveLayerId(baseLayer.id);
    };
    img.src = imageUrl;
  }, []);

  // Добавление нового слоя (в начало массива, чтобы быть верхним)
  const addLayer = useCallback((newLayer) => {
    setLayers(prevLayers => [newLayer, ...prevLayers]);
    setActiveLayerId(newLayer.id);
  }, []);

  // Обновление слоев
  const updateLayers = useCallback((newLayers) => {
    setLayers(newLayers);
  }, []);

  // Смена активного слоя
  const setActiveLayer = useCallback((layerId) => {
    setActiveLayerId(layerId);
  }, []);

  // Получение активного слоя
  const getActiveLayer = useCallback(() => {
    return layers.find(layer => layer.id === activeLayerId);
  }, [layers, activeLayerId]);

  // Рендеринг слоев на canvas
  const renderLayers = useCallback(async (canvas, canvasWidth, canvasHeight) => {
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Рендерим слои в обратном порядке (последний в массиве рисуется последним = поверх)
    for (const layer of [...layers].reverse()) {
      if (!layer.visible || !layer.data) continue;

      try {
        await renderLayer(ctx, layer, canvasWidth, canvasHeight);
      } catch (error) {
        console.error('Ошибка рендеринга слоя:', layer.name, error);
      }
    }
  }, [layers]);

  // Рендеринг отдельного слоя
  const renderLayer = useCallback(async (ctx, layer, canvasWidth, canvasHeight) => {
    // Сохраняем состояние контекста
    ctx.save();

    // Устанавливаем прозрачность
    ctx.globalAlpha = layer.opacity / 100;

    // Устанавливаем режим наложения
    ctx.globalCompositeOperation = getCompositeOperation(layer.blendMode);

    if (layer.type === 'image') {
      await renderImageLayer(ctx, layer, canvasWidth, canvasHeight);
    } else if (layer.type === 'color') {
      renderColorLayer(ctx, layer, canvasWidth, canvasHeight);
    }

    // Восстанавливаем состояние контекста
    ctx.restore();
  }, []);

  // Рендеринг слоя с изображением
  const renderImageLayer = useCallback((ctx, layer, canvasWidth, canvasHeight) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Масштабируем изображение под размер canvas
          const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
          const width = img.width * scale;
          const height = img.height * scale;
          const x = (canvasWidth - width) / 2;
          const y = (canvasHeight - height) / 2;

          ctx.drawImage(img, x, y, width, height);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = reject;
      img.src = layer.data;
    });
  }, []);

  // Рендеринг цветного слоя
  const renderColorLayer = useCallback((ctx, layer, canvasWidth, canvasHeight) => {
    ctx.fillStyle = layer.data;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }, []);

  // Преобразование режимов наложения в CSS/Canvas операции
  const getCompositeOperation = useCallback((blendMode) => {
    switch (blendMode) {
      case 'multiply':
        return 'multiply';
      case 'screen':
        return 'screen';
      case 'overlay':
        return 'overlay';
      case 'normal':
      default:
        return 'source-over';
    }
  }, []);

  // Экспорт композитного изображения
  const exportComposite = useCallback(async (format = 'image/png', quality = 0.9) => {
    if (!canvasRef.current || layers.length === 0) return null;

    const canvas = canvasRef.current;
    await renderLayers(canvas, canvas.width, canvas.height);
    
    return canvas.toDataURL(format, quality);
  }, [layers, renderLayers]);

  // Получение информации о слоях
  const getLayersInfo = useCallback(() => {
    return {
      totalLayers: layers.length,
      visibleLayers: layers.filter(layer => layer.visible).length,
      activeLayer: getActiveLayer(),
      hasAlphaChannels: layers.some(layer => layer.alphaChannel)
    };
  }, [layers, getActiveLayer]);

  return {
    layers,
    activeLayerId,
    canvasRef,
    initializeWithImage,
    addLayer,
    updateLayers,
    setActiveLayer,
    getActiveLayer,
    renderLayers,
    exportComposite,
    getLayersInfo
  };
};

export default useLayers;
