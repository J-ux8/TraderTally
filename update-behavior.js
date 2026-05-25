const fs = require('fs');
const path = require('path');

function findFiles(dir, filter, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === '.expo') continue;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFiles(filePath, filter, fileList);
    } else if (filter.test(filePath)) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = findFiles('.', /\.tsx$/);
let changedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}")) {
    content = content.replace(/behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/g, "behavior={Platform.OS === 'ios' ? 'padding' : undefined}");
    fs.writeFileSync(file, content);
    console.log('Updated', file);
    changedCount++;
  }
}

console.log('Total files updated: ' + changedCount);
