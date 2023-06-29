
import { pinecone } from 'utils/pinecone-client.js';
import { PINECONE_INDEX_NAME, WORKING_DIR } from 'config/serverSettings.js';
import { DocVectorStore } from 'utils/docVectorStore.js';
import { PuppeteerWebBaseLoader } from "langchain/document_loaders"
import { htmlToText, HtmlToTextOptions } from 'html-to-text';
import fs from 'fs';
import { Browser, Page } from 'puppeteer';


const INGEST_VECTORDB_NAMESPACE = ''; // when '' VECTORDB is not touched

/* URL's you want to retrieve text from */
let urls = [
  'https://company.ch/referenzen/customer1/details',
  'https://company.ch/referenzen/customer2/details',
  'https://company.ch/referenzen/customer3/details',
];

// urls = [
// //  'https://company.ch/referenzen',
//   'https://company.ch/referenzen/customer1/details'
// ]

const referenzenListe = `${WORKING_DIR}/company-ch-Referenzenliste.txt`;


export const run = async () => {
  try {

    const vectorStore = new DocVectorStore(pinecone.Index(PINECONE_INDEX_NAME));
    let detailCount = 0;
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
        
        if (name == 'company-ch-referenzen') {
          text = htmlToText(html, referenzListeConverterOptions);
          text = text.replace(/(.+)-Marker-(\r\n|\n|\r)(\r\n|\n|\r)(.+)(\r\n|\n|\r)(.+)(\r\n|\n|\r)/g, '$1, $4, $6');
          text = text.replace(/^(.+)(\r\n|\n|\r)/g, 'Referenzliste mit einer Auswahl an Projekten die Company für ihre Kunden verwirklicht hat.\n\nPROJEKTNAME, KUNDE, BETRIEB\n\n$1');

        } else if (name.includes('company-ch-referenzen-')) {
        
          if (detailCount==0) {
            fs.writeFileSync(referenzenListe, 'Referenzliste mit einer Auswahl an Projekten die Company für ihre Kunden verwirklicht hat.\n\nPROJEKTNAME, KUNDE, BETRIEB\n\n', 'utf8');
          }

          detailCount++;

          console.log(detailCount);
          const metaData: detailMetaData = { id: detailCount }; 
          text = htmlToText(html, referenzDetailConverterOptions, metaData);
          text = text.replaceAll(/\s\|\s/g, '');    // remove ' | ' nach der Jahreszahl
          text = text.replaceAll('UNSER KUNDE SAGT', 'Was unser Kunde zu Company in diesem Projekt sagt:');
          
          const matches = text.match(/^(.+)(\r\n|\n|\r)+(.+)(\r\n|\n|\r)/) || [];        // Zeitraum und Projektname auslesen
          if (matches.length == 5) {
            metaData.timeRange = matches[1];
            metaData.project = matches[3];
          }                
          //                Zeitraum      Newline  Projekt Newline  Ganzer Rest
          //                     $1|         $2|  $3|          $4| $5|
          text = text.replace(/^(.+)(\r\n|\n|\r)+(.+)(\r\n|\n|\r)+(.+)/g, `Details zum ${detailCount}. Projekt aus der Referenzliste\nKunde: ${metaData.customer}\nProjektname: $3\nThema: $5`);

          fs.appendFileSync(referenzenListe, `${metaData.project}, ${metaData.customer}, ${metaData.timeRange}\n\n` ,'utf8');




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


const referenzDetailConverterOptions: HtmlToTextOptions = { 
  formatters: {
    'extractCustomer': function (elem, walk, builder, options) {      
      builder.openBlock();
      walk(elem.children, builder);
      let text = elem.attribs['alt'] || '' as string;
      const find = 'Kunden Logo: ';
      const idx = text.lastIndexOf(find);
      const customer = idx > 0 ? text.substring(idx + find.length): '';
      ((builder as any)['metadata'] as detailMetaData).customer = customer;
      builder.addInline(customer);
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

const referenzListeConverterOptions: HtmlToTextOptions = { 
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

type detailMetaData = {
  id?: number;
  customer?: string;
  project?: string;
  timeRange?: string;
}