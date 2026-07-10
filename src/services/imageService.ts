export const compressImage = async (file: File, maxSizeMB: number = 1): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas context not available');
        let width = img.width;
        let height = img.height;
        const maxDimension = 800;
        if (width > height) {
          if (width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        const mimeType = 'image/webp';
        let quality = 0.8;
        let dataUrl = canvas.toDataURL(mimeType, quality);
        
        while (dataUrl.length > 700000 && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL(mimeType, quality);
        }
        
        resolve(dataUrl);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};
