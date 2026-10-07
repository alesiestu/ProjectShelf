# Project Git status view

## Obiettivo

Permettere di ispezionare rapidamente lo stato locale di un repository facendo click sul tag dei file modificati, senza aprire subito un diff completo.

## Esperienza utente

Il tag `N modified` nella card diventa cliccabile quando il progetto ha modifiche. Il click apre una finestra compatta con:

- branch corrente;
- numero di file modificati;
- ultimo commit e presenza del remote;
- elenco sintetico dei file con stato Git;
- azione `Diff` per caricare il dettaglio solo sul file richiesto;
- azione `Apri Terminale` per continuare il lavoro nella repository.

Gli stati Git vengono mostrati come modificato, aggiunto, eliminato o non tracciato. Il diff viene visualizzato in una sezione richiudibile della stessa finestra e può includere file staged e non staged.

## Backend

`src/main.js` espone un metodo read-only `repoStatus` che:

- accetta il percorso di una repository;
- esegue `git status --short --branch` per il riepilogo;
- esegue `git diff --stat` e `git diff --cached --stat` per le statistiche;
- restituisce file, stato, branch e conteggi;
- espone `repoDiff` per leggere il diff di un file selezionato, senza modificare il repository.

I percorsi ricevuti vengono passati come argomenti separati a Git, senza shell interpolation. Gli errori Git vengono restituiti come messaggi leggibili e non interrompono la scansione generale.

## Frontend

- Il tag modifiche usa un pulsante accessibile con `aria-label`.
- Il dialog viene aperto con il progetto selezionato e carica il riepilogo tramite API.
- Il diff viene richiesto solo sul click del file.
- Output testuale e percorsi vengono escapati prima del rendering.
- La vista supporta italiano e inglese e resta indipendente da filtri, colori, stelline, Todo e link esterni.

## Verifica

1. Aprire il riepilogo da una card modificata.
2. Verificare branch, conteggi e stati dei file.
3. Aprire il diff di un file staged e di uno non staged.
4. Provare un file non tracciato senza diff disponibile.
5. Aprire il Terminale dalla finestra.
6. Verificare che repository pulite non mostrino un tag cliccabile.
7. Eseguire `tinyjs build` e verificare il bundle firmato.
