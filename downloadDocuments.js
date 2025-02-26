const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Constants
const BASE_URL = "https://api.essendant.com/digital/digitalservices/search/v2";
const MSDS_URL = `${BASE_URL}/msds`;
const PDF_BASE_URL = "https://content.oppictures.com/Master_Images/Master_PDF_Files";
const SDS_DIR = 'documents/SDS';

// Common headers for all requests
const COMMON_HEADERS = {
    'accept': 'application/json, text/plain, */*',
    'accept-encoding': 'gzip, deflate, br, zstd',
    'accept-language': 'en-US,en;q=0.9',
    'connection': 'keep-alive',
    'host': 'api.essendant.com',
    'origin': 'https://www.biggestbook.com',
    'referer': 'https://www.biggestbook.com/',
    'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    'x-api-key': '31BC6E02FD51DF7F7CE37186A31EE9B9DEF9C642526BC29F8201D81B669B9'
};

// Function to ensure SDS directory exists
function ensureSDSDirectoryExists() {
    const documentsDir = 'documents';
    const sdsDir = path.join(documentsDir, 'SDS');
    
    // Create both directories if they don't exist
    if (!fs.existsSync(documentsDir)) {
        fs.mkdirSync(documentsDir);
        console.log('Created documents directory');
    }
    
    if (!fs.existsSync(sdsDir)) {
        fs.mkdirSync(sdsDir);
        console.log('Created SDS directory');
    }
}

// Function to download PDF
async function downloadPDF(pdfUrl, filePath) {
    try {
        const response = await axios({
            url: pdfUrl,
            method: 'GET',
            responseType: 'stream',
            timeout: 10000 // 10 second timeout
        });

        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(filePath, { flags: 'w' });
            
            writer.on('error', (err) => {
                console.error(`Error writing file: ${err.message}`);
                writer.end();
                reject(err);
            });

            writer.on('finish', () => {
                resolve();
            });

            response.data.pipe(writer);
        });
    } catch (error) {
        throw new Error(`Failed to download PDF: ${error.message}`);
    }
}

// Function to fetch SDS documents for a SKU
async function fetchSDSDocuments(sku) {
    try {
        const response = await axios.get(`${MSDS_URL}?q=${sku}&matchMode=AND&rows=30&start=0&vc=n`, {
            headers: COMMON_HEADERS
        });

        return response.data.docs || [];
    } catch (error) {
        console.error(`Error fetching SDS documents for SKU ${sku}:`, error.message);
        return [];
    }
}

// Main function to process products and download documents
async function downloadAllDocuments() {
    try {
        // Create SDS directory if it doesn't exist
        ensureSDSDirectoryExists();

        // Read the product data JSON file
        const productData = JSON.parse(fs.readFileSync('data/product_data.json', 'utf8'));
        
        console.log('Starting document downloads...');
        let downloadCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // Process each product
        for (const product of productData.products) {
            const sku = product.sku;
            console.log(`Checking SKU: ${sku}`);

            try {
                // Fetch SDS documents
                const sdsDocuments = await fetchSDSDocuments(sku);

                if (sdsDocuments.length === 0) {
                    console.log(`No SDS documents found for SKU: ${sku}`);
                    skippedCount++;
                    continue;
                }

                // Download each SDS document
                for (const doc of sdsDocuments) {
                    if (doc.msdsPdfName) {
                        const pdfUrl = `${PDF_BASE_URL}/${doc.msdsPdfName}`;
                        const pdfPath = path.join(process.cwd(), SDS_DIR, doc.msdsPdfName);
                        
                        try {
                            console.log(`Downloading SDS document: ${doc.msdsPdfName}`);
                            await downloadPDF(pdfUrl, pdfPath);
                            console.log(`Successfully downloaded: ${doc.msdsPdfName}`);
                            downloadCount++;
                        } catch (downloadError) {
                            console.error(`Failed to download ${doc.msdsPdfName}: ${downloadError.message}`);
                            errorCount++;
                        }

                        // Add a small delay between downloads
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            } catch (skuError) {
                console.error(`Error processing SKU ${sku}: ${skuError.message}`);
                errorCount++;
            }
        }

        console.log('\nDownload Summary:');
        console.log(`Total products processed: ${productData.products.length}`);
        console.log(`Documents downloaded: ${downloadCount}`);
        console.log(`Products without SDS: ${skippedCount}`);
        console.log(`Failed downloads: ${errorCount}`);
        console.log('Process completed!');
    } catch (error) {
        console.error('Error processing documents:', error.message);
    }
}

// Run the download process
downloadAllDocuments(); 