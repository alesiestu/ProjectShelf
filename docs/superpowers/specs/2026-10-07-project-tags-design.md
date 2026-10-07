# Project tags

## Obiettivo

Permettere di assegnare tag testuali liberi ai progetti, visualizzarli come pill compatte e usarli come filtri rapidi.

## Esperienza utente

Ogni card mostra un controllo `+ Tag`. Cliccandolo si apre un piccolo campo di inserimento. Premendo Invio il tag viene assegnato al progetto; gli spazi iniziali e finali vengono rimossi e i duplicati ignorati.

I tag compaiono nella card come pill compatte con un controllo `×` per rimuoverli. È possibile assegnare più tag allo stesso progetto.

La barra dei filtri mostra automaticamente i tag già presenti nei progetti. Cliccando un tag vengono mostrate solo le card che lo possiedono. Il filtro `Tutti` ripristina la vista completa. I tag non modificano classificazione Git, colori, stelline, todo o link esterni.

## Persistenza

I tag vengono salvati in `app.store` come mappa indicizzata dal percorso assoluto:

```json
{
  "/Users/alessandro/Workspace/project": ["client", "da seguire"]
}
```

La mappa sopravvive a scansioni, filtri, cambio lingua e riapertura dell'app.

## Architettura

- `src/main.js` carica `projectTags` e valida mappe, percorsi e array di stringhe.
- `src/frontend/app.js` gestisce input, assegnazione, rimozione, rendering e filtro dinamico.
- `src/frontend/style.css` definisce input e pill compatte con gli stili già presenti.

## Compatibilità e sicurezza

- I tag vengono sempre escapati prima del rendering.
- I valori vuoti vengono ignorati.
- Ogni tag viene limitato a 50 caratteri e ogni progetto a 12 tag per evitare dati eccessivi.
- Il confronto dei filtri è esatto e case-insensitive, mentre viene mantenuta la grafia inserita la prima volta.

## Verifica

1. Aggiungere un tag libero con Invio.
2. Aggiungere più tag allo stesso progetto.
3. Rimuovere un tag dalla pill.
4. Filtrare usando un tag dalla barra superiore.
5. Verificare persistenza dopo rescan, cambio lingua e riavvio.
6. Provare testo vuoto, duplicati e tag molto lunghi.
7. Eseguire `tinyjs build` e verificare il bundle firmato.
