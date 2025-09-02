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
} from "@utils/CanvasChange/canvasKeyHand";
import {
  extractRGB,
  rgbToXyz,
  rgbToLab,
  calculateContrast,
} from "@utils/RonvertColours/ronvertColours";

import { calculateFileSize } from "@utils/FileSize/fileSize";

const Editor = () => {
  const { image, setImage } = useContext(ImageContext);

  const [toolActive, setToolActive] = useState("cursor");
  const [pipetteColor1, setPipetteColor1] = useState("");
  const [pipetteColor2, setPipetteColor2] = useState("");
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
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

  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  
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

  const handleScaleChange = (event) => {
    const newScaleFactor = event.target.value;
    setScaleFactor(newScaleFactor);
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
      const maxWidth = workspaceWidth - 100;
      const maxHeight = workspaceHeight - 100;

      const widthScale = maxWidth / img.width;
      const heightScale = maxHeight / img.height;
      const newScaleFactor = Math.min(widthScale, heightScale) * 100;
      
      if (scaleFactor === 0) {
        setScaleFactor(newScaleFactor);
      }

      const scaledWidth = img.width * (scaleFactor / 100);
      const scaledHeight = img.height * (scaleFactor / 100);

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

      const drawImage = () => {
        context.current.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Calculate center position
        const centerX = (canvasElement.width - scaledWidth) / 2 + imagePosition.x; // Add imagePosition.x
        const centerY = (canvasElement.height - scaledHeight) / 2 + imagePosition.y; // Add imagePosition.y

        // Если изображение имеет прозрачность, рисуем шахматный фон
        if (originalFormat && originalFormat.metadata && originalFormat.metadata.hasMask) {
          drawTransparencyBackground(context.current, centerX, centerY, scaledWidth, scaledHeight);
        }

        context.current.drawImage(
            img,
            centerX,
            centerY,
            scaledWidth,
            scaledHeight
        );
        requestAnimationFrame(drawImage);
      };

      drawImage();

      setDimensions({ width: scaledWidth, height: scaledHeight });
      calculateFileSize(img.src).then(size => setFileSize(formatFileSize(size)));

      // Обработчик события колесика мыши для масштабирования
      const handleWheel = (event) => {
        event.preventDefault();
        const delta = event.deltaY;
        const scaleSteps = [10, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300];
        const currentIndex = scaleSteps.indexOf(scaleFactor);
        let newIndex = currentIndex;

        if (delta < 0) { // Изменение направления для увеличения
          newIndex = Math.min(currentIndex + 1, scaleSteps.length - 1);
        } else {
          newIndex = Math.max(currentIndex - 1, 0);
        }

        setScaleFactor(scaleSteps[newIndex]);
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
  }, [image, scaleFactor, imagePosition]);

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
    const imageWidth = dimensions.width * (scaleFactor / 100);
    const imageHeight = dimensions.height * (scaleFactor / 100);
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

      // Обновляем позицию изображения с учетом чувствительности
      setImagePosition(prevPosition => ({
        x: prevPosition.x + dx,
        y: prevPosition.y + dy
      }));
    }

    // Обновляем курсор в конце
    setCursor({ x, y });
    setMouseCoords({ x, y });
  }, [isDragging, toolActive, isMouseWheelDown, cursor.x, cursor.y, dimensions, scaleFactor, handToolSensitivity, wheelDragSensitivity]);

  const handleKeyDownEvent = (e) => handleKeyDown(toolActive, canvasTranslation, setCanvasTranslation, e);
  const handleKeyUpEvent = (e) => handleKeyUp(toolActive, canvasTranslation, setCanvasTranslation, e);
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
      setPreviousTool(toolActive);
      setToolActive("hand");
      setIsDragging(true);
    }
  };

  const handleMouseWheelUp = (e) => {
    if (e.button === 1) { // Middle mouse button
      setIsMouseWheelDown(false);
      setToolActive(previousTool);
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
          break;
        case "KeyH":
          setSelectedTool("hand");
          setToolActive("hand");
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
      const coordinates = {
        x: mouseCoords.x,
        y: mouseCoords.y,
      };
      event.altKey ? (setPipetteColor2(currentColor), setImageCoordinates((prev) => ({ ...prev, extra: coordinates }))) : (setPipetteColor1(currentColor), setImageCoordinates((prev) => ({ ...prev, base: coordinates })));
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
    const handleKeyDownEvent = (e) => handleKeyDown(toolActive, canvasTranslation, setCanvasTranslation, e);
    document.body.addEventListener("keydown", handleKeyDownEvent);
    return () => document.body.removeEventListener("keydown", handleKeyDownEvent);
  }, [toolActive, canvasTranslation]);

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
      />
      <StatusBar 
        image={image}
        dimensions={dimensions}
        fileSize={fileSize}
        mouseCoords={mouseCoords}
        colorDepth={colorDepth}
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
          {["Цвет #1", "Цвет #2 (зажми alt)", "Текущий цвет"].map((label, index) => (
            <div className="editor__info-color" key={index}>
              <p className="status-bar__text">{label}:</p>
              <div className="status-bar__color" style={{ backgroundColor: index === 0 ? pipetteColor1 : index === 1 ? pipetteColor2 : currentColor }}></div>
              <p className="status-bar__text">&nbsp;{index === 0 ? pipetteColor1 : index === 1 ? pipetteColor2 : currentColor}</p>
              <p className="status-bar__text">&nbsp;{(index === 0 ? pipetteColor1 : index === 1 ? pipetteColor2 : currentColor) && rgbToXyz(extractRGB(index === 0 ? pipetteColor1 : index === 1 ? pipetteColor2 : currentColor))}</p>
              {/* <p className="status-bar__text">&nbsp;{(index === 0 ? pipetteColor1 : index === 1 ? pipetteColor2 : currentColor) && rgbToLab(extractRGB(index === 0 ? pipetteColor1 : index === 1 ? pipetteColor2 : currentColor))}</p> */}
              {index < 2 && <p className="status-bar__text">&nbsp;({imageCoordinates[index === 0 ? "base" : "extra"].x}, {imageCoordinates[index === 0 ? "base" : "extra"].y})</p>}
            </div>
          ))}
          <p className="editor__contrast-info">
            Контраст {pipetteColor1 && pipetteColor2 && calculateContrast(extractRGB(pipetteColor1), extractRGB(pipetteColor2))}
          </p>
        </div>
      </ContextModal>
    </section>
  );
};

export default Editor;