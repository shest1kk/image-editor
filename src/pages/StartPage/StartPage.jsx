import React, { useRef, useContext, useState, useEffect } from 'react';
import { ImageContext } from '@/ImageProvider';
import TheButton from '@components/Button/TheButton';
import { Link, useNavigate } from 'react-router-dom';
import Loader from '@components/Loader/Loader';
import { ImageLoader } from '@utils/ImageFormats/ImageLoader';
import './StartPage.css';

const StartPage = () => {
    const { image, setImage, setFilename } = useContext(ImageContext);
    const inputFile = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [error, setError] = useState('');
    const [previewImage, setPreviewImage] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1500);

        // Очищаем метаданные при загрузке стартовой страницы
        localStorage.removeItem('imageFormatData');

        // Показываем информацию о поддержке GrayBit-7
        console.log(`
🎨 РЕДАКТОР ИЗОБРАЖЕНИЙ - Поддержка GrayBit-7

Новый формат GrayBit-7 (.gb7) теперь поддерживается!

📥 ЗАГРУЗКА:
• Перетащите .gb7 файл в область загрузки
• Используйте кнопку "Загрузить изображение" 
• Поддерживается 7-битное изображение в градациях серого
• Поддерживается альфа-маска (опционально)

📤 ЭКСПОРТ:
• Меню "Экспорт" → "GrayBit-7"
• Автоматическое преобразование в градации серого
• Сжатие 8-бит → 7-бит значений
        `);

        return () => clearTimeout(timer);
    }, []);

    const handleButtonClick = () => inputFile.current.click();

    const handleImageChange = async (event) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                if (!ImageLoader.isSupportedFormat(file.name)) {
                    setError(`Неподдерживаемый формат файла: ${ImageLoader.getFileExtension(file.name)}`);
                    return;
                }

                const imageData = await ImageLoader.loadFromFile(file);
                setPreviewImage(imageData.src);
                setImage(imageData.src, file.name);
                setFilename(file.name);
                setError('');

                // Сохраняем метаданные формата для использования в редакторе
                if (imageData.format === 'GrayBit-7') {
                    localStorage.setItem('imageFormatData', JSON.stringify({
                        format: imageData.format,
                        originalFormat: imageData.originalFormat,
                        colorDepth: imageData.colorDepth,
                        metadata: imageData.metadata
                    }));
                    console.log('Загружен файл GrayBit-7:', imageData.metadata);
                } else {
                    localStorage.removeItem('imageFormatData');
                }
            } catch (error) {
                console.error('Ошибка загрузки файла:', error);
                setError(`Ошибка загрузки файла: ${error.message}`);
            }
        }
    };

    const handlePaste = (event) => {
        const items = event.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const file = items[i].getAsFile();
                const reader = new FileReader();
                reader.onload = (e) => {
                    setPreviewImage(e.target.result);
                    setImage(e.target.result, `pasted-image-${Date.now()}.png`);
                    setFilename(`pasted-image-${Date.now()}.png`);
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const handleDrop = (event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) {
            // Используем handleImageChange для единообразной обработки
            handleImageChange({ target: { files: [file] } });
        }
    };

    const handlePasteReplace = (event) => {
        handlePaste(event);
    };

    const handleModalOpen = () => setShowModal(true);

    const handleModalClose = () => {
        setShowModal(false);
        setError('');
    };

    const handleImageUrlChange = (event) => setImageUrl(event.target.value);

    const handleImageUrlSubmit = () => {
        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
            setError('Пожалуйста, введите корректный URL, начинающийся с http:// или https://');
            return;
        }

        fetch(imageUrl)
            .then(response => response.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    setPreviewImage(e.target.result);
                    setImage(e.target.result);
                    handleModalClose();
                };
                reader.readAsDataURL(blob);
            })
            .catch(error => {
                console.error('Error fetching image:', error);
                setError('Не удалось загрузить изображение. Пожалуйста, проверьте URL и попробуйте снова.');
            });
    };

    return (
        <>
            {isLoading ? (
                <Loader />
            ) : (
                <section className="home" id="wrapper" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onPaste={handlePasteReplace} style={{ height: '100vh', overflow: 'hidden' }}>
                    <h1 className="home__title">ОБРАБОТКА ИЗОБРАЖЕНИЙ</h1>
                    <div className="home__head">
                        <p>Привет! Этот сервис предназначен для обработки изображений.</p>
                        <p>Ты можешь загрузить изображение по кнопке ниже, или просто перетащить сюда изображение / вставить его (CTRL+V).</p>
                    </div>
                    <input ref={inputFile} style={{ display: 'none' }} type="file" accept={ImageLoader.getAcceptString()} onChange={handleImageChange} />
                    <div className="home__actions">
                        <div className="home__load-buttons" style={{ width: '100%' }}>
                            <TheButton onClick={handleButtonClick} title="Загрузка изображения с компьютера (поддерживает JPG, PNG, GIF, BMP, WebP, SVG, GrayBit-7)" normal style={{ width: '100%' }}>
                                Загрузить изображение
                            </TheButton>
                            {error && <p style={{ color: 'red', marginTop: '10px', textAlign: 'center' }}>{error}</p>}
                            <TheButton onClick={handleModalOpen} title="Вставить URL" normal style={{ width: '100%', marginTop: '10px' }}>
                                Вставить URL
                            </TheButton>
                            {previewImage && (
                                <TheButton onClick={() => navigate('/editor')} accent style={{ width: '100%', marginTop: '10px' }}>
                                    Перейти в редактор
                                </TheButton>
                            )}
                            {showModal && (
                                <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'white', padding: '20px', borderRadius: '5px', boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)' }}>
                                    <input type="text" value={imageUrl} onChange={handleImageUrlChange} placeholder="Введите URL изображения" style={{ width: '100%', marginBottom: '10px' }} />
                                    <TheButton onClick={handleImageUrlSubmit} accent style={{ width: '100%' }}>Загрузить изображение</TheButton>
                                    <button onClick={handleModalClose} style={{ position: 'absolute', top: '10px', right: '10px', cursor: 'pointer' }}>Х</button>
                                    {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
                                </div>
                            )}
                        </div>
                    </div>
                    {previewImage && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: '20px' }}>
                            <img className="preview" src={previewImage} alt="Uploaded" />
                        </div>
                    )}
                </section>
            )}
        </>
    );
}

export default StartPage;
