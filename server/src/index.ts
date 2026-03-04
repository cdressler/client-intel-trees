import 'dotenv/config';
import { createApp } from './app.js';
import { getDatabase } from './db.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const db = getDatabase();
const app = createApp(db);

app.listen(PORT, () => {
  console.log(`Client Intelligence Tree server running on port ${PORT}`);
});
