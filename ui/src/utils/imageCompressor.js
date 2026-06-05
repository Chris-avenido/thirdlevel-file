/**
 * Compresses an image file client-side before upload using an HTML5 Canvas.
 * @param {File} file The original image file
 * @param {number} targetSize The max dimension (width or height) in pixels
 * @param {number} quality The JPEG quality factor (0 to 1)
 * @returns {Promise<File>} The compressed image file as a JPEG
 */
export const compressImageClientSide = (file, targetSize = 196, quality = 0.85) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width;
                let h = img.height;
                
                if (w > h) {
                    if (w > targetSize) { h = Math.round(h * targetSize / w); w = targetSize; }
                } else {
                    if (h > targetSize) { w = Math.round(w * targetSize / h); h = targetSize; }
                }
                
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }));
                    } else {
                        resolve(file);
                    }
                }, 'image/jpeg', quality);
            };
            img.onerror = () => resolve(file);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
};
