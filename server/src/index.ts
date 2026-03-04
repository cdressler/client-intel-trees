import 'dotenv/config';
import path from 'path';
import { createApp } from './app.js';
import { getDatabase } from './db.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const dataDir = process.env.DATA_DIR;
const uploadsDir = dataDir ? path.join(dataDir, 'uploads') : 'uploads';

const db = getDatabase();
const app = createApp(db, uploadsDir);

app.listen(PORT, () => {
  console.log(`Client Intelligence Tree server running on port ${PORT}`);
});
