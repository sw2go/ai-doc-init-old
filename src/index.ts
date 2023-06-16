import path from "path";
import url from "url";

const [exampleName, ...args] = process.argv.slice(2);

if (!exampleName) {
  console.error("Please provide path to example to run");
  process.exit(1);
}

// Allow people to pass all possible variations of a path to an example
// ./src/foo.ts, ./dist/foo.js, src/foo.ts, dist/foo.js, foo.ts
let exampleRelativePath = exampleName;
console.log(import.meta.url);
console.log(url.fileURLToPath(import.meta.url));
console.log(    path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  exampleRelativePath
)
);




let runExample;
try {
  ({ run: runExample } = await import(
    exampleRelativePath
  ));
} catch (e) {
  throw new Error(`Could not load example ${exampleName}: ${e}`);
}

if (runExample) {
  const maybePromise = runExample(args);

  if (maybePromise instanceof Promise) {
    maybePromise.catch((e) => {
      console.error(`Example failed with:`);
      console.error(e);
      process.exit(1);
    });
  }
}
