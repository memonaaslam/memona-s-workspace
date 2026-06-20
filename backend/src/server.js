require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { init } = require('./db');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const vaultRoutes = require('./routes/vault');
const passwordRoutes = require('./routes/passwords');
const { router: recycleRoutes, purgeOldItems } = require('./routes/recycle');
const backupRoutes = require('./routes/backup');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => res.json({ ok: true, name: 'Memonas Workspace API' }));

app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/vault', vaultRoutes);
app.use('/passwords', passwordRoutes);
app.use('/recycle-bin', recycleRoutes);
app.use('/backup', backupRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  init()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Memonas Workspace API running on port ${PORT}`);
      });
      setInterval(() => purgeOldItems(30), 24 * 60 * 60 * 1000);
    })
    .catch((err) => {
      console.error('Failed to initialize database:', err);
      process.exit(1);
    });
}

module.exports = app;
