# Déploiement sur Vercel — Arbre GHUSSEIN

## Méthode rapide (5 minutes)

### 1. Créer un repo GitHub
```bash
cd ghussein-tree
git remote add origin https://github.com/kandasc/ghussein-tree.git
git push -u origin master
```

### 2. Déployer sur Vercel
1. Aller sur https://vercel.com/new
2. Importer le repo `ghussein-tree`
3. Ajouter les variables d'environnement :
   - `NEXTAUTH_SECRET` = `ghussein-family-secret-sayele-2025-secure`
   - `NEXTAUTH_URL` = `https://[votre-url].vercel.app`
4. Cliquer **Deploy**

## Accès Admin
- **URL** : https://[votre-url].vercel.app/login
- **Identifiant** : `admin.ghussein`
- **Mot de passe** : `ghussein2025`

## Accès public (lecture seule)
- **URL** : https://[votre-url].vercel.app

## Changer le mot de passe
Dans `lib/auth.ts`, remplacer `ghussein2025` par votre nouveau mot de passe dans la ligne :
```ts
const ADMIN_HASH = bcrypt.hashSync('ghussein2025', 10);
```

## Note importante
Sur Vercel (serverless), la base de données fichier JSON est réinitialisée 
à chaque déploiement. Pour une persistance permanente, connectez une base 
Neon PostgreSQL (que vous utilisez déjà pour Kalpin).
