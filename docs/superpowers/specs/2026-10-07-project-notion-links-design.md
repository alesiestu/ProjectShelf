# Project Notion links

## Obiettivo

Permettere di associare a ogni progetto una pagina Notion esterna dove gestire step, todo e note operative.

## Esperienza utente

Ogni card mostra un'azione Notion:

- `Aggiungi Notion` quando il progetto non ha ancora un link;
- `Notion` quando il link è già configurato.

Il primo click apre un dialog con un campo URL e le azioni Salva e Annulla. Un progetto già configurato apre direttamente il link nel browser. Un'azione secondaria permette di modificare o rimuovere il collegamento.

ProjectShelf non integra la pagina Notion, non usa l'API Notion e non richiede autenticazione: conserva solo l'URL e delega l'apertura al browser predefinito.

## Persistenza

I link vengono salvati in `app.store` come mappa indicizzata dal percorso assoluto del progetto:

```json
{
  "/Users/alessandro/Workspace/project": "https://www.notion.so/..."
}
```

La mappa sopravvive a scansioni, filtri, cambio lingua e riapertura dell'app. L'assenza della chiave equivale a nessun link configurato.

## Architettura

- `src/main.js` carica `projectNotionLinks`, valida URL `http`/`https`, salva la mappa e apre i link tramite il comando macOS `open`.
- `src/frontend/app.js` gestisce dialog, stato dei link, traduzioni e azioni della card.
- `src/frontend/style.css` definisce il dialog e lo stile del pulsante Notion.

## Compatibilità e sicurezza

- Sono accettati solo URL con schema `http://` o `https://`.
- I link vengono passati al browser di sistema e non caricati dentro la webview dell'app.
- Un URL non valido mostra un messaggio di errore e non viene salvato.
- Il link è indipendente da colori, stelline, filtri e stato Git.

## Verifica

1. Aggiungere un link Notion a un progetto.
2. Aprire il link e verificare che parta il browser predefinito.
3. Modificare il link e rimuoverlo.
4. Verificare persistenza dopo rescan, cambio lingua e riavvio.
5. Provare un URL non valido e verificare che venga rifiutato.
6. Eseguire `tinyjs build` e verificare il bundle firmato.
