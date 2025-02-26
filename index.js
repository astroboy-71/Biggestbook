const axios = require('axios');  
const fs = require('fs');  
const path = require('path');

const BASE_URL = "https://api.essendant.com/digital/digitalservices/search/v2";  
const MAIN_PRODUCT_URL = `${BASE_URL}/search?fc=90298&cr=1&rs=24&st=BM&cmt=ALT&vc=n`;  
const ITEM_DETAIL_URL = `${BASE_URL}/items?&vc=n&sgs=Simple&win={SKU}&re=Detail`;  

// Common headers for all requestsaad
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

// Function to fetch main product list and extract SKUs  
async function fetchAllProductSKUs() {  
    try {  
        const response = await axios.get(MAIN_PRODUCT_URL, {  
            headers: {  
                ...COMMON_HEADERS,  
                'Content-Type': 'application/json;charset=UTF-8',  
            }  
        });  
        const products = response.data.searchResult.products;  

        if (!products || products.length === 0) {  
            console.log("No products found.");  
            return [];  
        }  
 
        return products.map(product => product.win); // Extract SKU numbers  
    } catch (error) {  
        console.error("Error fetching product SKUs:", error.message);  
        return [];  
    }  
}  

// Function to ensure URL has https://
function formatImageUrl(url) {
    if (!url || url === "N/A") return "N/A";
    return url.startsWith("//") ? "https:" + url : url;
}

// Function to fetch product details by SKU  
async function fetchProductDetails(sku) {  
    try {  
        const response = await axios.get(ITEM_DETAIL_URL.replace("{SKU}", sku), {  
            headers: COMMON_HEADERS
        });  
        const itemData = response.data.items[0];  

        if (!itemData) {  
            console.log(`No details found for SKU: ${sku}`);  
            return null;  
        }  

        // Extract and format the necessary details  
        const productData = {  
            productName: itemData.description || "N/A",  
            brandName: itemData.brand?.description || "N/A",  
            sku: itemData.win || "N/A",  
            upcCode: itemData.upc || "N/A",  
            globalProductType: itemData.attributes?.find(attr => attr.name === "Global Product Type")?.value || "N/A",  
            fullDescription: itemData.sellingCopy || (itemData.sellingPoints ? itemData.sellingPoints.join(" ") : "N/A"),  
            listPrice: itemData.listPrice ? `$${itemData.listPrice.toFixed(2)}/${itemData.uom}` : "N/A",  
            categories: extractCategories(itemData.categoryBreadcrumb),  
            attributes: extractAttributes(itemData.attributes)
        };  

        // Create separate image data object with https URLs
        const imageData = {
            sku: itemData.win || "N/A",
            productName: itemData.description || "N/A",
            image: {
                url: formatImageUrl(itemData.image?.url)
            },
            moreImages: (itemData.moreImages || []).map(img => ({
                url: formatImageUrl(img.url)
            }))
        };

        return { productData, imageData };  
    } catch (error) {  
        console.error(`Error fetching details for SKU ${sku}:`, error.message);  
        return null;  
    }  
}  

// Extract categories (Primary, Subcategory, and Deeper Categories)  
function extractCategories(categoryBreadcrumb) {  
    if (!categoryBreadcrumb || categoryBreadcrumb.length === 0) return "N/A";  

    let categories = [];  
    for (const cat of categoryBreadcrumb) {  
        let primary = cat.description;  
        let subCategories = cat.subCategories?.map(sub => sub.description);  
        let deeperCategories = (subCategories || []).flatMap(subCat =>   
            cat.subCategories?.find(sub => sub.description === subCat)?.subCategories?.map(deep => deep.description) || []  
        );  

        categories.push({  
            primaryCategory: primary,  
            subCategory: subCategories?.[0] || "N/A",  
            deeperCategory: deeperCategories?.[0] || "N/A"  
        });  
    }  

    return categories;  
}  

// Extract all provided attributes as key-value pairs  
function extractAttributes(attributes) {  
    if (!attributes || attributes.length === 0) return [];  

    return attributes.map(attr => ({  
        name: attr.name,  
        value: attr.value  
    }));  
}  

// Function to ensure directory exists
function ensureDirectoryExists(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
}

// Function to remove existing files if they exist
function removeExistingFiles() {
    const dataDir = 'data';
    ensureDirectoryExists(dataDir);
    
    const files = ['product_data.json', 'image_data.json'];
    files.forEach(file => {
        const filePath = path.join(dataDir, file);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`Removed existing ${file}`);
            } catch (err) {
                console.error(`Error removing ${file}:`, err.message);
            }
        }
    });
}

// Main Scraping Process  
async function scrapeProducts() {  
    // Remove existing files before starting
    removeExistingFiles();
    
    console.log("Fetching product SKUs...");  
    const skus = await fetchAllProductSKUs();  

    if (skus.length === 0) {  
        console.log("No SKUs to process.");  
        return;  
    }  

    console.log(`Found ${skus.length} SKUs. Fetching product details...`);  
    let productData = [];
    let imageData = [];  

    for (const sku of skus) {  
        const result = await fetchProductDetails(sku);  
        if (result) {
            productData.push(result.productData);
            imageData.push(result.imageData);
        }  
    }  

    // Add count information to the JSON files
    const productDataWithCount = {
        totalItems: productData.length,
        products: productData
    };

    const imageDataWithCount = {
        totalItems: imageData.length,
        images: imageData
    };

    // Create data directory if it doesn't exist
    const dataDir = 'data';
    ensureDirectoryExists(dataDir);

    // Save to separate JSON files in the data directory
    fs.writeFileSync(path.join(dataDir, 'product_data.json'), JSON.stringify(productDataWithCount, null, 2));
    fs.writeFileSync(path.join(dataDir, 'image_data.json'), JSON.stringify(imageDataWithCount, null, 2));  
    console.log("Scraping completed. Data saved to 'data/product_data.json' and 'data/image_data.json'.");  
}  

// Run the scraping process  
scrapeProducts();