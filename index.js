const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('WhatsApp Bot is running 24/7!');
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// هنا تقدر تحط كود البوت أو استدعاء ملف تشغيل البوت الأساسي لو السكربت متقسم

