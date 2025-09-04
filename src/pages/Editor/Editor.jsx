import React, { useRef, useContext, useEffect, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { ImageContext } from "@/ImageProvider";
import "./Editor.css";

import ToolPanel from "@components/ToolPanel/ToolPanel";
import MenuBar from "@components/MenuBar/MenuBar";
import StatusBar from "@components/StatusBar/StatusBar";

import EditorCanvas from "@components/EditorCanvas/EditorCanvas";

import Modal from "@components/Modal/Modal";
import ScalingModal from "./ScalingModal/ScalingModal";
import ContextModal from "@components/ContextModal/ContextModal";
import CurvesModal from "./CurvesModal/CurvesModal";
import FilterModal from "./FilterModal/FilterModal";
import { GrayBit7Handler } from "@utils/ImageFormats/GrayBit7";
import { ColorDepthAnalyzer } from "@utils/ImageAnalysis/colorDepth";

import {
  updateTranslation,
  handleKeyDown,
  handleKeyUp,
  handleMouseUp,
  constrainImagePosition,
} from "@utils/CanvasChange/canvasKeyHand";


import { calculateFileSize } from "@utils/FileSize/fileSize";
import { 
  extractRGB, 
  rgbToXyz, 
  rgbToLab, 
  rgbToOKLch, 
  calculateContrast,
  formatColorForDisplay
} from "@utils/ColorSpaces/colorConversions";

const Editor = () => {
  const { image, setImage } = useContext(ImageContext);

  const [toolActive, setToolActive] = useState("cursor");
  const [pipetteColor1, setPipetteColor1] = useState("");
  const [pipetteColor2, setPipetteColor2] = useState("");
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const [colorDepth, setColorDepth] = useState('24-bit RGB');
  const [originalFormat, setOriginalFormat] = useState(null);
  const [fileSize, setFileSize] = useState(0);
  const [scaleFactor, setScaleFactor] = useState(100); // Default to 100%
  const [infoActive, setInfoActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [canvasTranslation, setCanvasTranslation] = useState({ x: 0, y: 0 });
  const [imageCoordinates, setImageCoordinates] = useState({
    base: { x: 0, y: 0 },
    extra: { x: 0, y: 0 },
  });
  const [showBg, setShowBg] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalCurvesOpen, setIsModalCurvesOpen] = useState(false);
  const [isModalFilterOpen, setIsModalFilterOpen] = useState(false);
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);



  const canvas = useRef();
  const context = useRef();
  const animationFrameId = useRef(null);
  const isDraggingRef = useRef(false);
  const isMouseWheelDownRef = useRef(false);
  const scrollContainer = useRef(null);
  const zoomTimeoutRef = useRef(null);

  const [isMouseDown, setIsMouseDown] = useState(false); // Track mouse button state
  const [selectedTool, setSelectedTool] = useState("cursor"); // New state to track selected tool
  const [isMouseWheel, setIsMouseWheel] = useState(false); // New state to track mouse wheel state

  const imageObj = new Image();
  imageObj.src = image;

  const [isDarkMode, setIsDarkMode] = useState(false);  // Changed to false for light mode by default

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [mouseCoords, setMouseCoords] = useState({ x: null, y: null });

  const [isMouseWheelDown, setIsMouseWheelDown] = useState(false);
  const [previousTool, setPreviousTool] = useState("cursor");
  const [handActivatedByWheel, setHandActivatedByWheel] = useState(false); // Флаг: рука активирована колесом мыши

  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [showScrollbars, setShowScrollbars] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  
  // Коэффициенты чувствительности перемещения
  const handToolSensitivity = 0.5; // Для инструмента "Рука"
  const wheelDragSensitivity = 0.7; // Для перетаскивания колесиком мыши

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // Эффект для загрузки сохраненной темы из localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      setIsDarkMode(false);  // Устанавливаем false вместо проверки системных настроек
      localStorage.setItem('theme', 'light');  // Сохраняем светлую тему по умолчанию
    }
  }, []);

  // Эффект для применения темы к body и сохранения ее в localStorage
  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.body.classList.toggle('light-mode', !isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Функция для переключения между светлой и темной темами
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const openModal = () => {
    setIsModalOpen(true);
    setToolActive("cursor");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsModalCurvesOpen(false);
    setIsModalFilterOpen(false);
  };

  const openContextModal = () => {
    setIsContextModalOpen(true);
    setToolActive("cursor");
    setInfoActive(true);
  };

  const closeContextModal = () => {
    setIsContextModalOpen(false);
    setToolActive("cursor");
    setSelectedTool("cursor"); // Синхронизируем визуальное состояние
    setInfoActive(false);
  };

  const handleScaleChange = (newScaleFactor) => {
    // Поддерживаем и event объекты и прямые значения
    const value = typeof newScaleFactor === 'object' ? newScaleFactor.target.value : newScaleFactor;
    setScaleFactor(Number(value));
  };

  // Эффект для обработки загрузки изображения и настройки холста
  useEffect(() => {
    if (!image) return;

    const img = new Image();
    img.src = image;
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const workspace = document.querySelector(".workspace");
      if (!workspace) return;

      const { offsetWidth: workspaceWidth, offsetHeight: workspaceHeight } = workspace;
      const maxWidth = workspaceWidth - 100; // 50px отступ с каждой стороны
      const maxHeight = workspaceHeight - 100; // 50px отступ с каждой стороны

      // Всегда рассчитываем масштаб для максимального заполнения экрана с отступами 50px
      const widthScale = maxWidth / img.width;
      const heightScale = maxHeight / img.height;
      let calculatedScale = Math.min(widthScale, heightScale) * 100;
      
      // Ограничиваем масштаб в диапазоне 12% - 300%
      const newScaleFactor = Math.max(12, Math.min(300, calculatedScale));
      
      // Устанавливаем оптимальный масштаб для помещения изображения
      setScaleFactor(newScaleFactor);

      // Сбрасываем позицию изображения при загрузке нового
      setImagePosition({ x: 0, y: 0 });

      // Устанавливаем исходные размеры изображения
      setOriginalDimensions({ width: img.width, height: img.height });

      const canvasElement = canvas.current;
      if (!canvasElement) return;

      context.current = canvasElement.getContext("2d");
      context.current.imageSmoothingEnabled = true;

      canvasElement.width = workspaceWidth;
      canvasElement.height = workspaceHeight;

      // Проверяем сохраненные метаданные формата
      const savedFormatData = localStorage.getItem('imageFormatData');
      if (savedFormatData) {
        try {
          const formatData = JSON.parse(savedFormatData);
          setColorDepth(formatData.colorDepth || '24-bit RGB');
          setOriginalFormat(formatData);
        } catch (error) {
          console.warn('Ошибка чтения метаданных формата:', error);
          setOriginalFormat(null);
          // Fallback к анализу
          try {
            const colorDepthInfo = ColorDepthAnalyzer.analyzeColorDepth(img);
            setColorDepth(colorDepthInfo.description);
          } catch (analysisError) {
            setColorDepth('24-bit RGB');
          }
        }
      } else {
        // Анализируем глубину цвета изображения
        try {
          const colorDepthInfo = ColorDepthAnalyzer.analyzeColorDepth(img);
          setColorDepth(colorDepthInfo.description);
        } catch (error) {
          console.warn('Ошибка анализа глубины цвета:', error);
          setColorDepth('24-bit RGB');
        }
        setOriginalFormat(null);
      }

      // Функция для перерисовки canvas
      const redrawCanvas = () => {
        if (!context.current || !canvasElement) return;
        
        // Пересчитываем размеры при каждой перерисовке
        const currentScaledWidth = img.width * (scaleFactor / 100);
        const currentScaledHeight = img.height * (scaleFactor / 100);
        
        context.current.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Calculate center position (при загрузке изображения позиция всегда (0,0))
        const centerX = (canvasElement.width - currentScaledWidth) / 2;
        const centerY = (canvasElement.height - currentScaledHeight) / 2;

        // Если изображение имеет прозрачность, рисуем шахматный фон
        if (originalFormat && originalFormat.metadata && originalFormat.metadata.hasMask) {
          drawTransparencyBackground(context.current, centerX, centerY, currentScaledWidth, currentScaledHeight);
        }

        context.current.drawImage(
            img,
            centerX,
            centerY,
            currentScaledWidth,
            currentScaledHeight
        );
        
        // Обновляем dimensions
        setDimensions({ width: currentScaledWidth, height: currentScaledHeight });
      };
      
      // Сохраняем функцию в глобальной области для доступа из других useEffect
      window.redrawCanvas = redrawCanvas;

      // Первоначальная отрисовка будет выполнена через drawImageOnCanvas useEffect
      calculateFileSize(img.src).then(size => setFileSize(formatFileSize(size)));

      // Обработчик события колесика мыши для масштабирования
      const handleWheel = (event) => {
        event.preventDefault();
        
        // Отключаем скролл/зум если активно перетаскивание
        if (isDraggingRef.current || isMouseWheelDownRef.current) {
          return;
        }
        
        // Отмечаем что начинается зум
        setIsZooming(true);
        
        // Очищаем предыдущий таймаут
        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current);
        }
        
        const delta = event.deltaY;
        const scaleStep = 10; // Шаг изменения масштаба в процентах
        
        // Используем функциональный setter для получения актуального значения
        setScaleFactor(currentScale => {
          let newScale = currentScale;
          
          if (delta < 0) { // Колесико вверх - увеличение
            newScale = currentScale + scaleStep;
          } else { // Колесико вниз - уменьшение
            newScale = currentScale - scaleStep;
          }

          // Ограничиваем масштаб в диапазоне 12% - 300%
          return Math.max(12, Math.min(300, newScale));
        });
        
        // Устанавливаем таймаут для завершения зума
        zoomTimeoutRef.current = setTimeout(() => {
          setIsZooming(false);
        }, 150); // 150ms после последнего события колеса
      };

      // Обработчик события касания для масштабирования на мобильных устройствах
      const handleTouchZoom = (event) => {
        if (event.touches.length === 2) {
          const touch1 = event.touches[1];
          const touch2 = event.touches[0];
          const distance = Math.sqrt(
            (touch1.clientX - touch2.clientX) ** 2 +
            (touch1.clientY - touch2.clientY) ** 2
          );
          const newScaleFactor = Math.max(10, Math.min(300, 200 / distance)); // Настройка коэффициента масштабирования на основе расстояния
          setScaleFactor(newScaleFactor);
        }
      };

      canvasElement.addEventListener("wheel", handleWheel);
      canvasElement.addEventListener("touchmove", handleTouchZoom);
      return () => {
        if (canvasElement) {
          canvasElement.removeEventListener("wheel", handleWheel);
          canvasElement.removeEventListener("touchmove", handleTouchZoom);
        }
      };
    };
  }, [image]); // Убираем isDragging и isMouseWheelDown из зависимостей - они будут браться из замыкания

  // Функция для проверки нужны ли scrollbars
  const checkScrollbarsNeeded = useCallback(() => {
    if (!scrollContainer.current || !originalDimensions.width || !originalDimensions.height) {
      setShowScrollbars(false);
      return;
    }
    
    const containerElement = scrollContainer.current;
    const scaledWidth = originalDimensions.width * (scaleFactor / 100);
    const scaledHeight = originalDimensions.height * (scaleFactor / 100);
    
    // Показываем scrollbars если изображение больше контейнера
    const needsScrollbars = scaledWidth > containerElement.clientWidth || scaledHeight > containerElement.clientHeight;
    setShowScrollbars(needsScrollbars);
    
    return needsScrollbars;
  }, [originalDimensions, scaleFactor]);

  // Функция для синхронизации scrollbars с позицией изображения
  const syncScrollbarsWithImagePosition = useCallback(() => {
    if (!showScrollbars || !scrollContainer.current || !originalDimensions.width) return;
    
    const containerElement = scrollContainer.current;
    const scaledWidth = originalDimensions.width * (scaleFactor / 100);
    const scaledHeight = originalDimensions.height * (scaleFactor / 100);
    const padding = 100;
    
    const canvasWidth = scaledWidth + padding * 2;
    const canvasHeight = scaledHeight + padding * 2;
    
    // Рассчитываем базовую центральную позицию (без смещения)
    const baseCenterX = (canvasWidth - containerElement.clientWidth) / 2;
    const baseCenterY = (canvasHeight - containerElement.clientHeight) / 2;
    
    // Применяем смещение изображения к позиции скролла
    const scrollX = baseCenterX - imagePosition.x;
    const scrollY = baseCenterY - imagePosition.y;
    
    // Устанавливаем позицию скролла
    containerElement.scrollLeft = Math.max(0, Math.min(scrollX, canvasWidth - containerElement.clientWidth));
    containerElement.scrollTop = Math.max(0, Math.min(scrollY, canvasHeight - containerElement.clientHeight));
  }, [showScrollbars, originalDimensions, scaleFactor, imagePosition]);

  // Основная функция перерисовки canvas
  const drawImageOnCanvas = useCallback(() => {
    if (!context.current || !canvas.current || !image) return;
    
    const canvasElement = canvas.current;
    const img = new Image();
    img.src = image;
    
    img.onload = () => {
      // Рассчитываем размеры с текущим масштабом
      const scaledWidth = img.width * (scaleFactor / 100);
      const scaledHeight = img.height * (scaleFactor / 100);
      
      // Проверяем нужны ли scrollbars и получаем результат
      const needsScrollbars = checkScrollbarsNeeded();
      
      if (needsScrollbars) {
        // Если нужны scrollbars, увеличиваем canvas до размера изображения + отступы
        const padding = 100; // Отступы вокруг изображения
        canvasElement.width = scaledWidth + padding * 2;
        canvasElement.height = scaledHeight + padding * 2;
        
        // Центрируем изображение относительно canvas (с учетом padding)
        const centerX = (canvasElement.width - scaledWidth) / 2 + imagePosition.x;
        const centerY = (canvasElement.height - scaledHeight) / 2 + imagePosition.y;
        
        // Очищаем canvas
        context.current.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Рисуем фон для прозрачности если нужно
        if (originalFormat && originalFormat.metadata && originalFormat.metadata.hasMask) {
          drawTransparencyBackground(context.current, centerX, centerY, scaledWidth, scaledHeight);
        }
        
        // Рисуем изображение
        context.current.drawImage(img, centerX, centerY, scaledWidth, scaledHeight);
        
        // Автоматически синхронизируем scrollbars при центрированной позиции (но не во время зума)
        if (scrollContainer.current && imagePosition.x === 0 && imagePosition.y === 0 && !isZooming) {
          setTimeout(() => {
            syncScrollbarsWithImagePosition();
          }, 0);
        }
      } else {
        // Обычная отрисовка для случая когда изображение помещается
        // Восстанавливаем размеры canvas под контейнер
        if (scrollContainer.current) {
          canvasElement.width = scrollContainer.current.clientWidth;
          canvasElement.height = scrollContainer.current.clientHeight;
        }
        
        // Очищаем canvas
        context.current.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Рассчитываем позицию для центрирования + смещение от перетаскивания
        const centerX = (canvasElement.width - scaledWidth) / 2 + imagePosition.x;
        const centerY = (canvasElement.height - scaledHeight) / 2 + imagePosition.y;

        // Рисуем фон для прозрачности если нужно
        if (originalFormat && originalFormat.metadata && originalFormat.metadata.hasMask) {
          drawTransparencyBackground(context.current, centerX, centerY, scaledWidth, scaledHeight);
        }

        // Рисуем изображение
        context.current.drawImage(img, centerX, centerY, scaledWidth, scaledHeight);
      }
      
      // Обновляем dimensions для других компонентов (синхронизируем с redrawCanvas)
      setDimensions({ width: scaledWidth, height: scaledHeight });
    };
  }, [image, scaleFactor, imagePosition, originalFormat, checkScrollbarsNeeded, syncScrollbarsWithImagePosition, isZooming]);

  // Синхронизируем ref'ы с состояниями для использования в handleWheel
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    isMouseWheelDownRef.current = isMouseWheelDown;
  }, [isMouseWheelDown]);

  // Центрируем изображение при изменении масштаба
  useEffect(() => {
    setImagePosition({ x: 0, y: 0 });
    // Проверяем scrollbars при изменении масштаба
    const needsScrollbars = checkScrollbarsNeeded();
    
    // Если нужны scrollbars, центрируем viewport (но не во время активного зума)
    if (needsScrollbars && scrollContainer.current && originalDimensions.width && !isZooming) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const containerElement = scrollContainer.current;
          if (containerElement) {
            const scaledWidth = originalDimensions.width * (scaleFactor / 100);
            const scaledHeight = originalDimensions.height * (scaleFactor / 100);
            const padding = 100;
            
            const canvasWidth = scaledWidth + padding * 2;
            const canvasHeight = scaledHeight + padding * 2;
            
            // Центрируем к центру холста (canvas)
            const scrollX = (canvasWidth - containerElement.clientWidth) / 2;
            const scrollY = (canvasHeight - containerElement.clientHeight) / 2;
            
            containerElement.scrollLeft = Math.max(0, scrollX);
            containerElement.scrollTop = Math.max(0, scrollY);
          }
        });
      });
    }
  }, [scaleFactor, checkScrollbarsNeeded, originalDimensions, isZooming]);

  // Синхронизируем scrollbars после окончания зума
  useEffect(() => {
    if (!isZooming) {
      syncScrollbarsWithImagePosition();
    }
  }, [isZooming, syncScrollbarsWithImagePosition]);

  // Обработчик скролла
  const handleScroll = useCallback((e) => {
    if (!showScrollbars) return;
    
    // Пока оставляем базовую функциональность
    // В будущем здесь можно добавить обратную синхронизацию: скролл -> позиция изображения
  }, [showScrollbars]);

  // Синхронизируем scrollbars при изменении позиции изображения
  useEffect(() => {
    if (!isZooming) { // Не синхронизируем во время зума
      syncScrollbarsWithImagePosition();
    }
  }, [imagePosition, syncScrollbarsWithImagePosition, isZooming]);

  // Перерисовываем при изменении масштаба или позиции
  useEffect(() => {
    drawImageOnCanvas();
  }, [drawImageOnCanvas]);

  const [currentColor, setCurrentColor] = useState("");

  // Функция для обработки движения мыши
  const handleMouseMove = useCallback((e) => {
    const canvasElement = canvas.current;
    if (!canvasElement) return;

    const rect = canvasElement.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    setCursor({ x, y });
    setMouseCoords({ x, y });

    // Calculate image position and dimensions
    const imageWidth = originalDimensions.width * (scaleFactor / 100);
    const imageHeight = originalDimensions.height * (scaleFactor / 100);
    const imageX = (canvasElement.width - imageWidth) / 2 + imagePosition.x; // Update to use imagePosition
    const imageY = (canvasElement.height - imageHeight) / 2 + imagePosition.y; // Update to use imagePosition

    // Check if cursor is over the image
    if (x >= imageX && x < imageX + imageWidth && y >= imageY && y < imageY + imageHeight) {
      // Add color picking logic when the pipette tool is active
      if (toolActive === "pipette") {
        const ctx = canvasElement.getContext('2d');
        const pixelData = ctx.getImageData(x, y, 1, 1).data;
        const color = `rgb(${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]})`;
        setCurrentColor(color);
      }
    } else {

    }

    // Handle dragging for hand tool
    if (isDragging && (toolActive === "hand" || isMouseWheelDown)) {
      // Выбираем коэффициент в зависимости от способа перетаскивания
      let sensitivity = isMouseWheelDown ? wheelDragSensitivity : handToolSensitivity;
      
      // Если зажат Shift - делаем перемещение более точным (медленным)
      if (e.shiftKey) {
        sensitivity *= 0.2; // Уменьшаем чувствительность в 5 раз
      }
      
      const dx = (x - cursor.x) * sensitivity;
      const dy = (y - cursor.y) * sensitivity;

      // Обновляем позицию изображения с учетом чувствительности и ограничений
      setImagePosition(prevPosition => {
        const newX = prevPosition.x + dx;
        const newY = prevPosition.y + dy;
        
        // Получаем размеры контейнера и изображения
        const canvasElement = canvas.current;
        const containerElement = scrollContainer.current;
        if (!canvasElement || !containerElement) return prevPosition;
        
        const scaledImageWidth = originalDimensions.width * (scaleFactor / 100);
        const scaledImageHeight = originalDimensions.height * (scaleFactor / 100);
        
        // Применяем ограничения относительно размеров контейнера (viewport)
        return constrainImagePosition(
          newX, 
          newY, 
          containerElement.clientWidth, 
          containerElement.clientHeight, 
          scaledImageWidth, 
          scaledImageHeight
        );
      });
    }

    // Обновляем курсор в конце
    setCursor({ x, y });
    setMouseCoords({ x, y });
  }, [isDragging, toolActive, isMouseWheelDown, cursor.x, cursor.y, dimensions, scaleFactor, handToolSensitivity, wheelDragSensitivity]);

  const handleKeyDownEvent = (e) => {
    if (!canvas.current || !scrollContainer.current) return;
    const containerElement = scrollContainer.current;
    const scaledImageWidth = originalDimensions.width * (scaleFactor / 100);
    const scaledImageHeight = originalDimensions.height * (scaleFactor / 100);
    
    handleKeyDown(
      20, // step size для клавиатурного управления
      toolActive, 
      imagePosition, 
      setImagePosition, 
      containerElement.clientWidth, 
      containerElement.clientHeight, 
      scaledImageWidth, 
      scaledImageHeight, 
      e
    );
  };
  const handleKeyUpEvent = (e) => handleKeyUp(toolActive, e);
  const handleMouseUpEvent = (e) => {
    if (e.button === 1) { // Middle mouse button
      handleMouseWheelUp(e);
    } else {
      handleMouseUp(setIsDragging);
      setIsMouseDown(false);
    }
  };
  const handleMouseDownEvent = (e) => {
    setIsMouseDown(true);
    
    if (e.button === 1) { // Middle mouse button
      handleMouseWheelDown(e);
    } else if (toolActive === "hand") {
      setIsDragging(true);
    }
  };

  const handleMouseWheelDown = (e) => {
    if (e.button === 1) { // Middle mouse button
      e.preventDefault(); // Prevent default scrolling behavior
      
      setIsMouseWheelDown(true);
      setHandActivatedByWheel(true); // Помечаем, что рука активирована колесом
      setPreviousTool(selectedTool); // Сохраняем ВЫБРАННЫЙ инструмент, а не активный
      setToolActive("hand");
      setSelectedTool("hand"); // Визуально показываем, что рука активна
      setIsDragging(true);
    }
  };

  const handleMouseWheelUp = (e) => {
    if (e.button === 1) { // Middle mouse button
      setIsMouseWheelDown(false);
      
      // Восстанавливаем предыдущий инструмент только если рука была активирована колесом
      if (handActivatedByWheel) {
        setToolActive(previousTool);
        setSelectedTool(previousTool);
        setHandActivatedByWheel(false); // Сбрасываем флаг
      }
      
      setIsDragging(false);
    }
  };

  // Эффект для добавления обработчиков событий клавиатуры
  useEffect(() => {
    const handleKeyDownShortcut = (event) => {
      switch (event.code) {
        case "KeyC":
          setSelectedTool("cursor");
          setToolActive("cursor");
          // Закрываем модальное окно пипетки при переключении на курсор
          if (isContextModalOpen || infoActive) {
            setIsContextModalOpen(false);
            setInfoActive(false);
          }
          break;
        case "KeyP":
          setSelectedTool("pipette");
          setToolActive("pipette");
          setInfoActive(true);
          setIsContextModalOpen(true);
          break;
        case "KeyH":
          setSelectedTool("hand");
          setToolActive("hand");
          setHandActivatedByWheel(false); // Рука выбрана пользователем, а не колесом
          // Закрываем модальное окно пипетки при переключении на руку
          if (isContextModalOpen || infoActive) {
            setIsContextModalOpen(false);
            setInfoActive(false);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDownShortcut);
    const canvasElement = canvas.current;
    if (canvasElement) {
      canvasElement.addEventListener("mousedown", handleMouseDownEvent);
      canvasElement.addEventListener("mouseup", handleMouseUpEvent);
      canvasElement.addEventListener("mouseleave", handleMouseUpEvent);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDownShortcut);
      if (canvasElement) {
        canvasElement.removeEventListener("mousedown", handleMouseDownEvent);
        canvasElement.removeEventListener("mouseup", handleMouseUpEvent);
        canvasElement.removeEventListener("mouseleave", handleMouseUpEvent);
      }
    };
  }, [selectedTool]);

  const handleExportClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // Функция для проверки наличия прозрачности в изображении
  const checkImageHasTransparency = (imageData) => {
    const data = imageData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        return true; // Найден пиксель с прозрачностью
      }
    }
    return false; // Все пиксели непрозрачные
  };

  // Функция для отрисовки шахматного фона под прозрачными областями
  const drawTransparencyBackground = (ctx, x, y, width, height) => {
    const squareSize = 10; // Размер квадрата в пикселях
    
    ctx.save();
    
    // Создаем паттерн шахматной доски
    for (let posY = Math.floor(y); posY < y + height; posY += squareSize) {
      for (let posX = Math.floor(x); posX < x + width; posX += squareSize) {
        const squareX = Math.floor((posX - x) / squareSize);
        const squareY = Math.floor((posY - y) / squareSize);
        
        // Определяем цвет квадрата (белый или светло-серый)
        const isLight = (squareX + squareY) % 2 === 0;
        ctx.fillStyle = isLight ? '#ffffff' : '#e0e0e0';
        
        // Рисуем квадрат, ограничивая его размерами изображения
        const rectWidth = Math.min(squareSize, x + width - posX);
        const rectHeight = Math.min(squareSize, y + height - posY);
        
        if (rectWidth > 0 && rectHeight > 0) {
          ctx.fillRect(posX, posY, rectWidth, rectHeight);
        }
      }
    }
    
    ctx.restore();
  };

  const handleDownload = (format) => {
    // Создаем временный canvas для экспорта, не затрагивая основной
    const tempCanvas = document.createElement('canvas');
    const tempContext = tempCanvas.getContext('2d');

    const img = new Image();
    img.src = image;
    img.crossOrigin = "anonymous";

    img.onload = () => {
      // Устанавливаем размеры временного canvas по размерам изображения
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      
      // Рисуем изображение на временном canvas
      tempContext.drawImage(img, 0, 0);
      
      if (format === 'GB7') {
        // Экспорт в формат GrayBit-7
        const imageData = tempContext.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Определяем, нужна ли маска (есть ли прозрачность)
        const hasTransparency = checkImageHasTransparency(imageData);
        
        const buffer = GrayBit7Handler.encode(imageData, hasTransparency);
        const url = GrayBit7Handler.createDownloadURL(buffer, 'editedImage.gb7');
        
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.href = url;
        a.download = 'editedImage.gb7';
        a.click();
        document.body.removeChild(a);
        
        // Очищаем URL через некоторое время
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        // Стандартный экспорт
        const url = tempCanvas.toDataURL(format === 'JPG' ? 'image/jpeg' : 'image/png');
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.href = url;
        a.download = `editedImage.${format.toLowerCase()}`;
        a.click();
        document.body.removeChild(a);
      }
    };
    handleClose();
  };

  const handleTelegramShare = () => {
    // Создаем временный canvas для Telegram share, не затрагивая основной
    const tempCanvas = document.createElement('canvas');
    const tempContext = tempCanvas.getContext('2d');

    const img = new Image();
    img.src = image;
    img.crossOrigin = "anonymous";

    img.onload = () => {
      // Устанавливаем размеры временного canvas по размерам изображения
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      
      // Рисуем изображение на временном canvas
      tempContext.drawImage(img, 0, 0);

      tempCanvas.toBlob((blob) => {
        const file = new File([blob], "image.png", { type: "image/png" });
        
        // Create a temporary URL for the file
        const fileUrl = URL.createObjectURL(file);
        
        // Construct the Telegram share URL
        const telegramUrl = `tg://msg_ext_share_url?url=${encodeURIComponent(fileUrl)}`;
        
        // Try to open the Telegram app
        window.location.href = telegramUrl;
        
        // If the Telegram app doesn't open after a short delay, fall back to web version
        setTimeout(() => {
          const webTelegramUrl = `https://t.me/share/url?url=${encodeURIComponent(fileUrl)}`;
          window.open(webTelegramUrl, '_blank');
        }, 500);

        // Clean up the temporary URL after a delay
        setTimeout(() => {
          URL.revokeObjectURL(fileUrl);
        }, 60000); // Clean up after 1 minute
      }, 'image/png');
    };
    
    handleClose();
  };

  const showPreview = (value) => setShowBg(value);

  const openCurvesModal = () => {
    setIsModalCurvesOpen(true);
    setToolActive("cursor");
  };

  const openFilterModal = () => {
    setIsModalFilterOpen(true);
    setToolActive("cursor");
  };

  const handleCanvasClick = (event) => {
    const canvasRef = canvas.current;
    if (!canvasRef) return;

    if (toolActive === "pipette") {
      // Получаем координаты клика относительно canvas
      const rect = canvasRef.getBoundingClientRect();
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;

      // Рассчитываем размеры и позицию изображения на canvas
      const imageWidth = originalDimensions.width * (scaleFactor / 100);
      const imageHeight = originalDimensions.height * (scaleFactor / 100);
      const imageX = (canvasRef.width - imageWidth) / 2 + imagePosition.x;
      const imageY = (canvasRef.height - imageHeight) / 2 + imagePosition.y;

      // Проверяем, что клик был по изображению
      if (canvasX >= imageX && canvasX < imageX + imageWidth && 
          canvasY >= imageY && canvasY < imageY + imageHeight) {
        
        // Переводим координаты canvas в координаты изображения
        const imageCoordX = Math.floor((canvasX - imageX) / (scaleFactor / 100));
        const imageCoordY = Math.floor((canvasY - imageY) / (scaleFactor / 100));

        const coordinates = {
          x: imageCoordX,
          y: imageCoordY,
        };

        // Alt/Ctrl/Shift клик для второго цвета, обычный клик для первого
        if (event.altKey || event.ctrlKey || event.shiftKey) {
          setPipetteColor2(currentColor);
          setImageCoordinates((prev) => ({ ...prev, extra: coordinates }));
        } else {
          setPipetteColor1(currentColor);
          setImageCoordinates((prev) => ({ ...prev, base: coordinates }));
        }
      }
    }
  };

  const addToHistory = (newImage) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImage);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setImage(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setImage(history[historyIndex + 1]);
    }
  };

  useEffect(() => {
    if (image && (history.length === 0 || image !== history[historyIndex])) {
      addToHistory(image);
    }
  }, [image]);

  const updateImage = (newImage, newFileSize) => {

    setImage(newImage);
    setFileSize(formatFileSize(newFileSize));

    addToHistory(newImage);
  };

  useEffect(() => {
    const handleKeyDownEventBody = (e) => {
      if (!canvas.current || !scrollContainer.current) return;
      const containerElement = scrollContainer.current;
      const scaledImageWidth = originalDimensions.width * (scaleFactor / 100);
      const scaledImageHeight = originalDimensions.height * (scaleFactor / 100);
      
      handleKeyDown(
        20, // step size для клавиатурного управления
        toolActive, 
        imagePosition, 
        setImagePosition, 
        containerElement.clientWidth, 
        containerElement.clientHeight, 
        scaledImageWidth, 
        scaledImageHeight, 
        e
      );
    };
    document.body.addEventListener("keydown", handleKeyDownEventBody);
    return () => document.body.removeEventListener("keydown", handleKeyDownEventBody);
  }, [toolActive, imagePosition, scaleFactor, originalDimensions]);

  // Если нет изображения, перенаправляем на главную страницу
  if (!image) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className={`editor ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <MenuBar 
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        image={image}
        handleExportClick={handleExportClick}
        anchorEl={anchorEl}
        open={open}
        handleClose={handleClose}
        handleDownload={handleDownload}
        handleTelegramShare={handleTelegramShare}
        openModal={openModal}
        openCurvesModal={openCurvesModal}
        openFilterModal={openFilterModal}
        undo={undo}
        redo={redo}
        historyIndex={historyIndex}
        history={history}
      />
      <ToolPanel 
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        setToolActive={setToolActive}
        setInfoActive={setInfoActive}
        setIsContextModalOpen={setIsContextModalOpen}
        isMouseWheelDown={isMouseWheelDown}
        setHandActivatedByWheel={setHandActivatedByWheel}
      />
      <EditorCanvas 
        canvasRef={canvas}
        toolActive={toolActive}
        isMouseWheelDown={isMouseWheelDown}
        handleCanvasClick={handleCanvasClick}
        handleMouseMove={handleMouseMove}
        handleMouseDownEvent={handleMouseDownEvent}
        handleMouseUpEvent={handleMouseUpEvent}
        handleKeyDownEvent={handleKeyDownEvent}
        handleKeyUpEvent={handleKeyUpEvent}
        isModalOpen={isModalOpen}
        scrollRef={scrollContainer}
        showScrollbars={showScrollbars}
        onScroll={handleScroll}
      />
      <StatusBar 
        image={image}
        dimensions={dimensions}
        originalDimensions={originalDimensions}
        fileSize={fileSize}
        mouseCoords={mouseCoords}
        colorDepth={colorDepth}
        scaleFactor={scaleFactor}
        onScaleChange={handleScaleChange}
      />
      <Modal isOpen={isModalOpen} onClose={closeModal} title="Масштабирование изображения">
        <ScalingModal image={imageObj} setImage={updateImage} closeModal={closeModal} />
      </Modal>
      <Modal w80 bg0={showBg} isOpen={isModalCurvesOpen} onClose={closeModal} title="Кривые изображения">
        {isModalCurvesOpen && <CurvesModal imageCtx={context} setImage={updateImage} closeModal={closeModal} showPreview={showPreview} />}
      </Modal>
      <Modal bg0={showBg} isOpen={isModalFilterOpen} onClose={closeModal} title="Фильтрация изображения">
        {isModalFilterOpen && <FilterModal imageCtx={context} setImage={updateImage} closeModal={closeModal} showPreview={showPreview} />}
      </Modal>
      <ContextModal
        isOpen={isContextModalOpen || toolActive === "pipette"}
        onClose={closeContextModal}
        title="Пипетка"
      >
        <div className="editor__all-colors">
          {pipetteColor1 || pipetteColor2 ? (
            <>
              {/* Цвет #1 */}
              {pipetteColor1 && (
                <div className="editor__color-section">
                  <h3 className="editor__color-title">Цвет #1 (клик)</h3>
                  <div className="editor__color-info">
                    <div className="status-bar__color editor__color-swatch" style={{ backgroundColor: pipetteColor1 }}></div>
                    <div className="editor__color-details">
                      <p className="status-bar__text">Координаты: ({imageCoordinates.base.x}, {imageCoordinates.base.y})</p>
                      <p className="status-bar__text">RGB: {formatColorForDisplay(pipetteColor1, originalFormat)}</p>
                      <p className="status-bar__text" title="CIE XYZ - трехстимульное цветовое пространство, основанное на восприятии человеческого глаза">XYZ: {rgbToXyz(extractRGB(pipetteColor1))}</p>
                      <p className="status-bar__text" title="CIE Lab - перцептуально равномерное цветовое пространство. L: яркость (0-100), a: зелёный-красный (-128 до +127), b: синий-жёлтый (-128 до +127)">Lab: {rgbToLab(extractRGB(pipetteColor1))}</p>
                      <p className="status-bar__text" title="OKLch - современное перцептуально равномерное пространство. L: яркость (0-1), C: хрома/насыщенность (0+), h: оттенок (0-360°)">OKLch: {rgbToOKLch(extractRGB(pipetteColor1))}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Цвет #2 */}
              {pipetteColor2 && (
                <div className="editor__color-section">
                  <h3 className="editor__color-title">Цвет #2 (Alt/Ctrl/Shift + клик)</h3>
                  <div className="editor__color-info">
                    <div className="status-bar__color editor__color-swatch" style={{ backgroundColor: pipetteColor2 }}></div>
                    <div className="editor__color-details">
                      <p className="status-bar__text">Координаты: ({imageCoordinates.extra.x}, {imageCoordinates.extra.y})</p>
                      <p className="status-bar__text">RGB: {formatColorForDisplay(pipetteColor2, originalFormat)}</p>
                      <p className="status-bar__text" title="CIE XYZ - трехстимульное цветовое пространство, основанное на восприятии человеческого глаза">XYZ: {rgbToXyz(extractRGB(pipetteColor2))}</p>
                      <p className="status-bar__text" title="CIE Lab - перцептуально равномерное цветовое пространство. L: яркость (0-100), a: зелёный-красный (-128 до +127), b: синий-жёлтый (-128 до +127)">Lab: {rgbToLab(extractRGB(pipetteColor2))}</p>
                      <p className="status-bar__text" title="OKLch - современное перцептуально равномерное пространство. L: яркость (0-1), C: хрома/насыщенность (0+), h: оттенок (0-360°)">OKLch: {rgbToOKLch(extractRGB(pipetteColor2))}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Контраст */}
              {pipetteColor1 && pipetteColor2 && (
                <div className="editor__contrast-section">
                  <h3 className="editor__color-title">Контраст между цветами</h3>
                  <p className="editor__contrast-info" title="Контраст рассчитан по методике WCAG 2.1. Минимум 4.5:1 для обычного текста, 3:1 для крупного текста">
                    {calculateContrast(extractRGB(pipetteColor1), extractRGB(pipetteColor2))}
                  </p>
                </div>
              )}

              {/* Текущий цвет под курсором */}
              {currentColor && (
                <div className="editor__color-section">
                  <h3 className="editor__color-title">Цвет под курсором</h3>
                  <div className="editor__color-info">
                    <div className="status-bar__color editor__color-swatch" style={{ backgroundColor: currentColor }}></div>
                    <div className="editor__color-details">
                      <p className="status-bar__text">RGB: {formatColorForDisplay(currentColor, originalFormat)}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="editor__pipette-hint">
              <p className="status-bar__text">💡 Кликните по изображению для выбора первого цвета</p>
              <p className="status-bar__text">💡 Alt/Ctrl/Shift + клик для выбора второго цвета</p>
              <p className="status-bar__text">💡 После выбора двух цветов будет показан их контраст</p>
            </div>
          )}
        </div>
      </ContextModal>
    </section>
  );
};

export default Editor;