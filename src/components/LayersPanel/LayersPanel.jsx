import React, { useState, useCallback } from 'react';
import LayerItem from './LayerItem';
import './LayersPanel.css';

const BLEND_MODES = {
  normal: {
    name: 'Обычный',
    description: 'Пиксели верхнего слоя полностью заменяют пиксели нижнего слоя. Самый простой режим наложения.'
  },
  multiply: {
    name: 'Умножение',
    description: 'Умножает цвета слоев. Результат всегда темнее исходных цветов. Белый цвет становится прозрачным.'
  },
  screen: {
    name: 'Экран',
    description: 'Инвертирует цвета, умножает их, затем снова инвертирует. Результат всегда светлее. Черный цвет становится прозрачным.'
  },
  overlay: {
    name: 'Наложение',
    description: 'Комбинирует умножение и экран. Темные области становятся темнее, светлые - светлее. Увеличивает контрастность.'
  }
};

const LayersPanel = ({ 
  layers = [], 
  activeLayerId, 
  onLayersChange, 
  onLayersReorder,
  onLayersPropertiesChange,
  onActiveLayerChange, 
  onAddLayer,
  maxLayers = 2 
}) => {
  const [draggedLayer, setDraggedLayer] = useState(null);

  // Создание нового слоя
  const handleAddLayer = useCallback(() => {
    if (layers.length >= maxLayers) {
      alert(`Максимальное количество слоев: ${maxLayers}`);
      return;
    }

    const newLayer = {
      id: Date.now().toString(),
      name: `Слой ${layers.length + 1}`, // Будет переименован после добавления
      visible: true,
      opacity: 100,
      blendMode: 'normal',
      type: 'empty', // 'image', 'color', 'empty'
      data: null,
      preview: null,
      alphaChannel: null
    };

    onAddLayer && onAddLayer(newLayer);
  }, [layers.length, maxLayers, onAddLayer]);

  // Удаление слоя
  const handleDeleteLayer = useCallback((layerId) => {
    if (layers.length <= 1) {
      alert('Нельзя удалить последний слой');
      return;
    }

    const updatedLayers = layers.filter(layer => layer.id !== layerId);
    onLayersChange && onLayersChange(updatedLayers);

    // Если удаляемый слой был активным, активируем другой
    if (activeLayerId === layerId && updatedLayers.length > 0) {
      onActiveLayerChange && onActiveLayerChange(updatedLayers[0].id);
    }
  }, [layers, activeLayerId, onLayersChange, onActiveLayerChange]);

  // Изменение видимости слоя
  const handleToggleVisibility = useCallback((layerId) => {
    const updatedLayers = layers.map(layer => 
      layer.id === layerId 
        ? { ...layer, visible: !layer.visible }
        : layer
    );
    
    // Для видимости всегда используем onLayersChange, чтобы гарантировать перерисовку
    if (onLayersChange) {
      onLayersChange(updatedLayers);
    } else if (onLayersPropertiesChange) {
      onLayersPropertiesChange(updatedLayers);
    }
  }, [layers, onLayersChange, onLayersPropertiesChange]);

  // Изменение непрозрачности слоя
  const handleOpacityChange = useCallback((layerId, opacity) => {
    const updatedLayers = layers.map(layer => 
      layer.id === layerId 
        ? { ...layer, opacity: Number(opacity) }
        : layer
    );
    if (onLayersPropertiesChange) {
      onLayersPropertiesChange(updatedLayers);
    } else if (onLayersChange) {
      onLayersChange(updatedLayers);
    }
  }, [layers, onLayersPropertiesChange]);

  // Изменение режима наложения
  const handleBlendModeChange = useCallback((layerId, blendMode) => {
    const updatedLayers = layers.map(layer => 
      layer.id === layerId 
        ? { ...layer, blendMode }
        : layer
    );
    if (onLayersPropertiesChange) {
      onLayersPropertiesChange(updatedLayers);
    } else if (onLayersChange) {
      onLayersChange(updatedLayers);
    }
  }, [layers, onLayersPropertiesChange]);

  // Функция для извлечения альфа-канала из изображения
  const extractAlphaChannel = useCallback((img) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Рисуем изображение на canvas
    ctx.drawImage(img, 0, 0);
    
    // Получаем данные пикселей
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Проверяем, есть ли прозрачность
    let hasTransparency = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        hasTransparency = true;
        break;
      }
    }
    
    if (!hasTransparency) {
      return null; // Нет альфа-канала
    }
    
    // Создаем изображение альфа-канала (черно-белое)
    const alphaCanvas = document.createElement('canvas');
    const alphaCtx = alphaCanvas.getContext('2d');
    alphaCanvas.width = img.width;
    alphaCanvas.height = img.height;
    
    const alphaImageData = alphaCtx.createImageData(img.width, img.height);
    const alphaData = alphaImageData.data;
    
    // Заполняем альфа-канал (прозрачные области = черные, непрозрачные = белые)
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      alphaData[i] = alpha;     // R
      alphaData[i + 1] = alpha; // G
      alphaData[i + 2] = alpha; // B
      alphaData[i + 3] = 255;   // Alpha (сам альфа-канал всегда непрозрачен)
    }
    
    alphaCtx.putImageData(alphaImageData, 0, 0);
    
    // Создаем превью альфа-канала
    const previewCanvas = document.createElement('canvas');
    const previewCtx = previewCanvas.getContext('2d');
    previewCanvas.width = 64;
    previewCanvas.height = 64;
    
    const scale = Math.min(64 / img.width, 64 / img.height);
    const previewWidth = img.width * scale;
    const previewHeight = img.height * scale;
    const previewX = (64 - previewWidth) / 2;
    const previewY = (64 - previewHeight) / 2;
    
    previewCtx.fillStyle = '#ffffff';
    previewCtx.fillRect(0, 0, 64, 64);
    previewCtx.drawImage(alphaCanvas, previewX, previewY, previewWidth, previewHeight);
    
    return {
      visible: true,
      data: alphaCanvas.toDataURL(),
      preview: previewCanvas.toDataURL()
    };
  }, []);

  // Загрузка изображения в слой
  const handleLoadImage = useCallback((layerId, file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Создаем превью изображения
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;
        
        // Масштабируем изображение для превью
        const scale = Math.min(64 / img.width, 64 / img.height);
        const width = img.width * scale;
        const height = img.height * scale;
        const x = (64 - width) / 2;
        const y = (64 - height) / 2;
        
        // Для PNG с прозрачностью рисуем шахматный фон
        const squareSize = 4;
        for (let py = 0; py < 64; py += squareSize) {
          for (let px = 0; px < 64; px += squareSize) {
            const isLight = (Math.floor(px / squareSize) + Math.floor(py / squareSize)) % 2 === 0;
            ctx.fillStyle = isLight ? '#ffffff' : '#e0e0e0';
            ctx.fillRect(px, py, squareSize, squareSize);
          }
        }
        
        ctx.drawImage(img, x, y, width, height);
        const preview = canvas.toDataURL();
        
        // Извлекаем альфа-канал
        const alphaChannel = extractAlphaChannel(img);
        
        const updatedLayers = layers.map(layer => 
          layer.id === layerId 
            ? { 
                ...layer, 
                type: 'image',
                data: e.target.result,
                preview,
                name: file.name || layer.name,
                alphaChannel
              }
            : layer
        );
        
        if (onLayersPropertiesChange) {
          onLayersPropertiesChange(updatedLayers);
        } else if (onLayersChange) {
          onLayersChange(updatedLayers);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, [layers, onLayersPropertiesChange, onLayersChange, extractAlphaChannel]);

  // Заливка слоя цветом
  const handleFillColor = useCallback((layerId, color) => {
    // Создаем превью с цветом
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 64;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 64, 64);
    const preview = canvas.toDataURL();

    const updatedLayers = layers.map(layer => 
      layer.id === layerId 
        ? { 
            ...layer,
            // Сохраняем исходное состояние, если это первое применение цвета
            originalState: layer.type !== 'color' ? {
              type: layer.type,
              data: layer.data,
              preview: layer.preview,
              name: layer.name,
              alphaChannel: layer.alphaChannel
            } : layer.originalState,
            type: 'color',
            data: color,
            preview,
            name: `Цвет ${color}`
          }
        : layer
    );
    onLayersChange && onLayersChange(updatedLayers);
  }, [layers, onLayersChange]);

  // Сброс слоя к исходному состоянию (до применения цвета)
  const handleResetLayer = useCallback((layerId) => {
    const updatedLayers = layers.map(layer => 
      layer.id === layerId 
        ? { 
            ...layer,
            // Восстанавливаем исходное состояние, если оно есть
            ...(layer.originalState || {
              type: 'empty',
              data: null,
              preview: null,
              name: layer.name.includes('Слой') ? layer.name : `Слой ${layer.id}`,
              alphaChannel: null
            }),
            // Очищаем сохраненное состояние
            originalState: undefined
          }
        : layer
    );
    onLayersChange && onLayersChange(updatedLayers);
  }, [layers, onLayersChange]);

  // Drag and Drop для изменения порядка слоев
  const handleDragStart = useCallback((e, layerId) => {
    e.stopPropagation();
    setDraggedLayer(layerId);
    e.dataTransfer.effectAllowed = 'move';
    
    // Создаем пустую drag image, чтобы не показывать "призрачный" элемент
    const dragImage = new Image();
    dragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
    e.dataTransfer.setDragImage(dragImage, 0, 0);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e, targetLayerId) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedLayer || draggedLayer === targetLayerId) {
      setDraggedLayer(null);
      return;
    }

    const draggedIndex = layers.findIndex(layer => layer.id === draggedLayer);
    const targetIndex = layers.findIndex(layer => layer.id === targetLayerId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedLayer(null);
      return;
    }

    const newLayers = [...layers];
    const [draggedLayerObj] = newLayers.splice(draggedIndex, 1);
    newLayers.splice(targetIndex, 0, draggedLayerObj);

    // Используем onLayersReorder для перетаскивания (без переименования)
    if (onLayersReorder) {
      onLayersReorder(newLayers);
    } else if (onLayersChange) {
      onLayersChange(newLayers);
    }
    setDraggedLayer(null);
  }, [draggedLayer, layers, onLayersReorder, onLayersChange]);

  // Создание/удаление альфа-канала
  const handleToggleAlphaChannel = useCallback((layerId) => {
    const updatedLayers = layers.map(layer => 
      layer.id === layerId 
        ? { 
            ...layer, 
            alphaChannel: layer.alphaChannel ? null : {
              visible: true,
              data: null // Здесь будут данные альфа-канала
            }
          }
        : layer
    );
    onLayersChange && onLayersChange(updatedLayers);
  }, [layers, onLayersChange]);

  // Скрытие/показ альфа-канала
  const handleToggleAlphaVisibility = useCallback((layerId) => {
    const updatedLayers = layers.map(layer => 
      layer.id === layerId && layer.alphaChannel
        ? { 
            ...layer, 
            alphaChannel: {
              ...layer.alphaChannel,
              visible: !layer.alphaChannel.visible
            }
          }
        : layer
    );
    if (onLayersPropertiesChange) {
      onLayersPropertiesChange(updatedLayers);
    } else if (onLayersChange) {
      onLayersChange(updatedLayers);
    }
  }, [layers, onLayersPropertiesChange, onLayersChange]);

  const handleDeleteAlphaChannel = useCallback((layerId) => {
    const updatedLayers = layers.map(layer => 
      layer.id === layerId 
        ? { ...layer, alphaChannel: null }
        : layer
    );
    onLayersChange && onLayersChange(updatedLayers);
  }, [layers, onLayersPropertiesChange]);

  return (
    <div className="layers-panel">
      <div className="layers-panel__header">
        <h3 className="layers-panel__title">Слои</h3>
        <button 
          className="layers-panel__add-btn"
          onClick={handleAddLayer}
          disabled={layers.length >= maxLayers}
          title={`Добавить слой (${layers.length}/${maxLayers})`}
        >
          +
        </button>
      </div>

      <div className="layers-panel__list">
        {layers.map((layer, index) => (
          <LayerItem
            key={layer.id}
            layer={layer}
            index={index}
            isActive={layer.id === activeLayerId}
            blendModes={BLEND_MODES}
            onSelect={() => onActiveLayerChange && onActiveLayerChange(layer.id)}
            onDelete={() => handleDeleteLayer(layer.id)}
            onToggleVisibility={() => handleToggleVisibility(layer.id)}
            onOpacityChange={(opacity) => handleOpacityChange(layer.id, opacity)}
            onBlendModeChange={(blendMode) => handleBlendModeChange(layer.id, blendMode)}
            onLoadImage={(file) => handleLoadImage(layer.id, file)}
            onFillColor={(color) => handleFillColor(layer.id, color)}
            onResetLayer={() => handleResetLayer(layer.id)}
            onDragStart={(e) => handleDragStart(e, layer.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, layer.id)}
            onToggleAlphaChannel={() => handleToggleAlphaChannel(layer.id)}
            onToggleAlphaVisibility={() => handleToggleAlphaVisibility(layer.id)}
            onDeleteAlphaChannel={() => handleDeleteAlphaChannel(layer.id)}
            canDelete={layers.length > 1}
          />
        ))}
      </div>

      {layers.length === 0 && (
        <div className="layers-panel__empty">
          <p>Нет слоев</p>
          <button className="button" onClick={handleAddLayer}>
            Создать слой
          </button>
        </div>
      )}
    </div>
  );
};

export default LayersPanel;
