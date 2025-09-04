/**
 * Утилиты для анализа глубины цвета изображения
 */

export class ColorDepthAnalyzer {
    
    /**
     * Анализирует глубину цвета изображения
     * @param {HTMLImageElement|HTMLCanvasElement} imageSource - Источник изображения
     * @returns {Object} - Информация о глубине цвета
     */
    static analyzeColorDepth(imageSource) {
        try {
            // Создаем временный canvas для анализа
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let width, height;
            
            if (imageSource instanceof HTMLImageElement) {
                width = imageSource.naturalWidth || imageSource.width;
                height = imageSource.naturalHeight || imageSource.height;
            } else if (imageSource instanceof HTMLCanvasElement) {
                width = imageSource.width;
                height = imageSource.height;
            } else {
                throw new Error('Неподдерживаемый тип источника изображения');
            }
            
            // Ограничиваем размер для анализа (для производительности)
            const maxSampleSize = 200;
            const sampleWidth = Math.min(width, maxSampleSize);
            const sampleHeight = Math.min(height, maxSampleSize);
            
            canvas.width = sampleWidth;
            canvas.height = sampleHeight;
            
            // Рисуем изображение на canvas
            ctx.drawImage(imageSource, 0, 0, sampleWidth, sampleHeight);
            
            // Получаем данные пикселей
            const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
            const data = imageData.data;
            
            return this.calculateColorDepth(data);
            
        } catch (error) {
            console.warn('Ошибка анализа глубины цвета:', error);
            return {
                bitsPerChannel: 8,
                totalBits: 24,
                hasAlpha: false,
                description: '24-bit RGB',
                detailedDescription: '8 бит на канал (RGB)'
            };
        }
    }
    
    /**
     * Вычисляет глубину цвета на основе данных пикселей
     * @param {Uint8ClampedArray} data - Данные пикселей RGBA
     * @returns {Object} - Информация о глубине цвета
     */
    static calculateColorDepth(data) {
        const uniqueValues = {
            red: new Set(),
            green: new Set(),
            blue: new Set(),
            alpha: new Set()
        };
        
        let hasTransparency = false;
        let hasPartialTransparency = false;
        
        // Анализируем образец пикселей
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            uniqueValues.red.add(r);
            uniqueValues.green.add(g);
            uniqueValues.blue.add(b);
            uniqueValues.alpha.add(a);
            
            if (a < 255) hasTransparency = true;
            if (a > 0 && a < 255) hasPartialTransparency = true;
        }
        
        // Оцениваем биты на канал
        const redBits = this.estimateBitsForChannel(uniqueValues.red.size);
        const greenBits = this.estimateBitsForChannel(uniqueValues.green.size);
        const blueBits = this.estimateBitsForChannel(uniqueValues.blue.size);
        const alphaBits = hasTransparency ? this.estimateBitsForChannel(uniqueValues.alpha.size) : 0;
        
        const maxChannelBits = Math.max(redBits, greenBits, blueBits);
        const totalBits = hasTransparency ? (maxChannelBits * 3 + alphaBits) : (maxChannelBits * 3);
        
        return {
            bitsPerChannel: maxChannelBits,
            totalBits: totalBits,
            hasAlpha: hasTransparency,
            hasPartialTransparency: hasPartialTransparency,
            description: this.getColorDepthDescription(maxChannelBits, hasTransparency, hasPartialTransparency),
            detailedDescription: this.getDetailedDescription(maxChannelBits, hasTransparency, alphaBits),
            channelStats: {
                red: { uniqueValues: uniqueValues.red.size, estimatedBits: redBits },
                green: { uniqueValues: uniqueValues.green.size, estimatedBits: greenBits },
                blue: { uniqueValues: uniqueValues.blue.size, estimatedBits: blueBits },
                alpha: { uniqueValues: uniqueValues.alpha.size, estimatedBits: alphaBits }
            }
        };
    }
    
    /**
     * Оценивает количество бит для канала на основе уникальных значений
     * @param {number} uniqueCount - Количество уникальных значений
     * @returns {number} - Оценочное количество бит
     */
    static estimateBitsForChannel(uniqueCount) {
        if (uniqueCount <= 2) return 1;
        if (uniqueCount <= 4) return 2;
        if (uniqueCount <= 8) return 3;
        if (uniqueCount <= 16) return 4;
        if (uniqueCount <= 32) return 5;
        if (uniqueCount <= 64) return 6;
        if (uniqueCount <= 128) return 7;
        return 8;
    }
    
    /**
     * Получает краткое описание глубины цвета
     * @param {number} bitsPerChannel - Биты на канал
     * @param {boolean} hasAlpha - Есть ли альфа-канал
     * @param {boolean} hasPartialTransparency - Есть ли частичная прозрачность
     * @returns {string} - Описание
     */
    static getColorDepthDescription(bitsPerChannel, hasAlpha, hasPartialTransparency) {
        const totalBits = hasAlpha ? (bitsPerChannel * 4) : (bitsPerChannel * 3);
        const alphaInfo = hasAlpha ? (hasPartialTransparency ? 'A' : 'A') : '';
        
        if (bitsPerChannel <= 1) {
            return `${totalBits}-bit Монохром${alphaInfo}`;
        } else if (bitsPerChannel <= 4) {
            return `${totalBits}-bit Индексированный${alphaInfo}`;
        } else if (bitsPerChannel === 5) {
            return hasAlpha ? '20-bit RGBA' : '15-bit RGB';
        } else if (bitsPerChannel === 6) {
            return hasAlpha ? '24-bit RGBA' : '18-bit RGB';
        } else if (bitsPerChannel === 8) {
            return hasAlpha ? '32-bit RGBA' : '24-bit RGB';
        } else {
            return `${totalBits}-bit RGB${alphaInfo}`;
        }
    }
    
    /**
     * Получает детальное описание глубины цвета
     * @param {number} bitsPerChannel - Биты на канал
     * @param {boolean} hasAlpha - Есть ли альфа-канал
     * @param {number} alphaBits - Биты альфа-канала
     * @returns {string} - Детальное описание
     */
    static getDetailedDescription(bitsPerChannel, hasAlpha, alphaBits) {
        let description = `${bitsPerChannel} бит на канал (RGB)`;
        
        if (hasAlpha) {
            description += ` + ${alphaBits} бит альфа`;
        }
        
        return description;
    }
    
    /**
     * Анализирует изображение по data URL
     * @param {string} dataURL - Data URL изображения
     * @returns {Promise<Object>} - Промис с информацией о глубине цвета
     */
    static analyzeFromDataURL(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const result = this.analyzeColorDepth(img);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
            img.src = dataURL;
        });
    }
}

export default ColorDepthAnalyzer;

