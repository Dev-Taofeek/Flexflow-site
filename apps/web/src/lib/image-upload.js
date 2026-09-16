export function imageFileToLogoDataUrl(file, { maxSize = 256, quality = 0.82 } = {}) {
    return new Promise((resolve, reject) => {
        if (!file?.type?.startsWith("image/")) {
            reject(new Error("Please choose a PNG, JPG, or WebP image."));
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read the image file."));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error("Could not load the image file."));
            img.onload = () => {
                const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                const width = Math.max(1, Math.round(img.width * scale));
                const height = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;

                const context = canvas.getContext("2d");
                context.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/webp", quality));
            };
            img.src = String(reader.result || "");
        };
        reader.readAsDataURL(file);
    });
}
