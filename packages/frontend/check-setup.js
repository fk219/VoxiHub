#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Frontend Setup...\n');

const checks = [
  {
    name: 'package.json exists',
    check: () => fs.existsSync('package.json'),
    fix: 'File should exist'
  },
  {
    name: 'node_modules exists',
    check: () => fs.existsSync('node_modules'),
    fix: 'Run: npm install'
  },
  {
    name: 'Tailwind CSS installed',
    check: () => {
      try {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        return pkg.devDependencies && pkg.devDependencies.tailwindcss;
      } catch {
        return false;
      }
    },
    fix: 'Run: npm install'
  },
  {
    name: 'tailwind.config.js exists',
    check: () => fs.existsSync('tailwind.config.js'),
    fix: 'File should exist (already created)'
  },
  {
    name: 'postcss.config.js exists',
    check: () => fs.existsSync('postcss.config.js'),
    fix: 'File should exist (already created)'
  },
  {
    name: 'globals.css exists',
    check: () => fs.existsSync('src/styles/globals.css'),
    fix: 'File should exist (already created)'
  }
];

let allPassed = true;

checks.forEach(({ name, check, fix }) => {
  const passed = check();
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (!passed) {
    console.log(`   Fix: ${fix}\n`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('✨ All checks passed!');
  console.log('\nNext steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Open: http://localhost:3000');
  console.log('3. Hard refresh browser (Ctrl+Shift+R)');
} else {
  console.log('⚠️  Some checks failed!');
  console.log('\nQuick fix:');
  console.log('1. Run: npm install');
  console.log('2. Run: npm run dev');
  console.log('3. Hard refresh browser (Ctrl+Shift+R)');
}

console.log('='.repeat(50) + '\n');
