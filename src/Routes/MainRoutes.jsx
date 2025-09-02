import React from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from '../pages/StartPage/StartPage'; // Обновленный путь импорта
import Editor from '../pages/Editor/Editor';

const MainRoutes = () => { // Renamed component to MainRoutes
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor" element={<Editor />} />
      </Routes>
    </Router>
  );
}

export default MainRoutes; // Updated export to match new component name
