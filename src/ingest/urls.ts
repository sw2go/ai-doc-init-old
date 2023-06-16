
import { pinecone } from 'utils/pinecone-client.js';
import { PINECONE_INDEX_NAME, WORKING_DIR } from 'config/serverSettings.js';
import { DocVectorStore } from 'utils/docVectorStore.js';
import { PuppeteerWebBaseLoader } from "langchain/document_loaders"
import { Document } from 'langchain/document';
import { htmlToText, HtmlToTextOptions } from 'html-to-text';
import fs from 'fs';
import { Browser, Page } from 'puppeteer';


const INGEST_VECTORDB_NAMESPACE = ''; // when '' VECTORDB is not touched

/* URL's you want to retrieve text from */
let urls = [
  // 'https://loftsoft.ch/',
  // 'https://loftsoft.ch/wieso-wir',
  // 'https://loftsoft.ch/was-wir-bieten',
  // 'https://loftsoft.ch/uuebkit',
  // 'https://loftsoft.ch/ueber-uns',
  // 'https://loftsoft.ch/kontakt',
  'https://loftsoft.ch/referenzen',
  'https://loftsoft.ch/referenzen/se-minimelweb/details',
  'https://loftsoft.ch/referenzen/eda-pmtn/details',
  'https://loftsoft.ch/referenzen/metbar-event-planung/details',
  'https://loftsoft.ch/referenzen/securitas-klswebapp/details',
  'https://loftsoft.ch/referenzen/swisscom-mspp/details',
  'https://loftsoft.ch/referenzen/ktzh-leunetservicesportal/details',
  'https://loftsoft.ch/referenzen/swisscom-mcccustomerportal/details',
  'https://loftsoft.ch/referenzen/srk-personendb/details',
  'https://loftsoft.ch/referenzen/amag-wis/details',
  'https://loftsoft.ch/referenzen/holliger-palettenportal/details',
  'https://loftsoft.ch/referenzen/securitas-kls/details',
  'https://loftsoft.ch/referenzen/pfisteroptik-optilink/details',
];


// urls = [
//   'https://loftsoft.ch/referenzen',
//   'https://loftsoft.ch/referenzen/se-minimelweb/details'
// ]

export const run = async () => {
  try {

    const vectorStore = new DocVectorStore(pinecone.Index(PINECONE_INDEX_NAME));

    for(let i = 0; i < urls.length; i++) {
      
      console.log(urls[i]);

      const loader = new PuppeteerWebBaseLoader(urls[i], 
        {
          launchOptions: {
            headless: true,
          },
          gotoOptions: {
            waitUntil: 'networkidle0',
          },
          /** Pass custom evaluate, in this case you get page and browser instances */
          async evaluate(page: Page, browser: Browser) {
            //await page.waitForResponse("https://www.tabnews.com.br/va/view");
        
            const result = await page.evaluate(() => {

              return document.querySelector('app-header + div')?.innerHTML || '';
              //return document.body.innerHTML;
            });
            return result;
          },
        });

      const rawDocs = await loader.load();

      const name = urls[i].replace('https://', '').replace(/[./]/g, '-');
    
      for (let doc of rawDocs) {
        let html = doc.pageContent;
        fs.writeFileSync(`${WORKING_DIR}/${name}.html`, html, 'utf8');

        let text = ''
        
        if (name == 'loftsoft-ch-referenzen') {
          text = htmlToText(html, referenzenOptions);
          text = text.replace(/(.+)-Marker-(\r\n|\n|\r)(\r\n|\n|\r)(.+)(\r\n|\n|\r)(.+)(\r\n|\n|\r)/g, '$1, $4, $6');
          text = text.replace(/^(.+)(\r\n|\n|\r)/g, 'REFERENZ LISTE von Loftsoft IT\n\nDie folgende Liste enthält eine Auswahl von Projekten die Loftsoft IT für ihre Kunden umgesetzt hat,\nmit Projektbezeichnung, Kundenbezeichnung und den Betriebsjahren.\n\n$1');

        } else if (name.includes('loftsoft-ch-referenzen-')) {
          text = htmlToText(html, referenzenDetailsOptions);
          text = text.replaceAll(/\s\|\s/g, '');    // remove ' | ' nach der Jahreszahl
          text = text.replaceAll('UNSER KUNDE SAGT', 'KUNDENZITAT');
          text = text.replace(/^(.+)(\r\n|\n|\r)+(.+)/g, 'DETAILS zum PROJEKT - $3');
        } else {
          text = htmlToText(html);
        }

        text = text.replaceAll('&shy;', '');                              // remove shy Trenner
        text = text.replaceAll(/(\r\n|\n|\r){2}(\r\n|\n|\r)+/gm, '\n\n'); // Remove Mehrfach Zeilenumbrüche

        fs.writeFileSync(`${WORKING_DIR}/${name}.txt`, text, 'utf8');        
        doc.pageContent = text;
      
        if (INGEST_VECTORDB_NAMESPACE.length > 0) {
          if (i==0) {
            await vectorStore.clear(INGEST_VECTORDB_NAMESPACE);
          }          
          await vectorStore.upsert(INGEST_VECTORDB_NAMESPACE, [ doc ]);
        }

        console.log(`$OK ${name}`);

      }
    }
  } catch (error) {
    console.log('error', error);
    throw new Error('Failed to ingest your data');
  }
};


const referenzenDetailsOptions: HtmlToTextOptions = { 
  formatters: {
    'extractCustomer': function (elem, walk, builder, options) {
      builder.openBlock();
      walk(elem.children, builder);
      let text = elem.attribs['alt'] || '' as string;
      const find = 'Kunden Logo: ';
      const idx = text.lastIndexOf(find);
      builder.addInline(idx > 0 ? text.substring(idx + find.length): '');
      builder.closeBlock();
    }
  },        
  selectors: [
    { selector: 'swiper', format: 'skip' },                       // skip Kompetenz swiper im Kopf 
    { selector: 'app-back-button', format: 'skip' },              // skip back-button
    { selector: 'span.quotation-mark', format: 'skip' },          // skip zitat begin quotation-mark 
    { selector: 'div.portrait', format: 'skip' },                 // skip zitat bild 'name'
    { selector: 'img[alt*="Referenz Details:"]', format: 'skip'},
    { selector: 'a', options: { linkBrackets: false }  },
    { selector: 'img.customer-logo', format: 'extractCustomer' }, // Modify Customer
  ]
};

const referenzenOptions: HtmlToTextOptions = { 
  formatters: {
    'extractBegin': function (elem, walk, builder, options) {
      builder.openBlock();
      walk(elem.children, builder);
      builder.addInline('-Marker-');
      builder.closeBlock();
    }
  },    
  selectors: [
    { selector: 'div > h2', format: 'skip'},
    { selector: 'button', format: 'skip'},
    { selector: 'a', format: 'skip'  },
    { selector: 'img', format: 'skip'  },
    { selector: 'div > h3.mt-5', format: 'extractBegin' }
  ]
};
