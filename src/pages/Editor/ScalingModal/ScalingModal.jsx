import React, { useState, useEffect, useContext } from 'react';
import './ScalingModal.css';
import PropTypes from 'prop-types';
import Dropdown from '@components/Dropdown/Dropdown';
import TheButton from '@components/Button/TheButton';
import { ImageContext } from '@/ImageProvider';
import { bilinearInterpolation, bicubicInterpolation, nearestNeighborInterpolation } from '@utils/ImageProcessing/InterpolationMethods';
import { runInterpolationTest } from '@utils/ImageProcessing/InterpolationTest';
import { calculateFileSize } from "@utils/FileSize/fileSize";

const ScalingModal = ({ image, closeModal }) => {
    const { setImage } = useContext(ImageContext);
    const [resizeMode, setResizeMode] = useState(() => localStorage.getItem('resizeMode') || 'Проценты');
    const [width, setWidth] = useState('100');
    const [height, setHeight] = useState('100');
    const [lockAspectRatio, setLockAspectRatio] = useState(() => JSON.parse(localStorage.getItem('lockAspectRatio')) || true);
    const [aspectRatio, setAspectRatio] = useState(0);
    const [interpolationAlgorithm, setInterpolationAlgorithm] = useState(() => localStorage.getItem('interpolationAlgorithm') || 'Ближайший сосед');
    const [initialSize, setInitialSize] = useState('');
    const [resizedSize, setResizedSize] = useState('');
    const [widthError, setWidthError] = useState('');
    const [heightError, setHeightError] = useState('');
    const [initialMegapixels, setInitialMegapixels] = useState(0);
    const [initialFileSize, setInitialFileSize] = useState(0);
    const [resizedFileSize, setResizedFileSize] = useState(0);
    const [showTooltip, setShowTooltip] = useState(false);

    // Таблица популярных разрешений
    const resolutionPresets = {
        // По ширине
        4096: 2160,  // 4K DCI
        3840: 2160,  // 4K UHD
        1920: 1080,  // Full HD
        1280: 720,   // HD
        720: 480,    // SD
        640: 480,    // VGA
        1366: 768,   // HD+
        1440: 900,   // WXGA+
        1600: 900,   // HD+
        2560: 1440,  // QHD
        3440: 1440,  // UWQHD
        // По высоте (обратные)
        2160: 4096,  // 4K DCI (обратно)
        1080: 1920,  // Full HD (обратно)  
        480: 720,    // SD (обратно)
        768: 1366,   // HD+ (обратно)
        900: 1600,   // HD+ (обратно)
        1440: 2560,  // QHD (обратно)
    };

    const formatSize = (megapixels) => {
        return megapixels > 1 ? `${megapixels.toFixed(2)} MP` : `${(megapixels * 1000000).toFixed(0)} pixels`;
    };

    const getInterpolationDescription = (algorithm) => {
        switch (algorithm) {
            case 'Ближайший сосед':
                return 'Быстрый алгоритм, сохраняет резкие края. Подходит для пиксель-арта и изображений с четкими границами. Может создавать зубчатые края при увеличении.';
            case 'Билинейный':
                return 'Балансирует качество и скорость. Создает более гладкие результаты чем ближайший сосед. Хороший выбор для большинства изображений.';
            case 'Бикубический':
                return 'Высокое качество с наилучшей детализацией. Медленнее других методов. Рекомендуется для фотографий и детализированных изображений.';
            default:
                return '';
        }
    };

    useEffect(() => {
        if (!image) return;

        const img = new Image();
        img.src = image.src;

        img.onload = () => {
            const megapixels = (img.naturalWidth * img.naturalHeight) / 1000000;
            setInitialMegapixels(megapixels);
            const formattedSize = formatSize(megapixels);
            setInitialSize(formattedSize);
            setResizedSize(formattedSize);
            const calculatedAspectRatio = img.naturalWidth / img.naturalHeight;
            setAspectRatio(calculatedAspectRatio);
            

            if (resizeMode === 'Проценты') {
                setWidth('100');
                setHeight('100');
            } else {
                setWidth(img.naturalWidth.toString());
                setHeight(img.naturalHeight.toString());
            }

            // Calculate and set the initial file size
            calculateFileSize(img.src).then(size => {
                setInitialFileSize(size);
                setResizedFileSize(size);
            });
        };
    }, [image, resizeMode]);

    useEffect(() => {
        const validateDimensions = () => {
            const heightNum = Number(height);
            const widthNum = Number(width);
            
            // Валидация высоты
            if (!Number.isInteger(heightNum) || heightNum <= 0) {
                setHeightError('⚠ Высота должна быть целым положительным числом');
            } else if (heightNum < 1) {
                setHeightError('⚠ Минимальная высота: 1 пиксель');
            } else if (heightNum > 32768) {
                setHeightError('⚠ Максимальная высота: 32768 пикселей');
            } else if (resizeMode === 'Проценты' && (heightNum < 1 || heightNum > 1000)) {
                setHeightError('⚠ Проценты должны быть от 1% до 1000%');
            } else {
                setHeightError('');
            }
            
            // Валидация ширины
            if (!Number.isInteger(widthNum) || widthNum <= 0) {
                setWidthError('⚠ Ширина должна быть целым положительным числом');
            } else if (widthNum < 1) {
                setWidthError('⚠ Минимальная ширина: 1 пиксель');
            } else if (widthNum > 32768) {
                setWidthError('⚠ Максимальная ширина: 32768 пикселей');
            } else if (resizeMode === 'Проценты' && (widthNum < 1 || widthNum > 1000)) {
                setWidthError('⚠ Проценты должны быть от 1% до 1000%');
            } else {
                setWidthError('');
            }
        };
        
        validateDimensions();
    }, [height, width, resizeMode]);

    const handleWidthChange = (event) => {
        const value = event.target.value;
        setWidth(value);
        let newHeightValue = height;
        if (lockAspectRatio) {
            if (resizeMode === 'Проценты') {
                // В режиме процентов оба значения должны быть одинаковыми
                const newHeight = value;
                setHeight(newHeight.toString());
                newHeightValue = newHeight.toString();
            } else {
                // В режиме пикселей используем предустановленные разрешения
                const widthNum = Number(value);
                const presetHeight = resolutionPresets[widthNum];
                if (presetHeight) {
                    setHeight(presetHeight.toString());
                    newHeightValue = presetHeight.toString();
                } else {
                    // Если нет предустановки, используем старую логику
                    const newHeight = Math.round(widthNum / aspectRatio);
                    setHeight(newHeight.toString());
                    newHeightValue = newHeight.toString();
                }
            }
        }
        updateResizedSize(value, newHeightValue);
    };

    const handleHeightChange = (event) => {
        const value = event.target.value;
        setHeight(value);
        let newWidthValue = width;
        if (lockAspectRatio) {
            if (resizeMode === 'Проценты') {
                // В режиме процентов оба значения должны быть одинаковыми
                const newWidth = value;
                setWidth(newWidth.toString());
                newWidthValue = newWidth.toString();
            } else {
                // В режиме пикселей используем предустановленные разрешения
                const heightNum = Number(value);
                const presetWidth = resolutionPresets[heightNum];
                if (presetWidth) {
                    setWidth(presetWidth.toString());
                    newWidthValue = presetWidth.toString();
                } else {
                    // Если нет предустановки, используем старую логику
                    const newWidth = Math.round(heightNum * aspectRatio);
                    setWidth(newWidth.toString());
                    newWidthValue = newWidth.toString();
                }
            }
        }
        updateResizedSize(newWidthValue, value);
    };

    const updateResizedSize = (widthValue, heightValue) => {
        const newWidthValue = Number(widthValue);
        const newHeightValue = Number(heightValue);
        let megapixels;
        let actualNewWidth, actualNewHeight;
        
        if (resizeMode === 'Проценты') {
            megapixels = initialMegapixels * (newWidthValue / 100) * (newHeightValue / 100);
            // Рассчитываем фактические размеры в пикселях для процентов
            actualNewWidth = (image.naturalWidth * newWidthValue) / 100;
            actualNewHeight = (image.naturalHeight * newHeightValue) / 100;
        } else {
            megapixels = (newWidthValue * newHeightValue) / 1000000;
            actualNewWidth = newWidthValue;
            actualNewHeight = newHeightValue;
        }
        setResizedSize(formatSize(megapixels));

        // Estimate new file size based on dimensions change
        const scaleFactor = (actualNewWidth * actualNewHeight) / (image.naturalWidth * image.naturalHeight);
        const estimatedNewFileSize = initialFileSize * scaleFactor;
        setResizedFileSize(estimatedNewFileSize);
    };

    const handleResizeConfirm = () => {
        // Проверяем наличие ошибок валидации
        if (widthError || heightError) {
            return; // Не выполняем операцию если есть ошибки
        }
        
        localStorage.setItem('resizeMode', resizeMode);
        localStorage.setItem('width', width);
        localStorage.setItem('height', height);
        localStorage.setItem('lockAspectRatio', JSON.stringify(lockAspectRatio));
        localStorage.setItem('interpolationAlgorithm', interpolationAlgorithm);

        // Создаем временный canvas для получения оригинальных данных изображения
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Устанавливаем размеры временного canvas под оригинальное изображение
        tempCanvas.width = image.naturalWidth;
        tempCanvas.height = image.naturalHeight;
        
        // Рисуем оригинальное изображение без масштабирования
        tempCtx.drawImage(image, 0, 0);
        
        // Получаем данные оригинального изображения
        const originalImageData = tempCtx.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
        
        // Вычисляем новые размеры
        const newWidth = resizeMode === 'Проценты' 
            ? Math.round((image.naturalWidth * Number(width)) / 100) 
            : Number(width);
        const newHeight = resizeMode === 'Проценты' 
            ? Math.round((image.naturalHeight * Number(height)) / 100) 
            : Number(height);
        
        // Применяем интерполяцию к оригинальным данным
        let resizedImageData;
        switch (interpolationAlgorithm) {
            case 'Ближайший сосед':
                resizedImageData = nearestNeighborInterpolation(originalImageData, newWidth, newHeight);
                break;
            case 'Билинейный':
                resizedImageData = bilinearInterpolation(originalImageData, newWidth, newHeight);
                break;
            case 'Бикубический':
                resizedImageData = bicubicInterpolation(originalImageData, newWidth, newHeight);
                break;
            default:
                // Если не выбран метод интерполяции, используем встроенное масштабирование браузера
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = newWidth;
                canvas.height = newHeight;
                ctx.drawImage(image, 0, 0, newWidth, newHeight);
                resizedImageData = ctx.getImageData(0, 0, newWidth, newHeight);
        }
        
        // Создаем финальный canvas для результата
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        // Помещаем интерполированные данные на canvas
        ctx.putImageData(resizedImageData, 0, 0);
        
        canvas.toBlob(async (blob) => {
            const newFileSize = await calculateFileSize(URL.createObjectURL(blob));
            setImage(canvas.toDataURL('image/png'), newFileSize);
            closeModal();
        }, 'image/png');
    };

    const handleResizeModeChange = (selectedOption) => {
        setResizeMode(selectedOption);
        let newWidth, newHeight;
        if (selectedOption === 'Проценты') {
            newWidth = '100';
            newHeight = '100';
        } else {
            // Используем оригинальные размеры изображения
            newWidth = image.naturalWidth.toString();
            newHeight = image.naturalHeight.toString();
        }
        setWidth(newWidth);
        setHeight(newHeight);
        // Обновляем расчет размера с учетом нового режима
        setTimeout(() => updateResizedSize(newWidth, newHeight), 0);
    };

    const handleInterpolationAlgorithmChange = (selectedOption) => {
        setInterpolationAlgorithm(selectedOption);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
    };
        
    return (
        <form className="scaling-modal" onSubmit={handleSubmit}>
            <p className="form__text">
                Размер исходного изображения: {initialSize} ({(initialFileSize / 1024).toFixed(2)} KB)
            </p>
            <p className="form__text">
                Размер после изменений: {resizedSize} (примерно {(resizedFileSize / 1024).toFixed(2)} KB)
            </p>
            <h3 className="form__name">Настройка размеров</h3>
            <div className="form__settings">
                <label className="form__label" htmlFor="resize-mode">Единицы измерения</label>
                <Dropdown id="resize-mode" options={["Проценты", "Пиксели"]} onSelect={handleResizeModeChange} selectOption={resizeMode} />
                <label className="form__label" htmlFor="width">Ширина</label>
                <input
                    type="number"
                    id="width"
                    value={width}
                    onChange={handleWidthChange}
                    min={1}
                    step={1}
                    className="input"
                />
                <label className="form__label" htmlFor="height">Высота</label>
                <input
                    type="number"
                    id="height"
                    value={height}
                    onChange={handleHeightChange}
                    min={1}
                    step={1}
                    className="input"
                />
                <div className="form__lock">
                    <button type="button" className="form__lock-button" onClick={() => setLockAspectRatio(!lockAspectRatio)}>
                        {lockAspectRatio
                            ? <svg role="img" fill="currentColor" viewBox="0 0 18 18" id="SLockClosed18N-icon" width="18" height="18" aria-hidden="true" aria-label="" focusable="false"><path fillRule="evenodd" d="M14.5,8H14V7A5,5,0,0,0,4,7V8H3.5a.5.5,0,0,0-.5.5v8a.5.5,0,0,0,.5.5h11a.5.5,0,0,0,.5-.5v-8A.5.5,0,0,0,14.5,8ZM6,7a3,3,0,0,1,6,0V8H6Zm4,6.111V14.5a.5.5,0,0,1-.5.5h-1a.5.5,0,0,1-.5-.5V13.111a1.5,1.5,0,1,1,2,0Z"></path></svg>
                            : <svg role="img" fill="currentColor" viewBox="0 0 18 18" id="SLockOpen18N-icon" width="18" height="18" aria-hidden="true" aria-label="" focusable="false"><path fillRule="evenodd" d="M14.5,8H5.95V5.176A3.106,3.106,0,0,1,9,2a3.071,3.071,0,0,1,2.754,1.709c.155.32.133.573.389.573a.237.237,0,0,0,.093-.018l1.34-.534a.256.256,0,0,0,.161-.236C13.737,2.756,12.083.1,9,.1A5.129,5.129,0,0,0,4,5.146V8H3.5a.5.5,0,0,0-.5.5v8a.5.5,0,0,0,.5.5h11a.5.5,0,0,0,.5-.5v-8A.5.5,0,0,0,14.5,8ZM10,13.111V14.5a.5.5,0,0,1-.5.5h-1a.5.5,0,0,1-.5-.5V13.111a1.5,1.5,0,1,1,2,0Z"></path></svg>
                        }
                    </button>
                </div>
                <label className="form__label" htmlFor="interpolation-algorithm">Алгоритм интерполяции</label>
                <div className="form__select-iterpolation">
                    <Dropdown id="interpolation-algorithm" options={["Ближайший сосед", "Билинейный", "Бикубический"]} onSelect={handleInterpolationAlgorithmChange} selectOption={interpolationAlgorithm} />
                    <div 
                        className="form__tooltip-trigger"
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                    >
                        ℹ️
                        {showTooltip && (
                            <div className="form__tooltip">
                                {getInterpolationDescription(interpolationAlgorithm)}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="form__errors">
                {widthError && <p className="form__error">{widthError}</p>}
                {heightError && <p className="form__error">{heightError}</p>}
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <TheButton 
                    className="form__button" 
                    accent={true} 
                    onClick={handleResizeConfirm}
                    disabled={widthError || heightError}
                >
                    Выполнить
                </TheButton>
                
                <TheButton 
                    type="button"
                    onClick={() => runInterpolationTest(50, 200, false)}
                    style={{ 
                        background: '#4CAF50', 
                        fontSize: '12px',
                        padding: '5px 10px'
                    }}
                    title="Запустить визуальный тест методов интерполяции"
                >
                    🧪 Тест
                </TheButton>
            </div>
        </form>
    );
};

ScalingModal.propTypes = {
    image: PropTypes.object,
    closeModal: PropTypes.func,
};

export default ScalingModal;