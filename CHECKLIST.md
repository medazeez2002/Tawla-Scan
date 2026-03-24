# ✅ Checklist d'Installation - Tawla Scan

## 1️⃣ MySQL Setup
- [ ] Télécharger MySQL Community Server depuis https://dev.mysql.com/downloads/mysql/
- [ ] Installer MySQL (password: `root123`)
- [ ] Vérifier que le service MySQL80 est en cours d'exécution
- [ ] Initialiser la base de données: `.\init-db.ps1` ou `mysql -u root -p < database.sql`
- [ ] Tester: `mysql -u root -p` → `SHOW DATABASES;` → voir `tawla_scan`

## 2️⃣ Configuration Node.js
- [ ] ✅ `npm install express mysql2 cors dotenv concurrently` (FAIT)
- [ ] ✅ Fichier `.env` créé avec config MySQL (FAIT)
- [ ] ✅ Fichier `.env.local` créé avec `VITE_API_URL` (FAIT)
- [ ] ✅ Fichier `server.js` créé (FAIT)
- [ ] ✅ Fichier `src/lib/api.ts` créé (FAIT)
- [ ] ✅ `package.json` mis à jour avec scripts (FAIT)

## 3️⃣ Démarrage de l'App
### Première Fois:
```powershell
# Terminal 1: Démarrer le backend
npm run server

# Terminal 2: Démarrer le frontend
npm run dev
```

### Prochaines Fois:
```powershell
# Ou en une seule commande:
npm run dev:all
```

## 4️⃣ Tests
- [ ] Backend: Ouvrez http://localhost:3001/api/health (doit voir "ok")
- [ ] Frontend: Ouvrez http://localhost:5184 (doit voir l'app)
- [ ] Menu: http://localhost:3001/api/menu-items (doit voir 13 articles)
- [ ] Orders: Passez une commande → refresh http://localhost:3001/api/orders

## 5️⃣ Structure des Fichiers Créés
```
/Tawla Scan/
├── database.sql           ← Schéma & données MySQL
├── server.js              ← Serveur Node.js Express
├── init-db.ps1            ← Script pour initialiser DB
├── docker-compose.yml     ← Config Docker (optionnel)
├── MYSQL_SETUP.md        ← Guide installation MySQL
├── SETUP_GUIDE_FR.md     ← Guide complet en français
├── .env                  ← Config MySQL
├── .env.local            ← Config Vite
├── package.json          ← Mis à jour avec scripts
└── src/lib/api.ts        ← Client API pour React
```

## 📝 Notes Importantes
- Mot de passe MySQL par défaut: `root123` (changez-le en production)
- Backend sur: `http://localhost:3001`
- Frontend sur: `http://localhost:5184` (ou autre si port busy)
- Base de données: `tawla_scan`
- Utilisateur MySQL: `root`

---

## 🆘 Si quelque chose ne marche pas:
1. Vérifiez que MySQL est VRAIMENT en cours d'exécution
2. Essayez de vous connecter manuellement: `mysql -u root -p`
3. Regardez les erreurs exactes dans la console
4. Montrez-moi les erreurs si ça ne marche pas!

---

## ✨ Félicitations!
Une fois tout configuré, vous aurez:
✅ Une app React moderne avec Vite
✅ Un backend Node.js Express
✅ Une base de données MySQL 8.0
✅ Real-time order management
✅ API REST complète pour les commandes
✅ Persistence des données en base de données
