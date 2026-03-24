# 🗄️ Guide d'Installation - Tawla Scan avec MySQL

## 📋 Prérequis
- Node.js installé (vous l'avez déjà)
- MySQL Community Server (ou Docker)

---

## 🚀 Option 1: MySQL Local (Recommandé)

### 1️⃣ Télécharger et Installer MySQL
1. Allez sur: https://dev.mysql.com/downloads/mysql/
2. Téléchargez "MySQL Community Server" 8.0 ou 8.1 (Windows 64-bit)
3. Lancez l'installateur et suivez ces étapes:
   - **Config Type**: "Development Machine"
   - **MySQL Port**: 3306 (défaut)
   - **Root Password**: `root123` (ou votre mot de passe)
   - **Windows Service Name**: MySQL80

### 2️⃣ Démarrer MySQL
**Option A: Via Services (Recommandé)**
- Appuyez sur `Win+R`
- Tapez `services.msc`
- Trouvez "MySQL80"
- Clic droit → "Démarrer"

**Option B: Via PowerShell (Admin)**
```powershell
Start-Service MySQL80
```

### 3️⃣ Initialiser la Base de Données
```powershell
# Lancez ce script (adaptez le mot de passe si nécessaire)
.\init-db.ps1
```

Si le script ne fonctionne pas, utilisez:
```powershell
# Remplacez "root123" par votre mot de passe MySQL
mysql -u root -p < database.sql
# Entrez le mot de passe quand demandé
```

### 4️⃣ Vérifier la Connexion
```powershell
mysql -u root -p
# Entrez le mot de passe
# Tapez: SHOW DATABASES;
# Vous devriez voir "tawla_scan" dans la liste
```

---

## 🐳 Option 2: Docker (Plus Simple)

### 1️⃣ Installer Docker Desktop
- Téléchargez: https://www.docker.com/products/docker-desktop
- Installez et redémarrez

### 2️⃣ Démarrer MySQL avec Docker
```powershell
docker-compose up -d
```

Docker va:
- Télécharger MySQL 8.0
- Créer la base de données `tawla_scan`
- Importer les tables depuis `database.sql`

### 3️⃣ Vérifier MySQL
```powershell
docker exec tawla-scan-mysql mysql -u root -proot123 -e "SHOW DATABASES;"
```

---

## 🔧 Configuration Node.js

### 1️⃣ Vérifier le fichier `.env`
Le fichier `.env` contient déjà la configuration MySQL:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root123
DB_NAME=tawla_scan
PORT=3001
```

**Si vous avez changé le mot de passe MySQL**, mettez-le à jour dans `.env`

### 2️⃣ Tester le Serveur Backend
```powershell
npm run server
```

Vous devriez voir:
```
🚀 Server running on http://localhost:3001
📊 MySQL Database: tawla_scan
```

### 3️⃣ Démarrer l'App Complète
```powershell
# Terminal 1: Backend
npm run server

# Terminal 2: Frontend
npm run dev
```

**Ou en une seule commande:**
```powershell
npm run dev:all
```

---

## 🧪 Tester la Connexion

### Via Browser
Ouvrez: http://localhost:3001/api/health

Vous devriez voir:
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

### Vérifier les Données
- Menu items: http://localhost:3001/api/menu-items
- Offers: http://localhost:3001/api/offers
- Orders: http://localhost:3001/api/orders

---

## ❌ Troubleshooting

### "No connection established" (MySQL Workbench)
1. Vérifiez que MySQL est démarré (Services.msc)
2. Vérifiez le mot de passe dans Workbench
3. Assurez-vous que le port 3306 n'est pas bloqué par un firewall

### "ECONNREFUSED" ou erreur de connexion Node.js
1. Vérifiez que MySQL est en cours d'exécution
2. Vérifiez que `.env` a les bons paramètres
3. Assurez-vous que le port 3306 est disponible

### Database not found
Relancez le script d'initialisation:
```powershell
mysql -u root -p < database.sql
```

### Port 3306 en utilisation
Changez le port dans `.env`:
```env
DB_HOST=localhost:3307
```

---

## 📱 Utiliser l'App

1. Ouvrez http://localhost:5184 (ou le port affiché)
2. Sélectionnez les articles du menu
3. Allez au checkout
4. Visitez http://localhost:5184/restaurant pour voir les commandes

Les commandes seront maintenant **persistées dans MySQL** ✅

---

## 🎯 Prochaines Étapes

Vous pouvez maintenant:
- ✅ Ajouter/modifier des articles menu dans MySQL
- ✅ Voir les commandes en temps réel
- ✅ Changer le statut des commandes (pending → preparing → ready → completed)
- ✅ Déployer l'app en production avec un vrai serveur MySQL

Besoin d'aide? Montrez-moi les erreurs exactes que vous obtenez! 🚀
