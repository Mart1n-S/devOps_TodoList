# 📋 TodoList App — Infrastructure DevOps sur Kubernetes

> Projet de mise en place d'une infrastructure DevOps complète autour d'une application TodoList, déployée sur un cluster **K3s** hébergé sur un **homelab**.

---

## 📌 Présentation du projet

L'objectif de ce projet est la mise en place d'une infrastructure DevOps de bout en bout sur Kubernetes (k3s). Il couvre l'ensemble du cycle de vie logiciel : de l'intégration continue au déploiement automatisé, en passant par l'analyse de qualité de code, le scan de sécurité et le monitoring.

L'application TodoList (Node.js / MongoDB) sert de support pour démontrer la mise en œuvre de cette infrastructure.

> Vous pouvez retrouver un document PDF de présentation du projet à la racine du repository.

---

## 🏗️ Architecture de l'infrastructure

### Cluster Kubernetes (K3s)

Le cluster est hébergé sur un **homelab** et administré via **Kite**, une interface graphique pour K3s. Le cluster est découpé en **quatre namespaces** distincts pour isoler les responsabilités :

| Namespace | Rôle |
|---|---|
| `giveaway` | Héberge l'application (API + front) et la base de données MongoDB |
| `giveaway-ci` | Espace dédié aux pipelines CI/CD Tekton (exécution des PipelineRuns) |
| `monitoring` | Stack d'observabilité avec Grafana et Prometheus |
| `sonarqube` | Instance SonarQube pour l'analyse statique du code |

### Schéma global

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HOMELAB — Cluster K3s                        │
│                         (Interface : Kite)                          │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │  giveaway-ci     │  │  giveaway        │  │  monitoring       │  │
│  │                  │  │                  │  │                   │  │
│  │  Tekton Triggers │  │  TodoList API    │  │  Prometheus       │  │
│  │  Tekton Pipeline │──│  MongoDB         │  │  Grafana          │  │
│  │  EventListener   │  │  Service LB      │  │                   │  │
│  └──────────────────┘  └──────────────────┘  └───────────────────┘  │
│                                                                     │
│  ┌──────────────────┐                                               │
│  │  sonarqube       │                                               │
│  │                  │                                               │
│  │  SonarQube       │                                               │
│  └──────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔁 Pipeline CI/CD — Tekton

Le cœur du projet repose sur une **pipeline Tekton** déclenchée automatiquement à chaque push sur la branche `main` via un **webhook GitHub**. La pipeline orchestre 6 étapes séquentielles :

### Déclenchement

Un **EventListener** écoute les webhooks GitHub. Lorsqu'un `push` est détecté sur `refs/heads/main`, un **TriggerBinding** extrait les paramètres (URL du dépôt, révision) et un **TriggerTemplate** crée un nouveau `PipelineRun`.

```
GitHub Push (main) ──▶ Webhook ──▶ EventListener ──▶ TriggerBinding ──▶ TriggerTemplate ──▶ PipelineRun
```

### Étapes de la pipeline

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  1. Clone    │───▶│  2. Tests    │───▶│  3. Quality  │───▶│  4. Build    │───▶│  5. Trivy    │───▶│  6. Deploy   │
│  git-clone   │    │  npm test    │    │  SonarQube   │    │  Kaniko      │    │  Scan Sécu   │    │  kubectl     │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

#### 1. 📥 Fetch Repository (`git-clone`)
Clone le dépôt Git depuis GitHub dans un workspace partagé utilisé par toutes les étapes suivantes.

#### 2. 🧪 Run Tests (`run-tests`)
Exécute les tests unitaires et d'intégration via `npm test` (Jest + Supertest). Un **sidecar MongoDB** est démarré automatiquement pour fournir une base de données de test éphémère, garantissant un environnement de test isolé et reproductible.

#### 3. 📊 Quality Gate (`sonar-scan`)
Lance une analyse statique du code via **SonarQube**. Cette étape vérifie la qualité du code (bugs, code smells, couverture, duplications) et agit comme un **quality gate** : si les seuils de qualité ne sont pas respectés, la pipeline échoue.

#### 4. 🐳 Build & Push (`kaniko`)
Construit l'image Docker de l'application avec **Kaniko** (build d'images sans daemon Docker, adapté aux environnements Kubernetes) et la pousse sur **Docker Hub** (`docker.io/thysmadev/todolist-app:latest`).

#### 5. 🔒 Trivy Scan (`trivy-scan`)
Effectue un **scan de vulnérabilités** sur l'image Docker fraîchement construite avec **Trivy** (Aqua Security). Les vulnérabilités de sévérité `HIGH` et `CRITICAL` sont détectées et un rapport JSON est généré. Une **notification Discord** est ensuite envoyée automatiquement avec un résumé coloré :
- 🔴 Vulnérabilités critiques détectées
- 🟠 Vulnérabilités hautes détectées
- ✅ Aucune vulnérabilité majeure

#### 6. 🚀 Deploy Kubernetes (`deploy-kubernetes`)
Applique les manifestes Kubernetes (Infrastructure as Code) dans le namespace `giveaway`, force un **rollout restart** du déploiement pour tirer la nouvelle image, puis attend la confirmation du déploiement réussi.

### Tasks Tekton utilisées

| Task | Type | Description |
|---|---|---|
| `git-clone` | Task | Clone du dépôt Git |
| `run-tests` | Inline TaskSpec | Tests npm avec sidecar MongoDB |
| `sonar-scan` | Task | Analyse SonarQube |
| `kaniko` | Task | Build et push d'image Docker |
| `trivy-scan` | Inline TaskSpec | Scan de vulnérabilités + notification Discord |
| `deploy-kubernetes` | Inline TaskSpec | Déploiement via kubectl |

---

## 🛡️ Outils de l'écosystème

### Tekton

**Tekton** est un framework open-source de CI/CD cloud-native, conçu pour fonctionner nativement sur Kubernetes. Contrairement aux solutions CI/CD traditionnelles (Jenkins, GitLab CI), Tekton s'exécute entièrement sous forme de ressources Kubernetes (CRDs). Chaque étape de la pipeline est un conteneur isolé, ce qui garantit la reproductibilité et l'isolation des environnements d'exécution.

### SonarQube

**SonarQube** est une plateforme d'analyse statique de code qui détecte automatiquement les bugs, les vulnérabilités de sécurité, les code smells et mesure la couverture de tests. Il fournit un **Quality Gate** configurable qui définit des seuils de qualité minimaux à respecter avant qu'un code puisse être considéré comme prêt pour la production. Dans ce projet, SonarQube est hébergé directement dans le cluster dans son propre namespace.

### Grafana

**Grafana** est une plateforme de visualisation et de monitoring. Elle permet de créer des **dashboards** interactifs pour suivre en temps réel l'état de santé du cluster et des applications : utilisation CPU/mémoire, latence réseau, nombre de pods actifs, taux d'erreurs, etc. Grafana se connecte à des sources de données comme Prometheus pour transformer des métriques brutes en visualisations exploitables.

### Prometheus

**Prometheus** est un système de monitoring et d'alerte open-source. Il collecte et stocke des **métriques** sous forme de séries temporelles en interrogeant (scraping) périodiquement les endpoints des applications et composants du cluster. Il sert de source de données principale pour Grafana et permet de définir des **règles d'alerte** en cas de dépassement de seuils (ex. : CPU > 80%, pod en CrashLoopBackOff).

### Trivy

**Trivy** (Aqua Security) est un scanner de vulnérabilités open-source pour les images de conteneurs. Il analyse les dépendances système et applicatives de l'image Docker pour détecter les **CVE** (Common Vulnerabilities and Exposures) connues, classées par sévérité (LOW, MEDIUM, HIGH, CRITICAL).

### Kaniko

**Kaniko** est un outil de build d'images Docker qui fonctionne **sans daemon Docker**. C'est la solution idéale pour construire des images dans un cluster Kubernetes où l'accès au socket Docker n'est ni disponible ni souhaitable pour des raisons de sécurité.

---

## 📦 Déploiement Kubernetes

L'application est déployée dans le namespace `giveaway` avec les ressources suivantes :

| Ressource | Type | Description |
|---|---|---|
| `todolist-api` | Deployment | API Node.js (1 réplica, image depuis Docker Hub) |
| `mongodb` | Deployment | Base de données MongoDB 4.4 |
| `todolist-entrypoint` | Service (LoadBalancer) | Point d'entrée externe, port 80 → 3000 |
| `mongodb` | Service (ClusterIP) | Accès interne à MongoDB, port 27017 |

---

## 🔔 Notifications

La pipeline intègre un système de **notification Discord** automatique à l'issue du scan de sécurité Trivy. Un webhook Discord envoie un embed coloré contenant :
- Le nombre de vulnérabilités critiques et hautes
- Le nom de l'image scannée
- Un code couleur visuel (rouge / orange / vert)

---

## 🧰 Stack technique

| Composant | Technologie |
|---|---|
| Orchestrateur | K3s (Kubernetes léger) |
| Interface cluster | Kite |
| CI/CD | Tekton Pipelines + Triggers |
| Build d'images | Kaniko |
| Registre d'images | Docker Hub |
| Analyse de code | SonarQube |
| Scan de sécurité | Trivy (Aqua Security) |
| Monitoring | Prometheus + Grafana |
| Notifications | Discord (Webhook) |
| Application | Node.js + Express + MongoDB |
| Tests | Jest + Supertest |
| Conteneurisation | Docker (image Alpine) |

---

## 📂 Structure du projet

```
.
├── Dockerfile                  # Image de production (Node Alpine)
├── compose.yml                 # Stack Docker Compose (dev local)
├── package.json
├── server.js
├── public/                     # Frontend (HTML/JS statique)
├── tests/                      # Tests Jest
├── k8s/                        # Manifestes Kubernetes (IaC)
│   ├── namespace.yaml
│   ├── api-deployment.yaml
│   ├── api-service.yaml
│   ├── mongodb-deployment.yaml
│   └── mongodb-service.yaml
└── tekton/                     # Ressources Tekton (CI/CD)
    ├── pipeline.yaml           # Pipeline principale (6 étapes)
    ├── task-git-clone.yaml     # Task : clone du dépôt
    ├── task-kaniko.yaml        # Task : build & push image Docker
    ├── task-sonar-scan.yaml    # Task : analyse SonarQube
    ├── task-deploy-kubernetes.yaml  # Task : déploiement kubectl
    ├── event-listener.yaml     # EventListener (webhook GitHub)
    ├── trigger.yaml            # Trigger (lie binding + template)
    ├── trigger-binding.yaml    # TriggerBinding (extraction params)
    ├── trigger-template.yaml   # TriggerTemplate (création PipelineRun)
    └── rbac.yaml               # ServiceAccount & ClusterRoleBinding
```

---

