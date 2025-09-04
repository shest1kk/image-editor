// Импорт необходимых библиотек и модулей
import React, { createContext, useState } from 'react';
import PropTypes from 'prop-types';

// Создание контекста для управления изображениями
export const ImageContext = createContext();

// Компонент ImageProvider предназначен для управления состоянием текущего изображения в приложении.
// Он обеспечивает доступ к текущему изображению и функции для его обновления для всех дочерних компонентов,
// которые будут обернуты этим провайдером.
export const ImageProvider = ({ children }) => {
  // Состояние для хранения текущего изображения
  const [image, setImage] = useState(null);
  // Состояние для хранения оригинального имени файла
  const [filename, setFilename] = useState(null);

  // Функция для обновления состояния изображения
  const updateImage = (newImage, newFilename = null) => {
    setImage(newImage);
    if (newFilename !== null) {
      setFilename(newFilename);
    }
  };

  // Предоставление состояния изображения и функции обновления контексту
  return (
    <ImageContext.Provider value={{ 
      image, 
      filename, 
      setImage: updateImage,
      setFilename 
    }}>
      {children}
    </ImageContext.Provider>
  );
};

// Определение типов пропсов для компонента ImageProvider
ImageProvider.propTypes = {
  children: PropTypes.node, // Дочерние компоненты, которые будут обернуты провайдером
};