// Функция для добавления отступа к изображению
export default function addPadding(data, width, height) {
  // Вычисляем новые размеры с учетом отступа в 1 пиксель со всех сторон
  const widthPadding = width + 2;
  const heightPadding = height + 2;
  // Создаем новый массив для хранения данных изображения с отступом
  const newData = new Uint8ClampedArray(widthPadding * heightPadding * 4);

  // Копируем исходное изображение в центр нового массива
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inp = (y * width + x) * 4;
      const out = ((y + 1) * widthPadding + (x + 1)) * 4;
      newData.set(data.subarray(inp, inp + 4), out);
    }
  }

  // Заполняем отступы, используя ближайшие пиксели
  for (let y = 0; y < heightPadding; y++) {
    for (let x = 0; x < widthPadding; x++) {
      const out = (y * widthPadding + x) * 4;
      if (
        x === 0 ||
        x === widthPadding - 1 ||
        y === 0 ||
        y === heightPadding - 1
      ) {
        // Находим ближайший пиксель внутри изображения
        const nearX = Math.max(1, Math.min(x, widthPadding - 2));
        const nearY = Math.max(1, Math.min(y, heightPadding - 2));
        const nearIndex = (nearY * widthPadding + nearX) * 4;
        // Копируем значение ближайшего пикселя в отступ
        newData.set(newData.subarray(nearIndex, nearIndex + 4), out);
      }
    }
  }

  return newData;
}

// Этот компонент нужен для добавления отступа к изображению.
// Он создает новый массив данных изображения с дополнительным
// однопиксельным отступом со всех сторон. Отступ заполняется
// значениями ближайших пикселей исходного изображения. Это может
// быть полезно для обработки изображений, где требуется доступ
// к соседним пикселям, в том числе на границах изображения.
