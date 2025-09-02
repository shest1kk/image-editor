import React, { useRef, useContext, useState, useEffect } from 'react';
import { ImageContext } from '@/ImageProvider';
import TheButton from '@components/Button/TheButton';
import { Link, useNavigate } from 'react-router-dom';
import Loader from '@components/Loader/Loader';
import './StartPage.css';

const StartPage = () => {
    const { image, setImage } = useContext(ImageContext);
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

        return () => clearTimeout(timer);
    }, []);

    const handleButtonClick = () => inputFile.current.click();

    const handleImageChange = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewImage(e.target.result);
                setImage(e.target.result);
            };
            reader.readAsDataURL(file);
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
                    setImage(e.target.result);
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const handleDrop = (event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewImage(e.target.result);
                setImage(e.target.result);
            };
            reader.readAsDataURL(file);
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
                    <input ref={inputFile} style={{ display: 'none' }} type="file" accept="image/*" onChange={handleImageChange} />
                    <div className="home__actions">
                        <div className="home__load-buttons" style={{ width: '100%' }}>
                            <TheButton onClick={handleButtonClick} title="Загрузка изображения с компьютера" normal style={{ width: '100%' }}>
                                Загрузить изображение
                            </TheButton>
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
