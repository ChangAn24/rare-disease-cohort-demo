// Run with: node check.mjs
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('register.html', import.meta.url), 'utf8');
const nodes = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, {
  hidden: true, disabled: false, files: [], value: '', error: '', listeners: {},
  addEventListener(type, fn) { this.listeners[type] = fn; },
  setCustomValidity(error) { this.error = error; },
  reportValidity() { return !this.error; },
  click() { this.listeners.click(); }, focus() {}, scrollIntoView() {},
  querySelectorAll() { return []; },
}]));
nodes['upload-fields'].disabled = true;
let infoValid = false;
nodes['patient-form'].reportValidity = () => infoValid && (nodes['upload-fields'].disabled ||
  ['signed-application', 'signed-consent'].every(id => nodes[id].files.length && !nodes[id].error));
const context = vm.createContext({ document: { getElementById: id => nodes[id] } });
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
const valid = { name: 'signed.pdf', type: 'application/pdf', size: 1024 };
const errorFor = file => { context.file = file; return vm.runInContext('fileError(file)', context); };
assert(errorFor(undefined));
assert(errorFor({ ...valid, name: 'image.jpg', type: 'image/jpeg' }));
assert(errorFor({ ...valid, size: 0 }));
assert(errorFor({ ...valid, size: 20 * 1024 * 1024 + 1 }));
assert.equal(errorFor({ ...valid, name: 'SIGNED.PDF', type: '', size: 20 * 1024 * 1024 }), '');
nodes['next-step'].click();
assert.equal(nodes['upload-fields'].disabled, true, 'Incomplete registration must not unlock files');
infoValid = true;
nodes['next-step'].click();
assert.equal(nodes['upload-fields'].disabled, false);
const submit = () => nodes['patient-form'].listeners.submit({ preventDefault() {} });
submit();
assert.equal(nodes.feedback.hidden, true, 'Missing files must not pass');
for (const id of ['signed-application', 'signed-consent']) {
  nodes[id].files = [valid]; nodes[id].listeners.change();
}
submit();
assert.equal(nodes.feedback.hidden, false);
nodes['edit-info'].click();
assert.equal(nodes['upload-fields'].disabled, true);
assert.equal(nodes['signed-consent'].files.length, 1, 'Editing info must preserve file selection');
for (const name of ['index.html', 'register.html']) {
  const page = readFileSync(new URL(name, import.meta.url), 'utf8');
  for (const [, path] of page.matchAll(/href="(documents\/[^"#]+)"/g)) {
    const url = new URL(path, import.meta.url);
    assert(existsSync(url)); assert.equal(readFileSync(url).subarray(0, 5).toString(), '%PDF-');
  }
}
console.log('PASS: registration gate, required PDFs, file limits, edit flow and download links');
