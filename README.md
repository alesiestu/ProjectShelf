# ProjectShelf

ProjectShelf è una piccola app desktop open source per macOS che aiuta a ritrovare e riprendere i tuoi progetti Git, locali e su server SSH.

La vista iniziale **Da continuare** mette davanti preferiti, priorità e prossimo passo. **Recenti** mostra le sessioni aperte da ProjectShelf, **Preferiti** i progetti scelti da te, **Da pulire** i controlli Git e lo spazio occupato. La ricerca globale trova nome, percorso, tag e stack; premi `⌘K` o `/` per usarla.

In **Contesto** puoi salvare obiettivo, dove eri rimasto, prossimo passo, eventuale blocco e ambiente preferito (VS Code, Xcode, Codex o Terminale). **Riprendi** apre l’ambiente scelto, opzionalmente Terminale e note collegate, e registra l’ultima sessione separatamente dall’ultimo commit. I progetti SSH si riaprono nel Terminale con la chiave configurata. Le applicazioni esterne devono essere installate; i link alle note non sono una sincronizzazione dei contenuti.

Scegli una cartella e ProjectShelf cerca i progetti al suo interno. Per ogni repository mostra:

- stato del progetto in base all'ultima attività;
- stack tecnologico riconosciuto;
- branch corrente;
- presenza di modifiche non committate;
- remote Git e commit non inviati;
- dimensione del progetto;
- controlli sul branch corrente nella vista pulizia, senza garanzie di backup completo.

Ogni card può essere personalizzata con un colore, una valutazione da una a cinque stelle, tag liberi e link a una nota Notion e/o Obsidian. Sono disponibili filtri per vedere solo i progetti modificati, senza remote, recuperabili o con una priorità minima. Cliccando sul numero dei file modificati si apre una vista sintetica dello status Git, con il diff completo disponibile quando serve.

La sezione Todo consente di creare attività semplici e collegarle a uno o più progetti. Le attività aperte compaiono anche nelle card; da **Altro → Aggiungi todo** il progetto è già selezionato. I Todo e i conteggi dei filtri sono globali, mentre sopra le card appare il numero dei risultati visibili.

La scansione locale supporta anche i worktree con un file `.git`, scende fino a profondità 3 e mostra al massimo 400 repository. Le date commit mancanti restano sconosciute. La pulizia considera soprattutto il branch corrente: prima di rimuovere qualcosa verifica anche altri branch, tag, stash, file ignorati e accessibilità del remote. ProjectShelf non cancella repository.

## Backup dei metadati

Da **Backup** puoi esportare un JSON con contesti, priorità, colori, tag, link, Todo e configurazioni dei workspace. L’importazione ripristina solo le voci mancanti: non sovrascrive dati già presenti e mantiene le impostazioni dei workspace correnti. Una copia pre-importazione resta nello store locale dell’app. Il backup non contiene file dei repository, chiavi private o token MCP; può contenere nomi host e percorsi, quindi conservalo con cura.

Ogni modifica mostra il risultato del salvataggio. Se fallisce, resta in memoria e puoi usare **Riprova** prima di chiudere l’app.

## Workspace remoti via SSH

Puoi aggiungere workspace presenti su VM o server raggiunti via SSH senza montare il filesystem. Apri `Workspace` e inserisci alias SSH oppure indirizzo IP, utente, percorso remoto assoluto e chiave privata. La chiave predefinita è `~/.ssh/id_rsa`; puoi indicare un percorso diverso, ad esempio `~/.ssh/work-vm`.

La scansione aggiorna tutti i workspace locali e remoti abilitati. Ogni workspace SSH ha un timeout massimo di 60 secondi e viene mostrato con un badge `SSH` e l'alias dell'host. I progetti remoti supportano colori, stelle, tag, link Notion/Obsidian, Todo, Terminale e stato/diff Git in sola lettura. Finder e VS Code locale restano disponibili solo per i progetti locali.

ProjectShelf usa il client OpenSSH di sistema in modalità non interattiva (`BatchMode`) e non salva password, chiavi private o credenziali. Non vengono eseguiti comandi SSH arbitrari: i comandi di scansione e Git sono predefiniti e read-only.

## MCP locale per Codex

ProjectShelf include un piccolo server MCP locale. Apri il pulsante `MCP` nella barra superiore per avviare il servizio e copiare:

- la configurazione da aggiungere a Codex;
- il prompt di installazione e di utilizzo;
- endpoint e token temporanei del servizio.

Il server ascolta solo su `127.0.0.1` ed è protetto da un token. L'LLM può leggere i progetti e modificare solo colore, stelle, tag, link Notion/Obsidian, contesto di ripresa e Todo. Non può leggere o modificare file, eseguire comandi, fare operazioni Git o cancellare repository. `list_projects` include `metadata.context`; `update_project` accetta un oggetto `context` con i campi da aggiornare. L’ultima apertura è gestita dall’app. Le modifiche MCP vengono ricaricate automaticamente mentre il servizio è attivo (ogni 15 secondi o al ritorno nell’app, senza interrompere un dialogo di modifica).

La build completa include server, dipendenze e runtime Node: l’avvio da Applicazioni non dipende dalla cartella di lavoro. Endpoint e token vanno copiati nuovamente se il servizio viene riavviato o il token rigenerato.

Per avviare il server manualmente durante lo sviluppo:

```bash
pnpm install
pnpm mcp
```

Il servizio espone l'endpoint MCP su `/mcp`. Per i test automatici:

```bash
pnpm test
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
pnpm install
pnpm build
```

`pnpm build` genera `dist/ProjectShelf.app` e ne verifica la firma ad-hoc. Per il runtime MCP usa il Node che esegue lo script; per una distribuzione portabile scegli un binario Node standalone della stessa architettura del Mac tramite `PROJECTSHELF_NODE_BINARY=/percorso/node pnpm build`. Un Node Homebrew può dipendere da librerie Homebrew esterne. Il bundle non è notarizzato. Per aggiornare il Mac, chiudi ProjectShelf e sostituisci la sola app in `/Applications`; le preferenze rimangono separate.

## Licenza

Distribuito con licenza MIT. Vedi [LICENSE](LICENSE).
