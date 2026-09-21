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

/**
 * Reads a payment receipt into a data URL + mime pair for API upload.
 * PDFs are passed through untouched; images are downscaled to keep the
 * stored payload small while staying legible for reviewers.
 */
export function receiptFileToDataUrl(file, { maxSize = 1600, quality = 0.85 } = {}) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error("No file selected."));
            return;
        }
        const isPdf = file.type === "application/pdf";
        const isImage = file.type?.startsWith("image/");
        if (!isPdf && !isImage) {
            reject(new Error("Please choose a PNG, JPG, WebP image, or a PDF receipt."));
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read the file."));
        reader.onload = () => {
            if (isPdf) {
                resolve({ dataUrl: String(reader.result || ""), mime: file.type });
                return;
            }
            const img = new Image();
            img.onerror = () => reject(new Error("Could not load the image."));
            img.onload = () => {
                const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                const width = Math.max(1, Math.round(img.width * scale));
                const height = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext("2d");
                context.drawImage(img, 0, 0, width, height);
                resolve({ dataUrl: canvas.toDataURL("image/webp", quality), mime: "image/webp" });
            };
            img.src = String(reader.result || "");
        };
        reader.readAsDataURL(file);
    });
}
