import React, { useState, useEffect, useContext } from 'react';
import './ScalingModal.css';
import PropTypes from 'prop-types';
import Dropdown from '@components/Dropdown/Dropdown';
import TheButton from '@components/Button/TheButton';
import { ImageContext } from '@/ImageProvider';
import { bilinearInterpolation, bicubicInterpolation, nearestNeighborInterpolation } from '@utils/ImageProcessing/InterpolationMethods';
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

    const formatSize = (megapixels) => {
        return megapixels > 1 ? `${megapixels.toFixed(2)} MP` : `${(megapixels * 1000000).toFixed(0)} pixels`;
    };

    useEffect(() => {
        if (!image) return;

        const img = new Image();
        img.src = image.src;

        img.onload = () => {
            const megapixels = (img.width * img.height) / 1000000;
            setInitialMegapixels(megapixels);
            const formattedSize = formatSize(megapixels);
            setInitialSize(formattedSize);
            setResizedSize(formattedSize);
            setAspectRatio(img.width / img.height);

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
        if (!Number.isInteger(Number(height)) || Number(height) <= 0) {
            setHeightError('⚠ Высота должна быть целым положительным числом');
        } else {
            setHeightError('');
        }
        if (!Number.isInteger(Number(width)) || Number(width) <= 0) {
            setWidthError('⚠ Ширина должна быть целым положительным числом');
        } else {
            setWidthError('');
        }
    }, [height, width]);

    const handleWidthChange = (event) => {
        const value = event.target.value;
        setWidth(value);
        if (lockAspectRatio) {
            const newHeight = resizeMode === 'Проценты' ? value : Math.round(Number(value) / aspectRatio);
            setHeight(newHeight.toString());
        }
        updateResizedSize(value, height);
    };

    const handleHeightChange = (event) => {
        const value = event.target.value;
        setHeight(value);
        if (lockAspectRatio) {
            const newWidth = resizeMode === 'Проценты' ? value : Math.round(Number(value) * aspectRatio);
            setWidth(newWidth.toString());
        }
        updateResizedSize(width, value);
    };

    const updateResizedSize = (widthValue, heightValue) => {
        const newWidthValue = Number(widthValue);
        const newHeightValue = Number(heightValue);
        let megapixels;
        if (resizeMode === 'Проценты') {
            megapixels = initialMegapixels * (newWidthValue / 100) * (newHeightValue / 100);
        } else {
            megapixels = (newWidthValue * newHeightValue) / 1000000;
        }
        setResizedSize(formatSize(megapixels));

        // Estimate new file size based on dimensions change
        const scaleFactor = (newWidthValue * newHeightValue) / (image.naturalWidth * image.naturalHeight);
        const estimatedNewFileSize = initialFileSize * scaleFactor;
        setResizedFileSize(estimatedNewFileSize);
    };

    const handleResizeConfirm = () => {
        localStorage.setItem('resizeMode', resizeMode);
        localStorage.setItem('width', width);
        localStorage.setItem('height', height);
        localStorage.setItem('lockAspectRatio', JSON.stringify(lockAspectRatio));
        localStorage.setItem('interpolationAlgorithm', interpolationAlgorithm);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const newWidth = resizeMode === 'Проценты' 
            ? Math.round((image.naturalWidth * Number(width)) / 100) 
            : Number(width);
        const newHeight = resizeMode === 'Проценты' 
            ? Math.round((image.naturalHeight * Number(height)) / 100) 
            : Number(height);
        
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        ctx.drawImage(image, 0, 0, newWidth, newHeight);
        
        const imageData = ctx.getImageData(0, 0, newWidth, newHeight);
        
        let resizedImageData;
        switch (interpolationAlgorithm) {
            case 'Ближайший сосед':
                resizedImageData = nearestNeighborInterpolation(imageData, newWidth, newHeight);
                break;
            case 'Билинейный':
                resizedImageData = bilinearInterpolation(imageData, newWidth, newHeight);
                break;
            case 'Бикубический':
                resizedImageData = bicubicInterpolation(imageData, newWidth, newHeight);
                break;
            default:
                resizedImageData = imageData;
        }
        
        ctx.putImageData(resizedImageData, 0, 0);
        
        canvas.toBlob(async (blob) => {
            const newFileSize = await calculateFileSize(URL.createObjectURL(blob));
            setImage(canvas.toDataURL('image/png'), newFileSize);
            closeModal();
        }, 'image/png');
    };

    const handleResizeModeChange = (selectedOption) => {
        setResizeMode(selectedOption);
        if (selectedOption === 'Проценты') {
            setWidth('100');
            setHeight('100');
        } else {
            setWidth(image.width.toString());
            setHeight(image.height.toString());
        }
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
                </div>
            </div>
            <div className="form__errors">
                {widthError && <p className="form__error">{widthError}</p>}
                {heightError && <p className="form__error">{heightError}</p>}
            </div>
            <TheButton className="form__button" accent={true} onClick={handleResizeConfirm}>
                Выполнить
            </TheButton>
        </form>
    );
};

ScalingModal.propTypes = {
    image: PropTypes.object,
    closeModal: PropTypes.func,
};

export default ScalingModal;