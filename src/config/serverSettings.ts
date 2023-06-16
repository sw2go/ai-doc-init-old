/**
 * Change the namespace to the namespace on Pinecone you'd like to store your embeddings.
 */

if (process.env.PINECONE_INDEX_NAME === undefined || process.env.PINECONE_INDEX_NAME?.length === 0 ) {
  throw new Error('Missing Pinecone index name in .env file');
}

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

// If Enviroment is not set, the WORKING_DIR default is %HOME% (the Users directory on Windows and the users home folder (~) on Linux)
const WORKING_DIR = process.env.WORKING_DIR ?? process.env.HOME ?? './devdata';

const CTX_DIR = `${WORKING_DIR}/ctx`; 
const LOG_DIR = `${WORKING_DIR}/log`;

const CONTEXT_FILE_EXTENSION = '.ctx.txt';
const RESERVED_FILE_EXTENSIONS = [ CONTEXT_FILE_EXTENSION ]
 
export { PINECONE_INDEX_NAME, ADMIN_SECRET, RESERVED_FILE_EXTENSIONS, WORKING_DIR, CTX_DIR, LOG_DIR, CONTEXT_FILE_EXTENSION };
