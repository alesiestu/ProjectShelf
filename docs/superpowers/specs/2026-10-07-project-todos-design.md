# Project todos

## Obiettivo

Aggiungere una sezione Todo semplice e richiudibile dove annotare attività e collegarle a uno o più progetti della board.

## Esperienza utente

La sezione viene mostrata sotto le statistiche e sopra la board. È richiudibile: quando chiusa mostra solo il titolo `Todo` e il numero di attività aperte.

Quando aperta mostra una lista compatta. Ogni riga contiene:

- checkbox per segnare l'attività come completata;
- testo dell'attività;
- piccoli tag con i progetti collegati;
- azione per modificare o eliminare l'attività.

Un controllo `Aggiungi todo` apre un piccolo dialog con campo testo e selezione multipla dei progetti rilevati nella scansione. Un todo può non avere progetti collegati oppure essere associato a più progetti.

## Persistenza

I todo vengono salvati in `app.store` come array:

```json
[
  {
    "id": "todo-1",
    "text": "Controllare la migrazione",
    "projectPaths": ["/Users/alessandro/Workspace/project-a"],
    "done": false
  }
]
```

Il dato sopravvive a scansioni, filtri, cambio lingua e riapertura dell'app. Se un progetto collegato non è più presente nella scansione, il todo resta salvato ma il tag non viene mostrato nella lista finché il progetto non ricompare.

## Architettura

- `src/main.js` carica e salva `todos`, mantenendo testo, stato e percorsi collegati.
- `src/frontend/index.html` ospita la sezione richiudibile e il dialog riutilizzato per aggiunta/modifica.
- `src/frontend/app.js` gestisce lista, selezione multipla, completamento, modifica, eliminazione e traduzioni.
- `src/frontend/style.css` mantiene la sezione compatta, con tag piccoli e senza alterare la board.

## Compatibilità e sicurezza

- Il testo viene sempre escapato prima del rendering.
- I percorsi collegati vengono accettati solo come stringhe e filtrati rispetto ai progetti conosciuti quando vengono mostrati.
- Il completamento di un todo non modifica lo stato Git o la classificazione del progetto.
- La sezione usa colori e spaziatura già presenti nell'interfaccia.

## Verifica

1. Aggiungere un todo senza progetti.
2. Aggiungere un todo collegato a più progetti.
3. Completare, modificare ed eliminare un todo.
4. Chiudere e riaprire la sezione.
5. Verificare persistenza dopo rescan, cambio lingua e riavvio.
6. Verificare che i progetti collegati non alterino filtri, stelline, colori o link Notion/Obsidian.
7. Eseguire `tinyjs build` e verificare il bundle firmato.
