---
description: BetGuess projesini sunucuya deploy etme
---

# BetGuess Deploy Workflow

Sunucu: `tepe@192.168.1.100:2222`
Uzak dizin: `~/betguess`
Port: `3002`
PM2 process: `betguess`
URL: `https://betguess.mytepeapi.com.tr`

## Tam Deploy (Client + Server)

// turbo-all

1. Client'ı build et:
```
cd client && npm run build
```

2. Server dosyalarını sunucuya gönder:
```
scp -P 2222 -r server/src server/package.json server/package-lock.json server/tsconfig.json tepe@192.168.1.100:~/betguess/server/
```

3. Client build dosyalarını sunucuya gönder:
```
ssh -p 2222 tepe@192.168.1.100 "rm -rf ~/betguess/client/dist"
scp -P 2222 -r client/dist tepe@192.168.1.100:~/betguess/client/
```

4. Sunucuda npm install ve build yap:
```
ssh -p 2222 tepe@192.168.1.100 "cd ~/betguess/server && npm install --production=false 2>&1 | tail -3 && npx tsc 2>&1"
```

5. PM2 ile sunucuyu yeniden başlat:
```
ssh -p 2222 tepe@192.168.1.100 "pm2 restart betguess 2>&1"
```

6. Health check yap:
```
ssh -p 2222 tepe@192.168.1.100 "curl -s http://localhost:3002/api/health"
```

## Alternatif: PowerShell Script ile

Proje kök dizininde `deploy.ps1` scripti mevcuttur:

```powershell
# Tam deploy
.\deploy.ps1

# Sadece server değişikliklerini deploy et
.\deploy.ps1 -ServerOnly

# Sadece client değişikliklerini deploy et
.\deploy.ps1 -ClientOnly
```

## PM2 Yönetim Komutları

```bash
# Durumu kontrol et
ssh -p 2222 tepe@192.168.1.100 "pm2 status betguess"

# Logları gör
ssh -p 2222 tepe@192.168.1.100 "pm2 logs betguess --lines 50"

# Yeniden başlat
ssh -p 2222 tepe@192.168.1.100 "pm2 restart betguess"

# Durdur
ssh -p 2222 tepe@192.168.1.100 "pm2 stop betguess"
```
