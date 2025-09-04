/**
 * Модуль для тестирования методов интерполяции
 */
import { bilinearInterpolation, bicubicInterpolation, nearestNeighborInterpolation } from './InterpolationMethods.js';

/**
 * Создает тестовое изображение с четкими краями для демонстрации качества интерполяции
 * @param {number} width - Ширина изображения
 * @param {number} height - Высота изображения
 * @returns {ImageData} Тестовое изображение
 */
export function createTestPattern(width = 100, height = 100) {
  const imageData = new ImageData(width, height);
  const data = imageData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      
      // Создаем шахматную доску с различными паттернами
      if ((Math.floor(x / 10) + Math.floor(y / 10)) % 2 === 0) {
        // Белые квадраты
        data[index] = 255;     // R
        data[index + 1] = 255; // G 
        data[index + 2] = 255; // B
        data[index + 3] = 255; // A
      } else {
        // Черные квадраты
        data[index] = 0;       // R
        data[index + 1] = 0;   // G
        data[index + 2] = 0;   // B
        data[index + 3] = 255; // A
      }
      
      // Добавляем красную полосу для проверки цветовых каналов
      if (y >= height / 2 - 5 && y <= height / 2 + 5) {
        data[index] = 255;     // R
        data[index + 1] = 0;   // G
        data[index + 2] = 0;   // B
        data[index + 3] = 255; // A
      }
      
      // Добавляем синюю диагональ
      if (Math.abs(x - y) <= 2) {
        data[index] = 0;       // R
        data[index + 1] = 0;   // G
        data[index + 2] = 255; // B
        data[index + 3] = 255; // A
      }
    }
  }

  return imageData;
}

/**
 * Тестирует все методы интерполяции и возвращает результаты
 * @param {ImageData} sourceImage - Исходное изображение
 * @param {number} newWidth - Новая ширина
 * @param {number} newHeight - Новая высота
 * @returns {Object} Объект с результатами всех методов
 */
export function testAllInterpolationMethods(sourceImage, newWidth, newHeight, verbose = false) {
  if (verbose) {
    console.log(`🧪 Тестирование интерполяции: ${sourceImage.width}x${sourceImage.height} → ${newWidth}x${newHeight}`);
  }
  
  const startTime = performance.now();
  
  // Тестируем все методы
  const results = {
    nearestNeighbor: {
      name: 'Ближайший сосед',
      startTime: performance.now()
    },
    bilinear: {
      name: 'Билинейная',
      startTime: performance.now()
    },
    bicubic: {
      name: 'Бикубическая', 
      startTime: performance.now()
    }
  };

  // Nearest Neighbor
  results.nearestNeighbor.startTime = performance.now();
  results.nearestNeighbor.result = nearestNeighborInterpolation(sourceImage, newWidth, newHeight);
  results.nearestNeighbor.time = performance.now() - results.nearestNeighbor.startTime;

  // Bilinear
  results.bilinear.startTime = performance.now();
  results.bilinear.result = bilinearInterpolation(sourceImage, newWidth, newHeight);
  results.bilinear.time = performance.now() - results.bilinear.startTime;

  // Bicubic
  results.bicubic.startTime = performance.now();
  results.bicubic.result = bicubicInterpolation(sourceImage, newWidth, newHeight);
  results.bicubic.time = performance.now() - results.bicubic.startTime;

  const totalTime = performance.now() - startTime;

  // Выводим результаты только если включен verbose режим
  if (verbose) {
    console.table({
      'Ближайший сосед': {
        'Время (мс)': results.nearestNeighbor.time.toFixed(2),
        'Размер': `${results.nearestNeighbor.result.width}x${results.nearestNeighbor.result.height}`,
        'Качество': 'Быстро, резкие края'
      },
      'Билинейная': {
        'Время (мс)': results.bilinear.time.toFixed(2),
        'Размер': `${results.bilinear.result.width}x${results.bilinear.result.height}`,
        'Качество': 'Средне, сглаженные края'
      },
      'Бикубическая': {
        'Время (мс)': results.bicubic.time.toFixed(2),
        'Размер': `${results.bicubic.result.width}x${results.bicubic.result.height}`,
        'Качество': 'Медленно, лучшее качество'
      }
    });

    console.log(`⏱️ Общее время тестирования: ${totalTime.toFixed(2)}мс`);
  }
  
  return results;
}

/**
 * Создает canvas элементы для визуального сравнения результатов
 * @param {Object} testResults - Результаты тестирования
 * @returns {Object} Объект с canvas элементами
 */
export function createVisualComparison(testResults) {
  const canvases = {};
  
  Object.keys(testResults).forEach(method => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const result = testResults[method].result;
    
    canvas.width = result.width;
    canvas.height = result.height;
    canvas.style.border = '1px solid #ccc';
    canvas.style.margin = '5px';
    canvas.title = `${testResults[method].name} (${testResults[method].time.toFixed(2)}мс)`;
    
    ctx.putImageData(result, 0, 0);
    canvases[method] = canvas;
  });
  
  return canvases;
}

/**
 * Запускает полный тест интерполяции с визуализацией
 * @param {number} sourceSize - Размер исходного изображения
 * @param {number} targetSize - Размер целевого изображения
 */
export function runInterpolationTest(sourceSize = 50, targetSize = 200, verbose = true) {
  if (verbose) {
    console.log('🚀 Запуск полного теста интерполяции...');
  }
  
  // Создаем тестовое изображение
  const testImage = createTestPattern(sourceSize, sourceSize);
  
  // Тестируем все методы
  const results = testAllInterpolationMethods(testImage, targetSize, targetSize, verbose);
  
  // Создаем визуальное сравнение
  const canvases = createVisualComparison(results);
  
  // Добавляем результаты на страницу для визуального сравнения (если в браузере)
  if (typeof document !== 'undefined') {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '10px';
    container.style.right = '10px';
    container.style.background = 'white';
    container.style.padding = '10px';
    container.style.border = '2px solid #333';
    container.style.zIndex = '10000';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    
    const title = document.createElement('h3');
    title.textContent = 'Тест интерполяции';
    title.style.margin = '0 0 10px 0';
    title.style.fontSize = '14px';
    container.appendChild(title);
    
    Object.keys(canvases).forEach(method => {
      const label = document.createElement('div');
      label.textContent = testResults[method].name;
      label.style.fontSize = '12px';
      label.style.textAlign = 'center';
      container.appendChild(label);
      container.appendChild(canvases[method]);
    });
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '5px';
    closeButton.style.right = '5px';
    closeButton.style.border = 'none';
    closeButton.style.background = 'red';
    closeButton.style.color = 'white';
    closeButton.style.cursor = 'pointer';
    closeButton.style.borderRadius = '50%';
    closeButton.style.width = '20px';
    closeButton.style.height = '20px';
    closeButton.onclick = () => document.body.removeChild(container);
    container.appendChild(closeButton);
    
    document.body.appendChild(container);
  }
  
  return { results, canvases };
}
