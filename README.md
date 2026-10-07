# ProjectShelf

ProjectShelf è una piccola app desktop open source per macOS che aiuta a tenere sotto controllo i repository Git presenti in un workspace.

Scegli una cartella e ProjectShelf cerca i progetti al suo interno. Per ogni repository mostra:

- stato del progetto in base all'ultima attività;
- stack tecnologico riconosciuto;
- branch corrente;
- presenza di modifiche non committate;
- remote Git e commit non inviati;
- dimensione del progetto;
- indicazione di sicurezza prima di rimuoverlo localmente.

Sono disponibili anche filtri per vedere solo i progetti modificati, senza remote o recuperabili, oltre a pulsanti per aprire un progetto in Finder, Terminale o VS Code.

## Workspace remoti via SSH

Puoi aggiungere workspace presenti su VM o server raggiunti via SSH senza montare il filesystem. Apri `Workspace`, inserisci un alias già configurato in `~/.ssh/config` e un percorso remoto assoluto, poi premi `Rescan`.

La scansione aggiorna tutti i workspace locali e remoti abilitati. Ogni workspace SSH ha un timeout massimo di 60 secondi e viene mostrato con un badge `SSH` e l'alias dell'host. I progetti remoti supportano colori, stelle, tag, link Notion/Obsidian, Todo, Terminale e stato/diff Git in sola lettura. Finder e VS Code locale restano disponibili solo per i progetti locali.

ProjectShelf usa il client OpenSSH di sistema in modalità non interattiva (`BatchMode`) e non salva password, chiavi private o credenziali. Non vengono eseguiti comandi SSH arbitrari: i comandi di scansione e Git sono predefiniti e read-only.

## MCP locale per Codex

ProjectShelf include un piccolo server MCP locale. Apri il pulsante `MCP` nella barra superiore per avviare il servizio e copiare:

- la configurazione da aggiungere a Codex;
- il prompt di installazione e di utilizzo;
- endpoint e token temporanei del servizio.

Il server ascolta solo su `127.0.0.1` ed è protetto da un token. L'LLM può leggere i progetti e modificare solo colore, stelle, tag, link Notion/Obsidian e Todo. Non può leggere o modificare file, eseguire comandi, fare operazioni Git o cancellare repository.

Per avviare il server manualmente durante lo sviluppo:

```bash
pnpm install
pnpm mcp
```

Il servizio espone l'endpoint MCP su `/mcp`. Per i test automatici:

```bash
pnpm test:mcp
```

## Lingue

L'interfaccia supporta italiano e inglese. La lingua viene rilevata automaticamente dal sistema e può essere cambiata dalla barra superiore.

## Tecnologia

ProjectShelf è costruito con:

- [TinyJS](https://tinyjs.app/), per una finestra desktop nativa leggera;
- JavaScript, HTML e CSS senza framework frontend;
- Git CLI per leggere lo stato dei repository.
- Server MCP TypeScript ufficiale e Zod per gli schemi degli strumenti.

Non usa Electron, database o servizi cloud. Il server HTTP MCP è solo locale; i dati restano sul computer e vengono salvate solo le preferenze locali dell'app e il relativo file metadati.

## Sviluppo

È necessario avere TinyJS installato:

```bash
tinyjs dev
```

Per creare una build:

```bash
tinyjs build
```

## Licenza

Distribuito con licenza MIT. Vedi [LICENSE](LICENSE).
