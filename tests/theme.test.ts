import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const layout=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8');
const script=layout.match(/__html:\s*`([^`]+)`/)![1];
test("pre-render theme bootstrap restores dark, defaults to light, and tolerates blocked storage",()=>{
  for(const stored of [null,"dark","light","invalid"]){
    const document={documentElement:{dataset:{} as Record<string,string>}};
    vm.runInNewContext(script,{document,localStorage:{getItem:()=>stored}});
    assert.equal(document.documentElement.dataset.theme,stored==='dark'?'dark':'light');
  }
  const document={documentElement:{dataset:{} as Record<string,string>}};
  vm.runInNewContext(script,{document,localStorage:{getItem:()=>{throw Error('blocked')}}});
  assert.equal(document.documentElement.dataset.theme,'light');
});
