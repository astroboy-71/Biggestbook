const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

// Function to download a single PDF
function downloadPDF(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        
        https.get(url, response => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve();
            });

            file.on('error', err => {
                fs.unlink(filepath, () => reject(err));
            });
        }).on('error', err => {
            fs.unlink(filepath, () => reject(err));
        });
    });
}

// Function to save progress
function saveProgress(remainingUrls) {
    const progressPath = path.join(os.homedir(), 'Documents', 'LBT', 'download_progress.json');
    fs.writeFileSync(progressPath, JSON.stringify(remainingUrls, null, 2));
}

// Main function to handle the download process
async function downloadAllPDFs() {
    try {
        // Create LBT directory in Documents folder
        const documentsPath = path.join(os.homedir(), 'Documents');
        const lbtFolder = path.join(documentsPath, 'LBT');
        const progressPath = path.join(lbtFolder, 'download_progress.json');

        // Create directory if it doesn't exist
        if (!fs.existsSync(lbtFolder)) {
            fs.mkdirSync(lbtFolder, { recursive: true });
            console.log(`Created directory: ${lbtFolder}`);
        }

        // Initialize or load remaining URLs
        let remainingUrls;
        if (fs.existsSync(progressPath)) {
            remainingUrls = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
            console.log('Resuming from previous progress...');
        } else {
            remainingUrls = JSON.parse(fs.readFileSync('LBT.json', 'utf8'));
        }

        const totalFiles = Object.keys(remainingUrls).length;
        console.log(`Found ${totalFiles} PDF files to process`);

        // Process each PDF
        let index = 0;
        for (const [itemNumber, url] of Object.entries({...remainingUrls})) {
            index++;
            const pdfFilename = `${itemNumber}.pdf`;
            const pdfPath = path.join(lbtFolder, pdfFilename);

            // Skip if file already exists
            if (fs.existsSync(pdfPath)) {
                console.log(`[${index}/${totalFiles}] ${pdfFilename} already exists, skipping...`);
                delete remainingUrls[itemNumber];
                saveProgress(remainingUrls);
                continue;
            }

            try {
                console.log(`[${index}/${totalFiles}] Downloading ${pdfFilename}...`);
                await downloadPDF(url, pdfPath);
                console.log(`✓ Successfully downloaded ${pdfFilename}`);

                // Remove downloaded file from remaining URLs and save progress
                delete remainingUrls[itemNumber];
                saveProgress(remainingUrls);

                // Add a small delay to be nice to the server
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`✗ Error downloading ${pdfFilename}:`, error.message);
                // Save progress even if there's an error
                saveProgress(remainingUrls);
            }
        }

        // If all downloads are complete, remove the progress file
        if (Object.keys(remainingUrls).length === 0) {
            fs.unlinkSync(progressPath);
            console.log('\nAll downloads completed successfully!');
        } else {
            console.log('\nDownload process completed with some files remaining.');
            console.log('You can run the script again to retry failed downloads.');
        }

    } catch (error) {
        console.error('An error occurred:', error.message);
    }
}

// Start the download process
console.log("Starting PDF download process...");
downloadAllPDFs();