import React from 'react';

const StatusBar = ({ image, dimensions, fileSize, mouseCoords }) => {
  return (
    <div className="editor__status-bar status-bar">
      {image && (
        <>
          <span className="status-bar__text">Разрешение: {Math.round(dimensions.width)}&nbsp;x&nbsp;{Math.round(dimensions.height)}&nbsp;px</span>
          <span className="status-bar__text">Размер файла: {fileSize}</span>
          <span className="status-bar__text">
          Координаты: {mouseCoords.x !== null ? `${mouseCoords.x}, ${mouseCoords.y}` : 'N/A'}
          </span>
        </>
      )}
    </div>
  );
};

export default StatusBar;