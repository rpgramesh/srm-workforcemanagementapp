const fs = require('fs');
const path = require('path');

const directories = ['app', 'components', 'features'];

const replacements = [
  // Backgrounds
  { regex: /bg-slate-950/g, replace: "bg-slate-50" },
  { regex: /bg-slate-900/g, replace: "bg-white" },
  
  // Text colors
  { regex: /text-slate-200/g, replace: "text-slate-900" },
  { regex: /text-white/g, replace: "text-slate-900" },
  { regex: /text-slate-400/g, replace: "text-slate-500" },
  { regex: /text-slate-300/g, replace: "text-slate-700" },

  // Borders
  { regex: /border-white\/10/g, replace: "border-slate-200" },
  { regex: /border-white\/20/g, replace: "border-slate-300" },
  
  // Emerald to Blue (Primary)
  { regex: /emerald-500/g, replace: "blue-600" },
  { regex: /emerald-400/g, replace: "blue-500" },
  { regex: /emerald-300/g, replace: "blue-600" },
  { regex: /emerald-200/g, replace: "blue-700" },
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

let changedCount = 0;

directories.forEach(dir => {
  const files = walk(dir);
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    replacements.forEach(({ regex, replace }) => {
      content = content.replace(regex, replace);
    });

    if (content !== original) {
      fs.writeFileSync(file, content);
      console.log(`Updated: ${file}`);
      changedCount++;
    }
  });
});

console.log(`\nCompleted theme update across ${changedCount} files.`);
