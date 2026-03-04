const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult, param } = require('express-validator');
const path = require('path');

const app = express();

// Headers HTTP sécurisés
app.use(helmet({
  strictTransportSecurity: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      upgradeInsecureRequests: null
    }
  },
  crossOriginOpenerPolicy: false,
  originAgentCluster: false
}));

// Limite de requêtes (anti brute-force / DDoS)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes, réessaie plus tard.' }
});
app.use(limiter);

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Schéma strict avec taille max sur le titre
const TaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  completed: { type: Boolean, default: false }
}, { strict: true });

const Task = mongoose.model('Task', TaskSchema);

// --- ROUTES ---

// GET /tasks
app.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().select('-__v');
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /tasks
app.post('/tasks',
  body('title')
    .trim()
    .notEmpty().withMessage('Le titre est obligatoire')
    .isLength({ max: 200 }).withMessage('Titre trop long (max 200 car.)'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const newTask = new Task({ title: req.body.title });
      await newTask.save();
      res.status(201).json(newTask);
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// DELETE /tasks/:id
app.delete('/tasks/:id',
  param('id').isMongoId().withMessage('ID invalide'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const task = await Task.findByIdAndDelete(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Tâche introuvable' });
      }
      res.status(200).json({ message: 'Tâche supprimée' });
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

module.exports = app;

// Démarrage uniquement si lancé directement
if (require.main === module) {
  const MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI) {
    console.error('❌ MONGO_URI manquant dans les variables d\'environnement');
    process.exit(1);
  }

  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log('✅ Connecté à MongoDB');
      app.listen(process.env.PORT || 3000, () => {
        console.log(`🚀 Serveur sur le port ${process.env.PORT || 3000}`);
      });
    })
    .catch(err => {
      console.error('❌ Erreur MongoDB:', err.message);
      process.exit(1);
    });
}