import * as tiktoken from 'js-tiktoken';
import { opendir } from 'node:fs/promises'
import fs from 'fs'
import { WORKING_DIR } from 'config/serverSettings.js';


const filename = 'company-ch-referenzen.txt';


export const run = async () => {
  try {
    const encoding = tiktoken.getEncoding('cl100k_base');
    console.log('    tokens      chars file names');
    const dir = await opendir(`${WORKING_DIR}`);
    for await (const dirent of dir) {
      if (dirent.isFile()) {
        if(dirent.name.endsWith('.txt')) {
          const content = fs.readFileSync(`${WORKING_DIR}/${dirent.name}`, 'utf8');
          const tokens = encoding.encode(content, 'all');
          console.log( tokens.length.toString().padStart(10), content.length.toString().padStart(10), dirent.name);
        } else if(dirent.name.endsWith('.html')) {
          fs.unlinkSync(`${WORKING_DIR}/${dirent.name}`);        
        }
      }

    }
  } catch(e: any) {

  }
}

