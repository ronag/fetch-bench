import {readFileSync} from "fs";
import pAll from "p-all";
import nodeFetch from "node-fetch";
import {fetch as undiciFetch, Agent, setGlobalDispatcher, request } from "undici";
import axios from "axios";

setGlobalDispatcher(new Agent({
	pipelining: 2
}))

const pkg = JSON.parse(readFileSync(new URL("1500-deps.json", import.meta.url)));
const urls = Object.keys(pkg.devDependencies).map(name => `https://registry.npmjs.org/${name.replace(/\//g, "%2f")}`);
const warmupUrls = urls.slice(0, 10);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const opts = {concurrency: process.argv[2] ? Number(process.argv[2]) : 64};

// warm up the JIT
await Promise.all([
  ...warmupUrls.map(url => nodeFetch(url).then(res => res.arrayBuffer())),
  ...warmupUrls.map(url => axios.get(url, {responseType: "buffer"})),
  ...warmupUrls.map(url => undiciFetch(url).then(res => res.arrayBuffer())),
  ...warmupUrls.map(url => request(url).then(res => res.body.arrayBuffer())),
]);

await sleep(500);

const t3 = performance.now();
await pAll(urls.map(url => () => axios.get(url, {responseType: "buffer"})), opts);
console.info(`axios: ${Math.round(performance.now() - t3)}ms`);

await sleep(500);

const t2 = performance.now();
await pAll(urls.map(url => () => nodeFetch(url).then(res => res.arrayBuffer())), opts);
console.info(`node-fetch: ${Math.round(performance.now() - t2)}ms`);

await sleep(500);

const t1 = performance.now();
await pAll(urls.map(url => () => undiciFetch(url).then(res => res.arrayBuffer())), opts);
console.info(`undici-fetch: ${Math.round(performance.now() - t1)}ms`);

await sleep(500);

const t0 = performance.now();
await pAll(urls.map(url => () => request(url).then(res => res.body.arrayBuffer())), opts);
console.info(`undici-request: ${Math.round(performance.now() - t0)}ms`);
