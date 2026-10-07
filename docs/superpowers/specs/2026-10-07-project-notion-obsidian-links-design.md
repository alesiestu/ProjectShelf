# Project Notion and Obsidian links

## Obiettivo

Permettere di associare contemporaneamente a ogni progetto una pagina Notion e una nota Obsidian, aprendole direttamente con l'applicazione appropriata.

## Esperienza utente

Ogni card mostra due azioni indipendenti:

- `Aggiungi Notion` / `Notion`;
- `Aggiungi Obsidian` / `Obsidian`.

Se il link non esiste, il click apre un dialog per inserirlo. Se esiste, il click apre direttamente la destinazione. Un'azione secondaria permette di modificare o rimuovere solo quel collegamento, senza alterare l'altro.

Notion usa URL web `https://...` e viene aperto nel browser predefinito. Obsidian usa un URI `obsidian://open?...`, copiato dall'utente da Obsidian, e viene aperto dal sistema nell'app Obsidian con vault e nota indicati dal link.

## Persistenza

I collegamenti vengono salvati in `app.store` come mappa indicizzata dal percorso assoluto del progetto:

```json
{
  "/Users/alessandro/Workspace/project": {
    "notion": "https://www.notion.so/...",
    "obsidian": "obsidian://open?vault=...&file=..."
  }
}
```

La mappa sopravvive a scansioni, filtri, cambio lingua e riapertura dell'app. I due valori sono indipendenti: rimuovere Notion non rimuove Obsidian e viceversa.

## Architettura

- `src/main.js` carica `projectKnowledgeLinks`, valida i protocolli consentiti (`http:`, `https:`, `obsidian:`), salva la mappa e apre i link tramite il comando macOS `open`.
- `src/frontend/index.html` ospita un dialog riutilizzabile per il tipo di link selezionato.
- `src/frontend/app.js` gestisce le due azioni, il dialog, la persistenza e le traduzioni.
- `src/frontend/style.css` distingue visivamente i due pulsanti e il dialog.

## Compatibilità e sicurezza

- Notion accetta solo URL `http://` e `https://`.
- Obsidian accetta solo URI `obsidian://`.
- I link vengono aperti dal sistema e non caricati dentro la webview dell'app.
- URL o URI non validi vengono rifiutati e non salvati.
- I collegamenti restano indipendenti da colori, stelline, filtri e stato Git.

## Verifica

1. Salvare un link Notion e un link Obsidian nello stesso progetto.
2. Aprire entrambi e verificare che ogni destinazione usi l'app corretta.
3. Modificare e rimuovere uno dei due link senza alterare l'altro.
4. Provare protocolli non validi e verificare che vengano rifiutati.
5. Verificare persistenza dopo rescan, cambio lingua e riavvio.
6. Eseguire `tinyjs build` e verificare il bundle firmato.
