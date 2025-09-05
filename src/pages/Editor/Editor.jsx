import React, { useRef, useContext, useEffect, useState, useCallback, useMemo } from "react";
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
import LayersPanel from "@components/LayersPanel/LayersPanel";
// import FilterModal from "./FilterModal/FilterModal";
import { GrayBit7Handler } from "@utils/ImageFormats/GrayBit7";
import { ColorDepthAnalyzer } from "@utils/ImageAnalysis/colorDepth";

import {
  updateTranslation,
  handleKeyDown,
  handleKeyUp,
  handleMouseUp,
  constrainImagePosition,
  constrainLayerPosition,
} from "@utils/CanvasChange/canvasKeyHand";


import { calculateFileSize } from "@utils/FileSize/fileSize";
import useLayers from "@hooks/useLayers";
import {
  extractRGB,
  rgbToXyz,
  rgbToLab,
  rgbToOKLch, 
  calculateContrast,
  formatColorForDisplay
} from "@utils/ColorSpaces/colorConversions";

const Editor = () => {
  const { image, setImage, filename } = useContext(ImageContext);

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
  const draggingTimeoutRef = useRef(null); // Таймер для стабилизации isDragging
  const [isActivelyMoving, setIsActivelyMoving] = useState(false); // Флаг активного движения
  const movingTimeoutRef = useRef(null); // Таймер для флага активного движения
  const [isZooming, setIsZooming] = useState(false); // Флаг зумирования
  const [needsRedraw, setNeedsRedraw] = useState(true); // Флаг необходимости перерисовки
  const [isActivelyZooming, setIsActivelyZooming] = useState(false); // Флаг активного зумирования
  const zoomingTimeoutRef = useRef(null); // Таймер для флага активного зумирования
  const [canvasTranslation, setCanvasTranslation] = useState({ x: 0, y: 0 });
  const [imageCoordinates, setImageCoordinates] = useState({
    base: { x: 0, y: 0 },
    extra: { x: 0, y: 0 },
  });
  const [showBg, setShowBg] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalCurvesOpen, setIsModalCurvesOpen] = useState(false);
  // const [isModalFilterOpen, setIsModalFilterOpen] = useState(false);
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [showLayersPanel, setShowLayersPanel] = useState(false);

  // Layers management
  const {
    layers,
    activeLayerId,
    canvasRef: layersCanvasRef,
    initializeWithImage,
    addLayer,
    updateLayers,
    setActiveLayer,
    getActiveLayer,
    renderLayers,
    exportComposite,
    getLayersInfo
  } = useLayers();

  // Функция для переименования слоев в правильном порядке
  const renumberLayers = useCallback((layersArray) => {
    return layersArray.map((layer, index) => {
      // Новый слой (index 0) всегда "Слой 2" (верхний)
      if (index === 0) {
        return { ...layer, name: "Слой 2" };
      }
      
      // Исходное изображение (index 1) всегда "Слой 1" (нижний)
      if (index === 1) {
        return { ...layer, name: "Слой 1" };
      }
      
      // Для остальных случаев (если будет больше 2 слоев в будущем)
      return {
        ...layer,
        name: `Слой ${index + 1}`
      };
    });
  }, []);

  // Обертка для updateLayers с переименованием
  const updateLayersWithRenumbering = useCallback((newLayers) => {
    console.log('📝 updateLayersWithRenumbering: вызван');
    
    // ПРИНУДИТЕЛЬНО сбрасываем isZooming при изменениях слоёв
    if (isZooming) {
      console.log('🔧 updateLayersWithRenumbering: принудительный сброс isZooming=false');
      setIsZooming(false);
      // Очищаем таймаут зума
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
    }
    
    // Проверяем, нужно ли переименовывать слои
    const needsRenaming = newLayers.some((layer, index) => {
      const expectedName = `Слой ${index + 1}`;
      return layer.name !== expectedName;
    });
    
    if (needsRenaming) {
      const renumberedLayers = renumberLayers(newLayers);
      updateLayers(renumberedLayers);
    } else {
      updateLayers(newLayers);
    }
    
    // ТОЛЬКО для реальных изменений структуры слоев требуют перерисовки  
    console.log('🎨 updateLayersWithRenumbering: требует перерисовки');
    setNeedsRedraw(true);
  }, [updateLayers, renumberLayers, isZooming]);

  // Обертка для updateLayers без переименования (для перетаскивания и других операций)
  const updateLayersWithoutRenumbering = useCallback((newLayers) => {
    updateLayers(newLayers);
    // Изменения порядка слоев требуют перерисовки
    setNeedsRedraw(true);
  }, [updateLayers]);

  // Обертка для операций, которые не должны переименовывать слои
  const updateLayersForProperties = useCallback((newLayers) => {
    console.log('🔄 updateLayersForProperties: обновление свойств слоёв');
    
    // ПРИНУДИТЕЛЬНО сбрасываем isZooming при изменениях слоёв
    if (isZooming) {
      console.log('🔧 updateLayersForProperties: принудительный сброс isZooming=false');
      setIsZooming(false);
      // Очищаем таймаут зума
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
    }
    
    updateLayers(newLayers);
    // Изменения свойств слоев (видимость, прозрачность, etc) требуют перерисовки
    setNeedsRedraw(true);
    console.log('🎨 updateLayersForProperties: установлен needsRedraw=true');
  }, [updateLayers, isZooming]);

  // Обертка для addLayer с переименованием
  const addLayerWithRenumbering = useCallback((newLayer) => {
    // Устанавливаем имя "Слой 2" для нового слоя
    const layerWithCorrectName = {
      ...newLayer,
      name: "Слой 2"
    };
    
    // Добавляем слой (он добавляется в начало массива)
    addLayer(layerWithCorrectName);
    
    // Убеждаемся, что слои имеют правильные имена
    setTimeout(() => {
      const allLayers = [layerWithCorrectName, ...layers];
      const renumberedLayers = renumberLayers(allLayers);
      updateLayers(renumberedLayers);
      // Новый слой требует перерисовки
      setNeedsRedraw(true);
    }, 10);
  }, [addLayer, layers, renumberLayers, updateLayers]);


  const canvas = useRef();
  const context = useRef();
  const animationFrameId = useRef(null);
  const isDraggingRef = useRef(false);
  const isMouseWheelDownRef = useRef(false);
  const scrollContainer = useRef(null);
  const zoomTimeoutRef = useRef(null);
  const renderTimeoutRef = useRef(null); // Для дебаунсинга рендеринга
  const positionTimeoutRef = useRef(null); // Для дебаунсинга позиции

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
    // setIsModalFilterOpen(false);
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
    const numValue = Number(value);
    console.log(`🔍 handleScaleChange: новый масштаб ${numValue}%`);
    
    // Устанавливаем флаг активного зумирования
    setIsActivelyZooming(true);
    if (zoomingTimeoutRef.current) {
      clearTimeout(zoomingTimeoutRef.current);
    }
    zoomingTimeoutRef.current = setTimeout(() => {
      setIsActivelyZooming(false);
      console.log('🔍 handleScaleChange: сброс isActivelyZooming');
    }, 250); // 250ms задержка для зума
    
    setScaleFactor(numValue);
    
    // CSS трансформации обновятся автоматически через useEffect
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
      
      // При загрузке нового изображения нужна перерисовка
      setNeedsRedraw(true);

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
          setColorDepth('24-bit RGB');
        }
        setOriginalFormat(null);
      }

      // Функция для совместимости - будет заменена на новую систему слоев
      const redrawCanvas = () => {
        // Эта функция будет переопределена после загрузки
        console.log('Старая redrawCanvas - будет заменена после инициализации слоев');
      };
      
      // Сохраняем функцию в глобальной области для доступа из других useEffect
      window.redrawCanvas = redrawCanvas;

      // Первоначальная отрисовка будет выполнена через drawImageOnCanvas useEffect
      calculateFileSize(img.src).then(size => setFileSize(formatFileSize(size)));
      
      // Инициализируем слои с базовым изображением
      const imageName = filename || 'Фоновый слой';
      initializeWithImage(image, imageName);

      // Обработчик события колесика мыши для масштабирования
      const handleWheel = (event) => {
        event.preventDefault();
        
        // Отключаем скролл/зум если активно перетаскивание
        if (isDraggingRef.current || isMouseWheelDownRef.current) {
          return;
        }
        
        // Отмечаем что начинается зум
        setIsZooming(true);
        console.log('🔍 mouseWheel: установлен isZooming=true');
        
        // Очищаем предыдущий таймаут
        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current);
        }
        
        const delta = event.deltaY;
        const scaleStep = 10; // Шаг изменения масштаба в процентах
        
        // Устанавливаем флаг активного зумирования
        setIsActivelyZooming(true);
        if (zoomingTimeoutRef.current) {
          clearTimeout(zoomingTimeoutRef.current);
        }
        zoomingTimeoutRef.current = setTimeout(() => {
          setIsActivelyZooming(false);
          console.log('🔍 mouseWheel: сброс isActivelyZooming');
        }, 250); // 250ms задержка для зума

        // Используем функциональный setter для получения актуального значения
        setScaleFactor(currentScale => {
          let newScale = currentScale;
          
          if (delta < 0) { // Колесико вверх - увеличение
            newScale = currentScale + scaleStep;
          } else { // Колесико вниз - уменьшение
            newScale = currentScale - scaleStep;
          }

          // Ограничиваем масштаб в диапазоне 12% - 300%
          const finalScale = Math.max(12, Math.min(300, newScale));
          console.log(`🔍 mouseWheel: масштаб ${currentScale}% → ${finalScale}%`);
          return finalScale;
        });
        
        // Устанавливаем таймаут для завершения зума
        zoomTimeoutRef.current = setTimeout(() => {
          setIsZooming(false);
          console.log('✅ mouseWheel: сброшен isZooming=false (таймаут 500ms)');
        }, 500); // 500ms после последнего события колеса
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

  // Очистка таймаутов при размонтировании
  useEffect(() => {
    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
      if (positionTimeoutRef.current) {
        clearTimeout(positionTimeoutRef.current);
      }
      if (draggingTimeoutRef.current) {
        clearTimeout(draggingTimeoutRef.current);
      }
      if (movingTimeoutRef.current) {
        clearTimeout(movingTimeoutRef.current);
      }
      if (zoomingTimeoutRef.current) {
        clearTimeout(zoomingTimeoutRef.current);
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

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
    
    // Рассчитываем базовую центральную позицию для отображения центра изображения в центре viewport
    // Центр изображения на canvas: (canvasWidth / 2, canvasHeight / 2)
    // Центр viewport: (containerElement.clientWidth / 2, containerElement.clientHeight / 2)
    const baseCenterX = (canvasWidth / 2) - (containerElement.clientWidth / 2);
    const baseCenterY = (canvasHeight / 2) - (containerElement.clientHeight / 2);
    
    // Применяем смещение изображения к позиции скролла
    const scrollX = baseCenterX - imagePosition.x;
    const scrollY = baseCenterY - imagePosition.y;
    
    // Устанавливаем позицию скролла
    containerElement.scrollLeft = Math.max(0, Math.min(scrollX, canvasWidth - containerElement.clientWidth));
    containerElement.scrollTop = Math.max(0, Math.min(scrollY, canvasHeight - containerElement.clientHeight));
  }, [showScrollbars, originalDimensions, scaleFactor, imagePosition]);

  // Преобразование режимов наложения в CSS/Canvas операции
  const getCompositeOperation = useCallback((blendMode) => {
    switch (blendMode) {
      case 'multiply':
        return 'multiply';
      case 'screen':
        return 'screen';
      case 'overlay':
        return 'overlay';
      case 'normal':
      default:
        return 'source-over';
    }
  }, []);

  // Рендеринг слоя с изображением на основном canvas
  const renderImageLayerOnCanvas = useCallback((ctx, layer, canvasElement, scaledWidth, scaledHeight, needsScrollbars, drawBackground = true) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          let centerX, centerY;
          
          if (needsScrollbars) {
            // С отступами
            const padding = 100;
            centerX = (canvasElement.width - scaledWidth) / 2 + imagePosition.x + (layer.position?.x || 0);
            centerY = (canvasElement.height - scaledHeight) / 2 + imagePosition.y + (layer.position?.y || 0);
          } else {
            // Обычное центрирование
            centerX = (canvasElement.width - scaledWidth) / 2 + imagePosition.x + (layer.position?.x || 0);
            centerY = (canvasElement.height - scaledHeight) / 2 + imagePosition.y + (layer.position?.y || 0);
          }

          // Рисуем фон для прозрачности только если явно указано
          if (drawBackground && originalFormat && originalFormat.metadata && originalFormat.metadata.hasMask) {
            drawTransparencyBackground(ctx, centerX, centerY, scaledWidth, scaledHeight);
          }

          // Если альфа-канал отключен, рендерим изображение без прозрачности
          if (layer.alphaChannel && !layer.alphaChannel.visible) {
            // Создаем временный canvas для удаления прозрачности
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            
            // Заливаем белым фоном
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Рисуем изображение поверх
            tempCtx.drawImage(img, 0, 0);
            
            // Рендерим на основном canvas
            ctx.drawImage(tempCanvas, centerX, centerY, scaledWidth, scaledHeight);
          } else {
            // Обычный рендеринг с сохранением прозрачности
            ctx.drawImage(img, centerX, centerY, scaledWidth, scaledHeight);
          }
          
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = reject;
      img.src = layer.data;
    });
  }, [imagePosition, originalFormat]);

  // Рендеринг цветного слоя на основном canvas
  const renderColorLayerOnCanvas = useCallback((ctx, layer, canvasElement, scaledWidth, scaledHeight, needsScrollbars) => {
    let centerX, centerY;
    
    if (needsScrollbars) {
      const padding = 100;
      centerX = (canvasElement.width - scaledWidth) / 2 + imagePosition.x + (layer.position?.x || 0);
      centerY = (canvasElement.height - scaledHeight) / 2 + imagePosition.y + (layer.position?.y || 0);
    } else {
      centerX = (canvasElement.width - scaledWidth) / 2 + imagePosition.x + (layer.position?.x || 0);
      centerY = (canvasElement.height - scaledHeight) / 2 + imagePosition.y + (layer.position?.y || 0);
    }

    ctx.fillStyle = layer.data;
    ctx.fillRect(centerX, centerY, scaledWidth, scaledHeight);
  }, [imagePosition]);

  // Функция рендеринга слоев на основном canvas
  const renderLayersOnCanvas = useCallback(async (canvasElement, scaledWidth, scaledHeight, needsScrollbars) => {
    const ctx = context.current;
    if (!ctx) return;

    let centerX, centerY;
    
    if (needsScrollbars) {
      // С отступами
      const padding = 100;
      centerX = (canvasElement.width - scaledWidth) / 2 + imagePosition.x;
      centerY = (canvasElement.height - scaledHeight) / 2 + imagePosition.y;
    } else {
      // Обычное центрирование
      centerX = (canvasElement.width - scaledWidth) / 2 + imagePosition.x;
      centerY = (canvasElement.height - scaledHeight) / 2 + imagePosition.y;
    }

    // Получаем видимые слои в правильном порядке (нижние слои первыми)
    const visibleLayers = [...layers].reverse().filter(layer => layer.visible);

    // Проверяем, нужен ли шахматный фон
    const hasTransparentImageLayers = visibleLayers.some(layer => 
      layer.type === 'image' && 
      originalFormat && 
      originalFormat.metadata && 
      originalFormat.metadata.hasMask
    );

    // Более точная проверка: есть ли цветные слои ПОД всеми прозрачными слоями
    let needsTransparencyBackground = false;
    
    if (hasTransparentImageLayers) {
      // Находим все прозрачные слои
      const transparentLayers = visibleLayers.filter(layer => 
        layer.type === 'image' && 
        originalFormat && 
        originalFormat.metadata && 
        originalFormat.metadata.hasMask
      );
      
      // Для каждого прозрачного слоя проверяем, есть ли под ним цветные слои
      for (const transparentLayer of transparentLayers) {
        const layerIndex = visibleLayers.indexOf(transparentLayer);
        const layersBelow = visibleLayers.slice(0, layerIndex);
        const hasColorBelow = layersBelow.some(layer => layer.type === 'color');
        
        if (!hasColorBelow) {
          needsTransparencyBackground = true;
          break;
        }
      }
    }

    // Рисуем шахматный фон только если действительно нужен
    if (needsTransparencyBackground) {
      drawTransparencyBackground(ctx, centerX, centerY, scaledWidth, scaledHeight);
    }

    // Рендерим слои в обратном порядке (последний в массиве рисуется последним = поверх)
    for (const layer of visibleLayers) {
      try {
        // Сохраняем состояние контекста
        ctx.save();

        // Устанавливаем прозрачность
        ctx.globalAlpha = layer.opacity / 100;

        // Устанавливаем режим наложения
        ctx.globalCompositeOperation = getCompositeOperation(layer.blendMode);

        if (layer.type === 'image') {
          await renderImageLayerOnCanvas(ctx, layer, canvasElement, scaledWidth, scaledHeight, needsScrollbars, false); // Передаем false для отключения фона
        } else if (layer.type === 'color') {
          renderColorLayerOnCanvas(ctx, layer, canvasElement, scaledWidth, scaledHeight, needsScrollbars);
        }

        // Восстанавливаем состояние контекста
        ctx.restore();
      } catch (error) {
        console.error('Ошибка рендеринга слоя:', layer.name, error);
      }
    }
  }, [layers, getCompositeOperation, renderImageLayerOnCanvas, renderColorLayerOnCanvas, imagePosition, originalFormat]);

  // Основная функция перерисовки canvas через систему слоев
  const drawImageOnCanvas = useCallback(async () => {
    const start = performance.now();
    console.log('🎨 drawImageOnCanvas: НАЧАТ');
    
    if (!context.current || !canvas.current || layers.length === 0) {
      console.log('❌ drawImageOnCanvas: нет контекста, canvas или слоев');
      return;
    }
    
    const canvasElement = canvas.current;
    
    // Ищем любой слой с изображением (даже скрытый) для определения размеров
    // Также ищем слои, которые раньше были изображениями (сохраняем originalDimensions)
    const imageLayer = layers.find(layer => layer.type === 'image');
    
    // Проверяем, есть ли вообще видимые слои (любого типа)
    const hasVisibleLayers = layers.some(layer => layer.visible);
    if (!hasVisibleLayers) {
      // Если нет видимых слоев вообще, очищаем canvas
      context.current.clearRect(0, 0, canvasElement.width, canvasElement.height);
      return;
    }

    // Проверяем, нужно ли перерисовывать (избегаем лишних перерисовок)
    const currentScale = scaleFactor;
    const currentPosition = imagePosition;
    
    // ВРЕМЕННО ОТКЛЮЧЕНО: оптимизация может вызывать бесконечный цикл
    // if (canvasElement.dataset.lastScale === currentScale.toString() && 
    //     canvasElement.dataset.lastPosition === JSON.stringify(currentPosition)) {
    //   console.log('🚫 Skipping redraw - same scale and position');
    //   return;
    // }
    
    if (imageLayer) {
      // Если есть слой с изображением, используем его размеры (независимо от видимости)
      const img = new Image();
      img.src = imageLayer.data;
      
      await new Promise((resolve) => {
        img.onload = () => {
          // Рассчитываем размеры с текущим масштабом
          const scaledWidth = img.width * (scaleFactor / 100);
          const scaledHeight = img.height * (scaleFactor / 100);
          renderWithDimensions(canvasElement, scaledWidth, scaledHeight, resolve);
        };
      });
    } else if (originalDimensions.width && originalDimensions.height) {
      // Если нет слоя с изображением, но есть сохраненные оригинальные размеры
      const scaledWidth = originalDimensions.width * (scaleFactor / 100);
      const scaledHeight = originalDimensions.height * (scaleFactor / 100);
      renderWithDimensions(canvasElement, scaledWidth, scaledHeight, () => {});
    } else {
      // Если нет ни слоя с изображением, ни оригинальных размеров, используем размеры canvas
      const currentWidth = canvasElement.width;
      const currentHeight = canvasElement.height;
      renderWithDimensions(canvasElement, currentWidth, currentHeight, () => {});
    }
    
    // Вспомогательная функция для рендеринга с заданными размерами
    function renderWithDimensions(canvasElement, scaledWidth, scaledHeight, resolve) {
        
        // Проверяем нужны ли scrollbars и получаем результат
        const needsScrollbars = checkScrollbarsNeeded();
        
        if (needsScrollbars) {
          // Если нужны scrollbars, увеличиваем canvas до размера изображения + отступы
          const padding = 100;
          canvasElement.width = scaledWidth + padding * 2;
          canvasElement.height = scaledHeight + padding * 2;
        } else {
          // Восстанавливаем размеры canvas под контейнер
          if (scrollContainer.current) {
            canvasElement.width = scrollContainer.current.clientWidth;
            canvasElement.height = scrollContainer.current.clientHeight;
          }
        }
        
        // Очищаем canvas
        context.current.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Рендерим все видимые слои через систему слоев
        renderLayersOnCanvas(canvasElement, scaledWidth, scaledHeight, needsScrollbars);
        
        // Автоматически синхронизируем scrollbars при центрированной позиции (но не во время зума)
        if (needsScrollbars && scrollContainer.current && imagePosition.x === 0 && imagePosition.y === 0 && !isZooming) {
          setTimeout(() => {
            syncScrollbarsWithImagePosition();
          }, 0);
        }
        
        // Обновляем dimensions для других компонентов
        setDimensions({ width: scaledWidth, height: scaledHeight });
        
        // ВРЕМЕННО ОТКЛЮЧЕНО: сохранение состояния может вызывать проблемы
        // canvasElement.dataset.lastScale = currentScale.toString();
        // canvasElement.dataset.lastPosition = JSON.stringify(currentPosition);
        
        const end = performance.now();
        console.log(`🎨 drawImageOnCanvas: ЗАВЕРШЕН за ${(end - start).toFixed(2)}ms`);
        
        // Сбрасываем флаг после успешной перерисовки
        setNeedsRedraw(false);
        
        resolve();
    }
  }, [layers, scaleFactor, imagePosition, checkScrollbarsNeeded, syncScrollbarsWithImagePosition, isZooming, renderLayersOnCanvas]);

  // Мемоизированная строка трансформации для оптимизации
  const transformString = useMemo(() => {
    const result = `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${scaleFactor / 100})`;
    console.log('🔄 useMemo: transformString пересчитан', result, `position:`, imagePosition, `scale:`, scaleFactor);
    return result;
  }, [imagePosition.x, imagePosition.y, scaleFactor]);

  // Функция для быстрого обновления CSS трансформаций
  const updateCanvasTransform = useCallback(() => {
    const start = performance.now();
    const canvasElement = canvas.current;
    if (!canvasElement) {
      console.log('❌ updateCanvasTransform: canvas не найден');
      return;
    }
    
    // Применяем CSS трансформации МГНОВЕННО
    canvasElement.style.transform = transformString;
    canvasElement.style.transformOrigin = 'center center';
    
    const end = performance.now();
    console.log(`⚡ updateCanvasTransform: применен за ${(end - start).toFixed(2)}ms`, transformString);
  }, [transformString]);

  // Функция для принудительной перерисовки (только для эффектов/фильтров)
  const forceRedraw = useCallback(() => {
    console.log('🎨 forceRedraw: принудительная перерисовка');
    setNeedsRedraw(true);
  }, []);

  // Переопределяем window.redrawCanvas для совместимости - через флаг
  useEffect(() => {
    window.redrawCanvas = () => {
      setNeedsRedraw(true);
      console.log('🔄 window.redrawCanvas: установлен needsRedraw=true');
    };
  }, []);

  // Синхронизируем ref'ы с состояниями для использования в handleWheel
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    isMouseWheelDownRef.current = isMouseWheelDown;
  }, [isMouseWheelDown]);

  // Центрируем изображение при изменении масштаба
  useEffect(() => {
    // Сбрасываем позицию изображения к центру
    setImagePosition({ x: 0, y: 0 });
    
    // Проверяем scrollbars при изменении масштаба
    const needsScrollbars = checkScrollbarsNeeded();
    
    // Если нужны scrollbars, центрируем viewport к центру изображения (но не во время активного зума)
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
            
            // Рассчитываем позицию скролла так, чтобы центр изображения был в центре viewport
            // Центр изображения на canvas: (canvasWidth / 2, canvasHeight / 2)
            // Центр viewport: (containerElement.clientWidth / 2, containerElement.clientHeight / 2)
            const scrollX = (canvasWidth / 2) - (containerElement.clientWidth / 2);
            const scrollY = (canvasHeight / 2) - (containerElement.clientHeight / 2);
            
            containerElement.scrollLeft = Math.max(0, Math.min(scrollX, canvasWidth - containerElement.clientWidth));
            containerElement.scrollTop = Math.max(0, Math.min(scrollY, canvasHeight - containerElement.clientHeight));
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

  // Создаем мемоизированное значение для отслеживания изменений свойств слоев
  const layersSignature = useMemo(() => {
    return layers.map(layer => `${layer.id}-${layer.visible}-${layer.opacity}-${layer.blendMode}`).join('|');
  }, [layers]);

  // Перерисовываем canvas при изменении слоев (с debounce для предотвращения мерцания)
  useEffect(() => {
    if (layers.length > 0) {
      // Очищаем предыдущий таймаут
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
      
      // Устанавливаем флаг необходимости перерисовки вместо прямого вызова
      zoomTimeoutRef.current = setTimeout(() => {
        setNeedsRedraw(true);
        console.log('🔄 useEffect[scaleFactor]: установлен needsRedraw=true для перерисовки после зума');
      }, 50); // 50ms debounce
      
      return () => {
        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current);
        }
      };
    }
  }, [layersSignature, drawImageOnCanvas]);

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

  // Мгновенно обновляем CSS трансформации при изменении позиции/масштаба
  useEffect(() => {
    console.log('🎯 useEffect: запуск updateCanvasTransform');
    updateCanvasTransform();
  }, [updateCanvasTransform]);

  // Перерисовываем canvas только когда действительно нужно И НЕ ДВИГАЕМ И НЕ ЗУМИМ
  useEffect(() => {
    console.log(`🔍 useEffect[needsRedraw]: needsRedraw=${needsRedraw}, состояния: isDragging=${isDragging}, isMouseWheelDown=${isMouseWheelDown}, isActivelyMoving=${isActivelyMoving}, isActivelyZooming=${isActivelyZooming}, isZooming=${isZooming}`);
    
    if (needsRedraw && !isDragging && !isMouseWheelDown && !isActivelyMoving && !isActivelyZooming && !isZooming) {
      console.log('🎨 useEffect: запуск drawImageOnCanvas (needsRedraw=true, ВСЕ ФЛАГИ АКТИВНОСТИ=false)');
      drawImageOnCanvas();
      setNeedsRedraw(false); // Сбрасываем флаг после перерисовки
      console.log('✅ useEffect: сброшен needsRedraw=false после перерисовки');
    } else {
      console.log(`🚫 useEffect: пропуск drawImageOnCanvas (причина: needsRedraw=${needsRedraw} или активность)`);
    }
  }, [drawImageOnCanvas, needsRedraw, isDragging, isMouseWheelDown, isActivelyMoving, isActivelyZooming, isZooming]);

  const [currentColor, setCurrentColor] = useState("");

  // Ref для стабилизации состояний в handleMouseMove
  const stateRef = useRef({});
  stateRef.current = {
    isDragging,
    toolActive,
    isMouseWheelDown,
    scaleFactor,
    cursor,
    dimensions,
    originalDimensions,
    handToolSensitivity,
    wheelDragSensitivity,
    imagePosition
  };

  // Функция для обработки движения мыши - стабилизированная
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
    if (stateRef.current.isDragging && (stateRef.current.toolActive === "hand" || stateRef.current.isMouseWheelDown)) {
      const callId = Math.random().toString(36).substr(2, 9);
      console.log(`🖐️ handleMouseMove[${callId}]: начинаем перетаскивание (toolActive=${stateRef.current.toolActive}, isMouseWheelDown=${stateRef.current.isMouseWheelDown})`);
      
      // Устанавливаем флаг активного движения и сбрасываем его с задержкой
      setIsActivelyMoving(true);
      if (movingTimeoutRef.current) {
        clearTimeout(movingTimeoutRef.current);
      }
      movingTimeoutRef.current = setTimeout(() => {
        setIsActivelyMoving(false);
        console.log('🔄 handleMouseMove: сброс isActivelyMoving');
      }, 300); // 300ms задержка
      // Выбираем коэффициент в зависимости от способа перетаскивания
      let sensitivity = stateRef.current.isMouseWheelDown ? stateRef.current.wheelDragSensitivity : stateRef.current.handToolSensitivity;
      
      // Если зажат Shift - делаем перемещение более точным (медленным)
      if (e.shiftKey) {
        sensitivity *= 0.2; // Уменьшаем чувствительность в 5 раз
      }
      
      const dx = (x - stateRef.current.cursor.x) * sensitivity;
      const dy = (y - stateRef.current.cursor.y) * sensitivity;

      // ВРЕМЕННО: перемещаем всю композицию вместо индивидуальных слоев для производительности
      // if (activeLayerId) {
      //   // Логика индивидуального перемещения слоев отключена для отладки
      //   console.log(`🎭 ОТКЛЮЧЕНО: перемещение активного слоя ${activeLayerId}`);
      // } else {
      
      // Всегда перемещаем всю композицию (быстро через CSS трансформации)
      setImagePosition(prevPosition => {
        const start = performance.now();
        console.log(`🖱️ setImagePosition[${callId}]: start (dx=${dx}, dy=${dy})`);
        
        const newX = prevPosition.x + dx;
        const newY = prevPosition.y + dy;
        
        // Получаем размеры контейнера и изображения
        const canvasElement = canvas.current;
        const containerElement = scrollContainer.current;
        if (!canvasElement || !containerElement) {
          console.log('❌ setImagePosition: нет canvas или container');
          return prevPosition;
        }
        
        const scaledImageWidth = stateRef.current.originalDimensions.width * (stateRef.current.scaleFactor / 100);
        const scaledImageHeight = stateRef.current.originalDimensions.height * (stateRef.current.scaleFactor / 100);
        
        // Применяем ограничения относительно размеров контейнера (viewport)
        const constrainedPosition = constrainImagePosition(
          newX, 
          newY, 
          containerElement.clientWidth, 
          containerElement.clientHeight, 
          scaledImageWidth, 
          scaledImageHeight
        );
        
        const end = performance.now();
        console.log(`🖱️ setImagePosition[${callId}]: завершен за ${(end - start).toFixed(2)}ms`, constrainedPosition);
        
        // CSS трансформации обновятся автоматически через useEffect
        return constrainedPosition;
      });
    }

    // Обновляем курсор в конце
    setCursor({ x, y });
    setMouseCoords({ x, y });
  }, []); // Пустые зависимости - используем stateRef для актуальных значений

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
    console.log(`🖱️ handleMouseUpEvent: button=${e.button}, isDragging=${isDragging}`);
    
    if (e.button === 1) { // Middle mouse button
      handleMouseWheelUp(e);
    } else {
      // ЗАДЕРЖКА перед сбросом isDragging для предотвращения мерцания при медленном движении
      draggingTimeoutRef.current = setTimeout(() => {
        handleMouseUp(setIsDragging);
        setIsMouseDown(false);
        console.log(`🔧 handleMouseUpEvent: сброс isDragging с задержкой`);
        draggingTimeoutRef.current = null;
      }, 200); // 200ms задержка для надёжности
    }
  };
  const handleMouseDownEvent = (e) => {
    console.log(`🖱️ handleMouseDownEvent: button=${e.button}, toolActive=${toolActive}`);
    setIsMouseDown(true);
    
    // Очищаем таймер при новом нажатии
    if (draggingTimeoutRef.current) {
      clearTimeout(draggingTimeoutRef.current);
      draggingTimeoutRef.current = null;
      console.log(`🔧 handleMouseDownEvent: очищен таймер dragging`);
    }
    
    if (e.button === 1) { // Middle mouse button
      handleMouseWheelDown(e);
    } else if (toolActive === "hand") {
      console.log(`🖱️ handleMouseDownEvent: устанавливаем isDragging=true`);
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
    // ПРИМЕЧАНИЕ: события мыши регистрируются в EditorCanvas через React пропсы
    // Дублирующую addEventListener регистрацию УБРАНА для предотвращения множественных вызовов
    
    return () => {
      window.removeEventListener("keydown", handleKeyDownShortcut);
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

  // Вспомогательная функция для генерации имени файла
  const getExportFilename = (format) => {
    if (!filename) {
      return `editedImage.${format.toLowerCase()}`;
    }
    
    // Получаем имя файла без расширения
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
    return `${nameWithoutExt}.${format.toLowerCase()}`;
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
        const exportFilename = getExportFilename('gb7');
        const url = GrayBit7Handler.createDownloadURL(buffer, exportFilename);
        
      const a = document.createElement("a");
      document.body.appendChild(a);
      a.href = url;
        a.download = exportFilename;
      a.click();
      document.body.removeChild(a);
        
        // Очищаем URL через некоторое время
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        // Стандартный экспорт
        let url;
        if (format === 'JPG') {
          // Для JPG устанавливаем качество 90% (уменьшает размер файла)
          url = tempCanvas.toDataURL('image/jpeg', 0.9);
        } else {
          // Для PNG качество не влияет (lossless), но может варьироваться сжатие
          url = tempCanvas.toDataURL('image/png');
        }
        
        const exportFilename = getExportFilename(format);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.href = url;
        a.download = exportFilename;
        a.click();
        document.body.removeChild(a);
      }
    };
    handleClose();
  };


  const showPreview = (value) => setShowBg(value);

  const openCurvesModal = () => {
    setIsModalCurvesOpen(true);
    setToolActive("cursor");
  };

  const toggleLayersPanel = () => {
    setShowLayersPanel(prev => !prev);
  };

  // const openFilterModal = () => {
  //   setIsModalFilterOpen(true);
  //   setToolActive("cursor");
  // };

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
        openModal={openModal}
        openCurvesModal={openCurvesModal}
        onToggleLayersPanel={toggleLayersPanel}
        // openFilterModal={openFilterModal}
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
      {/* <Modal bg0={showBg} isOpen={isModalFilterOpen} onClose={closeModal} title="Фильтрация изображения">
        {isModalFilterOpen && <FilterModal imageCtx={context} setImage={updateImage} closeModal={closeModal} showPreview={showPreview} />}
      </Modal> */}
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
      
      {/* Layers Panel */}
      {showLayersPanel && (
        <div className="editor__layers-panel">
          <LayersPanel
            layers={layers}
            activeLayerId={activeLayerId}
            onLayersChange={updateLayersWithRenumbering}
            onLayersReorder={updateLayersWithoutRenumbering}
            onLayersPropertiesChange={updateLayersForProperties}
            onActiveLayerChange={setActiveLayer}
            onAddLayer={addLayerWithRenumbering}
            maxLayers={2}
          />
        </div>
      )}
    </section>
  );
};

export default Editor;