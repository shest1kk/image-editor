    // Start of Selection
    function bilinearInterpolation(imageData, newWidth, newHeight) {
      const { width, height, data } = imageData;
      const newImageData = new ImageData(newWidth, newHeight);
    
      for (let y = 0; y < newHeight; y++) {
        for (let x = 0; x < newWidth; x++) {
          const gx = (x / newWidth) * (width - 1);
          const gy = (y / newHeight) * (height - 1);
          const gxi = Math.floor(gx);
          const gyi = Math.floor(gy);
          
          for (let channel = 0; channel < 4; channel++) {
            const a = data[4 * (gyi * width + gxi) + channel];
            const b = data[4 * (gyi * width + Math.min(gxi + 1, width - 1)) + channel];
            const c = data[4 * (Math.min(gyi + 1, height - 1) * width + gxi) + channel];
            const d = data[4 * (Math.min(gyi + 1, height - 1) * width + Math.min(gxi + 1, width - 1)) + channel];
            
            const value = (a * (1 - (gx - gxi)) * (1 - (gy - gyi)) +
                           b * (gx - gxi) * (1 - (gy - gyi)) +
                           c * (1 - (gx - gxi)) * (gy - gyi) +
                           d * (gx - gxi) * (gy - gyi));
            
            newImageData.data[4 * (y * newWidth + x) + channel] = value;
          }
        }
      }
    
      return newImageData;
    }
    
    function bicubicInterpolation(imageData, newWidth, newHeight) {
      const { width, height, data } = imageData;
      const newImageData = new ImageData(newWidth, newHeight);
    
      function cubic(x) {
        const abs = Math.abs(x);
        if (abs >= 0 && abs < 1) {
          return 1.5 * abs ** 3 - 2.5 * abs ** 2 + 1;
        } else if (abs >= 1 && abs < 2) {
          return -0.5 * abs ** 3 + 2.5 * abs ** 2 - 4 * abs + 2;
        }
        return 0;
      }
    
      for (let y = 0; y < newHeight; y++) {
        for (let x = 0; x < newWidth; x++) {
          const gx = (x / newWidth) * (width - 1);
          const gy = (y / newHeight) * (height - 1);
          const gxi = Math.floor(gx);
          const gyi = Math.floor(gy);
    
          for (let channel = 0; channel < 4; channel++) {
            let sum = 0;
            let weightSum = 0;
    
            for (let i = -1; i <= 2; i++) {
              for (let j = -1; j <= 2; j++) {
                const xi = Math.min(Math.max(gxi + i, 0), width - 1);
                const yi = Math.min(Math.max(gyi + j, 0), height - 1);
                const weight = cubic(gx - xi) * cubic(gy - yi);
                sum += data[4 * (yi * width + xi) + channel] * weight;
                weightSum += weight;
              }
            }
    
            newImageData.data[4 * (y * newWidth + x) + channel] = sum / weightSum;
          }
        }
      }
    
      return newImageData;
    }
    
    function nearestNeighborInterpolation(imageData, newWidth, newHeight) {
      const { width, height, data } = imageData;
      const newImageData = new ImageData(newWidth, newHeight);
    
      for (let y = 0; y < newHeight; y++) {
        for (let x = 0; x < newWidth; x++) {
          const gx = Math.round((x / newWidth) * (width - 1));
          const gy = Math.round((y / newHeight) * (height - 1));
          const srcIndex = 4 * (gy * width + gx);
          const destIndex = 4 * (y * newWidth + x);
          for (let channel = 0; channel < 4; channel++) {
            newImageData.data[destIndex + channel] = data[srcIndex + channel];
          }
        }
      }
    
      return newImageData;
    }
    
    export { bilinearInterpolation, bicubicInterpolation, nearestNeighborInterpolation };

    // 123