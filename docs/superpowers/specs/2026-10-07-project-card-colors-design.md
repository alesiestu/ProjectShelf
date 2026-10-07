# Project card colors

## Obiettivo

Permettere di evidenziare manualmente i progetti nella board assegnando un colore alla singola card. Il colore deve essere un aiuto visivo, senza modificare la classificazione Active/Idle/Stale/Cleanup e senza nascondere le informazioni della card.

## Esperienza utente

Ogni card mostra un piccolo controllo colore vicino al nome del progetto. Cliccando il controllo si apre una palette con:

- nessun colore;
- blu;
- verde;
- giallo;
- arancione;
- rosso;
- viola.

La scelta applica un bordo verticale sul lato sinistro della card e una tinta di sfondo molto leggera. Il testo, i tag e i pulsanti mantengono lo stile normale per garantire leggibilità. L'opzione senza colore rimuove completamente l'evidenziazione.

## Persistenza

Il frontend carica da `app.store` una mappa delle preferenze colore indicizzata dal percorso assoluto del progetto:

```json
{
  "/Users/alessandro/Workspace/project": "blue"
}
```

La mappa viene aggiornata quando l'utente sceglie o rimuove un colore. Le preferenze sopravvivono a nuove scansioni, filtri, cambio lingua e riapertura dell'app. I progetti senza preferenza usano lo stile standard.

## Architettura

- `src/main.js` espone `projectColors` in `loadPrefs` e lo salva tramite `savePrefs`.
- `src/frontend/app.js` mantiene la selezione, renderizza la palette e aggiunge la classe colore alla card.
- `src/frontend/style.css` definisce bordo e sfondo attenuato per i colori disponibili.
- La delega degli eventi sul contenitore della board evita listener separati per ogni card e continua a funzionare dopo ogni render.

## Compatibilità e sicurezza

- I valori accettati sono solo i nomi della palette definita; valori sconosciuti vengono ignorati.
- Il percorso resta la chiave, quindi due cartelle con lo stesso nome possono avere colori diversi.
- Il colore non cambia filtri, statistiche, scansione Git o criterio `safeToRemove`.
- Il controllo deve avere `title` e `aria-label` per descrivere l'azione e la lingua corrente.

## Verifica

1. Assegnare colori diversi a più progetti.
2. Verificare che il colore resti dopo Rescan e dopo il cambio filtro.
3. Chiudere e riaprire l'app e verificare la persistenza.
4. Rimuovere il colore e verificare il ritorno allo stile standard.
5. Verificare che italiano e inglese traducano il controllo e i nomi dei colori.
6. Eseguire `tinyjs build` e controllare che il backend compili.
