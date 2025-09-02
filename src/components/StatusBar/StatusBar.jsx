import React from 'react';

const StatusBar = ({ image, dimensions, originalDimensions, fileSize, mouseCoords, colorDepth }) => {
  return (
    <div className="editor__status-bar status-bar">
      {image && (
        <>
          <span className="status-bar__text">Исходные размеры: {originalDimensions.width}&nbsp;x&nbsp;{originalDimensions.height}&nbsp;px</span>
          <span className="status-bar__text">Размер файла: {fileSize}</span>
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