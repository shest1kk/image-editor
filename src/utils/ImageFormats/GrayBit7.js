/**
 * GrayBit-7 Format Handler
 * Образовательный формат изображений в оттенках серого без сжатия
 * 
 * Структура файла:
 * - Сигнатура: 0x47 0x42 0x37 0x1D ("GB7·")
 * - Версия: 1 байт (текущая 0x01)
 * - Флаг: 1 байт (бит 0 - флаг маски)
 * - Ширина: 2 байта (big-endian)
 * - Высота: 2 байта (big-endian)
 * - Резерв: 2 байта (0x0000)
 * - Данные: W×H байт (7 бит серого + 1 бит маски)
 */

export class GrayBit7Handler {
    static SIGNATURE = [0x47, 0x42, 0x37, 0x1D]; // "GB7·"
    static VERSION = 0x01;
    static HEADER_SIZE = 12;

    /**
     * Проверяет, является ли файл форматом GrayBit-7
     * @param {ArrayBuffer} buffer - Буфер данных файла
     * @returns {boolean} - true, если файл является GrayBit-7
     */
    static isGrayBit7(buffer) {
        if (buffer.byteLength < this.HEADER_SIZE) {
            return false;
        }

        const view = new Uint8Array(buffer);
        
        // Проверяем сигнатуру
        for (let i = 0; i < this.SIGNATURE.length; i++) {
            if (view[i] !== this.SIGNATURE[i]) {
                return false;
            }
        }

        return true;
    }

    /**
     * Декодирует изображение GrayBit-7 в ImageData
     * @param {ArrayBuffer} buffer - Буфер данных файла
     * @returns {Object} - Объект с ImageData и метаданными
     */
    static decode(buffer) {
        if (!this.isGrayBit7(buffer)) {
            throw new Error('Неверная сигнатура файла GrayBit-7');
        }

        const view = new Uint8Array(buffer);
        const dataView = new DataView(buffer);

        // Читаем заголовок
        const version = view[4];
        const flags = view[5];
        const hasMask = (flags & 0x01) !== 0;
        const width = dataView.getUint16(6, false); // big-endian
        const height = dataView.getUint16(8, false); // big-endian
        const reserved = dataView.getUint16(10, false);

        console.log('GrayBit-7 декодирование:', { version, flags, hasMask, width, height, reserved });

        if (version !== this.VERSION) {
            throw new Error(`Неподдерживаемая версия GrayBit-7: ${version}`);
        }

        const expectedDataSize = width * height;
        const actualDataSize = buffer.byteLength - this.HEADER_SIZE;

        if (actualDataSize < expectedDataSize) {
            throw new Error(`Недостаточно данных изображения. Ожидается: ${expectedDataSize}, получено: ${actualDataSize}`);
        }

        // Создаем ImageData
        const imageData = new ImageData(width, height);
        const pixels = imageData.data;

        // Декодируем пиксели
        for (let i = 0; i < width * height; i++) {
            const pixelByte = view[this.HEADER_SIZE + i];
            
            // Извлекаем 7-битное значение серого (биты 0-6)
            const grayValue = pixelByte & 0x7F; // маска 0111 1111
            
            // Извлекаем бит маски (бит 7)
            const maskBit = (pixelByte & 0x80) !== 0; // маска 1000 0000
            
            // Преобразуем 7-битное значение в 8-битное (0-127 → 0-255)
            const grayValue8Bit = Math.round((grayValue / 127) * 255);
            
            // Устанавливаем RGBA значения
            const pixelIndex = i * 4;
            pixels[pixelIndex] = grayValue8Bit;     // R
            pixels[pixelIndex + 1] = grayValue8Bit; // G
            pixels[pixelIndex + 2] = grayValue8Bit; // B
            
            // Альфа-канал зависит от маски
            if (hasMask) {
                pixels[pixelIndex + 3] = maskBit ? 255 : 0; // Непрозрачный если maskBit = 1
            } else {
                pixels[pixelIndex + 3] = 255; // Полностью непрозрачный
            }
        }

        return {
            imageData,
            metadata: {
                format: 'GrayBit-7',
                version,
                hasMask,
                width,
                height,
                originalSize: buffer.byteLength
            }
        };
    }

    /**
     * Кодирует ImageData в формат GrayBit-7
     * @param {ImageData} imageData - Данные изображения
     * @param {boolean} includeMask - Включать ли информацию о маске
     * @returns {ArrayBuffer} - Закодированные данные
     */
    static encode(imageData, includeMask = false) {
        const { width, height, data } = imageData;
        
        // Создаем буфер: заголовок + данные
        const bufferSize = this.HEADER_SIZE + (width * height);
        const buffer = new ArrayBuffer(bufferSize);
        const view = new Uint8Array(buffer);
        const dataView = new DataView(buffer);

        // Записываем заголовок
        // Сигнатура
        view.set(this.SIGNATURE, 0);
        
        // Версия
        view[4] = this.VERSION;
        
        // Флаг (бит 0 = флаг маски)
        view[5] = includeMask ? 0x01 : 0x00;
        
        // Ширина и высота (big-endian)
        dataView.setUint16(6, width, false);
        dataView.setUint16(8, height, false);
        
        // Резерв
        dataView.setUint16(10, 0x0000, false);

        // Кодируем пиксели
        for (let i = 0; i < width * height; i++) {
            const pixelIndex = i * 4;
            
            // Получаем значения RGBA
            const r = data[pixelIndex];
            const g = data[pixelIndex + 1];
            const b = data[pixelIndex + 2];
            const a = data[pixelIndex + 3];
            
            // Преобразуем в градации серого (простое усреднение)
            const gray = Math.round((r + g + b) / 3);
            
            // Преобразуем 8-битное значение в 7-битное (0-255 → 0-127)
            const gray7Bit = Math.round((gray / 255) * 127);
            
            // Определяем бит маски
            let pixelByte = gray7Bit & 0x7F; // Устанавливаем младшие 7 битов
            
            if (includeMask) {
                // Устанавливаем старший бит в зависимости от альфа-канала
                const maskBit = a > 127 ? 1 : 0; // Порог прозрачности
                pixelByte |= (maskBit << 7);
            }
            
            view[this.HEADER_SIZE + i] = pixelByte;
        }

        return buffer;
    }

    /**
     * Создает URL для скачивания файла GrayBit-7
     * @param {ArrayBuffer} buffer - Закодированные данные
     * @param {string} filename - Имя файла
     * @returns {string} - URL для скачивания
     */
    static createDownloadURL(buffer, filename = 'image.gb7') {
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        return URL.createObjectURL(blob);
    }

    /**
     * Получает информацию о файле GrayBit-7
     * @param {ArrayBuffer} buffer - Буфер данных файла
     * @returns {Object} - Информация о файле
     */
    static getFileInfo(buffer) {
        if (!this.isGrayBit7(buffer)) {
            return null;
        }

        const view = new Uint8Array(buffer);
        const dataView = new DataView(buffer);

        return {
            format: 'GrayBit-7',
            version: view[4],
            hasMask: (view[5] & 0x01) !== 0,
            width: dataView.getUint16(6, false),
            height: dataView.getUint16(8, false),
            fileSize: buffer.byteLength,
            dataSize: buffer.byteLength - this.HEADER_SIZE
        };
    }
}

export default GrayBit7Handler;
