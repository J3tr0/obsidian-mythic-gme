'use strict';

const { Plugin, ItemView, WorkspaceLeaf, addIcon, setIcon, PluginSettingTab, Setting } = require('obsidian');

const VIEW_TYPE = 'mythic-gme-view';

// ─── DATA ────────────────────────────────────────────────────────────────────

// Fate Chart: keyed by [oddsIndex][chaosFactor]
// Cell format: [exYesMax, yesMax, exNoMin]
//   roll <= exYesMax               → Exceptional Yes (0 = not possible)
//   exYesMax < roll <= yesMax      → Yes
//   yesMax < roll < exNoMin        → No
//   roll >= exNoMin                → Exceptional No (0 = not possible)
// Odds 0-8: Impossible, Nearly Impossible, Very Unlikely, Unlikely, 50/50,
//           Likely, Very Likely, Nearly Certain, Certain
const FATE_CHART = {
  0: { // Impossible
    1: [0,  1, 81],  2: [0,  1, 81],  3: [0,  1, 81],
    4: [1,  5, 82],  5: [2, 10, 83],  6: [3, 15, 84],
    7: [5, 25, 86],  8: [7, 35, 88],  9: [10,50, 91]
  },
  1: { // Nearly Impossible
    1: [0,  1, 81],  2: [0,  1, 81],  3: [1,  5, 82],
    4: [2, 10, 83],  5: [3, 15, 84],  6: [5, 25, 86],
    7: [7, 35, 88],  8: [10,50, 91],  9: [13,65, 94]
  },
  2: { // Very Unlikely
    1: [0,  1, 81],  2: [1,  5, 82],  3: [2, 10, 83],
    4: [3, 15, 84],  5: [5, 25, 86],  6: [7, 35, 88],
    7: [10,50, 91],  8: [13,65, 94],  9: [15,75, 96]
  },
  3: { // Unlikely
    1: [1,  5, 82],  2: [2, 10, 83],  3: [3, 15, 84],
    4: [5, 25, 86],  5: [7, 35, 88],  6: [10,50, 91],
    7: [13,65, 94],  8: [15,75, 96],  9: [17,85, 98]
  },
  4: { // 50/50
    1: [2, 10, 83],  2: [3, 15, 84],  3: [5, 25, 86],
    4: [7, 35, 88],  5: [10,50, 91],  6: [13,65, 94],
    7: [15,75, 96],  8: [17,85, 98],  9: [18,90, 99]
  },
  5: { // Likely
    1: [3, 15, 84],  2: [5, 25, 86],  3: [7, 35, 88],
    4: [10,50, 91],  5: [13,65, 94],  6: [15,75, 96],
    7: [17,85, 98],  8: [18,90, 99],  9: [19,95,100]
  },
  6: { // Very Likely
    1: [5, 25, 86],  2: [7, 35, 88],  3: [10,50, 91],
    4: [13,65, 94],  5: [15,75, 96],  6: [17,85, 98],
    7: [18,90, 99],  8: [19,95,100],  9: [20,99,  0]
  },
  7: { // Nearly Certain
    1: [7, 35, 88],  2: [10,50, 91],  3: [13,65, 94],
    4: [15,75, 96],  5: [17,85, 98],  6: [18,90, 99],
    7: [19,95,100],  8: [20,99,  0],  9: [20,99,  0]
  },
  8: { // Certain
    1: [10,50, 91],  2: [13,65, 94],  3: [15,75, 96],
    4: [17,85, 98],  5: [18,90, 99],  6: [19,95,100],
    7: [20,99,  0],  8: [20,99,  0],  9: [20,99,  0]
  }
};

const ODDS_LABELS = [
  'Impossibile', 'Quasi Impossibile', 'Molto Improbabile',
  'Improbabile', '50/50', 'Probabile', 'Molto Probabile',
  'Quasi Certo', 'Certo'
];

const ODDS_LABELS_EN = [
  'Impossible', 'Nearly Impossible', 'Very Unlikely',
  'Unlikely', '50/50', 'Likely', 'Very Likely',
  'Nearly Certain', 'Certain'
];

// Fate Check modifiers
const FATE_CHECK_ODDS_MOD = [-5, -4, -2, -1, 0, 1, 2, 4, 5]; // index = odds 0-8
const FATE_CHECK_CF_MOD   = [0, -5, -4, -2, -1, 0, 1, 2, 4, 5]; // index = CF (0 unused, 1-9)

// Event Focus Table (1d100)
const EVENT_FOCUS_TABLE = [
  { min: 1,   max: 5,   result: 'Evento Remoto' },
  { min: 6,   max: 10,  result: 'Evento Ambiguo' },
  { min: 11,  max: 20,  result: 'Nuovo PNG' },
  { min: 21,  max: 40,  result: 'Azione PNG' },
  { min: 41,  max: 45,  result: 'PNG Negativo' },
  { min: 46,  max: 50,  result: 'PNG Positivo' },
  { min: 51,  max: 55,  result: 'Avanzamento Filo' },
  { min: 56,  max: 65,  result: 'Regressione Filo' },
  { min: 66,  max: 70,  result: 'Chiusura Filo' },
  { min: 71,  max: 80,  result: 'PG Negativo' },
  { min: 81,  max: 85,  result: 'PG Positivo' },
  { min: 86,  max: 100, result: 'Contesto Attuale' }
];

// Scene Adjustment Table (1d10)
const SCENE_ADJUSTMENT = [
  'Rimuovi un Personaggio',
  'Aggiungi un Personaggio',
  'Riduci/Rimuovi un\'Attività',
  'Aumenta un\'Attività',
  'Rimuovi un Oggetto',
  'Aggiungi un Oggetto',
  'Fai 2 Aggiustamenti',
  'Fai 2 Aggiustamenti',
  'Fai 2 Aggiustamenti',
  'Fai 2 Aggiustamenti'
];

// NPC Behavior Table (2d10, range 2-20)
const NPC_BEHAVIOR = [
  null, null, // 0, 1 unused
  'Ritiro / Fuga',
  'Azione amichevole',
  'Cerca aiuto',
  'Osserva senza agire',
  'Esegue azione desiderata',
  'Azione erratica',
  'Attacca con cautela',
  'Svela informazioni',
  'Attacca con potenza',
  'Difende con forza',
  'Blocca o Ostacola',
  'Parla o Negozia',
  'Attività specifica',
  'Azione di gruppo',
  'Azione di supporto',
  'Cerca distanza / evita',
  'Perseguita o Tallona',
  'Distrugge o Rompe',
  'Incapacita / Cattura'
];

// Meaning Tables
const ACTIONS_1 = [
  'Abbandonare','Accompagnare','Attivare','Accordare','Imboscata',
  'Arrivare','Assistere','Attaccare','Ottenere','Negoziare',
  'Fare amicizia','Donare','Tradire','Bloccare','Rompere',
  'Trasportare','Celebrare','Cambiare','Chiudere','Combinare',
  'Comunicare','Nascondere','Continuare','Controllare','Creare',
  'Ingannare','Diminuire','Difendere','Ritardare','Negare',
  'Partire','Depositare','Distruggere','Disputare','Disturbare',
  'Diffidare','Dividere','Lasciar cadere','Facile','Energizzare',
  'Fuggire','Esporre','Fallire','Combattere','Fuggire',
  'Liberare','Guidare','Danneggiare','Guarire','Ostacolare',
  'Imitare','Imprigionare','Aumentare','Indulgere','Informare',
  'Indagare','Ispezionare','Invadere','Lasciare','Attirare',
  'Usare male','Muovere','Trascurare','Osservare','Aprire',
  'Opporsi','Rovesciare','Lodare','Procedere','Proteggere',
  'Punire','Inseguire','Reclutare','Rifiutare','Rilasciare',
  'Rinunciare','Riparare','Respingere','Tornare','Ricompensare',
  'Rovinare','Separare','Iniziare','Fermare','Strano',
  'Lottare','Riuscire','Supportare','Sopprimere','Prendere',
  'Minacciare','Trasformare','Intrappolare','Viaggiare','Trionfare',
  'Tregua','Fidarsi','Usare','Usurpare','Sprecare'
];

const ACTIONS_2 = [
  'Vantaggio','Avversità','Accordo','Animale','Attenzione',
  'Equilibrio','Battaglia','Benefici','Edificio','Peso',
  'Burocrazia','Affari','Caos','Comfort','Completamento',
  'Conflitto','Cooperazione','Pericolo','Difesa','Esaurimento',
  'Svantaggio','Distrazione','Elementi','Emozione','Nemico',
  'Energia','Ambiente','Aspettativa','Esterno','Stravaganza',
  'Fallimento','Fama','Paura','Libertà','Amico',
  'Obiettivo','Gruppo','Salute','Ostacolo','Casa',
  'Speranza','Idea','Malattia','Illusione','Individuo',
  'Informazione','Innocente','Intelletto','Interno','Investimento',
  'Leadership','Legale','Luogo','Militare','Disgrazia',
  'Banale','Natura','Bisogni','Notizia','Normale',
  'Oggetto','Oscurità','Ufficiale','Opposizione','Esterno',
  'Dolore','Percorso','Pace','Persone','Personale',
  'Fisico','Trama','Portale','Possessi','Povertà',
  'Potere','Prigione','Progetto','Protezione','Rassicurazione',
  'Rappresentante','Ricchezze','Sicurezza','Forza','Successo',
  'Sofferenza','Sorpresa','Tattica','Tecnologia','Tensione',
  'Tempo','Prova','Valore','Veicolo','Vittoria',
  'Vulnerabilità','Arma','Tempo atmosferico','Lavoro','Ferita'
];

const DESC_1 = [
  'Avventurosamente','Aggressivamente','Ansiosamente','Goffamente','Magnificamente',
  'Cupamente','Audacemente','Coraggiosamente','Affaccendatamente','Tranquillamente',
  'Attentamente','Senza cura','Cautamente','Incessantemente','Allegramente',
  'Combattivamente','Con freddezza','Follemente','Curiosamente','Pericolosamente',
  'Sfidando','Deliberatamente','Delicatamente','Deliziosamente','Fiocamente',
  'Efficientemente','Emotivamente','Energicamente','Enormemente','Con entusiasmo',
  'Eccitato','Con timore','Ferocemente','Furiosamente','Scioccamente',
  'Fortunatamente','Freneticamente','Liberamente','Spaventosamente','Completamente',
  'Generosamente','Dolcemente','Con gioia','Graziosamente','Con gratitudine',
  'Felicemente','Frettolosamente','Sanamente','Utilmente','Senza speranza',
  'Con disperazione','Innocentemente','Intensamente','Interessantemente','Irritantemente',
  'Gioiosamente','Gentilmente','Pigramente','Leggermente','Rumorosamente',
  'Amorevolmente','Lealmente','Maestosamente','Significativamente','Meccanicamente',
  'Mildemente','Miseramente','In modo beffardo','Misteriosamente','Naturalmente',
  'Ordinatamente','Gentilmente','Stranamente','Parzialmente','Passivamente',
  'Pacificamente','Perfettamente','Scherzosamente','Cortesemente','Positivamente',
  'Potentemente','In modo pittoresco','Litigiosamente','Quietamente','Rudemente',
  'Rudemente','Senza pietà','Lentamente','Dolcemente','Stranamente',
  'Velocemente','Minacciosamente','Timidamente','Molto','Violentemente',
  'Selvaggiamente','Con resa'
];

const DESC_2 = [
  'Anormale','Divertente','Artificiale','Medio','Bello',
  'Bizzarro','Noioso','Brillante','Rotto','Pulito',
  'Freddo','Colorato','Incolore','Confortante','Inquietante',
  'Carino','Danneggiato','Scuro','Sconfitto','Sporco',
  'Sgradevole','Asciutto','Opaco','Vuoto','Enorme',
  'Straordinario','Stravagante','Sbiadito','Familiare','Elegante',
  'Debole','Festoso','Impeccabile','Desolato','Fragile',
  'Fragrante','Fresco','Pieno','Glorioso','Grazioso',
  'Duro','Aspro','Sano','Pesante','Storico',
  'Orribile','Importante','Interessante','Giovanile','Mancante',
  'Grande','Sontuoso','Magro','Inferiore','Letale',
  'Vivace','Solitario','Amabile','Magnifico','Maturo',
  'Caotico','Potente','Militare','Moderno','Banale',
  'Misterioso','Naturale','Normale','Strano','Ufficiale',
  'Vecchio','Pallido','Pacifico','Piccolo','Povero',
  'Potente','Protettivo','Pittoresco','Raro','Rassicurante',
  'Notevole','Marcio','Grezzo','Rovinato','Rustico',
  'Spaventoso','Scioccante','Semplice','Piccolo','Liscio',
  'Morbido','Forte','Elegante','Sgradevole','Prezioso',
  'Vivace','Caldo','Acquoso','Debole','Giovane'
];

const ELEMENTS_LOCATIONS = [
  'Abbandonato','Attivo','Artistico','Atmosfera','Bellissimo',
  'Desolato','Luminoso','Affari','Calmo','Affascinante',
  'Pulito','Caotico','Freddo','Colorato','Incolore',
  'Confuso','Angusto','Inquietante','Grezzo','Carino',
  'Danneggiato','Pericoloso','Scuro','Delizioso','Sporco',
  'Domestico','Vuoto','Chiuso','Enorme','Ingresso',
  'Esclusivo','Esposto','Stravagante','Familiare','Elegante',
  'Festoso','Minaccioso','Fortunato','Fragrante','Frenetico',
  'Spaventoso','Pieno','Pericoloso','Utile','Orribile',
  'Importante','Impressionante','Inattivo','Intenso','Intrigante',
  'Vivace','Solitario','Lungo','Rumoroso','Significativo',
  'Caotico','Mobile','Moderno','Banale','Misterioso',
  'Naturale','Nuovo','Occupato','Strano','Ufficiale',
  'Vecchio','Aperto','Pacifico','Personale','Portale',
  'Protetto','Protezione','Intenzionale','Tranquillo','Rassicurante',
  'Remoto','Ricco','Servizi','Semplice','Piccolo',
  'Spazioso','Stoccaggio','Strano','Elegante','Sospetto',
  'Alto','Minaccioso','Tranquillo','Inaspettato','Spiacevole',
  'Insolito','Utile','Caldo','Avvertimento','Acquoso',
  'Accogliente'
];

const ELEMENTS_CHARACTERS = [
  'Accompagnato','Attivo','Aggressivo','Imboscata','Animale',
  'Ansioso','Armato','Bello','Audace','Occupato',
  'Calmo','Distratto','Casuale','Cauto','Elegante',
  'Colorato','Combattivo','Pazzo','Inquietante','Curioso',
  'Pericoloso','Ingannevole','Sconfitto','Sfidante','Delizioso',
  'Emotivo','Energico','Equipaggiato','Eccitato','Atteso',
  'Familiare','Veloce','Debole','Femminile','Feroce',
  'Nemico','Sciocco','Fortunato','Fragrante','Frenetico',
  'Amico','Spaventato','Spaventoso','Generoso','Felice',
  'Dannoso','Utile','Indifeso','Ferito','Importante',
  'Inattivo','Influente','Innocente','Intenso','Esperto',
  'Grande','Solitario','Rumoroso','Leale','Maschile',
  'Potente','Miserabile','Multiplo','Banale','Misterioso',
  'Naturale','Strano','Ufficiale','Vecchio','Passivo',
  'Pacifico','Giocoso','Potente','Professionale','Protetto',
  'Proteggendo','Interrogativo','Tranquillo','Rassicurante','Ricco di risorse',
  'In cerca','Abile','Lento','Piccolo','Furtivo',
  'Strano','Forte','Alto','Ladro','Minaccioso',
  'Trionfante','Inaspettato','Non naturale','Insolito','Violento',
  'Vocale','Debole','Selvaggio','Giovane'
];

const ELEMENTS_OBJECTS = [
  'Attivo','Artistico','Medio','Bello','Bizzarro',
  'Luminoso','Vestiario','Indizio','Freddo','Colorato',
  'Comunicazione','Complicato','Confuso','Consumabile','Contenitore',
  'Inquietante','Grezzo','Carino','Danneggiato','Pericoloso',
  'Disattivato','Deliberato','Delizioso','Desiderato','Domestico',
  'Vuoto','Energia','Enorme','Attrezzatura','Atteso',
  'Esaurito','Stravagante','Sbiadito','Familiare','Elegante',
  'Flora','Fortunato','Fragile','Fragrante','Spaventoso',
  'Spazzatura','Guida','Duro','Dannoso','Guaritore',
  'Pesante','Utile','Orribile','Importante','Inattivo',
  'Informazione','Intrigante','Grande','Letale','Leggero',
  'Liquido','Rumoroso','Maestoso','Significativo','Meccanico',
  'Moderno','Mobile','Multiplo','Banale','Misterioso',
  'Naturale','Nuovo','Strano','Ufficiale','Vecchio',
  'Ornamentale','Ornato','Personale','Potente','Prezioso',
  'Protezione','Raro','Pronto','Rassicurante','Risorsa',
  'Rovinato','Piccolo','Morbido','Solitario','Rubato',
  'Strano','Elegante','Minaccioso','Strumento','Viaggio',
  'Inaspettato','Spiacevole','Insolito','Utile','Inutile',
  'Prezioso','Caldo','Arma','Bagnato','Usurato'
];

// All meaning tables
const MEANING_TABLES = {
  'Azioni (1+2)': { type: 'dual', table1: ACTIONS_1, table2: ACTIONS_2 },
  'Descrizioni (1+2)': { type: 'dual', table1: DESC_1, table2: DESC_2 },
  'Elementi: Luoghi': { type: 'single', table: ELEMENTS_LOCATIONS },
  'Elementi: Personaggi': { type: 'single', table: ELEMENTS_CHARACTERS },
  'Elementi: Oggetti': { type: 'single', table: ELEMENTS_OBJECTS }
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function d(n) {
  return Math.floor(Math.random() * n) + 1;
}

function d100() {
  return d(100);
}

function rollFateChart(oddsIdx, cf) {
  const roll = d100();
  const [exYesMax, yesMax, exNoMin] = FATE_CHART[oddsIdx][cf];

  let answer, isExceptional;

  if (exYesMax > 0 && roll <= exYesMax) {
    answer = 'Sì Eccezionale';
    isExceptional = true;
  } else if (roll <= yesMax) {
    answer = 'Sì';
    isExceptional = false;
  } else if (exNoMin > 0 && roll >= exNoMin) {
    answer = 'No Eccezionale';
    isExceptional = true;
  } else {
    answer = 'No';
    isExceptional = false;
  }

  // Doubles: 11,22,...,99 (NOT 100). roll%11===0 catches exactly these.
  const isDouble = roll !== 100 && roll % 11 === 0;
  const singleDigit = roll / 11; // integer 1-9 when isDouble is true
  const isRandomEvent = isDouble && singleDigit <= cf;

  return { roll, answer, isExceptional, isRandomEvent };
}

function rollFateCheck(oddsIdx, cf) {
  const d1 = d(10);
  const d2 = d(10);
  const base = d1 + d2;
  const oddsMod = FATE_CHECK_ODDS_MOD[oddsIdx];
  const cfMod = FATE_CHECK_CF_MOD[cf]; // cf is 1-9, array[1..9]
  const total = base + oddsMod + cfMod;

  let answer, isExceptional, isRandomEvent;

  if (total >= 18 && total <= 20) {
    answer = 'Sì Eccezionale';
    isExceptional = true;
  } else if (total >= 11) {
    answer = 'Sì';
    isExceptional = false;
  } else if (total <= 4) {
    answer = 'No Eccezionale';
    isExceptional = true;
  } else {
    answer = 'No';
    isExceptional = false;
  }

  isRandomEvent = (d1 === d2) && d1 <= cf;

  return { roll: `${d1}+${d2}=${base} (mod ${oddsMod + cfMod >= 0 ? '+' : ''}${oddsMod + cfMod}) → ${total}`, answer, isExceptional, isRandomEvent };
}

function rollEventFocus() {
  const roll = d100();
  for (const entry of EVENT_FOCUS_TABLE) {
    if (roll >= entry.min && roll <= entry.max) {
      return { roll, result: entry.result };
    }
  }
  return { roll, result: 'Contesto Attuale' };
}

function rollMeaning(tableName) {
  const t = MEANING_TABLES[tableName];
  if (!t) return { word1: '?', word2: '?', doubledDown: false };
  if (t.type === 'dual') {
    const i1 = d(100) - 1;
    const i2 = d(100) - 1;
    return { word1: t.table1[i1], word2: t.table2[i2], doubledDown: false };
  } else {
    const i1 = d(100) - 1;
    const i2 = d(100) - 1;
    return { word1: t.table[i1], word2: t.table[i2], doubledDown: i1 === i2 };
  }
}

function rollNPCBehavior() {
  const d1 = d(10);
  const d2 = d(10);
  const total = d1 + d2;
  const idx = Math.min(total, NPC_BEHAVIOR.length - 1);
  return { roll: `${d1}+${d2}=${total}`, result: NPC_BEHAVIOR[idx] || 'Azione specifica' };
}

function rollListElement(items) {
  if (!items || items.length === 0) return { item: null, choose: false, roll: '-' };

  const count = items.length;
  // Section die: 1-5→none, 6-10→d4, 11-15→d6, 16-20→d8, 21-25→d10
  const sectionDie = count <= 5 ? 1 : count <= 10 ? 4 : count <= 15 ? 6 : count <= 20 ? 8 : 10;
  const sectionRoll = sectionDie === 1 ? 1 : d(sectionDie);
  const entryRoll = d(10);
  const rollDesc = sectionDie === 1 ? `d10: ${entryRoll}` : `d${sectionDie}: ${sectionRoll}, d10: ${entryRoll}`;

  const absIdx = (sectionRoll - 1) * 5 + (entryRoll - 1);
  if (entryRoll > 5 || absIdx >= count) {
    return { item: null, choose: true, roll: rollDesc };
  }
  return { item: items[absIdx], choose: false, roll: rollDesc };
}

function testExpectedScene(cf) {
  const roll = d(10);
  let type, desc;
  if (roll > cf) {
    type = 'expected';
    desc = 'Scena Attesa';
  } else if (roll % 2 === 1) {
    type = 'altered';
    desc = 'Scena Alterata';
  } else {
    type = 'interrupt';
    desc = 'Scena Interrotta';
  }
  return { roll, type, desc };
}

function rollSceneAdjustment() {
  const roll = d(10);
  return { roll, result: SCENE_ADJUSTMENT[roll - 1] };
}

function answerClass(answer) {
  if (answer === 'Sì Eccezionale') return 'exceptional-yes';
  if (answer === 'Sì') return 'yes';
  if (answer === 'No Eccezionale') return 'exceptional-no';
  return 'no';
}

// ─── VIEW ────────────────────────────────────────────────────────────────────

class MythicView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    // State
    this.cf = plugin.settings.chaosFactor || 5;
    this.threads = plugin.settings.threads || [];
    this.characters = plugin.settings.characters || [];
    this.useCheck = plugin.settings.oracleMethod === 'check';
    this.activeTab = plugin.settings.activeTab || 'oracle';
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Mythic GME'; }
  getIcon() { return 'mythic-m'; }

  async onOpen() {
    this.render();
  }

  async onClose() {}

  saveState() {
    this.plugin.settings.chaosFactor = this.cf;
    this.plugin.settings.threads = this.threads;
    this.plugin.settings.characters = this.characters;
    this.plugin.settings.activeTab = this.activeTab;
    this.plugin.saveSettings();
  }

  render() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass('mythic-view');

    this.renderTabBar(root);
    const content = root.createDiv({ cls: 'mythic-tab-content' });
    this.contentEl = content;
    this.renderActiveTab();
  }

  renderTabBar(root) {
    const bar = root.createDiv({ cls: 'mythic-tab-bar' });
    const tabs = [
      { id: 'oracle', icon: 'eye',        label: 'Oracle' },
      { id: 'events', icon: 'zap',        label: 'Eventi' },
      { id: 'scene',  icon: 'film',       label: 'Scena'  },
      { id: 'lists',  icon: 'list',       label: 'Liste'  }
    ];
    this.tabBtns = {};
    for (const tab of tabs) {
      const btn = bar.createEl('button', { cls: 'mythic-tab-btn', attr: { title: tab.label } });
      setIcon(btn, tab.icon);
      if (tab.id === this.activeTab) btn.addClass('active');
      btn.onclick = () => {
        this.activeTab = tab.id;
        this.plugin.settings.activeTab = tab.id;
        this.plugin.saveSettings();
        for (const [id, b] of Object.entries(this.tabBtns)) {
          b.toggleClass('active', id === tab.id);
        }
        this.contentEl.empty();
        this.renderActiveTab();
      };
      this.tabBtns[tab.id] = btn;
    }
  }

  renderActiveTab() {
    switch (this.activeTab) {
      case 'oracle': this.renderOracle(); break;
      case 'events': this.renderEvents(); break;
      case 'scene':  this.renderScene();  break;
      case 'lists':  this.renderLists();  break;
    }
  }

  // ── Oracle Tab ──────────────────────────────────────────────────────────────

  renderOracle() {
    const el = this.contentEl;

    // Chaos Factor
    this.renderChaosFactor(el);

    el.createEl('hr', { cls: 'mythic-divider' });

    // Odds
    el.createEl('p', { text: 'Probabilità (Odds):', cls: 'mythic-section-title' });
    const oddsSelect = el.createEl('select', { cls: 'mythic-odds-select' });
    ODDS_LABELS.forEach((label, i) => {
      const opt = oddsSelect.createEl('option', { text: label, value: String(i) });
      if (i === 4) opt.selected = true; // Default 50/50
    });

    // Roll button
    const rollBtn = el.createEl('button', { text: '🎲 Tira', cls: 'mythic-roll-btn' });

    // Result area
    const resultEl = el.createDiv({ cls: 'mythic-result' });
    const answerEl = resultEl.createDiv({ cls: 'mythic-result-answer' });
    const rollInfoEl = resultEl.createDiv({ cls: 'mythic-result-roll' });
    const eventEl = resultEl.createDiv({ cls: 'mythic-result-event' });
    eventEl.style.display = 'none';

    rollBtn.onclick = () => {
      const oddsIdx = parseInt(oddsSelect.value);
      let res;
      if (this.useCheck) {
        res = rollFateCheck(oddsIdx, this.cf);
      } else {
        res = rollFateChart(oddsIdx, this.cf);
      }

      const cls = answerClass(res.answer);
      resultEl.className = 'mythic-result visible ' + cls;
      answerEl.className = 'mythic-result-answer ' + cls;
      answerEl.textContent = res.answer;
      rollInfoEl.textContent = `Tiro: ${res.roll} | Odds: ${ODDS_LABELS[oddsIdx]} | FC: ${this.cf}`;

      if (res.isRandomEvent) {
        eventEl.style.display = '';
        eventEl.textContent = '⚡ Evento Casuale attivato!';
      } else {
        eventEl.style.display = 'none';
      }

      const logLines = [`? [${ODDS_LABELS[oddsIdx]}] (CF ${this.cf}) → ${res.answer} (tiro: ${res.roll})`];
      if (res.isRandomEvent) logLines.push('⚡ Evento Casuale attivato!');
      this.plugin.logResult(logLines);
    };

    el.createEl('hr', { cls: 'mythic-divider' });

    // NPC Behavior
    el.createEl('p', { text: 'Comportamento PNG:', cls: 'mythic-section-title' });
    const npcBtn = el.createEl('button', { text: '🎲 Comportamento PNG', cls: 'mythic-roll-btn secondary' });
    const npcResult = el.createDiv({ cls: 'mythic-result' });
    const npcResultRow = npcResult.createDiv({ cls: 'mythic-npc-result' });
    const npcWord = npcResultRow.createDiv({ cls: 'mythic-npc-word' });
    npcWord.createDiv({ text: 'Comportamento', cls: 'mythic-npc-word-label' });
    const npcWordVal = npcWord.createDiv({ cls: 'mythic-npc-word-val' });
    const npcRollInfo = npcResult.createDiv({ cls: 'mythic-result-roll' });

    npcBtn.onclick = () => {
      const res = rollNPCBehavior();
      npcResult.addClass('visible');
      npcWordVal.textContent = res.result;
      npcRollInfo.textContent = `Tiro: ${res.roll}`;
      if (this.plugin.settings.logLevel === 'full')
        this.plugin.logResult([`🎭 Comportamento PNG: ${res.result} (${res.roll})`]);
    };
  }

  renderChaosFactor(el) {
    const row = el.createDiv({ cls: 'mythic-chaos-row' });
    row.createEl('span', { text: 'CF:', cls: 'mythic-chaos-label' });

    const minusBtn = row.createEl('button', { text: '−', cls: 'mythic-chaos-btn' });
    const valueEl = row.createEl('span', { text: String(this.cf), cls: 'mythic-chaos-value' });
    const plusBtn = row.createEl('button', { text: '+', cls: 'mythic-chaos-btn' });

    minusBtn.onclick = () => {
      if (this.cf > 1) { this.cf--; valueEl.textContent = String(this.cf); this.saveState(); }
    };
    plusBtn.onclick = () => {
      if (this.cf < 9) { this.cf++; valueEl.textContent = String(this.cf); this.saveState(); }
    };
  }

  // ── Events Tab ──────────────────────────────────────────────────────────────

  renderEvents() {
    const el = this.contentEl;

    // Full Random Event
    el.createEl('p', { text: 'Evento Casuale Completo:', cls: 'mythic-section-title' });
    const allBtn = el.createEl('button', { text: '⚡ Genera Evento', cls: 'mythic-roll-btn' });

    const focusBox = el.createDiv({ cls: 'mythic-event-result' });
    focusBox.style.display = 'none';
    const focusLabel = focusBox.createDiv({ text: 'Focus', cls: 'mythic-event-result-label' });
    const focusVal = focusBox.createDiv({ cls: 'mythic-event-result-value' });
    const focusRoll = focusBox.createDiv({ cls: 'mythic-result-roll' });

    const meaningBox = el.createDiv({ cls: 'mythic-meaning-row' });
    meaningBox.style.display = 'none';
    const w1Box = meaningBox.createDiv({ cls: 'mythic-meaning-word' });
    w1Box.createDiv({ text: 'Parola 1', cls: 'mythic-meaning-word-label' });
    const w1Val = w1Box.createDiv({ cls: 'mythic-meaning-word-value' });
    const w2Box = meaningBox.createDiv({ cls: 'mythic-meaning-word' });
    w2Box.createDiv({ text: 'Parola 2', cls: 'mythic-meaning-word-label' });
    const w2Val = w2Box.createDiv({ cls: 'mythic-meaning-word-value' });

    // List result area
    const listResultBox = el.createDiv({ cls: 'mythic-event-result' });
    listResultBox.style.display = 'none';
    listResultBox.createDiv({ text: 'Elemento dalla Lista', cls: 'mythic-event-result-label' });
    const listResultVal = listResultBox.createDiv({ cls: 'mythic-event-result-value' });

    allBtn.onclick = () => {
      const focus = rollEventFocus();
      const meaning = rollMeaning('Azioni (1+2)');

      focusBox.style.display = '';
      focusVal.textContent = focus.result;
      focusRoll.textContent = `Tiro d100: ${focus.roll}`;

      meaningBox.style.display = '';
      w1Val.textContent = meaning.word1;
      w2Val.textContent = meaning.word2;
      if (meaning.doubledDown) {
        w2Val.textContent += ' ⚠️ Doubling Down!';
      }

      // If focus calls for a list element
      const needsThread = focus.result.includes('Filo');
      const needsChar = focus.result.includes('PNG') || focus.result.includes('PG Neg') || focus.result.includes('PG Pos');
      const listToUse = needsThread ? this.threads : (needsChar ? this.characters : null);

      let listEntry = null;
      if (listToUse) {
        const res = rollListElement(listToUse);
        listResultBox.style.display = '';
        listEntry = res.choose ? 'Choose (riga vuota)' : res.item ?? '(lista vuota)';
        listResultVal.textContent = res.choose
          ? '→ Choose: scegli tu (riga vuota)'
          : res.item ?? '(lista vuota — usa Contesto Attuale)';
      } else {
        listResultBox.style.display = 'none';
      }

      const logLines = [`⚡ Focus: ${focus.result} | ${meaning.word1} / ${meaning.word2}`];
      if (meaning.doubledDown) logLines.push('⚠️ Doubling Down!');
      if (listEntry) logLines.push(`📋 Lista: ${listEntry}`);
      this.plugin.logResult(logLines);
    };

    el.createEl('hr', { cls: 'mythic-divider' });

    // Event Focus only
    el.createEl('p', { text: 'Solo Focus Evento:', cls: 'mythic-section-title' });
    const focusBtn = el.createEl('button', { text: '🎲 Focus', cls: 'mythic-roll-btn secondary' });
    const focusOnlyBox = el.createDiv({ cls: 'mythic-event-result' });
    focusOnlyBox.style.display = 'none';
    focusOnlyBox.createDiv({ text: 'Focus', cls: 'mythic-event-result-label' });
    const focusOnlyVal = focusOnlyBox.createDiv({ cls: 'mythic-event-result-value' });
    const focusOnlyRoll = focusOnlyBox.createDiv({ cls: 'mythic-result-roll' });

    focusBtn.onclick = () => {
      const focus = rollEventFocus();
      focusOnlyBox.style.display = '';
      focusOnlyVal.textContent = focus.result;
      focusOnlyRoll.textContent = `Tiro: ${focus.roll}`;
      if (this.plugin.settings.logLevel === 'full')
        this.plugin.logResult([`⚡ Focus: ${focus.result} (d100: ${focus.roll})`]);
    };

    el.createEl('hr', { cls: 'mythic-divider' });

    // Meaning Tables
    el.createEl('p', { text: 'Tabelle del Significato:', cls: 'mythic-section-title' });
    const tableSelect = el.createEl('select', { cls: 'mythic-table-select' });
    for (const name of Object.keys(MEANING_TABLES)) {
      tableSelect.createEl('option', { text: name, value: name });
    }

    const meaningBtn = el.createEl('button', { text: '🎲 Significato', cls: 'mythic-roll-btn secondary' });
    const meaningRow = el.createDiv({ cls: 'mythic-meaning-row' });
    meaningRow.style.display = 'none';

    const mw1Box = meaningRow.createDiv({ cls: 'mythic-meaning-word' });
    mw1Box.createDiv({ text: 'Parola 1', cls: 'mythic-meaning-word-label' });
    const mw1Val = mw1Box.createDiv({ cls: 'mythic-meaning-word-value' });
    const mw2Box = meaningRow.createDiv({ cls: 'mythic-meaning-word' });
    mw2Box.createDiv({ text: 'Parola 2', cls: 'mythic-meaning-word-label' });
    const mw2Val = mw2Box.createDiv({ cls: 'mythic-meaning-word-value' });

    const doubleDownNote = el.createDiv({ cls: 'mythic-result-event' });
    doubleDownNote.style.display = 'none';
    doubleDownNote.textContent = '⚠️ Doubling Down! Stesso risultato — enfatizza il tema o rilancia.';

    meaningBtn.onclick = () => {
      const m = rollMeaning(tableSelect.value);
      meaningRow.style.display = '';
      mw1Val.textContent = m.word1;
      mw2Val.textContent = m.word2;
      doubleDownNote.style.display = m.doubledDown ? '' : 'none';
      if (this.plugin.settings.logLevel === 'full') {
        const lines = [`📖 ${tableSelect.value}: ${m.word1} / ${m.word2}`];
        if (m.doubledDown) lines.push('⚠️ Doubling Down!');
        this.plugin.logResult(lines);
      }
    };
  }

  // ── Scene Tab ───────────────────────────────────────────────────────────────

  renderScene() {
    const el = this.contentEl;

    this.renderChaosFactor(el);
    el.createEl('hr', { cls: 'mythic-divider' });

    // Test Expected Scene
    el.createEl('p', { text: 'Testa Scena Attesa:', cls: 'mythic-section-title' });
    const testBtn = el.createEl('button', { text: '🎲 Testa Scena', cls: 'mythic-roll-btn' });

    const sceneInfo = el.createDiv({ cls: 'mythic-scene-info' });
    sceneInfo.style.display = 'none';
    const sceneType = sceneInfo.createDiv({ cls: 'mythic-scene-type' });
    const sceneRoll = sceneInfo.createDiv({ cls: 'mythic-scene-roll' });
    const sceneNote = sceneInfo.createDiv({ cls: 'mythic-result-roll' });

    testBtn.onclick = () => {
      const res = testExpectedScene(this.cf);
      sceneInfo.style.display = '';
      sceneType.className = 'mythic-scene-type ' + res.type;
      sceneType.textContent = res.desc;
      sceneRoll.textContent = `Tiro d10: ${res.roll} | FC: ${this.cf}`;
      if (res.type === 'altered') {
        sceneNote.textContent = 'Altera la scena attesa. Usa le strategie: prossima aspettativa, modifica, Domanda del Destino, o Tabella Aggiustamento.';
      } else if (res.type === 'interrupt') {
        sceneNote.textContent = 'Genera un Evento Casuale: usa il Focus e le Tabelle del Significato.';
      } else {
        sceneNote.textContent = 'La scena inizia come previsto!';
      }
      this.plugin.logResult([`> ${res.desc} (d10: ${res.roll}, CF: ${this.cf})`], true);
    };

    el.createEl('hr', { cls: 'mythic-divider' });

    // Scene Adjustment
    el.createEl('p', { text: 'Tabella Aggiustamento Scena:', cls: 'mythic-section-title' });
    const adjBtn = el.createEl('button', { text: '🎲 Aggiustamento', cls: 'mythic-roll-btn secondary' });
    const adjBox = el.createDiv({ cls: 'mythic-event-result' });
    adjBox.style.display = 'none';
    adjBox.createDiv({ text: 'Aggiustamento', cls: 'mythic-event-result-label' });
    const adjVal = adjBox.createDiv({ cls: 'mythic-event-result-value' });
    const adjRoll = adjBox.createDiv({ cls: 'mythic-result-roll' });

    adjBtn.onclick = () => {
      const res = rollSceneAdjustment();
      adjBox.style.display = '';
      adjVal.textContent = res.result;
      adjRoll.textContent = `Tiro d10: ${res.roll}`;
      if (this.plugin.settings.logLevel === 'full')
        this.plugin.logResult([`🎲 Aggiustamento Scena: ${res.result} (d10: ${res.roll})`]);
    };

    el.createEl('hr', { cls: 'mythic-divider' });

    // Scene bookkeeping reminder
    el.createEl('p', { text: 'Fine Scena — Promemoria:', cls: 'mythic-section-title' });
    const reminder = el.createDiv({ cls: 'mythic-scene-info' });
    reminder.style.display = '';
    const items = [
      '☑ Aggiorna lista Fili (aggiungi/rimuovi)',
      '☑ Aggiorna lista Personaggi (aggiungi/rimuovi)',
      '☑ Aggiusta il Fattore Caos (+1 se caotico, -1 se sotto controllo)',
      '☑ Scrivi il sommario della scena nel Diario'
    ];
    for (const item of items) {
      reminder.createEl('div', { text: item, attr: { style: 'font-size:12px; padding:2px 0; color:var(--text-muted)' } });
    }
  }

  // ── Lists Tab ───────────────────────────────────────────────────────────────

  renderLists() {
    const el = this.contentEl;

    // Threads List
    el.createEl('p', { text: 'Lista Fili (Obiettivi):', cls: 'mythic-section-title' });
    this.renderList(el, this.threads, 'filo', (items) => {
      this.threads = items; this.saveState();
    });

    el.createEl('hr', { cls: 'mythic-divider' });

    // Characters List
    el.createEl('p', { text: 'Lista Personaggi (PNG):', cls: 'mythic-section-title' });
    this.renderList(el, this.characters, 'personaggio', (items) => {
      this.characters = items; this.saveState();
    });

    el.createEl('hr', { cls: 'mythic-divider' });

    // Random from list
    el.createEl('p', { text: 'Estrai elemento casuale:', cls: 'mythic-section-title' });

    const randFiliBtn = el.createEl('button', { text: '🎲 Filo', cls: 'mythic-roll-btn secondary', attr: { style: 'margin-bottom:8px' } });
    const randPngBtn  = el.createEl('button', { text: '🎲 Personaggio', cls: 'mythic-roll-btn secondary', attr: { style: 'margin-bottom:8px' } });

    const randResult = el.createDiv({ cls: 'mythic-event-result' });
    randResult.style.display = 'none';
    randResult.createDiv({ text: 'Estratto', cls: 'mythic-event-result-label' });
    const randVal = randResult.createDiv({ cls: 'mythic-event-result-value' });
    const randRoll = randResult.createDiv({ cls: 'mythic-result-roll' });

    const doRandRoll = (list, label) => {
      if (list.length === 0) {
        randResult.style.display = '';
        randVal.textContent = '(lista vuota)';
        randRoll.textContent = '';
        return;
      }
      const res = rollListElement(list);
      randResult.style.display = '';
      randVal.textContent = res.choose ? '→ Choose: scegli tu (riga vuota)' : res.item;
      randRoll.textContent = `Tiro: ${res.roll}`;
      if (this.plugin.settings.logLevel === 'full') {
        const entry = res.choose ? 'Choose (riga vuota)' : res.item;
        this.plugin.logResult([`📋 ${label}: ${entry} (${res.roll})`]);
      }
    };

    randFiliBtn.onclick = () => doRandRoll(this.threads, 'Filo');
    randPngBtn.onclick = () => doRandRoll(this.characters, 'Personaggio');
  }

  renderList(parentEl, items, placeholder, onUpdate) {
    const listEl = parentEl.createEl('ul', { cls: 'mythic-list-items' });

    const refresh = () => {
      listEl.empty();
      if (items.length === 0) {
        listEl.createEl('li', { cls: 'mythic-list-item' })
          .createEl('span', { text: `Nessun ${placeholder} ancora.`, cls: 'mythic-list-empty' });
        return;
      }
      items.forEach((item, idx) => {
        // Section divider every 5 items
        if (idx > 0 && idx % 5 === 0) {
          listEl.createEl('li', { cls: 'mythic-list-section-sep' });
        }
        const li = listEl.createEl('li', { cls: 'mythic-list-item' });
        li.createEl('span', { text: String(idx + 1) + '.', cls: 'mythic-list-item-num' });
        li.createEl('span', { text: item, cls: 'mythic-list-item-text' });
        const delBtn = li.createEl('button', { text: '×', cls: 'mythic-list-item-delete' });
        delBtn.onclick = () => {
          items.splice(idx, 1);
          onUpdate(items);
          refresh();
        };
      });
    };

    refresh();

    // Add row
    const addRow = parentEl.createDiv({ cls: 'mythic-add-row' });
    const input = addRow.createEl('input', { cls: 'mythic-add-input', attr: { placeholder: `Aggiungi ${placeholder}...`, type: 'text' } });
    const addBtn = addRow.createEl('button', { text: 'Aggiungi', cls: 'mythic-add-btn' });

    const doAdd = () => {
      const val = input.value.trim();
      if (val && items.length < 25) {
        items.push(val);
        onUpdate(items);
        input.value = '';
        refresh();
      }
    };

    addBtn.onclick = doAdd;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
  }
}

// ─── PLUGIN ──────────────────────────────────────────────────────────────────

// SVG paths scaled from 746x746 to 100x100 (factor 0.13405)
const MYTHIC_ICON_SVG = `<g transform="scale(0.13405)"><path fill="currentColor" d="M566.91,541.08c1.01-16.9.63-30.97,0-41.22-.88-14.41-2.47-25.21-5.22-43.83-2.12-14.41-3.58-24.26-6.26-37.57-2.84-14.06-7.06-34.64-15.65-59.48-5.18-14.99-6.31-15.21-16.7-43.3-4.88-13.21-7.8-21.12-10.96-30.78-5.96-18.26-14.88-46.11-18.7-82.22-.97-9.14-1.96-22.2-1.83-38.09l-85.04,33.65c-.8,2.59-1.23,5.23,0,6.26,1.46,1.22,4.14-.8,9.29-1.99,2.89-.67,8.41-1.95,11.84-.09,5.12,2.77,5.78,11.87,4.43,18-1.06,4.82-3.45,8.11-8.35,13.83-9.1,10.63-16.89,18-17.99,19.04-28.12,24.87-43.05,38.09-43.05,38.09,0,0-2.03.09-5.74.26l-52.7-101.22c-4.78-7.57-9.57-15.13-14.35-22.7l-89.48,39.65v7.3l31.57-13.3c1.65-.64,5.02-1.63,8.35-.26,1.31.54,2.37,1.35,4.96,4.43,3.78,4.51,5.89,7.04,7.83,11.22.59,1.28,2.29,5.14,3.13,10.7,2.58,17.03-2.61,33.91-2.61,33.91-8.88,28.89,6.28-6.62-21.13,85.3,0,0-6.96,23.34-20.35,63.65-2.27,6.85-13.55,40.27-27.39,56.61-6.12,7.23-13.57,14.87-13.57,14.87-4.58,4.71-8.51,8.45-11.22,10.96v4.17s13.93,10.27,20.09,15.13c20.58,16.23,33.46,34.39,38.35,41.74,3.92,5.89,9.11,14.47,14.09,25.57-.62-34.91-.17-64.64.52-87.65.82-27.16,1.6-51.66,4.96-84.52,1.58-15.44,3.05-26.03,6-47.22,5.62-40.37,8.35-50.91,10.96-59.22,5.2-16.56,11.56-29.45,16.17-37.83h4.17l45.91,91.83c.19,1.12.34,2.78,0,4.7-.75,4.22-3.39,6.98-3.91,7.57-4.89,5.44-12.09,29.12-15.39,43.04-6.99,29.5-5.7,54.21-4.96,63.65,1.5,19.04,2.83,35.83,13.04,55.04,10.07,18.94,23.2,29.71,26.87,32.61,6.42,5.06,22.45,17.37,46.7,20.09,20.05,2.25,35.17-3.23,38.35-4.43,19.16-7.25,30.01-19.98,34.43-25.3,3.49-4.2,9.76-11.88,14.09-23.74,7.78-21.33,3.38-39.97,1.83-46.17-1.26-5.02-3.92-15.22-11.74-26.09-3.38-4.7-11.88-16.2-27.65-22.96-21.4-9.17-41.13-3.17-45.91-1.57-5.95,2-32.99,12.04-40.96,39.91-5.98,20.92,2.66,38.33,4.43,41.74,2.55,4.9,12.06,23.12,33.39,27.91,20.79,4.68,36.81-6.99,38.61-8.35,2.13-1.61,17.56-13.64,18.52-33.91.19-4.08.57-15.67-7.57-26.09-6.95-8.9-16.06-11.77-18.78-12.52-3.43-.95-13.73-3.8-24,1.83-2.45,1.34-8.54,5.15-12,12.78-4.71,10.38-1.03,20.08.26,23.48,1.71,4.5,3.61,9.51,8.87,12.26,7.02,3.67,14.44.39,15.91-.26,2.09-.92,7.56-3.34,8.87-8.61.16-.65.55-2.5,0-4.7-1.46-5.84-8.22-8.74-10.96-9.91-8.9-3.82-14.77-1.67-16.7-5.48-.88-1.75-.35-3.6.26-5.74,2.22-7.76,10.18-11.16,10.96-11.48,6.66-2.73,12.8-.78,17.74.78,3.44,1.09,13.34,4.39,19.57,14.35.81,1.3,3.81,6.3,4.7,13.57.16,1.34.8,7.17-1.3,14.35-1.83,6.25-4.8,10.36-6.78,13.04-2.26,3.06-6.69,8.95-14.61,13.3-12.02,6.62-23.79,5.17-26.87,4.7-13.83-2.12-22.17-10.38-24.78-13.04-9.05-9.23-11.42-19.57-12.79-25.57-1.17-5.09-3.66-16.65.78-30.52,1.42-4.43,5.47-15.12,15.91-24.26,12.5-10.95,26.21-12.72,31.3-13.3,12.15-1.4,21.89,1.26,27.13,3.13,2.36.84,14.28,5.26,25.04,16.96,1.53,1.66,7.56,8.38,12.26,19.04,1.41,3.19,5.88,13.95,6.26,28.7.16,6.03.37,22.38-9.13,39.13-13.28,23.41-36.34,31.37-43.3,33.65-4.88,1.6-35.53,11.13-64.7-5.48-23.5-13.38-31.64-35.53-39.39-56.61,0,0-14.53-39.54-.26-100.96,0,0,4.75-20.46,13.57-23.28,2.22-.71,3.65,0,3.65,0,1.38.68,1.71,2.05,2.87,4.23,1.17,2.21,1.63,2.3,3.39,4.96,1.87,2.82,3.05,5.26,4.7,8.87,6.07,13.33,7.36,18.11,9.39,18,.65-.03,1.58-.58,2.61-3.13l42-40.96-26.35-54.78c-.6-1.31-1.1-3.03-.52-4.7.54-1.54,1.78-2.39,2.09-2.61,2.54-1.82,3.24-5.31,27.39-31.83,5.33-5.85,16.38-17.84,28.17-23.48,1.77-.85,5.21-2.34,8.87-1.3,4.84,1.37,7.31,6.37,8.87,9.65,7.7,16.2,12.67,31.55,16.96,43.3,2.51,6.87,2.33,5.78,4.96,13.04,5.11,14.1,8,24.3,9.91,30.78,7.05,23.92,8.41,23.29,15.39,46.43,3.19,10.58,7.06,23.41,10.7,40.7,4.85,23.06,6.73,41.94,7.57,53.22.93,12.52,1.47,27.86.78,45.39l57.04-.48Z"/><path fill="currentColor" d="M373.02.5C167.28.5.5,167.28.5,373.02s166.78,372.52,372.52,372.52,372.52-166.78,372.52-372.52S578.76.5,373.02.5ZM373.02,704.85c-183.26,0-331.83-148.56-331.83-331.83S189.76,41.2,373.02,41.2s331.83,148.56,331.83,331.83-148.56,331.83-331.83,331.83Z"/></g>`;

class MythicPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    addIcon('mythic-m', MYTHIC_ICON_SVG);

    this.registerView(VIEW_TYPE, (leaf) => new MythicView(leaf, this));

    this.addRibbonIcon('mythic-m', 'Mythic GME', () => {
      this.activateView();
    });

    this.addCommand({
      id: 'open-mythic-view',
      name: 'Apri pannello Mythic GME',
      callback: () => this.activateView()
    });

    this.addSettingTab(new MythicSettingTab(this.app, this));
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({
      chaosFactor: 5,
      oracleMethod: 'chart',
      activeTab: 'oracle',
      enableLogging: false,
      logLevel: 'narrative',
      logTarget: 'active',
      logNotePath: '',
      ttrpgNotationIntegration: false,
      threads: [],
      characters: []
    }, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  ttrpgAvailable() {
    return !!this.app.plugins.plugins['solo-ttrpg-notation'];
  }

  async logResult(lines, triggerScene = false) {
    const s = this.settings;
    if (!s.enableLogging) return;

    const useTtrpg = s.ttrpgNotationIntegration && this.ttrpgAvailable();

    if (triggerScene && useTtrpg) {
      this.app.commands.executeCommandById('solo-ttrpg-notation:insert-ttrpg-scene');
    }

    let file;
    if (s.logTarget === 'fixed' && s.logNotePath) {
      const { TFile } = require('obsidian');
      file = this.app.vault.getAbstractFileByPath(s.logNotePath);
      if (!file) {
        new (require('obsidian').Notice)(`Mythic GME: nota non trovata: "${s.logNotePath}"`);
        return;
      }
    } else {
      file = this.app.workspace.getActiveFile();
    }

    if (!file) {
      new (require('obsidian').Notice)('Mythic GME: nessuna nota attiva per il log.');
      return;
    }

    const current = await this.app.vault.read(file);
    const block = useTtrpg
      ? '\n```ttrpg\n' + lines.join('\n') + '\n```\n'
      : '\n' + lines.join('\n') + '\n';

    await this.app.vault.modify(file, current + block);
    new (require('obsidian').Notice)(`Mythic GME: loggato in "${file.name}"`);
  }
}

class MythicSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    // ── Oracle ──────────────────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Oracle' });

    new Setting(containerEl)
      .setName('Metodo Oracle')
      .setDesc('Fate Chart usa un d100 con tabella; Fate Check usa 2d10 confrontati con gli odds.')
      .addDropdown(drop => drop
        .addOption('chart', 'Fate Chart (d100)')
        .addOption('check', 'Fate Check (2d10)')
        .setValue(this.plugin.settings.oracleMethod)
        .onChange(async (value) => {
          this.plugin.settings.oracleMethod = value;
          await this.plugin.saveSettings();
        })
      );

    // ── Log ─────────────────────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Log risultati' });

    new Setting(containerEl)
      .setName('Abilita log')
      .setDesc('Scrive i risultati in una nota Obsidian.')
      .addToggle(t => t
        .setValue(this.plugin.settings.enableLogging)
        .onChange(async (value) => {
          this.plugin.settings.enableLogging = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.enableLogging) {
      new Setting(containerEl)
        .setName('Livello log')
        .setDesc('Narrativo: solo tiri significativi. Completo: tutti i tiri.')
        .addDropdown(drop => drop
          .addOption('narrative', 'Solo risultati narrativi')
          .addOption('full', 'Tutti i tiri')
          .setValue(this.plugin.settings.logLevel)
          .onChange(async (value) => {
            this.plugin.settings.logLevel = value;
            await this.plugin.saveSettings();
          })
        );

      new Setting(containerEl)
        .setName('Nota target')
        .setDesc('Dove scrivere il log.')
        .addDropdown(drop => drop
          .addOption('active', 'Nota attiva')
          .addOption('fixed', 'Nota fissa (percorso sotto)')
          .setValue(this.plugin.settings.logTarget)
          .onChange(async (value) => {
            this.plugin.settings.logTarget = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );

      if (this.plugin.settings.logTarget === 'fixed') {
        new Setting(containerEl)
          .setName('Percorso nota fissa')
          .setDesc('Es: Campagna/mythic-log.md — la nota deve esistere.')
          .addText(t => t
            .setPlaceholder('Cartella/nome-nota.md')
            .setValue(this.plugin.settings.logNotePath)
            .onChange(async (value) => {
              this.plugin.settings.logNotePath = value;
              await this.plugin.saveSettings();
            })
          );
      }

      if (this.plugin.ttrpgAvailable()) {
        new Setting(containerEl)
          .setName('Integrazione Solo TTRPG Notation')
          .setDesc('Scrive il log nel formato ttrpg e inserisce una scena automaticamente quando testi una scena.')
          .addToggle(t => t
            .setValue(this.plugin.settings.ttrpgNotationIntegration)
            .onChange(async (value) => {
              this.plugin.settings.ttrpgNotationIntegration = value;
              await this.plugin.saveSettings();
            })
          );
      } else {
        containerEl.createEl('p', {
          text: '⚠️ Plugin "Solo TTRPG Notation" non trovato — installa il plugin per abilitare l\'integrazione.',
          attr: { style: 'font-size:12px; color:var(--text-muted); margin: 4px 0 0 0;' }
        });
      }
    }
  }
}

module.exports = MythicPlugin;
