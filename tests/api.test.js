const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/testdb';

beforeAll(async () => {
  await mongoose.connect(MONGO_URI);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await mongoose.connection.collection('tasks').deleteMany({});
});

// Tests GET /tasks
describe('GET /tasks', () => {
  it('retourne un tableau vide si aucune tâche', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('retourne les tâches existantes', async () => {
    await request(app)
      .post('/tasks')
      .send({ title: 'Tâche test' });

    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Tâche test');
  });
});

// Tests POST /tasks
describe('POST /tasks', () => {
  it('crée une tâche avec un titre valide', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Ma nouvelle tâche' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Ma nouvelle tâche');
    expect(res.body.completed).toBe(false);
  });

  it('rejette un body vide', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.errors[0].msg).toBe('Le titre est obligatoire');
  });

  it('rejette un titre vide', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: '' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].msg).toBe('Le titre est obligatoire');
  });

  it('rejette un titre trop long (> 200 caractères)', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'a'.repeat(201) });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].msg).toBe('Titre trop long (max 200 car.)');
  });

  it('ignore les champs inconnus (strict mode)', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Tâche valide', champsInconnu: 'hacker' });

    expect(res.status).toBe(201);
    expect(res.body.champsInconnu).toBeUndefined();
  });

  it('la tâche est créée avec completed à false par défaut', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Vérification completed' });

    expect(res.status).toBe(201);
    expect(res.body.completed).toBe(false);
  });
});

// Tests sécurité
describe('Sécurité', () => {
  it('refuse un body trop volumineux (> 10kb)', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'a'.repeat(11000) });

    expect(res.status).toBe(413);
  });

  it('les headers Helmet sont présents', async () => {
    const res = await request(app).get('/tasks');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});