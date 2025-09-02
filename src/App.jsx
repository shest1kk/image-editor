// Импортируем необходимые библиотеки и компоненты
import React from 'react';
import './App.css'; 
import MainRoutes from './Routes/MainRoutes'; 
import { ImageProvider } from './ImageProvider'; 

// Главный компонент приложения
function App() {
  return (
    <ImageProvider>
      <MainRoutes />  
    </ImageProvider>
  )
}

export default App
