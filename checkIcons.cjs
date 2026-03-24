const icons = require('lucide-react');
console.log('cocktail matches:', Object.keys(icons).filter(k => /cocktail/i.test(k)));
console.log('martini matches:', Object.keys(icons).filter(k => /martini/i.test(k)));
console.log('glass matches:', Object.keys(icons).filter(k => /glass/i.test(k)));
console.log('total icons', Object.keys(icons).length);
