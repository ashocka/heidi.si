const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

const BASE_URL = 'https://heidi.si';
const OUTPUT_DIR = path.join(__dirname, 'pdf-outputs'); // Changed: now relative to script location

// Generate filename with current date
const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
const FINAL_PDF = path.join(__dirname, `Heidi-portfolio_${currentDate}.pdf`);

// Helper function to discover all project pages
async function discoverPages(page) {
  console.log('🔍 Discovering pages...');
  
  // Start with the two introduction pages
  const pages = [
    `${BASE_URL}/introduction.html`,
    `${BASE_URL}/artist-statement.html`
  ];
  
  // Go to portfolio page to find all projects
  await page.goto(`${BASE_URL}/portfolio/`, { waitUntil: 'networkidle2' });
  
  // Extract all portfolio project links
  const projectLinks = await page.evaluate((baseUrl) => {
    const links = Array.from(document.querySelectorAll('a'));
    return links
      .map(link => {
        let href = link.href;
        // Only include links that point to portfolio subdirectories
        if (href.includes('/portfolio/') && !href.endsWith('/portfolio/')) {
          // Ensure it ends with / or index.html
          if (!href.endsWith('/') && !href.endsWith('.html')) {
            href += '/';
          }
          return href;
        }
        return null;
      })
      .filter(Boolean)
      .filter(href => !href.includes('about.html')) // Added: exclude about.html
      .filter((href, index, self) => self.indexOf(href) === index);
  }, BASE_URL);
  
  pages.push(...projectLinks);
  
  console.log(`✅ Found ${pages.length} pages:`);
  pages.forEach((url, i) => console.log(`   ${i + 1}. ${url}`));
  
  return pages;
}

// Generate PDF for a single page
async function generatePagePDF(page, url, index) {
  console.log(`📄 Generating PDF ${index + 1}: ${url}`);
  
  await page.goto(url, { 
    waitUntil: 'networkidle2',
    timeout: 30000 
  });
  
  // Wait a bit for images to load
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const pdfPath = path.join(OUTPUT_DIR, `page-${index}.pdf`);
  
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20px',
      right: '20px',
      bottom: '20px',
      left: '20px'
    }
  });
  
  console.log(`   ✅ Saved to ${pdfPath}`);
  return pdfPath;
}

// Merge all PDFs into one
async function mergePDFs(pdfPaths) {
  console.log('\n📚 Merging PDFs...');
  
  const mergedPdf = await PDFDocument.create();
  
  for (let i = 0; i < pdfPaths.length; i++) {
    const pdfPath = pdfPaths[i];
    console.log(`   Merging ${i + 1}/${pdfPaths.length}: ${path.basename(pdfPath)}`);
    
    const pdfBytes = await fs.readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    
    copiedPages.forEach((page) => {
      mergedPdf.addPage(page);
    });
  }
  
  const mergedPdfBytes = await mergedPdf.save();
  await fs.writeFile(FINAL_PDF, mergedPdfBytes);
  
  console.log(`✅ Merged PDF saved to: ${FINAL_PDF}`);
  console.log(`   Total pages: ${mergedPdf.getPageCount()}`);
}

// Main execution
async function main() {
  console.log('🚀 Starting PDF generation for heidi.si\n');
  console.log(`📁 Output will be saved to: ${FINAL_PDF}\n`);
  
  // Create output directory
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (err) {
    // Directory exists
  }
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1200,
      height: 800,
      deviceScaleFactor: 1
    });
    
    // Discover all pages
    const pageUrls = await discoverPages(page);
    
    // Generate PDF for each page
    console.log('\n📑 Generating individual PDFs...\n');
    const pdfPaths = [];
    
    for (let i = 0; i < pageUrls.length; i++) {
      const pdfPath = await generatePagePDF(page, pageUrls[i], i);
      pdfPaths.push(pdfPath);
    }
    
    // Merge all PDFs
    await mergePDFs(pdfPaths);
    
    // Cleanup individual PDFs (optional)
    console.log('\n🧹 Cleaning up temporary files...');
    for (const pdfPath of pdfPaths) {
      await fs.unlink(pdfPath);
    }
    await fs.rmdir(OUTPUT_DIR);
    
    console.log('\n✨ Done! Your complete PDF is ready.');
    console.log(`📍 Location: ${FINAL_PDF}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

main();