import 'dotenv/config';

// Test CSV export
const res = await fetch('http://localhost:5000/api/opportunities/export/csv');
console.log('Status:', res.status);
console.log('Content-Type:', res.headers.get('content-type'));
const text = await res.text();
console.log('First 800 chars:');
console.log(text.substring(0, 800));
console.log('---');
console.log('Total length:', text.length);
process.exit(0);
