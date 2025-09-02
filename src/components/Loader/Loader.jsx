import React from 'react';
import './Loader.css';

const Loader = () => {
  return (
    <div className="loader">
      <div className="loader__spinner"></div>
      <p>Загрузка...</p>
    </div>
  );
};

export default Loader;
