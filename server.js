const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const app = express();

// Headers HTTP sécurisés (cache, XSS, etc.)
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // max 100 requêtes par IP
  message: { error: 'Trop de requêtes, réessaie plus tard.' }
});
app.use(limiter);

app.use(express.json({ limit: '10kb' })); // Limite la taille du body
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// On refuse de démarrer sans URI Mongo
if (!MONGO_URI) {
  console.error('❌ MONGO_URI manquant dans les variables d\'environnement');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connecté à MongoDB'))
  .catch(err => {
    console.error('❌ Erreur MongoDB:', err.message);
    process.exit(1);
  });

// Schéma strict avec taille max sur le titre
const TaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  completed: { type: Boolean, default: false }
}, { strict: true }); // strict: true = ignore les champs inconnus

const Task = mongoose.model('Task', TaskSchema);

// --- ROUTES ---

// GET /tasks — Lire toutes les tâches
app.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().select('-__v'); // on cache le champ __v
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /tasks — Créer une tâche avec validation
app.post('/tasks',
  body('title')
    .trim()
    .notEmpty().withMessage('Le titre est obligatoire')
    .isLength({ max: 200 }).withMessage('Titre trop long (max 200 car.)'),
  async (req, res) => {
    // ✅ On vérifie les erreurs de validation
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

app.listen(PORT, () => {
  console.log(`🚀 Serveur sur le port ${PORT}`);
});