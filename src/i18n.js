// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: feature names, widget contents, scene texts, messages of the
// Configuration screen. Vocabulary of the Gladys interface: appareil / Gerät
// / dispositivo, scène / Szene / escena, Découverte / Entdecken / Descubrir;
// "pile" in French covers every battery of a sensor, as on the forum.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // features
  featureLevel: {
    en: 'Battery level',
    fr: 'Niveau des piles',
    de: 'Batteriestand',
    es: 'Nivel de las pilas',
  },
  featureDaysRemaining: {
    en: 'Days until replacement',
    fr: 'Jours avant remplacement',
    de: 'Tage bis zum Wechsel',
    es: 'Días hasta el cambio',
  },
  featureDaysSince: {
    en: 'Days since replacement',
    fr: 'Jours depuis le remplacement',
    de: 'Tage seit dem Wechsel',
    es: 'Días desde el cambio',
  },
  featureReplaced: {
    en: 'Batteries replaced',
    fr: 'Piles remplacées',
    de: 'Batterien gewechselt',
    es: 'Pilas cambiadas',
  },
  featureLastReplaced: {
    en: 'Last replacement',
    fr: 'Dernier remplacement',
    de: 'Letzter Wechsel',
    es: 'Último cambio',
  },

  // days
  whenToday: { en: 'end today', fr: 'fin aujourd’hui', de: 'Ende heute', es: 'fin hoy' },
  whenTomorrow: { en: 'end tomorrow', fr: 'fin demain', de: 'Ende morgen', es: 'fin mañana' },
  whenIn: {
    en: 'end in {n} days',
    fr: 'fin dans {n} jours',
    de: 'Ende in {n} Tagen',
    es: 'fin en {n} días',
  },
  whenLate1: {
    en: '1 day overdue',
    fr: 'en retard d’1 jour',
    de: 'seit 1 Tag überfällig',
    es: 'con 1 día de retraso',
  },
  whenLate: {
    en: '{n} days overdue',
    fr: 'en retard de {n} jours',
    de: 'seit {n} Tagen überfällig',
    es: 'con {n} días de retraso',
  },
  shortToday: { en: 'Today', fr: 'Aujourd’hui', de: 'Heute', es: 'Hoy' },
  shortIn: { en: '{n} d', fr: '{n} j', de: '{n} T', es: '{n} d' },
  shortLate: {
    en: '{n} d late',
    fr: '{n} j de retard',
    de: '{n} T zu spät',
    es: '{n} d tarde',
  },
  unitDays: { en: 'd', fr: 'j', de: 'T', es: 'd' },
  daysCount: { en: '{n} days', fr: '{n} jours', de: '{n} Tage', es: '{n} días' },
  monthsCount: { en: '{n} months', fr: '{n} mois', de: '{n} Monate', es: '{n} meses' },
  life_set: { en: 'set', fr: 'saisie', de: 'eingegeben', es: 'indicada' },
  life_learned: { en: 'learned', fr: 'apprise', de: 'gelernt', es: 'aprendida' },
  life_default: { en: 'default', fr: 'par défaut', de: 'Standard', es: 'por defecto' },

  // status of the Configuration screen
  statusEmpty: {
    en: 'No battery yet: add one with the “Add a battery” button below.',
    fr: 'Aucune pile pour l’instant : ajoutez-en une avec le bouton « Ajouter une pile » ci-dessous.',
    de: 'Noch keine Batterie: Fügen Sie eine mit der Schaltfläche „Batterie hinzufügen“ unten hinzu.',
    es: 'Todavía no hay pilas: añada una con el botón «Añadir una pila» de abajo.',
  },
  statusOk: {
    en: '{count} battery record(s), {due} to replace soon.',
    fr: '{count} fiche(s) de piles, {due} à remplacer bientôt.',
    de: '{count} Batterie-Eintrag/Einträge, {due} bald zu wechseln.',
    es: '{count} ficha(s) de pilas, {due} por cambiar pronto.',
  },

  // configuration buttons
  added: {
    en: 'Battery added. Add its device in the Discovery tab.\n{line}',
    fr: 'Pile ajoutée. Ajoutez son appareil dans l’onglet Découverte.\n{line}',
    de: 'Batterie hinzugefügt. Fügen Sie ihr Gerät im Tab Entdecken hinzu.\n{line}',
    es: 'Pila añadida. Añada su dispositivo en la pestaña Descubrir.\n{line}',
  },
  edited: {
    en: 'Battery changed.\n{line}',
    fr: 'Pile modifiée.\n{line}',
    de: 'Batterie geändert.\n{line}',
    es: 'Pila modificada.\n{line}',
  },
  removed: {
    en: '“{name}” removed. Also delete its device in Gladys if you had added it.',
    fr: '« {name} » supprimée. Supprimez aussi son appareil dans Gladys si vous l’aviez ajouté.',
    de: '„{name}“ entfernt. Löschen Sie auch ihr Gerät in Gladys, falls Sie es hinzugefügt hatten.',
    es: '«{name}» eliminada. Elimine también su dispositivo en Gladys si lo había añadido.',
  },
  replaced: {
    en: 'Replacement of “{name}” recorded on {day}.',
    fr: 'Remplacement de « {name} » enregistré le {day}.',
    de: 'Wechsel von „{name}“ am {day} erfasst.',
    es: 'Cambio de «{name}» registrado el {day}.',
  },
  stockLeft: {
    en: '{n} × {type} left in stock.',
    fr: 'Il reste {n} × {type} en stock.',
    de: 'Noch {n} × {type} auf Lager.',
    es: 'Quedan {n} × {type} en stock.',
  },
  stockShort: {
    en: 'Not enough {type} in stock: {n} left, the list to buy is updated.',
    fr: 'Pas assez de {type} en stock : il en reste {n}, la liste d’achats est à jour.',
    de: 'Nicht genug {type} auf Lager: noch {n}, die Einkaufsliste ist aktualisiert.',
    es: 'No hay suficientes {type} en stock: quedan {n}, la lista de compra está al día.',
  },
  undone: {
    en: 'Last replacement of “{name}” undone: back to {day}.',
    fr: 'Dernier remplacement de « {name} » annulé : retour au {day}.',
    de: 'Letzter Wechsel von „{name}“ rückgängig gemacht: zurück zum {day}.',
    es: 'Último cambio de «{name}» anulado: vuelta al {day}.',
  },
  stockReturned: {
    en: '{n} × {type} put back in stock.',
    fr: '{n} × {type} remises en stock.',
    de: '{n} × {type} wieder auf Lager.',
    es: '{n} × {type} devueltas al stock.',
  },
  listHeader: {
    en: '{count} battery record(s) on {today}:',
    fr: '{count} fiche(s) de piles au {today} :',
    de: '{count} Batterie-Eintrag/Einträge am {today}:',
    es: '{count} ficha(s) de pilas el {today}:',
  },
  listLine: {
    en: '#{n} {line} (replaced {replaced})',
    fr: '#{n} {line} (remplacées le {replaced})',
    de: '#{n} {line} (gewechselt am {replaced})',
    es: '#{n} {line} (cambiadas el {replaced})',
  },
  listEmpty: {
    en: 'No battery yet.',
    fr: 'Aucune pile pour l’instant.',
    de: 'Noch keine Batterie.',
    es: 'Todavía no hay pilas.',
  },
  listNoStock: {
    en: 'Stock: none recorded.',
    fr: 'Stock : rien d’enregistré.',
    de: 'Lager: nichts erfasst.',
    es: 'Stock: nada registrado.',
  },
  listStock: {
    en: 'Stock: {stock}',
    fr: 'Stock : {stock}',
    de: 'Lager: {stock}',
    es: 'Stock: {stock}',
  },
  stockChanged: {
    en: 'Stock of {type}: {before} → {after}.',
    fr: 'Stock de {type} : {before} → {after}.',
    de: 'Lager {type}: {before} → {after}.',
    es: 'Stock de {type}: {before} → {after}.',
  },
  lookupNone: {
    en: 'No model found in the library. Type the battery type yourself (it is written on the battery).',
    fr: 'Aucun modèle trouvé dans la bibliothèque. Saisissez le type vous-même (il est écrit sur la pile).',
    de: 'Kein Modell in der Bibliothek gefunden. Geben Sie den Typ selbst ein (er steht auf der Batterie).',
    es: 'Ningún modelo encontrado en la biblioteca. Escriba el tipo usted mismo (está escrito en la pila).',
  },
  lookupHeader: {
    en: '{count} model(s) found ({shown} shown):',
    fr: '{count} modèle(s) trouvé(s) ({shown} affiché(s)) :',
    de: '{count} Modell(e) gefunden ({shown} angezeigt):',
    es: '{count} modelo(s) encontrado(s) ({shown} mostrado(s)):',
  },
  lookupLine: {
    en: '• {model}: {battery}',
    fr: '• {model} : {battery}',
    de: '• {model}: {battery}',
    es: '• {model}: {battery}',
  },

  // scene texts
  reportLine: {
    en: '• {name} ({model}): {when}',
    fr: '• {name} ({model}) : {when}',
    de: '• {name} ({model}): {when}',
    es: '• {name} ({model}): {when}',
  },
  reportLevelLow: {
    en: 'level {level} %',
    fr: 'niveau {level} %',
    de: 'Ladestand {level} %',
    es: 'nivel {level} %',
  },
  reportDue: {
    en: 'Batteries to replace ({count}):',
    fr: 'Piles à remplacer ({count}) :',
    de: 'Zu wechselnde Batterien ({count}):',
    es: 'Pilas por cambiar ({count}):',
  },
  reportAll: {
    en: 'All batteries ({count}):',
    fr: 'Toutes les piles ({count}) :',
    de: 'Alle Batterien ({count}):',
    es: 'Todas las pilas ({count}):',
  },
  reportNothingDue: {
    en: 'No battery to replace.',
    fr: 'Aucune pile à remplacer.',
    de: 'Keine Batterie zu wechseln.',
    es: 'Ninguna pila por cambiar.',
  },
  reportEmpty: {
    en: 'No battery recorded.',
    fr: 'Aucune pile enregistrée.',
    de: 'Keine Batterie erfasst.',
    es: 'Ninguna pila registrada.',
  },
  reportToBuy: { en: 'To buy:', fr: 'À acheter :', de: 'Zu kaufen:', es: 'Por comprar:' },
  reportBuyLine: {
    en: '• {count} × {type}',
    fr: '• {count} × {type}',
    de: '• {count} × {type}',
    es: '• {count} × {type}',
  },
  reportNothingToBuy: {
    en: 'Nothing to buy.',
    fr: 'Rien à acheter.',
    de: 'Nichts zu kaufen.',
    es: 'Nada que comprar.',
  },

  // widgets
  widgetEmpty: {
    en: 'No battery yet. Add them in the configuration of the Battery Tracker integration.',
    fr: 'Aucune pile pour l’instant. Ajoutez-les dans la configuration de l’intégration Battery Tracker.',
    de: 'Noch keine Batterie. Fügen Sie sie in der Konfiguration der Integration Battery Tracker hinzu.',
    es: 'Todavía no hay pilas. Añádalas en la configuración de la integración Battery Tracker.',
  },
  widgetNothingDue: {
    en: 'No battery to replace soon.',
    fr: 'Aucune pile à remplacer bientôt.',
    de: 'Keine Batterie bald zu wechseln.',
    es: 'Ninguna pila por cambiar pronto.',
  },
  widgetMore: {
    en: 'And {count} more.',
    fr: 'Et {count} de plus.',
    de: 'Und {count} weitere.',
    es: 'Y {count} más.',
  },
  widgetChooseBattery: {
    en: 'Choose a battery in the settings of the widget (its device must be added in Gladys).',
    fr: 'Choisissez une pile dans les réglages du widget (son appareil doit être ajouté dans Gladys).',
    de: 'Wählen Sie eine Batterie in den Einstellungen des Widgets (ihr Gerät muss in Gladys hinzugefügt sein).',
    es: 'Elija una pila en los ajustes del widget (su dispositivo debe estar añadido en Gladys).',
  },
  widgetBatteryGone: {
    en: 'This battery no longer exists in the integration. Choose another one in the settings.',
    fr: 'Cette pile n’existe plus dans l’intégration. Choisissez-en une autre dans les réglages.',
    de: 'Diese Batterie gibt es in der Integration nicht mehr. Wählen Sie eine andere in den Einstellungen.',
    es: 'Esta pila ya no existe en la integración. Elija otra en los ajustes.',
  },
  widgetShoppingEmpty: {
    en: 'Nothing to buy within {days} days, and no stock recorded.',
    fr: 'Rien à acheter dans les {days} jours, et aucun stock enregistré.',
    de: 'Nichts zu kaufen in den nächsten {days} Tagen, und kein Lager erfasst.',
    es: 'Nada que comprar en {days} días, y ningún stock registrado.',
  },
  widgetHorizon: {
    en: 'Batteries ending within {days} days.',
    fr: 'Piles en fin de vie dans les {days} jours.',
    de: 'Batterien, die in {days} Tagen leer werden.',
    es: 'Pilas que se agotan en {days} días.',
  },
  tileReplace: { en: 'To replace', fr: 'À remplacer', de: 'Zu wechseln', es: 'Por cambiar' },
  tileSoon: { en: 'Soon', fr: 'Bientôt', de: 'Bald', es: 'Pronto' },
  tileToBuy: { en: 'To buy', fr: 'À acheter', de: 'Zu kaufen', es: 'Por comprar' },
  tileInStock: { en: 'In stock', fr: 'En stock', de: 'Auf Lager', es: 'En stock' },
  tileLevel: { en: 'Level', fr: 'Niveau', de: 'Ladestand', es: 'Nivel' },
  tileLevelEstimated: {
    en: 'Estimated level',
    fr: 'Niveau estimé',
    de: 'Geschätzter Stand',
    es: 'Nivel estimado',
  },
  tileDaysLeft: { en: 'Days left', fr: 'Jours restants', de: 'Resttage', es: 'Días restantes' },
  tileLate: { en: 'Overdue', fr: 'En retard', de: 'Überfällig', es: 'Retraso' },
  tileDaysSince: { en: 'In use for', fr: 'En service', de: 'In Betrieb', es: 'En uso' },
  rowType: { en: 'Batteries', fr: 'Piles', de: 'Batterien', es: 'Pilas' },
  rowReplaced: { en: 'Replaced', fr: 'Remplacées le', de: 'Gewechselt am', es: 'Cambiadas el' },
  rowEnd: { en: 'Estimated end', fr: 'Fin estimée', de: 'Geschätztes Ende', es: 'Fin estimado' },
  rowLife: { en: 'Life', fr: 'Durée de vie', de: 'Lebensdauer', es: 'Duración' },
  rowLevelSource: { en: 'Level', fr: 'Niveau', de: 'Ladestand', es: 'Nivel' },
  levelReported: {
    en: 'reported {day}',
    fr: 'mesuré le {day}',
    de: 'gemeldet am {day}',
    es: 'medido el {day}',
  },
  levelEstimated: {
    en: 'estimated from age',
    fr: 'estimé selon l’âge',
    de: 'nach Alter geschätzt',
    es: 'estimado por la edad',
  },
  rowStock: { en: 'Stock', fr: 'Stock', de: 'Lager', es: 'Stock' },
  stockCount: { en: '{n} spare', fr: '{n} de rechange', de: '{n} Ersatz', es: '{n} de repuesto' },
  rowToBuy: {
    en: 'buy {buy} · stock {stock}',
    fr: 'acheter {buy} · stock {stock}',
    de: '{buy} kaufen · Lager {stock}',
    es: 'comprar {buy} · stock {stock}',
  },
  rowEnough: {
    en: 'stock {stock} · needs {needed}',
    fr: 'stock {stock} · besoin {needed}',
    de: 'Lager {stock} · Bedarf {needed}',
    es: 'stock {stock} · necesita {needed}',
  },
  buttonReplaced: {
    en: 'Batteries replaced',
    fr: 'Piles changées',
    de: 'Batterien gewechselt',
    es: 'Pilas cambiadas',
  },
  buttonReplacedToday: {
    en: 'Replaced today',
    fr: 'Changées aujourd’hui',
    de: 'Heute gewechselt',
    es: 'Cambiadas hoy',
  },
  buttonStock: {
    en: 'Update stock',
    fr: 'Mettre à jour le stock',
    de: 'Lager ändern',
    es: 'Actualizar stock',
  },
  buttonBought: {
    en: 'Bought the list',
    fr: 'Liste achetée',
    de: 'Liste gekauft',
    es: 'Lista comprada',
  },
  formBattery: { en: 'Battery', fr: 'Pile', de: 'Batterie', es: 'Pila' },
  formDay: {
    en: 'Day (empty = today)',
    fr: 'Jour (vide = aujourd’hui)',
    de: 'Tag (leer = heute)',
    es: 'Día (vacío = hoy)',
  },
  formDayPlaceholder: { en: 'dd/mm/yyyy', fr: 'jj/mm/aaaa', de: 'TT.MM.JJJJ', es: 'dd/mm/aaaa' },
  formType: { en: 'Battery type', fr: 'Type de pile', de: 'Batterietyp', es: 'Tipo de pila' },
  formOperation: { en: 'Operation', fr: 'Opération', de: 'Vorgang', es: 'Operación' },
  formCount: { en: 'Count', fr: 'Nombre', de: 'Anzahl', es: 'Cantidad' },
  operation_add: { en: 'Add', fr: 'Ajouter', de: 'Hinzufügen', es: 'Añadir' },
  operation_remove: { en: 'Remove', fr: 'Retirer', de: 'Entnehmen', es: 'Quitar' },
  operation_set: { en: 'Set to', fr: 'Fixer à', de: 'Setzen auf', es: 'Fijar en' },
  toastNoForm: {
    en: 'This version of Gladys does not send the form of the button: update Gladys.',
    fr: 'Cette version de Gladys n’envoie pas le formulaire du bouton : mettez Gladys à jour.',
    de: 'Diese Gladys-Version sendet das Formular der Schaltfläche nicht: Aktualisieren Sie Gladys.',
    es: 'Esta versión de Gladys no envía el formulario del botón: actualice Gladys.',
  },
  toastNothingToBuy: {
    en: 'Nothing to buy.',
    fr: 'Rien à acheter.',
    de: 'Nichts zu kaufen.',
    es: 'Nada que comprar.',
  },
  toastBought: {
    en: 'Put in stock: {bought}.',
    fr: 'Mis en stock : {bought}.',
    de: 'Eingelagert: {bought}.',
    es: 'Añadido al stock: {bought}.',
  },

  // errors
  errorSave: {
    en: 'Unable to save: {message}',
    fr: 'Enregistrement impossible : {message}',
    de: 'Speichern nicht möglich: {message}',
    es: 'No se puede guardar: {message}',
  },
  errorName: {
    en: 'Give a name from 1 to {max} characters (what the batteries power).',
    fr: 'Donnez un nom de 1 à {max} caractères (ce que les piles alimentent).',
    de: 'Geben Sie einen Namen mit 1 bis {max} Zeichen an (was die Batterien versorgen).',
    es: 'Indique un nombre de 1 a {max} caracteres (lo que alimentan las pilas).',
  },
  errorType: {
    en: 'Give a battery type from 1 to {max} characters (AA, CR2032…).',
    fr: 'Donnez un type de pile de 1 à {max} caractères (AA, CR2032…).',
    de: 'Geben Sie einen Batterietyp mit 1 bis {max} Zeichen an (AA, CR2032…).',
    es: 'Indique un tipo de pila de 1 a {max} caracteres (AA, CR2032…).',
  },
  errorTypeMissing: {
    en: 'Give the battery type, or the manufacturer and model of the device to look it up.',
    fr: 'Donnez le type de pile, ou le fabricant et le modèle de l’appareil pour le chercher.',
    de: 'Geben Sie den Batterietyp an, oder Hersteller und Modell des Geräts, um ihn zu suchen.',
    es: 'Indique el tipo de pila, o el fabricante y el modelo del dispositivo para buscarlo.',
  },
  errorModelUnknown: {
    en: '“{model}” is not in the library: type the battery type yourself.',
    fr: '« {model} » n’est pas dans la bibliothèque : saisissez le type de pile vous-même.',
    de: '„{model}“ ist nicht in der Bibliothek: Geben Sie den Batterietyp selbst ein.',
    es: '«{model}» no está en la biblioteca: escriba el tipo de pila usted mismo.',
  },
  errorModelAmbiguous: {
    en: '“{model}” matches {count} models ({types}): be more precise, or type the battery type.',
    fr: '« {model} » correspond à {count} modèles ({types}) : précisez, ou saisissez le type de pile.',
    de: '„{model}“ passt auf {count} Modelle ({types}): Seien Sie genauer oder geben Sie den Batterietyp ein.',
    es: '«{model}» corresponde a {count} modelos ({types}): precise, o escriba el tipo de pila.',
  },
  errorModel_manual: {
    en: 'For “{model}”, the library says to check the manual: type the battery type yourself.',
    fr: 'Pour « {model} », la bibliothèque renvoie à la notice : saisissez le type de pile vous-même.',
    de: 'Für „{model}“ verweist die Bibliothek auf die Anleitung: Geben Sie den Batterietyp selbst ein.',
    es: 'Para «{model}», la biblioteca remite al manual: escriba el tipo de pila usted mismo.',
  },
  errorModel_irreplaceable: {
    en: 'The battery of “{model}” cannot be replaced, according to the library.',
    fr: 'La pile de « {model} » n’est pas remplaçable, d’après la bibliothèque.',
    de: 'Die Batterie von „{model}“ ist laut Bibliothek nicht austauschbar.',
    es: 'La pila de «{model}» no es reemplazable, según la biblioteca.',
  },
  errorQuantity: {
    en: 'The number of batteries goes from {min} to {max}.',
    fr: 'Le nombre de piles va de {min} à {max}.',
    de: 'Die Anzahl der Batterien liegt zwischen {min} und {max}.',
    es: 'El número de pilas va de {min} a {max}.',
  },
  errorLife: {
    en: 'The life goes from {min} to {max} months (0 = learned or default life).',
    fr: 'La durée de vie va de {min} à {max} mois (0 = durée apprise ou par défaut).',
    de: 'Die Lebensdauer liegt zwischen {min} und {max} Monaten (0 = gelernt oder Standard).',
    es: 'La duración va de {min} a {max} meses (0 = aprendida o por defecto).',
  },
  errorDay: {
    en: '“{value}” is not a day: write it dd/mm/yyyy, or leave it empty for today.',
    fr: '« {value} » n’est pas une date : écrivez-la jj/mm/aaaa, ou laissez vide pour aujourd’hui.',
    de: '„{value}“ ist kein Datum: Schreiben Sie es TT.MM.JJJJ oder lassen Sie es leer für heute.',
    es: '«{value}» no es una fecha: escríbala dd/mm/aaaa, o déjela vacía para hoy.',
  },
  errorFutureDay: {
    en: 'A replacement cannot be in the future.',
    fr: 'Un remplacement ne peut pas être dans le futur.',
    de: 'Ein Wechsel kann nicht in der Zukunft liegen.',
    es: 'Un cambio no puede estar en el futuro.',
  },
  errorBeforeLast: {
    en: 'This day is before the last replacement: correct it with “Edit a battery”.',
    fr: 'Ce jour est antérieur au dernier remplacement : corrigez-le avec « Modifier une pile ».',
    de: 'Dieser Tag liegt vor dem letzten Wechsel: Korrigieren Sie ihn mit „Batterie bearbeiten“.',
    es: 'Este día es anterior al último cambio: corríjalo con «Modificar una pila».',
  },
  errorNothingToUndo: {
    en: '“{name}” has no previous replacement to come back to.',
    fr: '« {name} » n’a pas de remplacement précédent auquel revenir.',
    de: '„{name}“ hat keinen früheren Wechsel, zu dem zurückgekehrt werden kann.',
    es: '«{name}» no tiene un cambio anterior al que volver.',
  },
  errorTarget: {
    en: 'Give the number (#2), the name or the identifier of the battery.',
    fr: 'Donnez le numéro (#2), le nom ou l’identifiant de la pile.',
    de: 'Geben Sie die Nummer (#2), den Namen oder die Kennung der Batterie an.',
    es: 'Indique el número (#2), el nombre o el identificador de la pila.',
  },
  errorAmbiguous: {
    en: 'Several batteries are named “{query}” ({numbers}): use the number.',
    fr: 'Plusieurs piles s’appellent « {query} » ({numbers}) : utilisez le numéro.',
    de: 'Mehrere Batterien heißen „{query}“ ({numbers}): Verwenden Sie die Nummer.',
    es: 'Varias pilas se llaman «{query}» ({numbers}): use el número.',
  },
  errorNotFound: {
    en: 'No battery “{query}”. “List the batteries” gives the numbers.',
    fr: 'Aucune pile « {query} ». « Lister les piles » donne les numéros.',
    de: 'Keine Batterie „{query}“. „Batterien auflisten“ zeigt die Nummern.',
    es: 'Ninguna pila «{query}». «Listar las pilas» da los números.',
  },
  errorFull: {
    en: 'At most {max} batteries.',
    fr: '{max} piles au maximum.',
    de: 'Höchstens {max} Batterien.',
    es: 'Como máximo {max} pilas.',
  },
  errorChoice: {
    en: '“{value}” is not one of the choices.',
    fr: '« {value} » ne fait pas partie des choix.',
    de: '„{value}“ gehört nicht zur Auswahl.',
    es: '«{value}» no es una de las opciones.',
  },
  errorCount: {
    en: 'Give a whole number from 0 to {max}.',
    fr: 'Donnez un nombre entier de 0 à {max}.',
    de: 'Geben Sie eine ganze Zahl von 0 bis {max} an.',
    es: 'Indique un número entero de 0 a {max}.',
  },
  errorTypes: {
    en: 'At most {max} battery types in stock.',
    fr: '{max} types de piles au maximum en stock.',
    de: 'Höchstens {max} Batterietypen auf Lager.',
    es: 'Como máximo {max} tipos de pilas en stock.',
  },
  errorDevice: {
    en: 'This device is not a battery of the Battery Tracker integration.',
    fr: 'Cet appareil n’est pas une pile de l’intégration Battery Tracker.',
    de: 'Dieses Gerät ist keine Batterie der Integration Battery Tracker.',
    es: 'Este dispositivo no es una pila de la integración Battery Tracker.',
  },
  errorLevel: {
    en: '“{value}” is not a level from 0 to 100.',
    fr: '« {value} » n’est pas un niveau de 0 à 100.',
    de: '„{value}“ ist kein Stand von 0 bis 100.',
    es: '«{value}» no es un nivel de 0 a 100.',
  },
};

/**
 * @description Whether a value is one of the languages of the integration.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language (English fallback), with its
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('whenIn', 'fr', { n: 3 }); // -> 'fin dans 3 jours'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string|Function} key - The TEXTS key, or `(language) => string`.
 * @param {object} [values] - The substitutions.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 * @example
 * all('statusOk', { count: 3, due: 1 });
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      typeof key === 'function' ? key(language) : t(key, language, values),
    ]),
  );
}

const locale = (language) => (isLanguage(language) ? language : 'en');

/**
 * @description A calendar day written in a language: "Saturday, November 21,
 * 2026" (long), "Nov 21, 2026" (short).
 * @param {string} iso - YYYY-MM-DD.
 * @param {string} language - The language.
 * @param {'long'|'short'} [style] - The style.
 * @returns {string} The text.
 * @example
 * formatDay('2026-11-21', 'fr'); // -> 'samedi 21 novembre 2026'
 */
function formatDay(iso, language, style = 'long') {
  const [year, month, day] = iso.split('-').map(Number);
  const options =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
      : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };
  return new Intl.DateTimeFormat(locale(language), options).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

/**
 * @description A day without its year: "Nov 21", "21 nov.".
 * @param {string} iso - YYYY-MM-DD.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function formatShortDay(iso, language) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(language), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * @description The days left before the estimated end, written: "end in 12
 * days", "end today", "3 days overdue" (long, inside a sentence), or "12 d",
 * "Today", "3 d late" (short, a widget row).
 * @param {number} days - Days remaining (negative once passed).
 * @param {string} language - The language.
 * @param {'long'|'short'} [style] - The style.
 * @returns {string} The text.
 */
function relativeDays(days, language, style = 'long') {
  if (style === 'short') {
    if (days === 0) return t('shortToday', language);
    return days > 0 ? t('shortIn', language, { n: days }) : t('shortLate', language, { n: -days });
  }
  if (days === 0) return t('whenToday', language);
  if (days === 1) return t('whenTomorrow', language);
  if (days === -1) return t('whenLate1', language);
  return days > 0 ? t('whenIn', language, { n: days }) : t('whenLate', language, { n: -days });
}

export { LANGUAGES, TEXTS, isLanguage, t, all, formatDay, formatShortDay, relativeDays };
