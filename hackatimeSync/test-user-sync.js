require('dotenv').config();

// Test just the user sync logic
async function testUserSync() {
  console.log('🧪 Testing user sync logic...');
  
  // Import the functions from the main file
  const fs = require('fs');
  const path = require('path');
  
  // Read the main file and extract the functions we need
  const mainFile = fs.readFileSync('./index.js', 'utf8');
  
  // We'll need to test the syncUserDaysActive function
  // But first let's check if the main sync is actually running
  
  console.log('The main sync should be running in the background.');
  console.log('Check the terminal output to see if it has reached the user daysActive sync.');
  console.log('Look for this message: "Starting user daysActive sync..."');
  console.log('');
  console.log('If you see that message, the user sync is running.');
  console.log('If you don\'t see it, the main sync is still processing games.');
  console.log('');
  console.log('The main sync processes games first, then users.');
  console.log('With 1615 games, it might take a while to complete.');
}

testUserSync().catch(console.error);
