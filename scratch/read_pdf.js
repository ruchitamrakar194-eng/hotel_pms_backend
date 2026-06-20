const fs = require('fs');
const pdf = require('pdf-parse');

const pdfPath = 'uploads/1780680628758-888970439-Hotelogx_Sample_Hotel_Policies.pdf';

async function main() {
  const dataBuffer = fs.readFileSync(pdfPath);
  try {
    const data = await pdf(dataBuffer);
    console.log("PDF TEXT:\n", data.text);
  } catch (err) {
    console.error("Error parsing pdf:", err);
  }
}

main();
