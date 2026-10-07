# Project priority ratings

## Obiettivo

Permettere di assegnare manualmente da 0 a 5 stelline a ogni progetto, così da indicare la priorità personale e filtrare rapidamente i repository più importanti.

## Esperienza utente

Ogni card mostra cinque stelle vicino al nome del progetto. Le stelle già assegnate sono evidenziate; le restanti restano disponibili per aumentare la valutazione. Cliccando una stella si imposta quel valore. Cliccando nuovamente la valutazione già attiva si azzera il voto.

La valutazione non modifica lo stato Git, la classificazione temporale, i colori personalizzati o i criteri di sicurezza.

## Filtri

La barra dei filtri viene estesa con filtri a soglia:

- Tutti;
- 5 stelle;
- 4+ stelle;
- 3+ stelle;
- 1+ stella.

Il filtro mostra i progetti con una valutazione maggiore o uguale alla soglia. Le card restano nelle colonne Active/Idle/Stale/Cleanup. All'interno delle colonne, i progetti vengono ordinati prima per numero di stelle decrescente e poi per ultima attività.

## Persistenza

Le valutazioni vengono salvate in `app.store` come mappa indicizzata dal percorso assoluto:

```json
{
  "/Users/alessandro/Workspace/project": 4
}
```

I valori validi sono interi da 1 a 5. L'assenza della chiave equivale a 0 stelle. La mappa sopravvive a scansioni, filtri, cambio lingua e riapertura dell'app.

## Architettura

- `src/main.js` carica `projectRatings` e valida i valori prima di salvarli.
- `src/frontend/app.js` renderizza le stelle, gestisce i click, mantiene il filtro a soglia e ordina le card.
- `src/frontend/style.css` definisce stelle, stato attivo, hover e focus accessibile.
- Le etichette dei filtri e gli attributi `aria-label` sono tradotti in italiano e inglese.

## Verifica

1. Assegnare valutazioni diverse a più progetti.
2. Verificare che un secondo click sulla valutazione attiva azzeri il voto.
3. Verificare i filtri 5, 4+, 3+ e 1+.
4. Verificare l'ordinamento per stelle dentro ogni colonna.
5. Eseguire Rescan, cambiare lingua, chiudere e riaprire l'app.
6. Confermare che colori, filtri esistenti e valutazioni restino indipendenti.
7. Eseguire `tinyjs build` e verificare il bundle firmato.
