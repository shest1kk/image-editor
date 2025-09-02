import React from 'react';

const ImageChoice = ({ handleContinueEditing, handleLoadNewImage }) => {
  return (
    <div className="image-choice" style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center'
    }}>
      <h2>Выберите действие:</h2>
      <button onClick={handleContinueEditing} style={{margin: '10px'}}>Вернуться к редактированию последнего изображения</button>
      <button onClick={handleLoadNewImage} style={{margin: '10px'}}>Загрузить новое изображение</button>
    </div>
  );
};

export default ImageChoice;