# ai-doc-init
Scrape html pages and write the content as text to files
- uses puppeteer to scrape static and dynamic html pages (SPA)
- uses html-to-text to extract and convert html to text

## Development

1. Clone the repo

```
git clone git@github.com:sw2go/ai-doc-init.git
```

2. Install packages

```
npm install
```

## Run to scrape

1. in the file `./ingest/urls.ts` define the array with the urls you want to scrape
2. `npm run start ./ingest/urls.ts`
3. find the results in ./devdata
