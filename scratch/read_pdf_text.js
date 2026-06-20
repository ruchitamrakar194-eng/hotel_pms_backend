const fs = require('fs');
const path = 'uploads/1780680628758-888970439-Hotelogx_Sample_Hotel_Policies.pdf';
console.log(fs.readFileSync(path, 'utf8').substring(0, 500));
