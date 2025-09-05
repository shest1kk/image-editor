// Функция для ограничения смещения изображения в пределах canvas
export const constrainImagePosition = (newX, newY, canvasWidth, canvasHeight, scaledImageWidth, scaledImageHeight) => {
    // Рассчитываем центральную позицию изображения (без смещения)
    const centerX = (canvasWidth - scaledImageWidth) / 2;
    const centerY = (canvasHeight - scaledImageHeight) / 2;
    
    // Рассчитываем позицию изображения с учетом смещения
    const imageLeft = centerX + newX;
    const imageTop = centerY + newY;
    const imageRight = imageLeft + scaledImageWidth;
    const imageBottom = imageTop + scaledImageHeight;
    
    // Минимальная видимая часть изображения (в пикселях)
    const minVisibleEdge = 50;
    
    // Ограничения: минимальный край изображения всегда должен быть виден
    let constrainedX = newX;
    let constrainedY = newY;
    
    // Проверяем границы по X (горизонталь)
    if (imageRight < minVisibleEdge) {
        // Изображение ушло слишком далеко влево - оставляем минимальный видимый край
        constrainedX = minVisibleEdge - centerX - scaledImageWidth;
    } else if (imageLeft > canvasWidth - minVisibleEdge) {
        // Изображение ушло слишком далеко вправо - оставляем минимальный видимый край
        constrainedX = canvasWidth - minVisibleEdge - centerX;
    }
    
    // Проверяем границы по Y (вертикаль)
    if (imageBottom < minVisibleEdge) {
        // Изображение ушло слишком далеко вверх - оставляем минимальный видимый край
        constrainedY = minVisibleEdge - centerY - scaledImageHeight;
    } else if (imageTop > canvasHeight - minVisibleEdge) {
        // Изображение ушло слишком далеко вниз - оставляем минимальный видимый край
        constrainedY = canvasHeight - minVisibleEdge - centerY;
    }
    
    return { x: constrainedX, y: constrainedY };
};

// Функция для ограничения позиции отдельного слоя
export const constrainLayerPosition = (newX, newY, canvasWidth, canvasHeight, scaledImageWidth, scaledImageHeight, baseImagePosition = { x: 0, y: 0 }) => {
    // Рассчитываем центральную позицию изображения (без смещения)
    const centerX = (canvasWidth - scaledImageWidth) / 2;
    const centerY = (canvasHeight - scaledImageHeight) / 2;
    
    // Рассчитываем финальную позицию слоя на экране (базовая позиция + позиция слоя)
    const finalX = baseImagePosition.x + newX;
    const finalY = baseImagePosition.y + newY;
    
    // Рассчитываем позицию изображения с учетом всех смещений
    const imageLeft = centerX + finalX;
    const imageTop = centerY + finalY;
    const imageRight = imageLeft + scaledImageWidth;
    const imageBottom = imageTop + scaledImageHeight;
    
    // Минимальная видимая часть изображения (в пикселях)
    const minVisibleEdge = 50;
    
    // Ограничения: минимальный край изображения всегда должен быть виден
    let constrainedLayerX = newX;
    let constrainedLayerY = newY;
    
    // Проверяем границы по X (горизонталь)
    if (imageRight < minVisibleEdge) {
        // Изображение ушло слишком далеко влево - оставляем минимальный видимый край
        constrainedLayerX = minVisibleEdge - centerX - scaledImageWidth - baseImagePosition.x;
    } else if (imageLeft > canvasWidth - minVisibleEdge) {
        // Изображение ушло слишком далеко вправо - оставляем минимальный видимый край
        constrainedLayerX = canvasWidth - minVisibleEdge - centerX - baseImagePosition.x;
    }
    
    // Проверяем границы по Y (вертикаль)
    if (imageBottom < minVisibleEdge) {
        // Изображение ушло слишком далеко вверх - оставляем минимальный видимый край
        constrainedLayerY = minVisibleEdge - centerY - scaledImageHeight - baseImagePosition.y;
    } else if (imageTop > canvasHeight - minVisibleEdge) {
        // Изображение ушло слишком далеко вниз - оставляем минимальный видимый край
        constrainedLayerY = canvasHeight - minVisibleEdge - centerY - baseImagePosition.y;
    }
    
    return { x: constrainedLayerX, y: constrainedLayerY };
};

export const updateTranslation = (animationFrameId, canvasTranslation, setCanvasTranslation, imagePosition, setImagePosition, dx, dy) => {
    if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
    }
    animationFrameId.current = requestAnimationFrame(() => {
        setCanvasTranslation(prevTranslation => ({
            x: prevTranslation.x + dx,
            y: prevTranslation.y + dy
        }));
        setImagePosition(prevPosition => ({
            x: prevPosition.x + dx,
            y: prevPosition.y + dy
        }));
    });
};

export const handleMouseDown = (toolActive, setIsDragging) => {
    if (toolActive === "hand") {
        setIsDragging(true);
    }
};

export const handleMouseUp = (setIsDragging) => {
    setIsDragging(false);
};

export const handleKeyDown = (step, toolActive, imagePosition, setImagePosition, canvasWidth, canvasHeight, scaledImageWidth, scaledImageHeight, e) => {
    if (toolActive === "hand") {
        let dx = 0, dy = 0;
        
        switch (e.key) {
            case "ArrowLeft":
                dx = -step;
                break;
            case "ArrowRight":
                dx = step;
                break;
            case "ArrowUp":
                dy = -step;
                break;
            case "ArrowDown":
                dy = step;
                break;
            case " ": // Пробел для сброса позиции
                setImagePosition({ x: 0, y: 0 });
                return;
            default:
                return;
        }
        
        // Применяем ограничения к новой позиции
        const newPosition = constrainImagePosition(
            imagePosition.x + dx,
            imagePosition.y + dy,
            canvasWidth,
            canvasHeight,
            scaledImageWidth,
            scaledImageHeight
        );
        
        setImagePosition(newPosition);
    }
};

export const handleKeyUp = (toolActive, e) => {
    if (toolActive === "hand") {
        // Клавиатурное управление теперь работает по нажатию, а не удержанию
        // Эта функция может быть использована для дополнительных действий в будущем
        return;
    }
};