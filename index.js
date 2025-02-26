const axios = require('axios');  
const fs = require('fs');  
const path = require('path');

const BASE_URL = "https://api.essendant.com/digital/digitalservices/search/v2";  
const ITEM_DETAIL_URL = `${BASE_URL}/items?&vc=n&sgs=Simple&win={SKU}&re=Detail`;  
const PRODUCTS_PER_PAGE = 24;

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

// Function to read category data from text file
function readCategoryData(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const categories = [];
        
        // Split by lines and process each line
        const lines = data.trim().split('\n');
        for (const line of lines) {
            const [categoryNumber, totalProducts] = line.trim().split(',').map(item => item.trim());
            if (categoryNumber && totalProducts) {
                categories.push({
                    categoryNumber,
                    totalProducts: parseInt(totalProducts)
                });
            }
        }
        return categories;
    } catch (error) {
        console.error("Error reading category data:", error.message);
        return [];
    }
}

// Function to generate URLs for a category based on total products
function generateCategoryUrls(categoryNumber, totalProducts) {
    const urls = [];
    const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE);

    for (let page = 0; page < totalPages; page++) {
        const startProduct = page * PRODUCTS_PER_PAGE + 1;
        const url = `${BASE_URL}/search?fc=${categoryNumber}&cr=${startProduct}&rs=${PRODUCTS_PER_PAGE}&st=BM&cmt=ALT&vc=n`;
        urls.push(url);
    }

    return urls;
}

// Modified fetchAllProductSKUs to handle paginated URLs
async function fetchAllProductSKUs(categoryUrls, categoryNumber) {
    let allSKUs = [];

    for (const [index, url] of categoryUrls.entries()) {
        try {
            console.log(`Fetching page ${index + 1} for category ${categoryNumber}...`);
            
            const response = await axios.get(url, {
                headers: {
                    ...COMMON_HEADERS,
                    'Content-Type': 'application/json;charset=UTF-8',
                }
            });

            const products = response.data.searchResult.products;
            if (products && products.length > 0) {
                allSKUs.push(...products.map(product => product.win));
            }

            // Add a small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`Error fetching page ${index + 1} for category ${categoryNumber}:`, error.message);
        }
    }

    return allSKUs;
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
            })),
            categoryNumber: itemData.attributes?.find(attr => attr.name === "Category Number")?.value || "N/A"
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

// Modified main scraping function to handle multiple categories
async function scrapeProducts() {
    // Remove existing files before starting
    removeExistingFiles();

    // Read category data from file
    const categories = readCategoryData('categories.txt');
    if (categories.length === 0) {
        console.log("No categories found in categories.txt");
        return;
    }

    let allProductData = [];
    let allImageData = [];

    // Process each category
    for (const category of categories) {
        console.log(`Processing category ${category.categoryNumber} (${category.totalProducts} products)...`);
        
        // Generate URLs for this category
        const categoryUrls = generateCategoryUrls(category.categoryNumber, category.totalProducts);
        
        // Fetch all SKUs for this category
        const skus = await fetchAllProductSKUs(categoryUrls, category.categoryNumber);
        console.log(`Found ${skus.length} SKUs in category ${category.categoryNumber}`);

        // Fetch details for each SKU
        for (const sku of skus) {
            const result = await fetchProductDetails(sku);
            if (result) {
                // Add category information to the data
                result.productData.categoryNumber = category.categoryNumber;
                result.imageData.categoryNumber = category.categoryNumber;
                
                allProductData.push(result.productData);
                allImageData.push(result.imageData);
            }
            
            // Add a small delay between SKU requests
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // Save all data
    const productDataWithCount = {
        totalItems: allProductData.length,
        products: allProductData
    };

    const imageDataWithCount = {
        totalItems: allImageData.length,
        images: allImageData
    };

    // Save to JSON files
    const dataDir = 'data';
    ensureDirectoryExists(dataDir);
    fs.writeFileSync(path.join(dataDir, 'product_data.json'), JSON.stringify(productDataWithCount, null, 2));
    fs.writeFileSync(path.join(dataDir, 'image_data.json'), JSON.stringify(imageDataWithCount, null, 2));
    
    console.log("Scraping completed. Data saved to 'data/product_data.json' and 'data/image_data.json'.");
}

// Run the scraping process
scrapeProducts();