import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const CHATS_DIR = path.join(__dirname, '../../../sample_chats');
const OUTPUT_FILE = path.join(CHATS_DIR, 'extracted_conversations.txt');

function findHtmlFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findHtmlFiles(filePath, fileList);
    } else if (filePath.endsWith('.html')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const htmlFiles = findHtmlFiles(CHATS_DIR);
console.log(`Found ${htmlFiles.length} HTML files.`);

let outputContent = '';
let processedCount = 0;

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const $ = cheerio.load(content);
  
  let chatText = `\n--- Conversation: ${path.basename(path.dirname(file))} ---\n`;
  let hasMessages = false;

  $('section').each((_, section) => {
    const sender = $(section).find('h2').text().trim();
    
    let messageText = '';
    
    // Facebook exports usually put the actual text in innermost divs
    $(section).find('div._a6-p div').each((i, el) => {
       // Only grab text if it has no child divs (innermost text node wrapper)
       if ($(el).children('div').length === 0) {
         const text = $(el).text().trim();
         if (text && 
             text !== 'You are no longer in this conversation.' && 
             !text.includes('replied to an ad') &&
             !text.includes('This attachment may have been removed')) {
           messageText += text + ' ';
         }
       }
    });
    
    messageText = messageText.trim();

    if (sender && messageText) {
      chatText += `${sender}: ${messageText}\n`;
      hasMessages = true;
    }
  });

  if (hasMessages) {
    outputContent += chatText;
    processedCount++;
  }
}

fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf-8');
console.log(`Processed ${processedCount} conversations and saved to ${OUTPUT_FILE}`);
