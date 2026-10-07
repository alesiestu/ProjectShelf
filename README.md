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

## Lingue

L'interfaccia supporta italiano e inglese. La lingua viene rilevata automaticamente dal sistema e può essere cambiata dalla barra superiore.

## Tecnologia

ProjectShelf è costruito con:

- [TinyJS](https://tinyjs.app/), per una finestra desktop nativa leggera;
- JavaScript, HTML e CSS senza framework frontend;
- Git CLI per leggere lo stato dei repository.

Non usa Electron, server HTTP, database o servizi cloud. I dati restano sul computer e vengono salvate solo le preferenze locali dell'app.

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
