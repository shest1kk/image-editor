import { GrayBit7Handler } from './GrayBit7.js';

/**
 * Универсальный загрузчик изображений с поддержкой различных форматов
 */
export class ImageLoader {
    
    /**
     * Загружает изображение из файла с автоматическим определением формата
     * @param {File} file - Файл изображения
     * @returns {Promise<Object>} - Объект с данными изображения и метаданными
     */
    static async loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    const result = await this.processFileData(event.target.result, file.name, file.type);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            
            // Определяем, как читать файл по расширению
            const extension = this.getFileExtension(file.name).toLowerCase();
            
            if (extension === 'gb7') {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsDataURL(file);
            }
        });
    }

    /**
     * Обрабатывает данные файла в зависимости от формата
     * @param {ArrayBuffer|string} data - Данные файла
     * @param {string} filename - Имя файла
     * @param {string} mimeType - MIME тип файла
     * @returns {Promise<Object>} - Объект с данными изображения
     */
    static async processFileData(data, filename, mimeType) {
        const extension = this.getFileExtension(filename).toLowerCase();
        
        if (extension === 'gb7') {
            return this.loadGrayBit7(data);
        } else {
            return this.loadStandardImage(data);
        }
    }

    /**
     * Загружает изображение GrayBit-7
     * @param {ArrayBuffer} buffer - Буфер данных файла
     * @returns {Promise<Object>} - Объект с данными изображения
     */
    static async loadGrayBit7(buffer) {
        try {
            const decoded = GrayBit7Handler.decode(buffer);
            
            // Преобразуем ImageData в data URL для совместимости с существующим кодом
            const canvas = document.createElement('canvas');
            canvas.width = decoded.imageData.width;
            canvas.height = decoded.imageData.height;
            
            const ctx = canvas.getContext('2d');
            ctx.putImageData(decoded.imageData, 0, 0);
            
            const dataURL = canvas.toDataURL('image/png');
            
            return {
                src: dataURL,
                format: 'GrayBit-7',
                originalFormat: 'GrayBit-7',
                metadata: decoded.metadata,
                width: decoded.imageData.width,
                height: decoded.imageData.height,
                size: buffer.byteLength,
                colorDepth: decoded.metadata.hasMask ? '8-bit Grayscale+A' : '7-bit Grayscale'
            };
        } catch (error) {
            throw new Error(`Ошибка загрузки GrayBit-7: ${error.message}`);
        }
    }

    /**
     * Загружает стандартное изображение (JPEG, PNG, etc.)
     * @param {string} dataURL - Data URL изображения
     * @returns {Promise<Object>} - Объект с данными изображения
     */
    static async loadStandardImage(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                // Определяем формат по data URL
                const format = this.getFormatFromDataURL(dataURL);
                
                resolve({
                    src: dataURL,
                    format: format,
                    originalFormat: format,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    size: this.estimateDataURLSize(dataURL)
                });
            };
            
            img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
            img.src = dataURL;
        });
    }

    /**
     * Получает расширение файла
     * @param {string} filename - Имя файла
     * @returns {string} - Расширение файла
     */
    static getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
    }

    /**
     * Определяет формат изображения по data URL
     * @param {string} dataURL - Data URL
     * @returns {string} - Формат изображения
     */
    static getFormatFromDataURL(dataURL) {
        if (dataURL.startsWith('data:image/jpeg')) return 'JPEG';
        if (dataURL.startsWith('data:image/jpg')) return 'JPEG';
        if (dataURL.startsWith('data:image/png')) return 'PNG';
        if (dataURL.startsWith('data:image/gif')) return 'GIF';
        if (dataURL.startsWith('data:image/webp')) return 'WebP';
        if (dataURL.startsWith('data:image/bmp')) return 'BMP';
        if (dataURL.startsWith('data:image/svg')) return 'SVG';
        return 'Unknown';
    }

    /**
     * Приблизительно оценивает размер data URL
     * @param {string} dataURL - Data URL
     * @returns {number} - Размер в байтах
     */
    static estimateDataURLSize(dataURL) {
        const base64Data = dataURL.split(',')[1];
        return base64Data ? Math.round(base64Data.length * 0.75) : 0;
    }

    /**
     * Проверяет, поддерживается ли формат файла
     * @param {string} filename - Имя файла
     * @returns {boolean} - true, если формат поддерживается
     */
    static isSupportedFormat(filename) {
        const extension = this.getFileExtension(filename).toLowerCase();
        const supportedExtensions = [
            'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'gb7'
        ];
        return supportedExtensions.includes(extension);
    }

    /**
     * Получает строку для атрибута accept input[type="file"]
     * @returns {string} - Строка с поддерживаемыми форматами
     */
    static getAcceptString() {
        return 'image/*,.gb7';
    }
}

export default ImageLoader;
