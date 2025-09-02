import React, { useState, useEffect } from 'react';

const StatusBar = ({ image, dimensions, originalDimensions, fileSize, mouseCoords, colorDepth, scaleFactor, onScaleChange }) => {
  const [inputValue, setInputValue] = useState(Math.round(scaleFactor));

  // Синхронизируем внутреннее состояние с внешним scaleFactor
  useEffect(() => {
    setInputValue(Math.round(scaleFactor));
  }, [scaleFactor]);
  return (
    <div className="editor__status-bar status-bar">
      {image && (
        <>
          <span className="status-bar__text">Исходные размеры: {originalDimensions.width}&nbsp;x&nbsp;{originalDimensions.height}&nbsp;px</span>
          <span className="status-bar__text">Размер файла: {fileSize}</span>
          <div className="status-bar__scale-control">
            <label className="status-bar__text">Масштаб: </label>
            <input 
              type="number"
              value={inputValue} 
              onChange={(e) => {
                // Разрешаем любой ввод для промежуточных значений
                setInputValue(e.target.value);
              }}
              onBlur={(e) => {
                // Применяем ограничения и обновляем масштаб при потере фокуса
                const value = Number(e.target.value);
                if (value >= 12 && value <= 300 && !isNaN(value)) {
                  onScaleChange(value);
                } else {
                  // Возвращаем к предыдущему валидному значению
                  setInputValue(Math.round(scaleFactor));
                }
              }}
              onKeyDown={(e) => {
                // Применяем изменения при нажатии Enter
                if (e.key === 'Enter') {
                  const value = Number(e.target.value);
                  if (value >= 12 && value <= 300 && !isNaN(value)) {
                    onScaleChange(value);
                  } else {
                    setInputValue(Math.round(scaleFactor));
                  }
                  e.target.blur(); // Убираем фокус
                }
              }}
              min="12"
              max="300"
              step="1"
              className="status-bar__scale-input"
            />
            <span className="status-bar__text">%</span>
          </div>
          <span className="status-bar__text">Глубина цвета: {colorDepth || '24-bit RGB'}</span>
          <span className="status-bar__text">
          Координаты: {mouseCoords.x !== null ? `${mouseCoords.x}, ${mouseCoords.y}` : 'N/A'}
          </span>
        </>
      )}
    </div>
  );
};

export default StatusBar;