const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json()); // Pour lire le JSON dans les requêtes
app.use(express.static('public')); // Pour servir notre page web front-end

// Récupération des variables d'environnement
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/todoapp';

// Connexion à MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connecté à MongoDB avec succès'))
  .catch(err => console.error('❌ Erreur de connexion MongoDB:', err));

// Modèle de donnée (Une Tâche)
const TaskSchema = new mongoose.Schema({
  title: String,
  completed: { type: Boolean, default: false }
});
const Task = mongoose.model('Task', TaskSchema);

// --- ROUTES DE NOTRE API ---

// Lire toutes les tâches
app.get('/tasks', async (req, res) => {
  const tasks = await Task.find();
  res.json(tasks);
});

// Créer une nouvelle tâche
app.post('/tasks', async (req, res) => {
  const newTask = new Task({ title: req.body.title });
  await newTask.save();
  res.status(201).json(newTask);
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});