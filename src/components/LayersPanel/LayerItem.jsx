import React, { useState, useRef, useCallback, useEffect } from 'react';

// Кастомный слайдер для непрозрачности
const CustomOpacitySlider = ({ value, onChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef(null);

  // Сначала объявляем updateValue
  const updateValue = useCallback((e) => {
    if (!sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    
    onChange && onChange(Math.round(percentage));
  }, [onChange]);

  // Теперь можем использовать updateValue в других функциях
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    updateValue(e);
    // Добавляем класс для курсора
    document.body.classList.add('dragging-slider');
  }, [updateValue]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    updateValue(e);
  }, [isDragging, updateValue]);

  const handleMouseUp = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    // Убираем класс для курсора
    document.body.classList.remove('dragging-slider');
  }, []);

  // Глобальные обработчики для продолжения drag за пределами элемента
  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleMouseMove(e);
      };
      
      const handleGlobalMouseUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleMouseUp(e);
        // На всякий случай убираем класс
        document.body.classList.remove('dragging-slider');
      };
      
      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
      document.addEventListener('mouseup', handleGlobalMouseUp, { passive: false });
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={sliderRef}
      className="custom-opacity-slider"
      onMouseDown={handleMouseDown}
    >
      <div className="custom-opacity-slider__track">
        <div 
          className="custom-opacity-slider__fill"
          style={{ width: `${value}%` }}
        />
        <div 
          className="custom-opacity-slider__thumb"
          style={{ left: `${value}%` }}
        />
      </div>
    </div>
  );
};

const LayerItem = ({
  layer,
  index,
  isActive,
  blendModes,
  onSelect,
  onDelete,
  onToggleVisibility,
  onOpacityChange,
  onBlendModeChange,
  onLoadImage,
  onFillColor,
  onResetLayer,
  onDragStart,
  onDragOver,
  onDrop,
  onToggleAlphaChannel,
  onToggleAlphaVisibility,
  onDeleteAlphaChannel,
  canDelete
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showBlendTooltip, setShowBlendTooltip] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerValue, setColorPickerValue] = useState('#ffffff');
  const fileInputRef = useRef(null);
  const colorTimeoutRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      onLoadImage && onLoadImage(file);
    }
    // Сбрасываем значение input для возможности выбора того же файла
    e.target.value = '';
  };

  const handleLoadImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFillColorClick = () => {
    if (!showColorPicker) {
      // Если color picker скрыт, показываем его
      setShowColorPicker(true);
    }
    // Цвет применяется автоматически в handleColorChange
  };

  const handleColorChange = (e) => {
    const newColor = e.target.value;
    // Мгновенно обновляем цвет в UI
    setColorPickerValue(newColor);
    
    // Очищаем предыдущий timeout
    if (colorTimeoutRef.current) {
      clearTimeout(colorTimeoutRef.current);
    }
    
    // Применяем цвет к слою с debounce (задержка 150ms)
    colorTimeoutRef.current = setTimeout(() => {
      onFillColor && onFillColor(newColor);
    }, 150);
  };

  const handleResetColor = () => {
    // Сбрасываем слой к пустому состоянию
    onResetLayer && onResetLayer();
    // Скрываем color picker
    setShowColorPicker(false);
    // Сбрасываем значение цвета к белому
    setColorPickerValue('#ffffff');
  };

  // Очистка timeout при размонтировании компонента
  useEffect(() => {
    return () => {
      if (colorTimeoutRef.current) {
        clearTimeout(colorTimeoutRef.current);
      }
    };
  }, []);

  const getPreviewContent = () => {
    if (layer.preview) {
      return (
        <img 
          src={layer.preview} 
          alt={layer.name}
          className="layer-item__preview-image"
        />
      );
    }

    switch (layer.type) {
      case 'color':
        return (
          <div 
            className="layer-item__preview-color"
            style={{ backgroundColor: layer.data }}
          />
        );
      case 'image':
        return (
          <div className="layer-item__preview-placeholder">
            IMG
          </div>
        );
      default:
        return (
          <div className="layer-item__preview-empty">
            Пусто
          </div>
        );
    }
  };

  return (
    <div 
      className={`layer-item ${isActive ? 'layer-item--active' : ''} ${showActions ? 'layer-item--expanded' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
    >
      {/* Скрытый input для выбора файла */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <div className="layer-item__main">
        {/* Превью слоя */}
        <div className="layer-item__preview">
          {getPreviewContent()}
        </div>

        {/* Информация о слое */}
        <div className="layer-item__info">
          <div className="layer-item__name">{layer.name}</div>
          <div className="layer-item__details">
            <span className="layer-item__type">
              {layer.type === 'image' && '🖼️'}
              {layer.type === 'color' && '🎨'}
              {layer.type === 'empty' && '📄'}
            </span>
            <span className="layer-item__opacity">{layer.opacity}%</span>
          </div>
        </div>

        {/* Кнопки управления */}
        <div className="layer-item__controls">
          <button
            className={`layer-item__visibility ${layer.visible ? 'layer-item__visibility--visible' : 'layer-item__visibility--hidden'}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility && onToggleVisibility();
            }}
            title={layer.visible ? 'Скрыть слой' : 'Показать слой'}
          >
            {layer.visible ? '👁️' : '🚫'}
          </button>

          <button
            className="layer-item__menu"
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(!showActions);
            }}
            title="Действия"
          >
            ⋮
          </button>
        </div>
      </div>

      {/* Расширенные действия */}
      {showActions && (
        <div className="layer-item__actions">
          {/* Непрозрачность */}
          <div 
            className="layer-item__action-group"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          >
            <label className="layer-item__action-label">Непрозрачность:</label>
            <CustomOpacitySlider
              value={layer.opacity}
              onChange={(value) => {
                onOpacityChange && onOpacityChange(value);
              }}
            />
            <span className="layer-item__opacity-value">{layer.opacity}%</span>
          </div>

          {/* Режим наложения */}
          <div className="layer-item__action-group">
            <label className="layer-item__action-label">Наложение:</label>
            <div style={{ position: 'relative' }}>
              <select
                value={layer.blendMode}
                onChange={(e) => {
                  e.stopPropagation();
                  onBlendModeChange && onBlendModeChange(e.target.value);
                }}
                onMouseEnter={() => setShowBlendTooltip(true)}
                onMouseLeave={() => setShowBlendTooltip(false)}
                className="layer-item__blend-select"
              >
                {Object.entries(blendModes).map(([mode, config]) => (
                  <option key={mode} value={mode} title={config.description}>
                    {config.name}
                  </option>
                ))}
              </select>
              
              {/* Tooltip для режимов наложения */}
              {showBlendTooltip && (
                <div className="layer-item__blend-tooltip">
                  <strong>{blendModes[layer.blendMode]?.name}</strong>
                  <br />
                  {blendModes[layer.blendMode]?.description}
                </div>
              )}
            </div>
          </div>

          {/* Действия с контентом */}
          <div className="layer-item__action-group">
            <div className="layer-item__content-actions">
              <button
                className="layer-item__action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoadImageClick();
                }}
                title="Загрузить изображение"
              >
                📁 Изображение
              </button>
              
              <div className="layer-item__color-action">
                {showColorPicker && (
                  <input
                    type="color"
                    value={colorPickerValue}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleColorChange(e);
                    }}
                    onMouseUp={() => {
                      // Мгновенно применяем цвет при отпускании мыши
                      if (colorTimeoutRef.current) {
                        clearTimeout(colorTimeoutRef.current);
                      }
                      onFillColor && onFillColor(colorPickerValue);
                    }}
                    className="layer-item__color-picker"
                    title="Выбрать цвет"
                  />
                )}
                <button
                  className="layer-item__action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFillColorClick();
                  }}
                  title={showColorPicker ? "Цвет выбран" : "Показать выбор цвета"}
                  style={showColorPicker ? {
                    background: `linear-gradient(45deg, ${colorPickerValue} 50%, #f0f0f0 50%)`,
                    color: '#333'
                  } : {}}
                >
                  🎨 Цвет
                </button>
                
                {/* Кнопка сброса цвета - показывается только если слой цветной */}
                {layer.type === 'color' && (
                  <button
                    className="layer-item__action-btn layer-item__action-btn--secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetColor();
                    }}
                    title={layer.originalState ? 
                      "Убрать цвет и вернуть исходное изображение" : 
                      "Убрать цвет (сделать слой пустым)"
                    }
                  >
                    {layer.originalState ? '🔄 Отменить' : '🗑️ Сброс'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Альфа-канал */}
          <div className="layer-item__action-group">
            <label className="layer-item__action-label">Альфа-канал:</label>
            <div className="layer-item__alpha-actions">
              {layer.alphaChannel ? (
                <>
                  {/* Превью альфа-канала */}
                  <div className="layer-item__alpha-preview">
                    {layer.alphaChannel.preview && (
                      <img 
                        src={layer.alphaChannel.preview} 
                        alt="Alpha channel preview"
                        className="layer-item__alpha-preview-image"
                        title="Превью альфа-канала"
                      />
                    )}
                  </div>
                  
                  <div className="layer-item__alpha-controls">
                    <button
                      className={`layer-item__action-btn ${layer.alphaChannel.visible ? 'layer-item__action-btn--active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleAlphaVisibility && onToggleAlphaVisibility();
                      }}
                      title={layer.alphaChannel.visible ? "Скрыть альфа-канал" : "Показать альфа-канал"}
                    >
                      {layer.alphaChannel.visible ? '👁️' : '🚫'} Альфа
                    </button>
                    <button
                      className="layer-item__action-btn layer-item__action-btn--danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAlphaChannel && onDeleteAlphaChannel();
                      }}
                      title="Удалить альфа-канал"
                    >
                      🗑️
                    </button>
                  </div>
                </>
              ) : (
                <button
                  className="layer-item__action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleAlphaChannel && onToggleAlphaChannel();
                  }}
                  title="Добавить альфа-канал"
                >
                  ➕ Альфа
                </button>
              )}
            </div>
          </div>

          {/* Удаление слоя */}
          {canDelete && (
            <div className="layer-item__action-group">
              <button
                className="layer-item__action-btn layer-item__action-btn--danger"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Удалить слой "${layer.name}"?`)) {
                    onDelete && onDelete();
                  }
                }}
                title="Удалить слой"
              >
                🗑️ Удалить слой
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default LayerItem;
