const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'https://qipedc.moet.gov.vn/dictionary';
const MAX_PAGES = 219;

async function scrapeMoetFinal() {
    console.log('Starting browser...');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();
    console.log(`Accessing: ${TARGET_URL}`);

    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    let allItems = [];

    for (let currentPage = 1; currentPage <= MAX_PAGES; currentPage++) {
        process.stdout.write(`\nProcessing page ${currentPage}/${MAX_PAGES}: `);

        try {
            await page.waitForSelector('a[onclick^="modalData"]', { timeout: 5000 });
        } catch (e) {
            console.log("No data found on this page.");
        }

        const pageItems = await page.evaluate(() => {
            const items = [];
            const elements = document.querySelectorAll('a[onclick^="modalData"]');

            elements.forEach((el) => {
                const onClickText = el.getAttribute('onclick');
                const parts = onClickText.match(/'([^']+)'/g);

                if (parts && parts.length >= 2) {
                    const id = parts[0].replace(/'/g, '');
                    let word = parts[1].replace(/'/g, '');
                    const videoUrl = `https://qipedc.moet.gov.vn/videos/${id}.mp4`;

                    const lastChar = id.slice(-1).toUpperCase();
                    if (lastChar === 'B') word += ' (Bắc)';
                    else if (lastChar === 'N') word += ' (Nam)';
                    else if (lastChar === 'T') word += ' (Trung)';

                    items.push({ id, word, videoUrl });
                }
            });
            return items;
        });

        console.log(`Found ${pageItems.length} words.`);
        allItems = allItems.concat(pageItems);

        if (currentPage < MAX_PAGES) {
            const nextPage = currentPage + 1;

            try {
                const selector = `button[value="${nextPage}"]`;
                const nextBtn = await page.$(selector);

                if (nextBtn) {
                    await nextBtn.click();
                    await new Promise(r => setTimeout(r, 1500));
                } else {
                    console.log(`Button for page ${nextPage} not found. Stopping.`);
                    break;
                }
            } catch (error) {
                console.log(`Error clicking page ${nextPage}:`, error.message);
                break;
            }
        }
    }

    console.log(`\nDONE! Total words collected: ${allItems.length}`);

    if (allItems.length > 0) {
        const dirPath = path.join(__dirname, 'src', 'data');
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

        const filePath = path.join(dirPath, 'dictionaryData.ts');
        const fileContent = `export const MOET_DATA = ${JSON.stringify(allItems, null, 2)};`;

        fs.writeFileSync(filePath, fileContent, 'utf8');
        console.log(`File saved at: ${filePath}`);
    }

    await browser.close();
}

scrapeMoetFinal();