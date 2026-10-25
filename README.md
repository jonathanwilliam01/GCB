<img src="public/icons/icon-192.png" width="96" alt="GCB" />

# GCB - Gestão e Controle do Bebê

Versão atual: **V1.26.10.04** · [Patch notes](PATCH_NOTES.md)

Angular, só front. Dados no `localStorage` do navegador (chave `gcb:data`), com backup/restauração em JSON na aba Bebê.

```bash
npm install
npm start        # http://localhost:4200
npm run build    # dist/gcb/browser
```

Deploy: importar o repositório no Vercel (config em `vercel.json`).
