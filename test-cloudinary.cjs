const fs = require('fs');

async function testUpload() {
  const cloudName = "ddygpbg8g";
  const uploadPreset = "SoLuna";
  
  // Create a dummy image
  fs.writeFileSync('test.txt', 'dummy content');
  
  const formData = new FormData();
  const fileBlob = new Blob([fs.readFileSync('test.txt')]);
  formData.append("file", fileBlob, "test.txt");
  formData.append("upload_preset", uploadPreset);

  console.log("Starting upload...");
  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });
    
    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response:", data);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

testUpload();
