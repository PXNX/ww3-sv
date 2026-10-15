/*
 * Sanctions Wordle word list for "de". Written with umlauts and ß here; the game spells them AE, OE, UE and SS (a word counts when that form has exactly five letters), see locales.ts.
 *
 * SOLUTIONS are the words a puzzle can pick: common five-letter words, themed on sanctions,
 * energy, trade, politics and bureaucracy where possible. EXTRA are further valid guesses that
 * are never the answer. Every word of both lists is allowed as a guess.
 *
 * Status: drafted without a native-speaker review. A native speaker must check every entry (spelling, real word, not offensive or obscure) before this list is relied on.
 * Entries are separated by white space; the tests check length, alphabet and duplicates.
 */

export const SOLUTIONS = `
kohle strom preis markt waren fonds lager hafen route kanal rohre pumpe netze sonne
kraft licht dampf motor kabel atome kerne macht recht regel union staat reich krieg
waffe armee bombe minen front linie mauer büro akten frist liste kreis kasse quote limit
reden worte thema angst lüge bluff spion agent lecks spaß humor abgas anbau aktie alarm
ampel anruf arena armut asche audio autor blitz block boden bonus brief druck daten
datei feuer figur firma forum frage gleis gramm hilfe hitze index insel kampf klima
konto kurve lokal notiz organ panik party phase pilot piste probe profi regen reihe
robot runde sache serie sicht skala sorge sorte sport stufe summe tempo titel video
virus visum vogel wagen welle werte wolke zelle zitat zeuge natur wurst käse milch salat
suppe nudel apfel birne torte tisch stuhl lampe uhren fluss berge wiese blume katze
pferd fisch adler bauer vater feind grün weiß groß klein braun stark mutig leise heiß
süß sauer essen gehen sehen sagen geben bauen lesen leben handy radio bruch traum reise
tafel stern hotel spiel stadt kunst karte punkt tonne folge rente brand gabel kanne
decke ernte ziele ruhig
`;

export const EXTRA = `
abbau abend abzug achse acker adern adieu affen ahnen ahorn alben album alibi allee
alles alpen alpha altar alter amsel angel anker antik april arche areal arten asien
atlas autos axiom backe baden bahre ballt bande bange bares baron basis bauch beben
beere beete beine beleg bellt beton beule beute biene biere bilde binde birke bisse
bitte blank blase blass blatt blech blind blond blues bluse bogen bohne boote boxen
boxer brach braut bravo breit brett brise brote brust buche buchs bucht buden bulle
bunte busch busse bytes cello chaos chefs chips clown clubs codes creme dachs damen
danke darum datum decks degen deich delta deren dicht dicke diebe dient diese dinar
dinge disco dogma dolch dosen dosis draht drama drang dreck dreht droge duell duett
dumme dumpf dunst durch durst duzen ebene ecken edler ehren eigen eilen eilig eimer
einer eines einig einst eisen eisig eitel elche elend elfen emsig enden engel enger
enkel enorm erben erbin erbse erden ernst erste essig etage ethik etwas euros event
exakt extra fabel faden fahne fahrt falke falle falls farbe fasan faser fasst fatal
fauna fehde fehle fehlt feier feige feile felge felle ferne ferse feste fiber filme
finde first flach fleck flink flora floss flott fluch föhn folie forme forst fotos frech
freie fromm frost fuchs funke futur gaben ganze gasse gaste geber gebet gebot geige
geist gelbe gelee gelte genau genie genug gerne gerte gifte gilde glanz glatt glied
gnade gotik grand graue greis grell griff grill grobe groll grube gruss gummi gunst
gurke gutes haare haben hacke hafer hagel hager haken halbe halle hallo halte harfe
hasen hasse hasst hatte haupt hebel heben hecke hefte heide heile heilt heizt helle
helme hemde heran herbe herde herum heute hexen hielt hinab hinzu hirte hobby höhe hofft
hohle holen holte honig horde hosen hüte hunde hymne ideal idiot immer infos innen irren
islam jacke jagen jahre jeans jener jetzt joker jubel junge kader kajak kakao kamel
kamin kante kappe karat karre kater kaufe kegel kehle keine kelch kenne kerbe kerze
kette kilos kiste klage klang klaue klick klotz knabe knall knapp knete knick knien
knopf koala kodex komma kopie krach krank kranz krass kraut krebs krone kühe kugel kunde
kurze laden lärm lagen lande lange lanze larve laser lasse latte laube laufe lauge laune
leber lecke leder legen lehne lehre leine lenkt lernt leute liebe liege lilie links
lippe liter lobby locke löwe lotse lotto lunge lyrik mache märz magen mager magie mahnt
makel malen mango mappe marke maske masse mathe matte media meile meine meist melde
menge merke messe meter meute miene miete minus mitte mixer modus monat monde moral
motte müde mühe müll mumie musik nabel nacht nadel nähe näht nagel nagen nahen namen
nasen nebel neben neffe nehme nehmt neige neigt nelke nenne nette netto neuen neuer
neues nicht niete nimmt nobel nonne nutzt nylon ochse ölen offen ohren olive omega onkel
opern opfer optik orden ordne orgel orkan osten otter ozean paare pacht packe paket
panda papst parka passt pasta pause pedal perle pfahl pfand pfeil pflug pfote piano
pille pilze pirat pizza plage plane platz plump pocke porto posse prall prinz prosa
psalm pudel puder puppe putzt quark quarz quitt rache rampe rasch rasen rasse raste
ratte rauch raupe raute regal reibe reife reime reine reist rennt revue ribbe riese
rille ringe rippe ritus robbe rogen rolle roman rosen rotor ruder rufen ruhen ruine
rumpf russe sagte sahne saite salbe salon salto salve samen sanft sauce sauna schal
scham schar schau scheu schon schuh sechs seele segel segen sehne seide seife seite
sekte senat sende senke serum siege sieht silbe silos singt sinne sirup sitte sitzt
skier slang snack sofas sohle sonst sowie spät spare spart speck speer spitz spott sprit
spule stahl stall stamm stand statt staub stein stets stich stier stift still stirn
stock stoff stolz stopp store stube stumm sturm sturz suche sucht sumpf super tabak
taler tango tanks tanne tante tanzt tarif tasse taste taten tatze taube teams teddy
teich teile teils tenor tests teuer texte thron tiefe tiger tinte tipps tippt toast
toben total trage tragt trank treue trick trieb trist tritt trost trotz truhe trupp tüte
tulpe übel über umher umweg umzug unfug unrat unser unten unter urahn uralt vasen venen
verse viele villa viren volle vorab voran vorne votum waage waben wache wachs wacht
waden wäre wagte wahre waise walze wange wanne wanze warte warum watte wecke wedel weder
wegen wehen weich weide weile weine weint weise weist weite wende wenig werde werft
werke wesen weste wette wider wilde wirkt wirte witwe witze woche woher wohin wohnt
wolle wonne wuchs wunde wurde zacke zange zebra zeche zehen zeige zeigt zeile ziege
ziehe ziert zirka zonen zucht zudem zumal zunge zuvor zwang zweck zweig zwerg zwirn
zwist
`;
