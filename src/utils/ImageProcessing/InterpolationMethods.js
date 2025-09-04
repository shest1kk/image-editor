    /**
     * Билинейная интерполяция для масштабирования изображения
     * @param {ImageData} imageData - Исходные данные изображения
     * @param {number} newWidth - Новая ширина
     * @param {number} newHeight - Новая высота
     * @returns {ImageData} Масштабированное изображение
     */
    function bilinearInterpolation(imageData, newWidth, newHeight) {
      const { width, height, data } = imageData;
      const newImageData = new ImageData(newWidth, newHeight);
    
      for (let y = 0; y < newHeight; y++) {
        for (let x = 0; x < newWidth; x++) {
          // Вычисляем координаты в исходном изображении
          const gx = (x + 0.5) * width / newWidth - 0.5;
          const gy = (y + 0.5) * height / newHeight - 0.5;
          
          const gxi = Math.floor(gx);
          const gyi = Math.floor(gy);
          
          // Дробные части для интерполяции
          const fx = gx - gxi;
          const fy = gy - gyi;
          
          for (let channel = 0; channel < 4; channel++) {
            // Получаем значения четырех соседних пикселей с проверкой границ
            const x1 = Math.max(0, Math.min(gxi, width - 1));
            const y1 = Math.max(0, Math.min(gyi, height - 1));
            const x2 = Math.max(0, Math.min(gxi + 1, width - 1));
            const y2 = Math.max(0, Math.min(gyi + 1, height - 1));
            
            const a = data[4 * (y1 * width + x1) + channel] || 0;
            const b = data[4 * (y1 * width + x2) + channel] || 0;
            const c = data[4 * (y2 * width + x1) + channel] || 0;
            const d = data[4 * (y2 * width + x2) + channel] || 0;
            
            // Билинейная интерполяция
            const value = a * (1 - fx) * (1 - fy) +
                         b * fx * (1 - fy) +
                         c * (1 - fx) * fy +
                         d * fx * fy;
            
            newImageData.data[4 * (y * newWidth + x) + channel] = Math.round(Math.max(0, Math.min(255, value)));
          }
        }
      }
    
      return newImageData;
    }
    
    /**
     * Бикубическая интерполяция для масштабирования изображения
     * @param {ImageData} imageData - Исходные данные изображения
     * @param {number} newWidth - Новая ширина
     * @param {number} newHeight - Новая высота
     * @returns {ImageData} Масштабированное изображение
     */
    function bicubicInterpolation(imageData, newWidth, newHeight) {
      const { width, height, data } = imageData;
      const newImageData = new ImageData(newWidth, newHeight);
    
      // Функция кубической интерполяции (Keys cubic kernel)
      function cubic(x) {
        const abs = Math.abs(x);
        if (abs <= 1) {
          return 1.5 * abs ** 3 - 2.5 * abs ** 2 + 1;
        } else if (abs <= 2) {
          return -0.5 * abs ** 3 + 2.5 * abs ** 2 - 4 * abs + 2;
        }
        return 0;
      }
    
      for (let y = 0; y < newHeight; y++) {
        for (let x = 0; x < newWidth; x++) {
          // Вычисляем координаты в исходном изображении
          const gx = (x + 0.5) * width / newWidth - 0.5;
          const gy = (y + 0.5) * height / newHeight - 0.5;
          const gxi = Math.floor(gx);
          const gyi = Math.floor(gy);
    
          for (let channel = 0; channel < 4; channel++) {
            let sum = 0;
            let weightSum = 0;
    
            // Используем 4x4 матрицу соседних пикселей
            for (let i = -1; i <= 2; i++) {
              for (let j = -1; j <= 2; j++) {
                const xi = gxi + i;
                const yi = gyi + j;
                
                // Проверяем границы и получаем значение пикселя
                let pixelValue = 0;
                if (xi >= 0 && xi < width && yi >= 0 && yi < height) {
                  pixelValue = data[4 * (yi * width + xi) + channel] || 0;
                } else {
                  // Для пикселей за границами используем ближайший пиксель
                  const clampedX = Math.max(0, Math.min(xi, width - 1));
                  const clampedY = Math.max(0, Math.min(yi, height - 1));
                  pixelValue = data[4 * (clampedY * width + clampedX) + channel] || 0;
                }
                
                const weight = cubic(gx - xi) * cubic(gy - yi);
                sum += pixelValue * weight;
                weightSum += Math.abs(weight);
              }
            }
    
            // Нормализация и ограничение значений
            const result = weightSum > 0 ? sum / weightSum : 0;
            newImageData.data[4 * (y * newWidth + x) + channel] = Math.round(Math.max(0, Math.min(255, result)));
          }
        }
      }
    
      return newImageData;
    }
    
    /**
     * Интерполяция ближайшего соседа для масштабирования изображения
     * @param {ImageData} imageData - Исходные данные изображения
     * @param {number} newWidth - Новая ширина
     * @param {number} newHeight - Новая высота
     * @returns {ImageData} Масштабированное изображение
     */
    function nearestNeighborInterpolation(imageData, newWidth, newHeight) {
      const { width, height, data } = imageData;
      const newImageData = new ImageData(newWidth, newHeight);
    
      for (let y = 0; y < newHeight; y++) {
        for (let x = 0; x < newWidth; x++) {
          // Вычисляем координаты ближайшего пикселя в исходном изображении
          const gx = Math.round((x + 0.5) * width / newWidth - 0.5);
          const gy = Math.round((y + 0.5) * height / newHeight - 0.5);
          
          // Ограничиваем координаты границами изображения
          const sourceX = Math.max(0, Math.min(gx, width - 1));
          const sourceY = Math.max(0, Math.min(gy, height - 1));
          
          const srcIndex = 4 * (sourceY * width + sourceX);
          const destIndex = 4 * (y * newWidth + x);
          
          // Копируем все каналы (RGBA)
          for (let channel = 0; channel < 4; channel++) {
            newImageData.data[destIndex + channel] = data[srcIndex + channel] || 0;
          }
        }
      }
    
      return newImageData;
    }
    
    export { bilinearInterpolation, bicubicInterpolation, nearestNeighborInterpolation };

    // 123