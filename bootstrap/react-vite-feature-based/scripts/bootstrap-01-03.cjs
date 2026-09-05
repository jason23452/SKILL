#!/usr/bin/env node

const fs=require('fs');const cfg='tsconfig.app.json';if(fs.existsSync(cfg)){const j=JSON.parse(fs.readFileSync(cfg,'utf8'));j.compilerOptions={...(j.compilerOptions||{}),ignoreDeprecations:'6.0',baseUrl:(j.compilerOptions||{}).baseUrl||'.',paths:{...((j.compilerOptions||{}).paths||{}),'@/*':['./src/*']}};fs.writeFileSync(cfg,JSON.stringify(j,null,2))}
