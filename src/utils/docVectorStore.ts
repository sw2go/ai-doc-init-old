import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores';
import { Document } from "langchain/document";
import { NamespaceSummary, VectorOperationsApi } from '@pinecone-database/pinecone/dist/pinecone-generated-ts-fetch';



export class DocVectorStore {

  constructor(private index: VectorOperationsApi) {    
  }

  /**
   * delete all vectors in the namespace
   * @param namespace 
   */
  public async clear(namespace: string): Promise<{ before: number, after: number }> {
    console.log(`namespace '${namespace}': Clearing vector store...`);
    const before = await this.count(namespace);
    await this.index.delete1({ deleteAll: true, namespace: namespace });
    const after = await this.count(namespace);
    console.log(`namespace '${namespace}': Deleted ${before - after} vectors`);
    return {
      before,
      after
    };
  }

  // public async add(namespace: string, filePaths: string []) {

  //   let rawDocs: Document[] = [];

  //   for await (const filePath of filePaths) {
  //     switch(filePath.split('.').pop()?.toLowerCase()) {
  //       case 'txt':
  //         const textLoader = new TextLoader(filePath);
  //         rawDocs = rawDocs.concat(await textLoader.load());
  //         break;
  //       case 'pdf':
  //         const pdfLoader = new CustomPDFLoader(filePath);
  //         rawDocs = rawDocs.concat(await pdfLoader.load());
  //         break;
  //       default:
  //     }
  //   }
  //   return await this.upsert(namespace, rawDocs);    
  // }

  public async count(namespace: string) {
    const status = await this.index.describeIndexStats({describeIndexStatsRequest: { }});  // filter: { meta: "uuebkit" }
    let count: number = 0;
    if (status.namespaces) {
        count = status.namespaces[namespace]?.vectorCount || 0;
        console.log(status.namespaces)
    }
    return count;
  }

  public async getNamespaces() {
    const status = await this.index.describeIndexStats({describeIndexStatsRequest: { }});  // filter: { meta: "uuebkit" }
    if (status.namespaces) {
      return Object.keys(status.namespaces);
    } else {
      return [];
    }
  }

  public async upsert(namespace: string, rawDocs: Document[]) {

    const before = await this.count(namespace);

    if (!rawDocs || rawDocs.length == 0) {
      return {
        before,
        after: before
      }
    }

    /* Split text into chunks */
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,    // max doc size in tokens
      chunkOverlap: 200,  //       
      separators: ['\r\n\r\n','\r\n', '\n\n', '\n', ' ', ''] // default: [ '\n\n', '\n', ' ', '' ]
    });
  
    const docs = await textSplitter.splitDocuments(rawDocs);
  
    console.log(`namespace '${namespace}': Creating and adding embeddings to vector store...`);

    /* create and store the embeddings in the vectorStore */
    const embeddings = new OpenAIEmbeddings();
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: this.index,
      namespace: namespace,
      textKey: 'text',
    });

    const after = await this.count(namespace);
  
    console.log(`namespace '${namespace}': Added ${rawDocs.length} rawdocs, ${docs.length} docs, ${after - before} vectors, total vectors ${after}`);

    return { 
      before, 
      after 
    };
  }
}