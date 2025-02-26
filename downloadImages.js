const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Function to create directory if it doesn't exist
function ensureDirectoryExists(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
}

// Function to download an image
async function downloadImage(url, filepath) {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(filepath);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        console.error(`Error downloading image from ${url}:`, error.message);
    }
}

// Main function to process the JSON and download images
async function downloadAllImages() {
    try {
        // Read the JSON file
        const jsonData = JSON.parse(fs.readFileSync('data/image_data.json', 'utf8'));
        const baseDir = 'downloaded_images';
        ensureDirectoryExists(baseDir);

        // Process each product
        for (const product of jsonData.images) {
            const productDir = path.join(baseDir, `${product.sku}_${product.productName.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 50)}`);
            const mainImageDir = path.join(productDir, 'main_image');
            const additionalImagesDir = path.join(productDir, 'additional_images');

            // Create directories
            ensureDirectoryExists(productDir);
            ensureDirectoryExists(mainImageDir);
            ensureDirectoryExists(additionalImagesDir);

            // Download main image
            if (product.image && product.image.url) {
                const mainImageFilename = path.join(mainImageDir, `main_${path.basename(product.image.url)}`);
                console.log(`Downloading main image for ${product.sku}...`);
                await downloadImage(product.image.url, mainImageFilename);
            }

            // Download additional images
            if (product.moreImages && product.moreImages.length > 0) {
                for (let i = 0; i < product.moreImages.length; i++) {
                    const additionalImage = product.moreImages[i];
                    const additionalImageFilename = path.join(additionalImagesDir, `additional_${i + 1}_${path.basename(additionalImage.url)}`);
                    console.log(`Downloading additional image ${i + 1} for ${product.sku}...`);
                    await downloadImage(additionalImage.url, additionalImageFilename);
                }
            }

            console.log(`Completed downloading images for ${product.sku}`);
        }

        console.log('All images have been downloaded successfully!');
    } catch (error) {
        console.error('Error processing images:', error.message);
    }
}

// Add delay between requests to avoid overwhelming the server
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the download process
downloadAllImages(); 