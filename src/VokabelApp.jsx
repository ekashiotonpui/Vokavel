import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Pencil, Trash2, X, ArrowLeftRight,
  RotateCcw, Check, Download, Upload, Layers, Search, Shuffle,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────
   Vokabel — ドイツ語 ⇄ 英語 双方向フラッシュカード
   設計の核：ドイツ語名詞の「性」を色で記憶する仕組み
     der = 青 / die = 赤 / das = 緑
   この色分けは飾りではなく、性を思い出すための学習補助。
   ────────────────────────────────────────────────────────── */

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

.vk-root {
  --desk: #15161B;
  --desk-2: #1C1E25;
  --paper: #FAF8F2;
  --paper-edge: #ECE7DA;
  --ink: #1A1A20;
  --ink-soft: #5C5C66;
  --line: #2A2C35;
  --der: #3B79B6;
  --die: #BE4763;
  --das: #2E9C6A;
  --neutral: #8A8A95;
  font-family: 'Inter', system-ui, sans-serif;
  background: radial-gradient(120% 90% at 50% -10%, #20222B 0%, var(--desk) 55%);
  color: #EDEAE2;
  min-height: 100dvh;
}

.vk-serif { font-family: 'Spectral', Georgia, serif; }
.vk-mono  { font-family: 'JetBrains Mono', monospace; }

.vk-btn { cursor: pointer; border: none; font-family: inherit; transition: transform .12s ease, background .15s ease, border-color .15s ease, opacity .15s; }
.vk-btn:active { transform: scale(.97); }
.vk-btn:focus-visible { outline: 2px solid #7FA8D6; outline-offset: 2px; }

.vk-icon-btn { display: grid; place-items: center; border-radius: 11px; transition: background .15s, color .15s; }
.vk-icon-btn:hover { background: rgba(255,255,255,.07); }

.vk-seg { transition: color .2s; }

.vk-card-shell { perspective: 1600px; }
.vk-card-inner {
  position: relative; width: 100%; height: 100%;
  transform-style: preserve-3d;
  transition: transform .55s cubic-bezier(.2,.8,.25,1);
}
.vk-card-inner.flipped { transform: rotateY(180deg); }
.vk-face {
  position: absolute; inset: 0;
  -webkit-backface-visibility: hidden; backface-visibility: hidden;
  border-radius: 22px; overflow: hidden;
  display: flex; flex-direction: column;
}
.vk-face.back { transform: rotateY(180deg); }

.vk-rate:hover { transform: translateY(-2px); }

.vk-row:hover { background: rgba(255,255,255,.04); }

.vk-input {
  width: 100%; background: #14151A; border: 1px solid #2E313B; color: #EDEAE2;
  border-radius: 12px; padding: 12px 14px; font-size: 15px; font-family: inherit;
  transition: border-color .15s, background .15s;
}
.vk-input:focus { outline: none; border-color: #5E84B3; background: #171922; }
.vk-input::placeholder { color: #595C66; }

@keyframes vk-pop { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: none; } }
.vk-pop { animation: vk-pop .35s cubic-bezier(.2,.8,.25,1) both; }

@keyframes vk-fade { from { opacity: 0 } to { opacity: 1 } }
.vk-fade { animation: vk-fade .3s ease both; }

@media (prefers-reduced-motion: reduce) {
  .vk-card-inner, .vk-pop, .vk-fade { transition: none !important; animation: none !important; }
}
`;

/* ─── 性の色 ─── */
const GENDERS = {
  der: { color: "#3B79B6", label: "männlich" },
  die: { color: "#BE4763", label: "weiblich" },
  das: { color: "#2E9C6A", label: "sächlich" },
};
const genderColor = (g) => (GENDERS[g] ? GENDERS[g].color : "#8A8A95");

/* ─── 初期データ ─── */
const SEED = [
  ["Mutter","die","Mütter","Meine Mutter kocht sehr gut.","mother"],
  ["Vater","der","Väter","Mein Vater arbeitet in einer Firma.","father"],
  ["Sohn","der","Söhne","Mein Sohn geht noch zur Schule.","son"],
  ["Tochter","die","Töchter","Meine Tochter studiert in Berlin.","daughter"],
  ["Bruder","der","Brüder","Mein Bruder wohnt in München.","brother"],
  ["Schwester","die","Schwestern","Meine Schwester ist sehr nett.","sister"],
  ["Kind","das","Kinder","Die Kinder spielen im Garten.","child"],
  ["Freund","der","Freunde","Ich gehe mit meinem Freund ins Kino.","friend (male)"],
  ["Freundin","die","Freundinnen","Meine Freundin spricht sehr gut Deutsch.","friend (female)"],
  ["Kollege","der","Kollegen","Mein Kollege hilft mir immer.","colleague"],
  ["Mann","der","Männer","Der Mann trinkt seinen Kaffee.","man"],
  ["Frau","die","Frauen","Die Frau arbeitet als Ärztin.","woman"],
  ["Junge","der","Jungen","Der Junge spielt gerne Fußball.","boy"],
  ["Mädchen","das","Mädchen","Das Mädchen liest ein Buch.","girl"],
  ["Baby","das","Babys","Das Baby schläft die ganze Nacht.","baby"],
  ["Eltern","die","—","Meine Eltern wohnen in Hamburg.","parents"],
  ["Großmutter","die","Großmütter","Meine Großmutter macht die besten Kuchen.","grandmother"],
  ["Großvater","der","Großväter","Mein Großvater erzählt tolle Geschichten.","grandfather"],
  ["Onkel","der","Onkel","Mein Onkel lebt in Wien.","uncle"],
  ["Tante","die","Tanten","Meine Tante kommt uns nächste Woche besuchen.","aunt"],
  ["Neffe","der","Neffen","Mein Neffe ist erst drei Jahre alt.","nephew"],
  ["Nichte","die","Nichten","Meine Nichte geht schon in die Schule.","niece"],
  ["Nachbar","der","Nachbarn","Mein Nachbar ist sehr freundlich.","neighbor (male)"],
  ["Nachbarin","die","Nachbarinnen","Meine Nachbarin hat einen Hund.","neighbor (female)"],
  ["Chef","der","Chefs","Mein Chef ist sehr streng.","boss (male)"],
  ["Chefin","die","Chefinnen","Meine Chefin ist sehr fair.","boss (female)"],
  ["Arzt","der","Ärzte","Der Arzt untersucht den Patienten.","doctor (male)"],
  ["Ärztin","die","Ärztinnen","Die Ärztin gibt mir ein Rezept.","doctor (female)"],
  ["Lehrer","der","Lehrer","Unser Lehrer erklärt alles sehr gut.","teacher (male)"],
  ["Lehrerin","die","Lehrerinnen","Die Lehrerin korrigiert die Hausaufgaben.","teacher (female)"],
  ["Student","der","Studenten","Der Student lernt sehr fleißig.","student (male)"],
  ["Studentin","die","Studentinnen","Die Studentin schreibt ihre Bachelorarbeit.","student (female)"],
  ["Schüler","der","Schüler","Die Schüler machen ihre Hausaufgaben.","pupil (male)"],
  ["Schülerin","die","Schülerinnen","Die Schülerin ist sehr aufmerksam.","pupil (female)"],
  ["Kellner","der","Kellner","Der Kellner bringt uns die Speisekarte.","waiter"],
  ["Kellnerin","die","Kellnerinnen","Die Kellnerin empfiehlt das Tagesgericht.","waitress"],
  ["Koch","der","Köche","Der Koch bereitet das Essen zu.","cook / chef (male)"],
  ["Köchin","die","Köchinnen","Die Köchin kocht sehr kreativ.","cook / chef (female)"],
  ["Polizist","der","Polizisten","Der Polizist hilft den Touristen.","police officer (male)"],
  ["Feuerwehrmann","der","Feuerwehrmänner","Der Feuerwehrmann löscht den Brand.","firefighter"],
  ["Haus","das","Häuser","Das Haus am See ist sehr groß.","house"],
  ["Wohnung","die","Wohnungen","Ich suche eine neue Wohnung.","apartment"],
  ["Zimmer","das","Zimmer","Mein Zimmer ist leider sehr klein.","room"],
  ["Küche","die","Küchen","Wir kochen jeden Abend in der Küche.","kitchen"],
  ["Bad","das","Bäder","Das Bad ist gerade besetzt.","bathroom"],
  ["Schlafzimmer","das","Schlafzimmer","Mein Schlafzimmer ist sehr gemütlich.","bedroom"],
  ["Wohnzimmer","das","Wohnzimmer","Wir sehen im Wohnzimmer fern.","living room"],
  ["Garten","der","Gärten","Die Kinder spielen im Garten.","garden"],
  ["Balkon","der","Balkone","Ich trinke meinen Kaffee auf dem Balkon.","balcony"],
  ["Keller","der","Keller","Wir lagern Wein im Keller.","cellar"],
  ["Dach","das","Dächer","Das Dach ist leider undicht.","roof"],
  ["Tür","die","Türen","Bitte schließ die Tür.","door"],
  ["Fenster","das","Fenster","Kannst du das Fenster öffnen?","window"],
  ["Treppe","die","Treppen","Der Aufzug ist kaputt, wir nehmen die Treppe.","stairs"],
  ["Stadt","die","Städte","Berlin ist eine sehr lebendige Stadt.","city"],
  ["Dorf","das","Dörfer","Wir wohnen in einem kleinen Dorf.","village"],
  ["Straße","die","Straßen","Die Bäckerei ist in dieser Straße.","street"],
  ["Platz","der","Plätze","Treffen wir uns auf dem Marktplatz.","square / place"],
  ["Brücke","die","Brücken","Die Brücke über den Fluss ist sehr alt.","bridge"],
  ["Land","das","Länder","Deutschland ist ein schönes Land.","country"],
  ["Schule","die","Schulen","Die Kinder gehen jeden Tag zur Schule.","school"],
  ["Universität","die","Universitäten","Ich studiere an der Universität Hamburg.","university"],
  ["Krankenhaus","das","Krankenhäuser","Das Krankenhaus ist gleich um die Ecke.","hospital"],
  ["Apotheke","die","Apotheken","Ich brauche ein Medikament aus der Apotheke.","pharmacy"],
  ["Supermarkt","der","Supermärkte","Ich gehe nach der Arbeit in den Supermarkt.","supermarket"],
  ["Geschäft","das","Geschäfte","In der Innenstadt gibt es viele Geschäfte.","shop"],
  ["Bäckerei","die","Bäckereien","Die Bäckerei öffnet um sechs Uhr.","bakery"],
  ["Metzgerei","die","Metzgereien","Ich kaufe Fleisch in der Metzgerei.","butcher's shop"],
  ["Restaurant","das","Restaurants","Wir essen heute Abend im Restaurant.","restaurant"],
  ["Café","das","Cafés","Wir treffen uns im Café um drei.","café"],
  ["Hotel","das","Hotels","Das Hotel liegt sehr günstig.","hotel"],
  ["Flughafen","der","Flughäfen","Der Flughafen ist weit vom Zentrum entfernt.","airport"],
  ["Bahnhof","der","Bahnhöfe","Der Zug fährt vom Hauptbahnhof ab.","train station"],
  ["Haltestelle","die","Haltestellen","Die Bushaltestelle ist um die Ecke.","bus stop"],
  ["Markt","der","Märkte","Jeden Samstag gibt es einen Markt.","market"],
  ["Büro","das","Büros","Ich arbeite in einem Büro im Zentrum.","office"],
  ["Bank","die","Banken","Ich muss heute zur Bank gehen.","bank"],
  ["Post","die","—","Ich schicke das Paket mit der Post.","post office"],
  ["Museum","das","Museen","Das Museum ist am Wochenende geöffnet.","museum"],
  ["Theater","das","Theater","Wir gehen heute Abend ins Theater.","theater"],
  ["Kino","das","Kinos","Der neue Film läuft im Kino.","cinema"],
  ["Park","der","Parks","Ich gehe gerne im Park spazieren.","park"],
  ["Schwimmbad","das","Schwimmbäder","Im Sommer gehen wir ins Schwimmbad.","swimming pool"],
  ["Buch","das","Bücher","Ich lese gerade ein spannendes Buch.","book"],
  ["Tisch","der","Tische","Das Buch liegt auf dem Tisch.","table"],
  ["Stuhl","der","Stühle","Bitte setz dich auf diesen Stuhl.","chair"],
  ["Bett","das","Betten","Ich gehe früh ins Bett.","bed"],
  ["Schrank","der","Schränke","Meine Kleidung hängt im Schrank.","wardrobe / cabinet"],
  ["Lampe","die","Lampen","Die Lampe im Wohnzimmer ist kaputt.","lamp"],
  ["Wasser","das","—","Ich trinke täglich viel Wasser.","water"],
  ["Essen","das","—","Das Essen hier schmeckt sehr gut.","food / meal"],
  ["Kaffee","der","—","Morgens trinke ich immer einen Kaffee.","coffee"],
  ["Tee","der","—","Abends trinke ich lieber Tee.","tea"],
  ["Milch","die","—","Ich nehme Milch in meinen Kaffee.","milk"],
  ["Saft","der","Säfte","Möchtest du Orangen- oder Apfelsaft?","juice"],
  ["Bier","das","Biere","In Bayern trinkt man viel Bier.","beer"],
  ["Wein","der","Weine","Dieser Rotwein ist ausgezeichnet.","wine"],
  ["Brot","das","Brote","Ich kaufe jeden Morgen frisches Brot.","bread"],
  ["Brötchen","das","Brötchen","Zum Frühstück esse ich zwei Brötchen.","bread roll"],
  ["Butter","die","—","Ich streiche Butter aufs Brot.","butter"],
  ["Käse","der","—","Deutschland hat viele Käsesorten.","cheese"],
  ["Ei","das","Eier","Ich esse zum Frühstück zwei Eier.","egg"],
  ["Fleisch","das","—","Ich esse nicht so viel Fleisch.","meat"],
  ["Fisch","der","Fische","Freitags essen wir oft Fisch.","fish"],
  ["Huhn","das","Hühner","Das Huhn ist auf dem Bauernhof.","chicken"],
  ["Suppe","die","Suppen","Im Winter esse ich gerne warme Suppe.","soup"],
  ["Salat","der","Salate","Ich esse mittags oft einen Salat.","salad"],
  ["Kartoffel","die","Kartoffeln","Deutschland ist bekannt für seine Kartoffeln.","potato"],
  ["Reis","der","—","In Japan isst man täglich Reis.","rice"],
  ["Nudeln","die","—","Heute Abend mache ich Nudeln mit Tomatensauce.","noodles / pasta"],
  ["Gemüse","das","—","Ich esse täglich frisches Gemüse.","vegetables"],
  ["Obst","das","—","Jeden Tag esse ich frisches Obst.","fruit"],
  ["Apfel","der","Äpfel","Ein Apfel pro Tag hält den Arzt fern.","apple"],
  ["Banane","die","Bananen","Ich esse gerne Bananen nach dem Sport.","banana"],
  ["Kuchen","der","Kuchen","Meine Oma backt den besten Kuchen.","cake"],
  ["Schokolade","die","—","Ich liebe dunkle Schokolade.","chocolate"],
  ["Zucker","der","—","Nimmst du Zucker in deinen Kaffee?","sugar"],
  ["Salz","das","—","Das Essen braucht noch etwas Salz.","salt"],
  ["Geld","das","—","Ich habe diesen Monat nicht viel Geld.","money"],
  ["Preis","der","Preise","Der Preis ist leider sehr hoch.","price"],
  ["Rechnung","die","Rechnungen","Bitte bringen Sie mir die Rechnung.","bill / invoice"],
  ["Arbeit","die","Arbeiten","Ich suche eine neue Arbeit.","work / job"],
  ["Beruf","der","Berufe","Was ist dein Beruf?","profession / job"],
  ["Firma","die","Firmen","Ich arbeite für eine große Firma.","company / firm"],
  ["Brief","der","Briefe","Ich schreibe dir einen Brief.","letter"],
  ["E-Mail","die","E-Mails","Ich schicke dir eine E-Mail.","email"],
  ["Telefon","das","Telefone","Gibst du mir deine Telefonnummer?","telephone"],
  ["Handy","das","Handys","Ich habe mein Handy vergessen.","mobile phone"],
  ["Computer","der","Computer","Ich arbeite täglich am Computer.","computer"],
  ["Internet","das","—","Ohne Internet kann ich nicht arbeiten.","internet"],
  ["Zeitung","die","Zeitungen","Ich lese jeden Morgen die Zeitung.","newspaper"],
  ["Zeitschrift","die","Zeitschriften","Diese Zeitschrift erscheint monatlich.","magazine"],
  ["Kleidung","die","—","Ich brauche neue Kleidung für den Winter.","clothing"],
  ["Hemd","das","Hemden","Er trägt immer ein weißes Hemd.","shirt"],
  ["Hose","die","Hosen","Diese Hose passt mir sehr gut.","trousers"],
  ["Rock","der","Röcke","Sie trägt heute einen schönen Rock.","skirt"],
  ["Jacke","die","Jacken","Vergiss nicht deine Jacke mitzunehmen.","jacket"],
  ["Mantel","der","Mäntel","Im Winter trage ich einen warmen Mantel.","coat"],
  ["Schuhe","die","—","Ich brauche neue Schuhe.","shoes"],
  ["Tasche","die","Taschen","Hast du meine Tasche gesehen?","bag / pocket"],
  ["Brille","die","Brillen","Ohne Brille sehe ich fast nichts.","glasses"],
  ["Uhr","die","Uhren","Meine Uhr geht leider falsch.","watch / clock"],
  ["Ring","der","Ringe","Er hat ihr einen Ring geschenkt.","ring"],
  ["Auto","das","Autos","Mein Auto ist leider kaputt.","car"],
  ["Zug","der","Züge","Der Zug kommt um 10 Uhr an.","train"],
  ["Bus","der","Busse","Ich fahre jeden Tag mit dem Bus.","bus"],
  ["U-Bahn","die","U-Bahnen","Die U-Bahn ist schneller als der Bus.","subway"],
  ["Straßenbahn","die","Straßenbahnen","Die Straßenbahn fährt alle fünf Minuten.","tram"],
  ["Fahrrad","das","Fahrräder","Ich fahre mit dem Fahrrad zur Arbeit.","bicycle"],
  ["Flugzeug","das","Flugzeuge","Das Flugzeug startet um 14 Uhr.","airplane"],
  ["Schiff","das","Schiffe","Wir machen eine Kreuzfahrt mit dem Schiff.","ship"],
  ["Taxi","das","Taxis","Wir nehmen ein Taxi zum Flughafen.","taxi"],
  ["Ticket","das","Tickets","Ich kaufe das Ticket online.","ticket"],
  ["Fahrkarte","die","Fahrkarten","Bitte kaufe mir eine Fahrkarte.","train/bus ticket"],
  ["Koffer","der","Koffer","Ich packe meinen Koffer für die Reise.","suitcase"],
  ["Reise","die","Reisen","Die Reise nach Japan war wunderschön.","journey / trip"],
  ["Urlaub","der","Urlaube","Nächsten Monat habe ich endlich Urlaub.","vacation / holiday"],
  ["Zeit","die","Zeiten","Ich habe heute leider keine Zeit.","time"],
  ["Tag","der","Tage","Heute ist ein wunderschöner Tag.","day"],
  ["Nacht","die","Nächte","Gute Nacht, bis morgen!","night"],
  ["Morgen","der","Morgen","Ich stehe jeden Morgen früh auf.","morning"],
  ["Mittag","der","—","Wir treffen uns um Mittag.","midday / noon"],
  ["Abend","der","Abende","Was machst du heute Abend?","evening"],
  ["Jahr","das","Jahre","Dieses Jahr möchte ich Deutsch lernen.","year"],
  ["Woche","die","Wochen","Nächste Woche habe ich Urlaub.","week"],
  ["Monat","der","Monate","Im nächsten Monat fahre ich nach Deutschland.","month"],
  ["Stunde","die","Stunden","Der Unterricht dauert zwei Stunden.","hour"],
  ["Minute","die","Minuten","Ich brauche nur fünf Minuten.","minute"],
  ["Sekunde","die","Sekunden","Das geht in einer Sekunde.","second"],
  ["Frühling","der","—","Im Frühling blühen die Blumen.","spring"],
  ["Sommer","der","—","Im Sommer fahren wir ans Meer.","summer"],
  ["Herbst","der","—","Im Herbst werden die Blätter bunt.","autumn"],
  ["Winter","der","—","Im Winter schneit es oft.","winter"],
  ["Montag","der","—","Am Montag beginnt die Arbeitswoche.","Monday"],
  ["Dienstag","der","—","Am Dienstag habe ich eine Besprechung.","Tuesday"],
  ["Mittwoch","der","—","Am Mittwoch gehe ich zum Sport.","Wednesday"],
  ["Donnerstag","der","—","Am Donnerstag kommt meine Schwester.","Thursday"],
  ["Freitag","der","—","Am Freitag arbeite ich bis 15 Uhr.","Friday"],
  ["Samstag","der","—","Am Samstag schlafe ich lange.","Saturday"],
  ["Sonntag","der","—","Am Sonntag bleibe ich zu Hause.","Sunday"],
  ["Wochenende","das","Wochenenden","Was machst du am Wochenende?","weekend"],
  ["Sonne","die","—","Die Sonne scheint heute sehr hell.","sun"],
  ["Mond","der","—","Der Mond scheint hell heute Nacht.","moon"],
  ["Stern","der","Sterne","Der Himmel ist voller Sterne.","star"],
  ["Regen","der","—","Morgen soll es viel Regen geben.","rain"],
  ["Schnee","der","—","Die Kinder spielen im Schnee.","snow"],
  ["Wind","der","—","Heute weht ein starker Wind.","wind"],
  ["Wolke","die","Wolken","Am Himmel gibt es viele Wolken.","cloud"],
  ["Wetter","das","—","Das Wetter heute ist herrlich.","weather"],
  ["Temperatur","die","Temperaturen","Die Temperatur sinkt im Winter.","temperature"],
  ["Meer","das","Meere","Im Sommer fahren wir ans Meer.","sea"],
  ["See","der","Seen","Am See kann man gut entspannen.","lake"],
  ["Fluss","der","Flüsse","Der Rhein ist ein langer Fluss.","river"],
  ["Berg","der","Berge","Wir wandern dieses Wochenende auf den Berg.","mountain"],
  ["Wald","der","Wälder","Ein Spaziergang im Wald ist sehr erholsam.","forest"],
  ["Wiese","die","Wiesen","Die Kühe grasen auf der Wiese.","meadow"],
  ["Blume","die","Blumen","Ich kaufe meiner Mutter Blumen.","flower"],
  ["Baum","der","Bäume","Der Baum im Garten ist sehr alt.","tree"],
  ["Tier","das","Tiere","Magst du Tiere?","animal"],
  ["Hund","der","Hunde","Der Hund läuft schnell im Park.","dog"],
  ["Katze","die","Katzen","Die Katze schläft auf dem Sofa.","cat"],
  ["Vogel","der","Vögel","Der Vogel singt jeden Morgen.","bird"],
  ["Pferd","das","Pferde","Das Pferd läuft sehr schnell.","horse"],
  ["Kuh","die","Kühe","Die Kuh steht auf der Wiese.","cow"],
  ["Schwein","das","Schweine","Das Schwein grunzt auf dem Bauernhof.","pig"],
  ["Körper","der","Körper","Sport ist gut für den Körper.","body"],
  ["Kopf","der","Köpfe","Ich habe starke Kopfschmerzen.","head"],
  ["Haar","das","Haare","Sie hat lange braune Haare.","hair"],
  ["Gesicht","das","Gesichter","Er hat ein freundliches Gesicht.","face"],
  ["Auge","das","Augen","Sie hat schöne blaue Augen.","eye"],
  ["Nase","die","Nasen","Meine Nase läuft schon seit Tagen.","nose"],
  ["Mund","der","Münder","Er öffnet den Mund zum Sprechen.","mouth"],
  ["Ohr","das","Ohren","Ich habe Schmerzen im rechten Ohr.","ear"],
  ["Zahn","der","Zähne","Du solltest zweimal täglich Zähne putzen.","tooth"],
  ["Hals","der","Hälse","Ich habe Halsschmerzen seit gestern.","throat / neck"],
  ["Arm","der","Arme","Er hat sich den Arm gebrochen.","arm"],
  ["Hand","die","Hände","Bitte wasch dir die Hände.","hand"],
  ["Finger","der","Finger","Ich habe mir den Finger verletzt.","finger"],
  ["Bein","das","Beine","Nach dem Sport tun mir die Beine weh.","leg"],
  ["Fuß","der","Füße","Ich habe Blasen an den Füßen.","foot"],
  ["Rücken","der","Rücken","Ich habe starke Rückenschmerzen.","back"],
  ["Herz","das","Herzen","Sport ist gut für das Herz.","heart"],
  ["Gesundheit","die","—","Gesundheit ist das Wichtigste im Leben.","health"],
  ["Krankheit","die","Krankheiten","Diese Krankheit ist sehr ansteckend.","illness / disease"],
  ["Schmerz","der","Schmerzen","Ich habe starke Schmerzen im Bauch.","pain"],
  ["Fieber","das","—","Das Kind hat hohes Fieber.","fever"],
  ["Erkältung","die","Erkältungen","Ich habe eine schlimme Erkältung.","cold"],
  ["Medikament","das","Medikamente","Der Arzt verschreibt mir ein Medikament.","medicine"],
  ["Rezept","das","Rezepte","Ich brauche ein Rezept vom Arzt.","prescription / recipe"],
  ["Unterricht","der","—","Der Unterricht beginnt um acht Uhr.","lesson / class"],
  ["Hausaufgabe","die","Hausaufgaben","Ich muss noch meine Hausaufgaben machen.","homework"],
  ["Prüfung","die","Prüfungen","Nächste Woche habe ich eine wichtige Prüfung.","exam"],
  ["Note","die","Noten","Er hat sehr gute Noten in Mathematik.","grade / mark"],
  ["Klasse","die","Klassen","Ich bin in der zehnten Klasse.","class / grade"],
  ["Fach","das","Fächer","Mein Lieblingsfach ist Mathematik.","subject"],
  ["Deutsch","das","—","Ich lerne Deutsch seit zwei Jahren.","German"],
  ["Englisch","das","—","Englisch ist international sehr wichtig.","English"],
  ["Mathematik","die","—","Mathematik ist mein stärkstes Fach.","mathematics"],
  ["Geschichte","die","—","Geschichte war mein Lieblingsfach in der Schule.","history"],
  ["Musik","die","—","Musik macht mein Leben schöner.","music"],
  ["Sport","der","—","Sport ist sehr wichtig für die Gesundheit.","sport"],
  ["Kunst","die","—","Sie studiert Kunst an der Akademie.","art"],
  ["Wort","das","Wörter","Ich lerne jeden Tag fünf neue Wörter.","word"],
  ["Satz","der","Sätze","Bitte schreib einen vollständigen Satz.","sentence"],
  ["Sprache","die","Sprachen","Wie viele Sprachen sprichst du?","language"],
  ["Frage","die","Fragen","Ich habe eine Frage an dich.","question"],
  ["Antwort","die","Antworten","Die Antwort auf diese Frage ist schwierig.","answer"],
  ["Fehler","der","Fehler","Jeder macht mal einen Fehler.","mistake / error"],
  ["Beispiel","das","Beispiele","Kannst du mir ein Beispiel geben?","example"],
  ["Bedeutung","die","Bedeutungen","Was ist die Bedeutung dieses Wortes?","meaning"],
  ["Wörterbuch","das","Wörterbücher","Ich schlage das Wort im Wörterbuch nach.","dictionary"],
  ["Seite","die","Seiten","Bitte öffne das Buch auf Seite zehn.","page / side"],
  ["Text","der","Texte","Lies bitte den Text durch.","text"],
  ["Gedicht","das","Gedichte","Dieses Gedicht ist sehr schön.","poem"],
  ["Besprechung","die","Besprechungen","Morgen haben wir eine wichtige Besprechung.","meeting"],
  ["Vertrag","der","Verträge","Ich habe heute einen Vertrag unterschrieben.","contract"],
  ["Gehalt","das","Gehälter","Mein Gehalt reicht leider nicht aus.","salary"],
  ["Feierabend","der","—","Nach dem Feierabend gehe ich joggen.","end of work / after work"],
  ["Überstunden","die","—","Diese Woche muss ich Überstunden machen.","overtime"],
  ["Termin","der","Termine","Ich habe morgen einen Arzttermin.","appointment"],
  ["Freizeit","die","—","In meiner Freizeit lese ich gerne.","free time / leisure"],
  ["Hobby","das","Hobbys","Mein Hobby ist Fotografieren.","hobby"],
  ["Fußball","der","—","Fußball ist in Deutschland sehr beliebt.","football / soccer"],
  ["Tennis","das","—","Ich spiele einmal pro Woche Tennis.","tennis"],
  ["Schwimmen","das","—","Schwimmen ist sehr gut für den Rücken.","swimming"],
  ["Laufen","das","—","Jeden Morgen gehe ich laufen.","running"],
  ["Wandern","das","—","Im Urlaub gehen wir viel wandern.","hiking"],
  ["Kochen","das","—","Kochen ist mein liebstes Hobby.","cooking"],
  ["Lesen","das","—","Lesen entspannt mich sehr.","reading"],
  ["Reisen","das","—","Reisen erweitert den Horizont.","travelling"],
  ["Tanzen","das","—","Sie tanzt sehr elegant.","dancing"],
  ["Singen","das","—","Er singt in einem Chor.","singing"],
  ["Film","der","Filme","Dieser Film hat mir sehr gut gefallen.","film / movie"],
  ["Konzert","das","Konzerte","Wir gehen morgen zu einem Konzert.","concert"],
  ["Ausstellung","die","Ausstellungen","Im Museum gibt es eine neue Ausstellung.","exhibition"],
  ["Spiel","das","Spiele","Das Spiel gestern war sehr spannend.","game / match"],
  ["Geburtstag","der","Geburtstage","Herzlichen Glückwunsch zum Geburtstag!","birthday"],
  ["Fest","das","Feste","Das Stadtfest findet im Juli statt.","festival / celebration"],
  ["Party","die","Partys","Wir feiern am Samstag eine Party.","party"],
  ["Geschenk","das","Geschenke","Ich habe ihr ein schönes Geschenk gekauft.","gift / present"],
  ["Karte","die","Karten","Schick mir bitte eine Postkarte.","card / ticket / map"],
  ["Foto","das","Fotos","Ich mache viele Fotos im Urlaub.","photo"],
  ["lernen","","—","Ich lerne jeden Tag ein bisschen Deutsch.","to learn"],
  ["sprechen","","—","Er spricht sehr gut Englisch.","to speak"],
  ["trinken","","—","Was möchtest du trinken?","to drink"],
  ["wohnen","","—","Ich wohne seit zehn Jahren in Tokio.","to live"],
  ["arbeiten","","—","Sie arbeitet in einer japanischen Firma.","to work"],
  ["studieren","","—","Er studiert Medizin an der Uni.","to study"],
  ["schreiben","","—","Ich schreibe eine E-Mail an meinen Chef.","to write"],
  ["hören","","—","Ich höre Musik beim Lernen.","to listen"],
  ["sehen","","—","Wir sehen abends fern.","to see"],
  ["kaufen","","—","Ich kaufe ein Geschenk für meine Mutter.","to buy"],
  ["verkaufen","","—","Er verkauft sein altes Auto.","to sell"],
  ["kommen","","—","Wann kommst du?","to come"],
  ["gehen","","—","Ich gehe jetzt zum Supermarkt.","to go"],
  ["fahren","","—","Wir fahren morgen nach München.","to drive / travel"],
  ["fliegen","","—","Ich fliege nächsten Monat nach Berlin.","to fly"],
  ["ankommen","","—","Der Zug kommt um drei Uhr an.","to arrive"],
  ["abfahren","","—","Der Bus fährt um acht Uhr ab.","to depart"],
  ["haben","","—","Ich habe heute sehr viel zu tun.","to have"],
  ["sein","","—","Er ist sehr freundlich.","to be"],
  ["werden","","—","Es wird morgen kalt.","to become"],
  ["wollen","","—","Ich will mehr Deutsch lernen.","to want"],
  ["können","","—","Kannst du mir bitte helfen?","can / to be able to"],
  ["müssen","","—","Ich muss jetzt zur Arbeit gehen.","must / to have to"],
  ["dürfen","","—","Hier darf man nicht rauchen.","may / to be allowed to"],
  ["sollen","","—","Du sollst mehr Wasser trinken.","should / to be supposed to"],
  ["mögen","","—","Ich mag deutsche Musik sehr.","to like"],
  ["möchten","","—","Ich möchte bitte ein Glas Wasser.","would like"],
  ["brauchen","","—","Ich brauche mehr Zeit zum Lernen.","to need"],
  ["helfen","","—","Kannst du mir helfen, bitte?","to help"],
  ["suchen","","—","Ich suche eine Wohnung in der Nähe.","to search / look for"],
  ["finden","","—","Ich kann meinen Schlüssel nicht finden.","to find"],
  ["öffnen","","—","Kannst du das Fenster öffnen?","to open"],
  ["schließen","","—","Bitte schließe die Tür.","to close"],
  ["geben","","—","Ich gebe dir meine Nummer.","to give"],
  ["nehmen","","—","Nimmst du den Bus oder die U-Bahn?","to take"],
  ["machen","","—","Was machst du am Wochenende?","to do / make"],
  ["schlafen","","—","Ich schlafe acht Stunden pro Nacht.","to sleep"],
  ["aufstehen","","—","Ich stehe um sieben Uhr auf.","to get up"],
  ["warten","","—","Ich warte vor dem Kino auf dich.","to wait"],
  ["denken","","—","Ich denke, Deutsch ist sehr nützlich.","to think"],
  ["glauben","","—","Ich glaube, morgen regnet es.","to believe"],
  ["verstehen","","—","Ich verstehe das leider nicht.","to understand"],
  ["antworten","","—","Bitte antworte auf meine E-Mail.","to answer"],
  ["fragen","","—","Darf ich dich etwas fragen?","to ask"],
  ["backen","","—","Meine Oma backt jeden Sonntag Kuchen.","to bake"],
  ["bezahlen","","—","Ich bezahle mit Kreditkarte.","to pay"],
  ["besuchen","","—","Wir besuchen nächste Woche meine Eltern.","to visit"],
  ["treffen","","—","Ich treffe mich heute mit einem Freund.","to meet"],
  ["einladen","","—","Ich lade dich zum Abendessen ein.","to invite"],
  ["anrufen","","—","Ich rufe dich heute Abend an.","to call"],
  ["aufräumen","","—","Ich muss noch mein Zimmer aufräumen.","to tidy up"],
  ["putzen","","—","Ich putze am Samstag die Wohnung.","to clean"],
  ["waschen","","—","Ich wasche heute meine Wäsche.","to wash"],
  ["bügeln","","—","Ich bügle meine Hemden selbst.","to iron"],
  ["spielen","","—","Die Kinder spielen draußen.","to play"],
  ["fotografieren","","—","Ich fotografiere gerne auf Reisen.","to photograph"],
  ["beginnen","","—","Die Schule beginnt um acht Uhr.","to begin"],
  ["enden","","—","Der Film endet um Mitternacht.","to end"],
  ["kennen","","—","Ich kenne ihn schon seit Jahren.","to know (a person)"],
  ["wissen","","—","Ich weiß nicht, wo er wohnt.","to know (a fact)"],
  ["vergessen","","—","Ich habe leider seinen Namen vergessen.","to forget"],
  ["erinnern","","—","Erinnerst du dich noch an ihn?","to remember"],
  ["empfehlen","","—","Kannst du mir ein gutes Restaurant empfehlen?","to recommend"],
  ["erklären","","—","Kannst du mir das bitte erklären?","to explain"],
  ["zeigen","","—","Zeig mir bitte den Weg zum Bahnhof.","to show"],
  ["bringen","","—","Kannst du mir bitte das Salz bringen?","to bring"],
  ["schicken","","—","Ich schicke dir morgen das Paket.","to send"],
  ["bekommen","","—","Ich habe heute einen Brief bekommen.","to receive / get"],
  ["verlieren","","—","Ich habe meine Schlüssel verloren.","to lose"],
  ["gewinnen","","—","Wir haben das Spiel gewonnen.","to win"],
  ["fallen","","—","Sei vorsichtig, du könntest fallen.","to fall"],
  ["steigen","","—","Die Preise steigen immer weiter.","to rise / climb"],
  ["gut","","—","Das Essen hier schmeckt sehr gut.","good"],
  ["schlecht","","—","Das Wetter ist heute leider schlecht.","bad"],
  ["groß","","—","Er wohnt in einer sehr großen Stadt.","big / tall"],
  ["klein","","—","Meine Wohnung ist leider sehr klein.","small"],
  ["neu","","—","Ich habe gestern ein neues Auto gekauft.","new"],
  ["alt","","—","Dieses Gebäude ist sehr alt.","old"],
  ["jung","","—","Sie ist noch sehr jung.","young"],
  ["schön","","—","Was für eine schöne Aussicht!","beautiful"],
  ["hässlich","","—","Das Gebäude sieht sehr hässlich aus.","ugly"],
  ["einfach","","—","Diese Aufgabe ist wirklich einfach.","easy / simple"],
  ["schwer","","—","Deutsch ist nicht so schwer.","difficult / heavy"],
  ["leicht","","—","Diese Aufgabe ist sehr leicht.","easy / light"],
  ["billig","","—","Dieses Hemd ist sehr billig.","cheap"],
  ["teuer","","—","Das Restaurant ist mir zu teuer.","expensive"],
  ["nah","","—","Die U-Bahn-Station ist nah.","near"],
  ["weit","","—","Mein Büro ist weit von zu Hause.","far"],
  ["viel","","—","Ich habe diese Woche viel Arbeit.","much / many"],
  ["wenig","","—","Ich spreche ein bisschen Deutsch.","little / few"],
  ["schnell","","—","Der Zug fährt sehr schnell.","fast"],
  ["langsam","","—","Bitte sprich etwas langsamer.","slow"],
  ["warm","","—","Im Sommer ist es hier sehr warm.","warm"],
  ["kalt","","—","Im Winter wird es hier sehr kalt.","cold"],
  ["heiß","","—","Der Tee ist noch sehr heiß.","hot"],
  ["kühl","","—","Im Herbst wird es kühler.","cool"],
  ["laut","","—","Die Musik ist viel zu laut.","loud"],
  ["leise","","—","Bitte sprich etwas leiser.","quiet"],
  ["hell","","—","Das Zimmer ist sehr hell.","bright"],
  ["dunkel","","—","Im Winter ist es früh dunkel.","dark"],
  ["sauber","","—","Das Hotel ist sehr sauber.","clean"],
  ["schmutzig","","—","Meine Hände sind ganz schmutzig.","dirty"],
  ["gesund","","—","Obst und Gemüse sind sehr gesund.","healthy"],
  ["krank","","—","Ich bin heute leider krank.","ill / sick"],
  ["müde","","—","Ich bin heute sehr müde.","tired"],
  ["fit","","—","Sie sieht sehr fit und gesund aus.","fit"],
  ["glücklich","","—","Er sieht heute sehr glücklich aus.","happy"],
  ["traurig","","—","Sie wirkt heute sehr traurig.","sad"],
  ["zufrieden","","—","Ich bin mit meiner Arbeit sehr zufrieden.","satisfied / content"],
  ["wütend","","—","Er war sehr wütend über die Nachricht.","angry"],
  ["nervös","","—","Vor der Prüfung bin ich immer nervös.","nervous"],
  ["ruhig","","—","Das Dorf ist sehr ruhig und friedlich.","calm / quiet"],
  ["freundlich","","—","Die Leute hier sind sehr freundlich.","friendly"],
  ["höflich","","—","Er ist immer sehr höflich.","polite"],
  ["lustig","","—","Er ist immer sehr lustig.","funny"],
  ["langweilig","","—","Der Vortrag war wirklich langweilig.","boring"],
  ["interessant","","—","Der Film war wirklich interessant.","interesting"],
  ["wichtig","","—","Deutsch ist für meinen Beruf wichtig.","important"],
  ["richtig","","—","Das ist die richtige Antwort.","correct / right"],
  ["falsch","","—","Diese Aussage ist leider falsch.","wrong / false"],
  ["möglich","","—","Ist das wirklich möglich?","possible"],
  ["unmöglich","","—","Das ist doch unmöglich!","impossible"],
  ["nötig","","—","Ist das wirklich nötig?","necessary"],
  ["fertig","","—","Bist du schon fertig?","ready / finished"],
  ["offen","","—","Die Tür ist noch offen.","open"],
  ["geschlossen","","—","Das Geschäft ist jetzt geschlossen.","closed"],
  ["frei","","—","Ist dieser Platz noch frei?","free"],
  ["besetzt","","—","Der Platz ist leider besetzt.","occupied"],
  ["heute","","—","Heute ist das Wetter sehr schön.","today"],
  ["gestern","","—","Gestern bin ich ins Kino gegangen.","yesterday"],
  ["jetzt","","—","Ich bin jetzt sehr beschäftigt.","now"],
  ["dann","","—","Erst lerne ich, dann gehe ich aus.","then"],
  ["immer","","—","Ich frühstücke immer vor der Arbeit.","always"],
  ["nie","","—","Ich esse nie Schweinefleisch.","never"],
  ["oft","","—","Wir gehen oft zusammen essen.","often"],
  ["manchmal","","—","Manchmal gehe ich nach der Arbeit joggen.","sometimes"],
  ["selten","","—","Er kommt nur selten zu Besuch.","rarely"],
  ["auch","","—","Ich möchte auch nach Deutschland fahren.","also / too"],
  ["sehr","","—","Diese Suppe schmeckt sehr gut.","very"],
  ["hier","","—","Bitte komm her.","here"],
  ["dort","","—","Die Bank ist dort, rechts.","there"],
  ["schon","","—","Ich habe meine Hausaufgaben schon gemacht.","already"],
  ["noch","","—","Ich habe noch nicht gegessen.","still / yet"],
  ["leider","","—","Leider kann ich heute nicht kommen.","unfortunately"],
  ["vielleicht","","—","Vielleicht komme ich morgen.","maybe / perhaps"],
  ["zusammen","","—","Wir essen immer zusammen.","together"],
  ["allein","","—","Ich wohne allein in einer kleinen Wohnung.","alone"],
  ["natürlich","","—","Natürlich helfe ich dir!","of course / naturally"],
  ["wirklich","","—","Das ist wirklich interessant.","really / truly"],
  ["eigentlich","","—","Eigentlich wollte ich früher kommen.","actually"],
  ["ungefähr","","—","Es dauert ungefähr eine Stunde.","approximately"],
  ["sofort","","—","Ich komme sofort!","immediately"],
  ["bald","","—","Bis bald!","soon"],
  ["endlich","","—","Endlich ist der Sommer da!","finally"],
  ["trotzdem","","—","Es regnet, aber ich gehe trotzdem spazieren.","nevertheless"],
  ["deshalb","","—","Ich bin krank, deshalb bleibe ich zu Hause.","therefore"],
  ["außerdem","","—","Er ist klug und außerdem sehr fleißig.","in addition / besides"],
  ["zuerst","","—","Zuerst frühstücke ich, dann gehe ich zur Arbeit.","first / at first"],
  ["danach","","—","Wir essen zu Mittag und danach machen wir einen Spaziergang.","afterwards"],
  ["links","","—","Die Bäckerei ist links.","left"],
  ["rechts","","—","Die Bank ist rechts um die Ecke.","right"],
  ["geradeaus","","—","Gehen Sie geradeaus und dann links.","straight ahead"],
  ["oben","","—","Meine Wohnung ist oben im dritten Stock.","above / upstairs"],
  ["unten","","—","Der Keller ist unten.","below / downstairs"],
  ["vorne","","—","Bitte setz dich nach vorne.","in front"],
  ["hinten","","—","Die Toilette ist hinten rechts.","behind / at the back"],
  ["drinnen","","—","Bei dem Regen bleiben wir lieber drinnen.","inside"],
  ["draußen","","—","Die Kinder spielen draußen.","outside"],
  ["Nummer","die","Nummern","Wie ist deine Telefonnummer?","number"],
  ["Adresse","die","Adressen","Gib mir bitte deine Adresse.","address"],
  ["Name","der","Namen","Wie ist dein Name?","name"],
  ["Vorname","der","Vornamen","Mein Vorname ist Thomas.","first name"],
  ["Nachname","der","Nachnamen","Mein Nachname ist Müller.","last name / surname"],
  ["Alter","das","—","Was ist dein Alter?","age"],
  ["Nationalität","die","Nationalitäten","Was ist deine Nationalität?","nationality"],
  ["Pass","der","Pässe","Ich brauche meinen Pass für die Reise.","passport"],
  ["Formular","das","Formulare","Bitte füllen Sie dieses Formular aus.","form"],
  ["Unterschrift","die","Unterschriften","Ich brauche Ihre Unterschrift hier.","signature"],
  ["Problem","das","Probleme","Wir haben ein kleines Problem.","problem"],
  ["Lösung","die","Lösungen","Für jedes Problem gibt es eine Lösung.","solution"],
  ["Idee","die","Ideen","Das ist eine wirklich gute Idee.","idea"],
  ["Plan","der","Pläne","Was ist dein Plan für das Wochenende?","plan"],
  ["Möglichkeit","die","Möglichkeiten","Es gibt viele Möglichkeiten.","possibility / option"],
  ["Entscheidung","die","Entscheidungen","Das ist eine sehr schwierige Entscheidung.","decision"],
  ["Meinung","die","Meinungen","Was ist deine Meinung dazu?","opinion"],
  ["Grund","der","Gründe","Was ist der Grund dafür?","reason"],
  ["Ergebnis","das","Ergebnisse","Das Ergebnis war sehr überraschend.","result"],
  ["Unterschied","der","Unterschiede","Was ist der Unterschied zwischen den beiden?","difference"],
  ["Anfang","der","Anfänge","Am Anfang war alles sehr schwierig.","beginning"],
  ["Ende","das","Enden","Das Ende des Films war sehr traurig.","end"],
  ["Mitte","die","—","Er steht in der Mitte des Raumes.","middle"],
  ["Teil","der","Teile","Dieser Teil des Buches ist sehr interessant.","part"],
  ["Art","die","Arten","Es gibt viele Arten von Musik.","kind / type / way"],
  ["Weise","die","Weisen","Auf diese Weise geht es besser.","way / manner"],
  ["Richtung","die","Richtungen","In welche Richtung gehen wir?","direction"],
  ["Inhalt","der","Inhalte","Der Inhalt des Buches ist sehr spannend.","content"],
  ["Nachricht","die","Nachrichten","Ich habe eine Nachricht von ihr bekommen.","message / news"],
  ["Information","die","Informationen","Wo kann ich mehr Informationen bekommen?","information"],
  ["Gespräch","das","Gespräche","Das Gespräch war sehr interessant.","conversation"],
  ["Witz","der","Witze","Er erzählt immer gute Witze.","joke"],
  ["Wand","die","Wände","An der Wand hängt ein schönes Bild.","wall"],
  ["Boden","der","Böden","Der Boden ist frisch geputzt.","floor / ground"],
  ["Decke","die","Decken","Die Decke im Wohnzimmer ist sehr hoch.","ceiling / blanket"],
  ["Heizung","die","Heizungen","Die Heizung ist im Winter sehr wichtig.","heating"],
  ["Strom","der","—","Ohne Strom geht heute gar nichts.","electricity"],
  ["Gas","das","—","Das Haus wird mit Gas beheizt.","gas"],
  ["Müll","der","—","Bitte trenn den Müll sorgfältig.","trash / garbage"],
  ["Schlüssel","der","Schlüssel","Ich habe meinen Schlüssel verloren.","key"],
  ["Klingel","die","Klingeln","Drück bitte auf die Klingel.","doorbell"],
  ["Briefkasten","der","Briefkästen","Der Brief liegt im Briefkasten.","mailbox"],
  ["Aufzug","der","Aufzüge","Der Aufzug ist leider kaputt.","elevator / lift"],
  ["Miete","die","Mieten","Die Miete in München ist sehr hoch.","rent"],
  ["Vermieter","der","Vermieter","Mein Vermieter ist sehr nett.","landlord"],
  ["Zeichen","das","Zeichen","Was bedeutet dieses Zeichen?","sign / symbol"],
  ["Farbe","die","Farben","Was ist deine Lieblingsfarbe?","color"],
  ["rot","","—","Sie trägt ein rotes Kleid.","red"],
  ["blau","","—","Der Himmel ist strahlend blau.","blue"],
  ["grün","","—","Die Wiesen sind im Frühling grün.","green"],
  ["gelb","","—","Die Sonnenblumen sind leuchtend gelb.","yellow"],
  ["schwarz","","—","Er trägt immer schwarze Kleidung.","black"],
  ["weiß","","—","Der Schnee ist weiß und sauber.","white"],
  ["grau","","—","Der Himmel ist heute grau.","gray"],
  ["braun","","—","Der Hund hat braunes Fell.","brown"],
  ["orange","","—","Sie trägt eine orange Jacke.","orange"],
  ["rosa","","—","Das Baby trägt ein rosa Kleidchen.","pink"],
  ["lila","","—","Sie mag lila Blumen.","purple"],
  ["Form","die","Formen","Was für eine Form hat das Objekt?","shape / form"],
  ["Kreis","der","Kreise","Zeichne bitte einen Kreis.","circle"],
  ["Quadrat","das","Quadrate","Das ist ein perfektes Quadrat.","square"],
  ["Dreieck","das","Dreiecke","Das Dach hat die Form eines Dreiecks.","triangle"],
  ["Zahl","die","Zahlen","Welche Zahl denkst du gerade?","number"],
  ["Menge","die","Mengen","Ich brauche eine große Menge Mehl.","quantity / amount"],
  ["Gewicht","das","Gewichte","Was ist das Gewicht des Pakets?","weight"],
  ["Größe","die","Größen","Welche Größe haben Sie?","size"],
  ["Länge","die","Längen","Die Länge des Tisches beträgt 1,5 Meter.","length"],
  ["Breite","die","Breiten","Die Breite des Fensters ist 80 cm.","width"],
  ["Höhe","die","Höhen","Die Höhe des Gebäudes beeindruckt mich.","height"],
  ["Entfernung","die","Entfernungen","Die Entfernung beträgt etwa 10 km.","distance"],
  ["Material","das","Materialien","Aus welchem Material ist das gemacht?","material"],
  ["Holz","das","Hölzer","Der Tisch ist aus Holz.","wood"],
  ["Metall","das","Metalle","Die Tür ist aus Metall.","metal"],
  ["Glas","das","Gläser","Das Fenster ist aus Glas.","glass"],
  ["Plastik","das","—","Diese Flasche ist aus Plastik.","plastic"],
  ["Papier","das","Papiere","Ich brauche ein Blatt Papier.","paper"],
  ["Stoff","der","Stoffe","Dieser Stoff ist sehr weich.","fabric / material"],
  ["Leder","das","—","Die Tasche ist aus echtem Leder.","leather"],
  ["Wolle","die","—","Der Pullover ist aus reiner Wolle.","wool"],
  ["Baumwolle","die","—","Das T-Shirt ist aus Baumwolle.","cotton"],
  ["Stein","der","Steine","Das Haus ist aus Stein gebaut.","stone"],
  ["Gebäude","das","Gebäude","Das Gebäude ist sehr modern.","building"],
  ["Kirche","die","Kirchen","Die Kirche ist sehr alt und schön.","church"],
  ["Rathaus","das","Rathäuser","Das Rathaus steht am Marktplatz.","town hall"],
  ["Schloss","das","Schlösser","Das Schloss Neuschwanstein ist weltberühmt.","castle"],
  ["Denkmal","das","Denkmäler","Das Brandenburger Tor ist ein berühmtes Denkmal.","monument"],
  ["Grenze","die","Grenzen","Die Grenze zwischen Deutschland und Frankreich.","border"],
  ["Hauptstadt","die","Hauptstädte","Berlin ist die Hauptstadt von Deutschland.","capital city"],
  ["Europa","das","—","Deutschland liegt in Europa.","Europe"],
  ["Welt","die","—","Die Welt ist sehr groß und vielfältig.","world"],
  ["Kontinent","der","Kontinente","Es gibt sieben Kontinente auf der Erde.","continent"],
  ["Norden","der","—","Hamburg liegt im Norden von Deutschland.","north"],
  ["Süden","der","—","München liegt im Süden von Deutschland.","south"],
  ["Osten","der","—","Berlin liegt eher im Osten.","east"],
  ["Westen","der","—","Köln liegt im Westen von Deutschland.","west"],
  ["Bevölkerung","die","Bevölkerungen","Die Bevölkerung Deutschlands wächst.","population"],
  ["Gesellschaft","die","Gesellschaften","Wir leben in einer offenen Gesellschaft.","society"],
  ["Politik","die","—","Er interessiert sich sehr für Politik.","politics"],
  ["Wirtschaft","die","—","Die deutsche Wirtschaft ist sehr stark.","economy"],
  ["Kultur","die","Kulturen","Deutschland hat eine reiche Kultur.","culture"],
  ["Tradition","die","Traditionen","Das Oktoberfest ist eine bayerische Tradition.","tradition"],
  ["Religion","die","Religionen","In Deutschland gibt es viele Religionen.","religion"],
  ["Krieg","der","Kriege","Der Zweite Weltkrieg war sehr grausam.","war"],
  ["Frieden","der","—","Wir wünschen uns allen Frieden.","peace"],
  ["Freiheit","die","—","Freiheit ist ein hohes Gut.","freedom"],
  ["Recht","das","Rechte","Jeder Mensch hat das Recht auf Bildung.","right / law"],
  ["Pflicht","die","Pflichten","Es ist unsere Pflicht, zu helfen.","duty / obligation"],
  ["Gesetz","das","Gesetze","Wir müssen uns alle ans Gesetz halten.","law"],
  ["Umwelt","die","—","Wir müssen die Umwelt schützen.","environment"],
  ["Natur","die","—","Die Natur in Bayern ist wunderschön.","nature"],
  ["Energie","die","—","Wir brauchen mehr erneuerbare Energie.","energy"],
  ["Klimawandel","der","—","Der Klimawandel ist eine große Herausforderung.","climate change"],
  ["Luft","die","—","Die Luft hier ist sehr frisch und sauber.","air"],
  ["Erde","die","—","Die Erde ist unser Planet.","earth"],
  ["Wissenschaft","die","Wissenschaften","Die Wissenschaft macht große Fortschritte.","science"],
  ["Technik","die","Techniken","Die moderne Technik verändert unser Leben.","technology / engineering"],
  ["Maschine","die","Maschinen","Die Maschine läuft seit Stunden.","machine"],
  ["Apparat","der","Apparate","Der Apparat ist leider kaputt.","apparatus / device"],
  ["Gerät","das","Geräte","Dieses Gerät ist sehr praktisch.","device / appliance"],
  ["Bildschirm","der","Bildschirme","Der Bildschirm meines Laptops ist kaputt.","screen"],
  ["Tastatur","die","Tastaturen","Ich schreibe lieber auf einer richtigen Tastatur.","keyboard"],
  ["Drucker","der","Drucker","Der Drucker hat kein Papier mehr.","printer"],
  ["Kamera","die","Kameras","Ich habe mir eine neue Kamera gekauft.","camera"],
  ["Radio","das","Radios","Morgens höre ich gerne Radio.","radio"],
  ["Fernseher","der","Fernseher","Der Fernseher im Hotelzimmer ist sehr groß.","television"],
  ["Kühlschrank","der","Kühlschränke","Der Kühlschrank ist leer, ich muss einkaufen.","refrigerator"],
  ["Herd","der","Herde","Der Herd im neuen Apartment ist sehr modern.","stove / cooker"],
  ["Mikrowelle","die","Mikrowellen","Ich wärme das Essen in der Mikrowelle auf.","microwave"],
  ["Waschmaschine","die","Waschmaschinen","Meine Waschmaschine ist kaputt.","washing machine"],
  ["Staubsauger","der","Staubsauger","Ich sauge einmal pro Woche Staub.","vacuum cleaner"],
  ["Netz","das","Netze","Das WLAN-Netz ist hier sehr gut.","network / net"],
  ["Passwort","das","Passwörter","Ich habe mein Passwort vergessen.","password"],
  ["App","die","Apps","Diese App ist sehr praktisch.","app"],
  ["Bericht","der","Berichte","Der Bericht in der Zeitung war sehr interessant.","report"],
  ["Artikel","der","Artikel","Ich habe einen interessanten Artikel gelesen.","article"],
  ["Interview","das","Interviews","Das Interview mit dem Politiker war sehr gut.","interview"],
  ["Werbung","die","Werbungen","Es gibt zu viel Werbung im Fernsehen.","advertisement / advertising"],
  ["Programm","das","Programme","Was läuft heute im Programm?","program"],
  ["Kanal","der","Kanäle","Auf welchem Kanal läuft der Film?","channel"],
  ["Sender","der","Sender","Dieser Sender zeigt viele gute Dokumentationen.","broadcaster / transmitter"],
  ["Veranstaltung","die","Veranstaltungen","Es gibt viele Veranstaltungen in der Stadt.","event"],
  ["Eintrittskarte","die","Eintrittskarten","Die Eintrittskarten sind leider ausverkauft.","entrance ticket"],
  ["Reservierung","die","Reservierungen","Ich habe eine Reservierung für zwei Personen.","reservation"],
  ["Rabatt","der","Rabatte","Gibt es hier einen Studentenrabatt?","discount"],
  ["Angebot","das","Angebote","Das Angebot ist sehr günstig.","offer / special deal"],
  ["Qualität","die","Qualitäten","Die Qualität dieses Produkts ist sehr gut.","quality"],
  ["Marke","die","Marken","Was ist deine Lieblingsmarke?","brand"],
  ["Produkt","das","Produkte","Dieses Produkt ist sehr beliebt.","product"],
  ["Einkauf","der","Einkäufe","Der wöchentliche Einkauf macht Spaß.","purchase / shopping"],
  ["Einkaufswagen","der","Einkaufswagen","Nimmst du bitte den Einkaufswagen?","shopping cart"],
  ["Kasse","die","Kassen","Bitte zahlen Sie an der Kasse.","cash register / checkout"],
  ["Quittung","die","Quittungen","Brauchen Sie eine Quittung?","receipt"],
  ["Kredit","der","Kredite","Ich bezahle mit Kreditkarte.","credit"],
  ["Konto","das","Konten","Ich überweise das Geld auf dein Konto.","account"],
  ["Überweisung","die","Überweisungen","Ich mache eine Überweisung.","bank transfer"],
  ["Schulden","die","—","Er hat viele Schulden.","debts"],
  ["Sparen","das","—","Sparen ist sehr wichtig für die Zukunft.","saving"],
  ["Versicherung","die","Versicherungen","Ich brauche eine Krankenversicherung.","insurance"],
  ["Steuer","die","Steuern","Die Steuern in Deutschland sind hoch.","tax"],
  ["Rente","die","—","Mein Vater ist jetzt in Rente.","pension / retirement"],
  ["Bewerbung","die","Bewerbungen","Ich schreibe gerade eine Bewerbung.","application (job)"],
  ["Lebenslauf","der","Lebensläufe","Schick mir bitte deinen Lebenslauf.","CV / résumé"],
  ["Vorstellungsgespräch","das","Vorstellungsgespräche","Morgen habe ich ein Vorstellungsgespräch.","job interview"],
  ["Ausbildung","die","Ausbildungen","Er macht gerade eine Ausbildung zum Koch.","training / apprenticeship"],
  ["Praktikum","das","Praktika","Ich mache gerade ein Praktikum bei einer Firma.","internship"],
  ["Erfahrung","die","Erfahrungen","Er hat viel Erfahrung in diesem Bereich.","experience"],
  ["Fähigkeit","die","Fähigkeiten","Welche Fähigkeiten bringst du mit?","skill / ability"],
  ["Kenntnisse","die","—","Ich habe gute Kenntnisse in Englisch.","knowledge / skills"],
  ["Ziel","das","Ziele","Mein Ziel ist es, Deutsch fließend zu sprechen.","goal / aim"],
  ["Traum","der","Träume","Es ist mein Traum, nach Deutschland zu reisen.","dream"],
  ["Zukunft","die","—","Die Zukunft ist offen und spannend.","future"],
  ["Vergangenheit","die","—","Wir können von der Vergangenheit lernen.","past"],
  ["Gegenwart","die","—","Lebe im Moment, in der Gegenwart.","present"],
  ["Erinnerung","die","Erinnerungen","Diese Erinnerungen sind sehr wertvoll.","memory / recollection"],
  ["Abenteuer","das","Abenteuer","Das Leben ist ein großes Abenteuer.","adventure"],
  ["Gefühl","das","Gefühle","Ich habe ein gutes Gefühl dabei.","feeling / emotion"],
  ["Liebe","die","—","Liebe ist das Wichtigste im Leben.","love"],
  ["Freude","die","—","Es ist eine Freude, dich zu sehen!","joy"],
  ["Hoffnung","die","Hoffnungen","Ich habe Hoffnung, dass alles gut wird.","hope"],
  ["Angst","die","Ängste","Ich habe Angst vor der Prüfung.","fear / anxiety"],
  ["Sorge","die","Sorgen","Mach dir keine Sorgen!","worry / concern"],
  ["Stress","der","—","Ich habe gerade sehr viel Stress.","stress"],
  ["Entspannung","die","—","Nach der Arbeit brauche ich Entspannung.","relaxation"],
  ["Spaß","der","—","Es macht mir viel Spaß, Deutsch zu lernen.","fun"],
  ["Humor","der","—","Er hat einen tollen Sinn für Humor.","humor"],
  ["Vertrauen","das","—","Vertrauen ist die Basis jeder Beziehung.","trust"],
  ["Respekt","der","—","Gegenseitiger Respekt ist sehr wichtig.","respect"],
  ["Verantwortung","die","Verantwortungen","Wir tragen alle Verantwortung.","responsibility"],
  ["Gewohnheit","die","Gewohnheiten","Das ist eine schlechte Gewohnheit.","habit"],
  ["Brauch","der","Bräuche","Das ist ein alter deutscher Brauch.","custom / tradition"],
  ["Akzent","der","Akzente","Er spricht mit einem starken Akzent.","accent"],
  ["Aussprache","die","—","Deine Aussprache ist schon sehr gut.","pronunciation"],
  ["Grammatik","die","—","Grammatik ist nicht so schwer.","grammar"],
  ["Vokabular","das","—","Ich muss mein Vokabular erweitern.","vocabulary"],
  ["Übung","die","Übungen","Übung macht den Meister.","exercise / practice"],
  ["Aufgabe","die","Aufgaben","Bitte löse die folgende Aufgabe.","task / exercise"],
  ["Test","der","Tests","Morgen schreiben wir einen Test.","test"],
  ["Leistung","die","Leistungen","Seine Leistungen in der Schule sind sehr gut.","performance / achievement"],
  ["Erfolg","der","Erfolge","Ich wünsche dir viel Erfolg!","success"],
  ["Misserfolg","der","Misserfolge","Aus Misserfolgen kann man viel lernen.","failure"],
  ["Fortschritt","der","Fortschritte","Ich mache gute Fortschritte beim Deutschlernen.","progress"],
  ["Anfänger","der","Anfänger","Ich bin noch ein Anfänger im Deutschen.","beginner"],
  ["Fortgeschrittene","der","Fortgeschrittenen","Er ist schon weit Fortgeschrittener.","advanced learner"],
  ["Niveau","das","Niveaus","Mein Deutschniveau ist B1.","level"],
  ["Kurs","der","Kurse","Ich belege einen Deutschkurs.","course"],
  ["Pause","die","Pausen","In der Pause gehe ich einen Kaffee trinken.","break"],
  ["Zeugnis","das","Zeugnisse","Mein Zeugnis war dieses Mal sehr gut.","school report / certificate"],
  ["Diplom","das","Diplome","Er hat sein Diplom schon in der Tasche.","diploma"],
  ["Abschluss","der","Abschlüsse","Sie hat ihren Abschluss an der TU gemacht.","degree / graduation"],
  ["Stipendium","das","Stipendien","Er hat ein Stipendium für die Uni bekommen.","scholarship"],
  ["Bibliothek","die","Bibliotheken","Ich gehe in die Bibliothek zum Lernen.","library"],
  ["Mensa","die","Mensen","In der Mensa gibt es günstiges Essen.","university cafeteria"],
  ["Vorlesung","die","Vorlesungen","Die Vorlesung dauert 90 Minuten.","lecture"],
  ["Seminar","das","Seminare","Im Seminar diskutieren wir aktuelle Themen.","seminar"],
  ["Referat","das","Referate","Ich halte nächste Woche ein Referat.","presentation / report"],
  ["Thema","das","Themen","Was ist das Thema der nächsten Stunde?","topic / theme"],
  ["Begriff","der","Begriffe","Ich verstehe diesen Begriff nicht.","concept / term"],
  ["Definition","die","Definitionen","Kannst du mir die Definition erklären?","definition"],
  ["Regel","die","Regeln","Es gibt viele Regeln in der deutschen Grammatik.","rule"],
  ["Ausnahme","die","Ausnahmen","Jede Regel hat ihre Ausnahmen.","exception"],
  ["Vergleich","der","Vergleiche","Im Vergleich zu früher geht es mir besser.","comparison"],
  ["Zusammenfassung","die","Zusammenfassungen","Schreib bitte eine kurze Zusammenfassung.","summary"],
  ["Übersetzung","die","Übersetzungen","Die Übersetzung ist sehr gut gelungen.","translation"],
  ["Grammatikbuch","das","Grammatikbücher","Das Grammatikbuch ist sehr hilfreich.","grammar book"],
  ["Lerntipp","der","Lerntipps","Hast du einen guten Lerntipp für mich?","learning tip"],
  ["Karteikarte","die","Karteikarten","Ich schreibe Vokabeln auf Karteikarten.","flashcard"],
  ["Notizbuch","das","Notizbücher","Ich schreibe alles in mein Notizbuch.","notebook"],
  ["Bleistift","der","Bleistifte","Hast du einen Bleistift für mich?","pencil"],
  ["Stift","der","Stifte","Leihst du mir kurz deinen Stift?","pen"],
  ["Radiergummi","der","Radiergummis","Ich brauche einen Radiergummi.","eraser"],
  ["Lineal","das","Lineale","Kannst du mir das Lineal leihen?","ruler"],
  ["Schere","die","Scheren","Ich brauche eine Schere zum Basteln.","scissors"],
  ["Kleber","der","—","Kleber für das Bastelprojekt brauche ich noch.","glue"],
  ["Heft","das","Hefte","Ich schreibe alles in mein Heft.","exercise book"],
  ["Block","der","Blöcke","Ich habe einen neuen Block gekauft.","notepad"],
  ["Mappe","die","Mappen","Ich habe alle Unterlagen in der Mappe.","folder / portfolio"],
  ["Ordner","der","Ordner","Alle Dokumente sind im Ordner sortiert.","binder / folder"],
  ["Zettel","der","Zettel","Ich habe eine Notiz auf dem Zettel gemacht.","piece of paper / note"],
  ["Kalender","der","Kalender","Ich trage alles in meinen Kalender ein.","calendar"],
  ["Uhrzeit","die","—","Zu welcher Uhrzeit sollen wir uns treffen?","time of day"],
  ["Datum","das","Daten","Welches Datum ist heute?","date"],
  ["Feiertag","der","Feiertage","An Feiertagen haben die Geschäfte geschlossen.","public holiday"],
  ["Ostern","das","—","An Ostern besuchen wir die Familie.","Easter"],
  ["Weihnachten","das","—","Weihnachten feiern wir immer zu Hause.","Christmas"],
  ["Silvester","das","—","An Silvester gibt es ein großes Feuerwerk.","New Year's Eve"],
  ["Neujahr","das","—","Frohes Neues Jahr!","New Year"],
  ["Jubiläum","das","Jubiläen","Dieses Jahr feiern sie ihr 25-jähriges Jubiläum.","anniversary / jubilee"],
  ["Hochzeit","die","Hochzeiten","Die Hochzeit war sehr schön.","wedding"],
  ["Taufe","die","Taufen","Wir waren bei der Taufe des Babys dabei.","baptism / christening"],
  ["Beerdigung","die","Beerdigungen","Die Beerdigung war sehr würdevoll.","funeral"],
  ["Glückwunsch","der","Glückwünsche","Herzlichen Glückwunsch zu deiner Beförderung!","congratulations"],
  ["Einladung","die","Einladungen","Danke für deine Einladung!","invitation"],
  ["Absage","die","Absagen","Leider muss ich eine Absage schicken.","cancellation"],
  ["Zusage","die","Zusagen","Ich freue mich über deine Zusage.","acceptance / confirmation"],
  ["Gruß","der","Grüße","Mit freundlichen Grüßen","greeting"],
  ["Abschied","der","Abschiede","Der Abschied fiel uns sehr schwer.","farewell"],
  ["Willkommen","das","—","Herzlich willkommen!","welcome"],
  ["Bitte","die","Bitten","Ich habe eine Bitte an dich.","request / please"],
  ["Dank","der","—","Vielen Dank für deine Hilfe!","thanks"],
  ["Entschuldigung","die","Entschuldigungen","Entschuldigung, darf ich kurz stören?","excuse me / apology"],
  ["Verzeihung","die","—","Verzeihung, ich habe es nicht so gemeint.","pardon / forgiveness"],
  ["Anrede","die","Anreden","Die richtige Anrede ist sehr wichtig.","form of address"],
  ["Dialog","der","Dialoge","Wir üben einen Dialog auf Deutsch.","dialog"],
  ["Diskussion","die","Diskussionen","Die Diskussion war sehr lebhaft.","discussion"],
  ["Debatte","die","Debatten","Die politische Debatte war sehr intensiv.","debate"],
  ["Argument","das","Argumente","Das ist ein gutes Argument.","argument"],
  ["Aussage","die","Aussagen","Diese Aussage ist nicht korrekt.","statement"],
  ["Behauptung","die","Behauptungen","Das ist eine unbewiesene Behauptung.","claim / assertion"],
  ["Erklärung","die","Erklärungen","Die Erklärung des Lehrers war sehr klar.","explanation"],
  ["Beschreibung","die","Beschreibungen","Schreib bitte eine kurze Beschreibung.","description"],
  ["Aufsatz","der","Aufsätze","Ich schreibe einen Aufsatz über Deutschland.","essay"],
  ["Anfrage","die","Anfragen","Ich habe eine Anfrage an Sie.","inquiry / request"],
  ["Kommentar","der","Kommentare","Hast du einen Kommentar dazu?","comment"],
  ["Standpunkt","der","Standpunkte","Ich verstehe deinen Standpunkt.","point of view"],
  ["Kritik","die","Kritiken","Konstruktive Kritik ist sehr wertvoll.","criticism"],
  ["Lob","das","Lobe","Sein Lob hat mich sehr gefreut.","praise"],
  ["Rat","der","Ratschläge","Kannst du mir einen Rat geben?","advice"],
  ["Tipp","der","Tipps","Hast du einen Tipp für mich?","tip"],
  ["Warnung","die","Warnungen","Das ist eine ernste Warnung.","warning"],
  ["Anweisung","die","Anweisungen","Bitte folge den Anweisungen.","instruction"],
  ["Vorschrift","die","Vorschriften","Diese Vorschrift muss eingehalten werden.","regulation / rule"],
  ["Erlaubnis","die","Erlaubnisse","Hast du eine Erlaubnis dafür?","permission"],
  ["Verbot","das","Verbote","Rauchen ist hier verboten.","prohibition / ban"],
  ["Gelegenheit","die","Gelegenheiten","Das ist eine tolle Gelegenheit!","opportunity"],
  ["Chance","die","Chancen","Das ist deine letzte Chance.","chance"],
  ["Risiko","das","Risiken","Das ist ein großes Risiko.","risk"],
  ["Gefahr","die","Gefahren","Bitte vorsichtig, hier ist Gefahr!","danger"],
  ["Sicherheit","die","Sicherheiten","Sicherheit geht vor.","safety / security"],
  ["Schutz","der","—","Das Gesetz dient zum Schutz der Bürger.","protection"],
  ["Hilfe","die","—","Kannst du mir bitte helfen?","help"],
  ["Unterstützung","die","Unterstützungen","Ich danke dir für deine Unterstützung.","support"],
  ["Zusammenarbeit","die","—","Die Zusammenarbeit hat sehr gut funktioniert.","cooperation"],
  ["Teamwork","das","—","Gutes Teamwork ist sehr wichtig.","teamwork"],
  ["Projekt","das","Projekte","Wir arbeiten gemeinsam an einem Projekt.","project"],
  ["Leitung","die","Leitungen","Er hat die Leitung des Projekts übernommen.","management / leadership"],
  ["Organisation","die","Organisationen","Die Organisation des Events war perfekt.","organization"],
  ["Konferenz","die","Konferenzen","Die internationale Konferenz findet in Berlin statt.","conference"],
  ["Vortrag","der","Vorträge","Der Vortrag war sehr informativ.","lecture / talk"],
  ["Präsentation","die","Präsentationen","Morgen halte ich eine Präsentation.","presentation"],
  ["Kompromiss","der","Kompromisse","Wir haben einen guten Kompromiss gefunden.","compromise"],
  ["Einigung","die","Einigungen","Die Einigung war schwer, aber wir haben es geschafft.","agreement"],
  ["Bedingung","die","Bedingungen","Unter welchen Bedingungen kannst du kommen?","condition"],
  ["Veränderung","die","Veränderungen","Die Veränderungen sind sehr positiv.","change"],
  ["Entwicklung","die","Entwicklungen","Die technische Entwicklung schreitet voran.","development"],
  ["Wachstum","das","—","Das Wachstum der Firma ist beeindruckend.","growth"],
  ["Rückgang","der","Rückgänge","Der Rückgang der Verkäufe ist besorgniserregend.","decline"],
  ["Steigerung","die","Steigerungen","Eine Steigerung der Qualität ist notwendig.","increase / improvement"],
  ["Verbesserung","die","Verbesserungen","Wir brauchen eine Verbesserung des Systems.","improvement"],
  ["Reform","die","Reformen","Die Reform des Bildungssystems ist wichtig.","reform"],
  ["Innovation","die","Innovationen","Innovation ist der Schlüssel zum Erfolg.","innovation"],
  ["Trend","der","Trends","Dieser Trend ist sehr interessant.","trend"],
  ["Mode","die","—","Sie interessiert sich sehr für Mode.","fashion"],
  ["Stil","der","Stile","Er hat einen sehr persönlichen Stil.","style"],
  ["Design","das","Designs","Das Design des Produkts ist sehr modern.","design"],
  ["Muster","das","Muster","Das Muster des Stoffes ist sehr schön.","pattern"],
  ["Modell","das","Modelle","Das ist das neueste Modell.","model"],
  ["Typ","der","Typen","Welchen Typ bevorzugst du?","type"],
  ["Sorte","die","Sorten","Welche Sorte Kaffee magst du?","sort / type"],
  ["Auswahl","die","Wahlen","Die Auswahl ist sehr groß.","selection / choice"],
  ["Nachfrage","die","—","Die Nachfrage ist sehr hoch.","demand"],
  ["Konkurrenz","die","—","Die Konkurrenz auf dem Markt ist groß.","competition"],
  ["Kunde","der","Kunden","Der Kunde ist König.","customer (male)"],
  ["Kundin","die","Kundinnen","Die Kundin ist sehr zufrieden.","customer (female)"],
  ["Service","der","—","Der Service hier ist ausgezeichnet.","service"],
  ["Wert","der","Werte","Der Wert dieser Sammlung ist sehr hoch.","value"],
  ["Vorteil","der","Vorteile","Was sind die Vorteile dieser Methode?","advantage"],
  ["Nachteil","der","Nachteile","Was sind die Nachteile?","disadvantage"],
  ["Alternative","die","Alternativen","Gibt es eine Alternative?","alternative"],
  ["Option","die","Optionen","Welche Optionen haben wir?","option"],
  ["Wahl","die","Wahlen","Die Wahl ist nicht leicht.","choice / election"],
  ["Eindruck","der","Eindrücke","Der erste Eindruck ist sehr wichtig.","impression"],
  ["Wirkung","die","Wirkungen","Die Wirkung des Medikaments ist gut.","effect"],
  ["Folge","die","Folgen","Was sind die Folgen dieser Entscheidung?","consequence"],
  ["Ursache","die","Ursachen","Was ist die Ursache des Problems?","cause"],
  ["Zusammenhang","der","Zusammenhänge","Ich verstehe den Zusammenhang nicht.","connection / context"],
  ["Einfluss","der","Einflüsse","Sein Einfluss auf mich war sehr groß.","influence"],
  ["Pflanze","die","Pflanzen","Ich pflege meine Zimmerpflanzen jeden Tag.","plant"],
  ["Gras","das","—","Das Gras auf der Wiese ist grün.","grass"],
  ["Rose","die","Rosen","Er hat ihr rote Rosen geschenkt.","rose"],
  ["Tulpe","die","Tulpen","Im Frühling blühen die Tulpen.","tulip"],
  ["Feld","das","Felder","Die Felder sind im Sommer goldgelb.","field"],
  ["Hügel","der","Hügel","Hinter dem Hügel liegt ein kleines Dorf.","hill"],
  ["Tal","das","Täler","Im Tal fließt ein kleiner Fluss.","valley"],
  ["Küste","die","Küsten","Die Nordseeküste ist sehr schön.","coast"],
  ["Insel","die","Inseln","Sylt ist eine schöne Insel in der Nordsee.","island"],
  ["Wüste","die","Wüsten","In der Wüste ist es sehr heiß.","desert"],
  ["Dschungel","der","Dschungel","Im Dschungel gibt es viele Tiere.","jungle"],
  ["Eis","das","—","Die Straße ist glatt durch das Eis.","ice"],
  ["Frost","der","—","Es gibt heute Nacht Frost.","frost"],
  ["Sturm","der","Stürme","Der Sturm hat viele Bäume umgeworfen.","storm"],
  ["Blitz","der","Blitze","Der Blitz leuchtet am Nachthimmel.","lightning"],
  ["Donner","der","—","Nach dem Blitz kommt der Donner.","thunder"],
  ["Regenbogen","der","Regenbögen","Nach dem Regen erschien ein schöner Regenbogen.","rainbow"],
  ["Nebel","der","—","Heute Morgen liegt dichter Nebel.","fog"],
  ["Schmetterling","der","Schmetterlinge","Der Schmetterling fliegt von Blume zu Blume.","butterfly"],
  ["Biene","die","Bienen","Die Biene sammelt Blütenpollen.","bee"],
  ["Spinne","die","Spinnen","Ich habe Angst vor Spinnen.","spider"],
  ["Schlange","die","Schlangen","In Australien gibt es viele Schlangen.","snake"],
  ["Löwe","der","Löwen","Der Löwe ist der König der Savanne.","lion"],
  ["Tiger","der","Tiger","In Indien gibt es noch wilde Tiger.","tiger"],
  ["Elefant","der","Elefanten","Elefanten sind sehr kluge Tiere.","elephant"],
  ["Affe","der","Affen","Die Affen spielen im Zoo.","monkey"],
  ["Bär","der","Bären","In Kanada gibt es viele Bären.","bear"],
  ["Wolf","der","Wölfe","Der Wolf heult bei Mondschein.","wolf"],
  ["Fuchs","der","Füchse","Der Fuchs ist ein cleveres Tier.","fox"],
  ["Hase","der","Hasen","Der Hase läuft sehr schnell.","hare / rabbit"],
  ["Maus","die","Mäuse","Die Katze jagt die Maus.","mouse"],
  ["Ratte","die","Ratten","Ratten sind sehr intelligente Tiere.","rat"],
  ["Krokodil","das","Krokodile","Das Krokodil lauert im Wasser.","crocodile"],
  ["Delphin","der","Delphine","Delphine sind sehr intelligente Meerestiere.","dolphin"],
  ["Hai","der","Haie","Der Hai schwimmt im Ozean.","shark"],
  ["Pinguin","der","Pinguine","Pinguine leben in der Antarktis.","penguin"],
  ["Adler","der","Adler","Der Adler fliegt hoch in der Luft.","eagle"],
  ["Eule","die","Eulen","Die Eule ist ein nachtaktiver Vogel.","owl"],
  ["Jahrhundert","das","Jahrhunderte","Im 20. Jahrhundert gab es große Veränderungen.","century"],
  ["Jahrzehnt","das","Jahrzehnte","In den letzten Jahrzehnten hat sich viel verändert.","decade"],
  ["Epoche","die","Epochen","Die Romantik war eine wichtige Epoche.","era / epoch"],
  ["Eile","die","—","Keine Eile, wir haben noch Zeit.","haste / hurry"],
  ["Geduld","die","—","Geduld ist eine Tugend.","patience"],
  ["Pünktlichkeit","die","—","Pünktlichkeit ist in Deutschland sehr wichtig.","punctuality"],
  ["Verspätung","die","Verspätungen","Der Zug hat leider Verspätung.","delay"],
  ["Frühstück","das","Frühstücke","Ich esse ein gesundes Frühstück.","breakfast"],
  ["Mittagessen","das","Mittagessen","Wir essen um 12 Uhr Mittagessen.","lunch"],
  ["Abendessen","das","Abendessen","Das Abendessen war sehr lecker.","dinner"],
  ["Nachtisch","der","Nachtische","Zum Nachtisch gibt es Eis.","dessert"],
  ["Vorspeise","die","Vorspeisen","Als Vorspeise nehme ich die Suppe.","starter / appetizer"],
  ["Hauptgericht","das","Hauptgerichte","Das Hauptgericht war ausgezeichnet.","main course"],
  ["Speisekarte","die","Speisekarten","Bitte bringen Sie mir die Speisekarte.","menu"],
  ["Mahlzeit","die","Mahlzeiten","Guten Appetit zur Mahlzeit!","meal"],
  ["Hunger","der","—","Ich habe großen Hunger.","hunger"],
  ["Durst","der","—","Nach dem Sport habe ich großen Durst.","thirst"],
  ["Appetit","der","—","Guten Appetit!","appetite"],
  ["Geschmack","der","Geschmäcker","Das hat einen sehr guten Geschmack.","taste"],
  ["lecker","","—","Das Essen ist wirklich lecker.","delicious / tasty"],
  ["salzig","","—","Das Essen ist etwas zu salzig.","salty"],
  ["süß","","—","Diese Torte ist sehr süß.","sweet"],
  ["sauer","","—","Die Zitrone schmeckt sehr sauer.","sour"],
  ["bitter","","—","Dunkle Schokolade schmeckt bitter.","bitter"],
  ["scharf","","—","Das Curry ist sehr scharf.","spicy / sharp"],
  ["mild","","—","Die Soße ist sehr mild.","mild"],
  ["frisch","","—","Das Brot ist noch ganz frisch.","fresh"],
  ["reif","","—","Die Bananen sind noch nicht reif.","ripe"],
  ["roh","","—","Ich esse das Gemüse lieber roh.","raw"],
  ["gekocht","","—","Die Kartoffeln sind weich gekocht.","cooked / boiled"],
  ["gebraten","","—","Das gebratene Hähnchen ist sehr lecker.","fried / roasted"],
  ["gebacken","","—","Das Brot ist frisch gebacken.","baked"],
  ["Zubereitung","die","Zubereitungen","Die Zubereitung dauert 30 Minuten.","preparation"],
  ["Zutaten","die","—","Welche Zutaten brauche ich?","ingredients"],
  ["Topf","der","Töpfe","Das Wasser kocht im Topf.","pot"],
  ["Pfanne","die","Pfannen","Ich brate das Fleisch in der Pfanne.","pan / frying pan"],
  ["Ofen","der","Öfen","Der Kuchen ist im Ofen.","oven"],
  ["Messer","das","Messer","Sei vorsichtig mit dem Messer!","knife"],
  ["Gabel","die","Gabeln","Wir essen mit Messer und Gabel.","fork"],
  ["Löffel","der","Löffel","Zum Suppe essen brauche ich einen Löffel.","spoon"],
  ["Teller","der","Teller","Bitte stell die Teller auf den Tisch.","plate"],
  ["Tasse","die","Tassen","Ich trinke meinen Kaffee aus dieser Tasse.","cup"],
  ["Flasche","die","Flaschen","Ich kaufe eine Flasche Wasser.","bottle"],
  ["Dose","die","Dosen","Die Suppendose ist schon geöffnet.","can / tin"],
  ["Packung","die","Packungen","Ich kaufe eine Packung Nudeln.","packet / pack"],
  ["Mannschaft","die","Mannschaften","Unsere Mannschaft hat gewonnen.","team"],
  ["Spieler","der","Spieler","Der Spieler hat ein Tor geschossen.","player"],
  ["Training","das","Trainings","Das Training war sehr anstrengend.","training"],
  ["Trainer","der","Trainer","Der Trainer ist sehr streng.","trainer / coach"],
  ["Wettkampf","der","Wettkämpfe","Beim Wettkampf bin ich sehr nervös.","competition"],
  ["Turnier","das","Turniere","Das Turnier findet in München statt.","tournament"],
  ["Meisterschaft","die","Meisterschaften","Die Weltmeisterschaft ist sehr spannend.","championship"],
  ["Rekord","der","Rekorde","Er hat einen neuen Rekord aufgestellt.","record"],
  ["Medaille","die","Medaillen","Sie hat eine Goldmedaille gewonnen.","medal"],
  ["Trophäe","die","Trophäen","Die Trophäe ist sehr groß.","trophy"],
  ["Tor","das","Tore","Er hat ein wichtiges Tor geschossen.","goal (sports) / gate"],
  ["Punkt","der","Punkte","Wir haben drei Punkte gewonnen.","point"],
  ["Sieg","der","Siege","Der Sieg war sehr wichtig für uns.","victory"],
  ["Niederlage","die","Niederlagen","Die Niederlage war sehr bitter.","defeat"],
  ["Unentschieden","das","—","Das Spiel endete Unentschieden.","draw / tie"],
  ["Halbzeit","die","—","In der Halbzeit lagen wir vorne.","half-time"],
  ["Schiedsrichter","der","Schiedsrichter","Der Schiedsrichter hat Gelb gegeben.","referee"],
  ["Fan","der","Fans","Die Fans jubeln lautstark.","fan / supporter"],
  ["Stadion","das","Stadien","Das Stadion fasst 70.000 Zuschauer.","stadium"],
  ["Bachelor","der","Bachelor","Er macht seinen Bachelor in Informatik.","bachelor's degree"],
  ["Master","der","Master","Sie studiert für ihren Master.","master's degree"],
  ["Doktor","der","Doktoren","Er hat seinen Doktor in Chemie gemacht.","doctorate / doctor"],
  ["Professor","der","Professoren","Der Professor ist sehr bekannt.","professor"],
  ["Forschung","die","Forschungen","Die Forschung macht große Fortschritte.","research"],
  ["Labor","das","Labore","Im Labor wird geforscht.","laboratory"],
  ["Experiment","das","Experimente","Das Experiment ist gelungen.","experiment"],
  ["Theorie","die","Theorien","Die Theorie klingt überzeugend.","theory"],
  ["Praxis","die","Praxen","Theorie und Praxis unterscheiden sich.","practice / practical"],
  ["Methode","die","Methoden","Welche Methode verwendest du?","method"],
  ["System","das","Systeme","Das System funktioniert sehr gut.","system"],
  ["Struktur","die","Strukturen","Die Struktur des Textes ist klar.","structure"],
  ["Funktion","die","Funktionen","Was ist die Funktion dieses Knopfes?","function"],
  ["Prozess","der","Prozesse","Der Prozess dauert mehrere Monate.","process"],
  ["Schritt","der","Schritte","Erkläre mir die Schritte.","step"],
  ["Phase","die","Phasen","Wir sind in der ersten Phase.","phase"],
  ["Stufe","die","Stufen","Auf welcher Stufe bist du?","level / step / rung"],
  ["Maßnahme","die","Maßnahmen","Welche Maßnahmen wurden ergriffen?","measure / step"],
  ["Strategie","die","Strategien","Wir brauchen eine neue Strategie.","strategy"],
  ["Konzept","das","Konzepte","Das Konzept ist sehr überzeugend.","concept"],
  ["Prinzip","das","Prinzipien","Das ist ein wichtiges Prinzip.","principle"],
  ["Norm","die","Normen","Diese Norm muss eingehalten werden.","norm / standard"],
  ["Standard","der","Standards","Der Standard ist sehr hoch.","standard"],
  ["Kriterium","das","Kriterien","Welches Kriterium ist das wichtigste?","criterion"],
  ["Faktor","der","Faktoren","Was sind die wichtigsten Faktoren?","factor"],
  ["Aspekt","der","Aspekte","Das ist ein wichtiger Aspekt.","aspect"],
  ["Bereich","der","Bereiche","In welchem Bereich arbeitest du?","area / field / sector"],
  ["Gebiet","das","Gebiete","Das ist ein schwieriges Gebiet.","area / territory / field"],
  ["abholen","","—","Ich hole dich um 8 Uhr vom Bahnhof ab.","to pick up"],
  ["achten","","—","Achte bitte auf deine Gesundheit.","to pay attention / take care"],
  ["anbieten","","—","Darf ich Ihnen etwas zu trinken anbieten?","to offer"],
  ["ändern","","—","Ich möchte meine Gewohnheiten ändern.","to change"],
  ["anfangen","","—","Wann fängst du mit dem Lernen an?","to start / begin"],
  ["annehmen","","—","Ich nehme das Angebot gerne an.","to accept"],
  ["anschauen","","—","Lass uns zusammen einen Film anschauen.","to look at / watch"],
  ["anziehen","","—","Ich ziehe heute meine neue Jacke an.","to put on (clothes)"],
  ["aufhören","","—","Hör auf zu rauchen!","to stop"],
  ["aufmachen","","—","Mach bitte das Fenster auf.","to open"],
  ["aufpassen","","—","Pass bitte auf die Kinder auf.","to watch out / take care of"],
  ["ausruhen","","—","Nach der Wanderung muss ich mich ausruhen.","to rest"],
  ["aussehen","","—","Du siehst heute sehr gut aus.","to look / appear"],
  ["aussteigen","","—","Ich steige an der nächsten Station aus.","to get off"],
  ["ausziehen","","—","Ich ziehe nächsten Monat aus meiner alten Wohnung aus.","to move out"],
  ["bedanken","","—","Ich möchte mich herzlich bei dir bedanken.","to thank"],
  ["bedeuten","","—","Was bedeutet dieses Wort auf Deutsch?","to mean"],
  ["benutzen","","—","Darf ich dein Telefon benutzen?","to use"],
  ["beschäftigen","","—","Womit beschäftigst du dich gerade?","to occupy / deal with"],
  ["bestellen","","—","Ich möchte bitte ein Glas Wasser bestellen.","to order"],
  ["bitten","","—","Ich bitte dich um Hilfe.","to ask / request"],
  ["buchen","","—","Ich habe einen Flug nach Berlin gebucht.","to book"],
  ["dauern","","—","Wie lange dauert die Fahrt?","to last / take (time)"],
  ["einschlafen","","—","Ich schlafe immer schnell ein.","to fall asleep"],
  ["einsteigen","","—","Wir steigen am Hauptbahnhof ein.","to board / get in"],
  ["einziehen","","—","Ich ziehe nächste Woche in meine neue Wohnung ein.","to move in"],
  ["entscheiden","","—","Du musst jetzt eine Entscheidung treffen.","to decide"],
  ["entwickeln","","—","Wir entwickeln gerade eine neue App.","to develop"],
  ["erzählen","","—","Erzähl mir, wie dein Tag war.","to tell / narrate"],
  ["fehlen","","—","Du fehlst mir sehr.","to be missing / to miss someone"],
  ["folgen","","—","Bitte folge mir.","to follow"],
  ["fühlen","","—","Wie fühlst du dich heute?","to feel"],
  ["führen","","—","Er führt das Gespräch sehr gut.","to lead / conduct"],
  ["funktionieren","","—","Die App funktioniert nicht mehr.","to work / function"],
  ["gehören","","—","Wem gehört diese Tasche?","to belong to"],
  ["gelingen","","—","Das Experiment ist gut gelungen.","to succeed"],
  ["geschehen","","—","Was ist hier geschehen?","to happen"],
  ["grüßen","","—","Bitte grüß deine Familie von mir.","to greet"],
  ["handeln","","—","Das Buch handelt von einer Liebesgeschichte.","to act / be about"],
  ["informieren","","—","Bitte informiere mich über die Neuigkeiten.","to inform"],
  ["interessieren","","—","Für welche Themen interessierst du dich?","to interest"],
  ["klingeln","","—","Es hat an der Tür geklingelt.","to ring"],
  ["klopfen","","—","Bitte klopfe an, bevor du reinkommst.","to knock"],
  ["kontrollieren","","—","Der Schaffner kontrolliert die Fahrkarten.","to check / control"],
  ["lächeln","","—","Sie lächelt immer so schön.","to smile"],
  ["landen","","—","Das Flugzeug ist sicher gelandet.","to land"],
  ["liegen","","—","Das Buch liegt auf dem Tisch.","to lie / be located"],
  ["meinen","","—","Was meinst du damit?","to mean / think"],
  ["mitnehmen","","—","Kannst du mich mitnehmen?","to take along"],
  ["ordnen","","—","Ich muss meine Unterlagen ordnen.","to sort / organize"],
  ["packen","","—","Ich muss noch meinen Koffer packen.","to pack"],
  ["passieren","","—","Was ist dir passiert?","to happen / pass"],
  ["planen","","—","Wir planen eine Reise nach Deutschland.","to plan"],
  ["prüfen","","—","Der Lehrer prüft die Hausaufgaben.","to check / examine"],
  ["reagieren","","—","Wie hat er auf die Nachricht reagiert?","to react"],
  ["reden","","—","Wir müssen über dieses Problem reden.","to talk / speak"],
  ["reparieren","","—","Ich muss mein Fahrrad reparieren lassen.","to repair"],
  ["reservieren","","—","Ich habe einen Tisch für zwei reserviert.","to reserve"],
  ["richten","","—","Bitte richte meinen Gruß an deine Familie.","to direct / address"],
  ["sammeln","","—","Ich sammle gerne Briefmarken.","to collect"],
  ["schenken","","—","Was schenkst du ihr zum Geburtstag?","to give as a gift"],
  ["schreien","","—","Bitte schrei nicht so laut!","to scream / shout"],
  ["setzen","","—","Bitte setz dich.","to set / put / sit down"],
  ["sorgen","","—","Ich sorge mich um dich.","to worry / take care of"],
  ["starten","","—","Der Flug startet um 14 Uhr.","to start / take off"],
  ["stattfinden","","—","Das Konzert findet morgen statt.","to take place"],
  ["stellen","","—","Stell die Tasse auf den Tisch.","to put / place"],
  ["stimmen","","—","Das stimmt nicht.","to be correct / to vote"],
  ["stören","","—","Entschuldigung, störe ich?","to disturb"],
  ["telefonieren","","—","Ich telefoniere gerade.","to talk on the phone"],
  ["übersetzen","","—","Kannst du das bitte übersetzen?","to translate"],
  ["umziehen","","—","Ich ziehe nächsten Monat um.","to move (house)"],
  ["untersuchen","","—","Der Arzt untersucht den Patienten.","to examine / investigate"],
  ["verabreden","","—","Wir haben uns für Samstag verabredet.","to arrange to meet"],
  ["verbessern","","—","Ich muss mein Deutsch verbessern.","to improve"],
  ["vergleichen","","—","Vergleich bitte die beiden Angebote.","to compare"],
  ["verlassen","","—","Ich verlasse die Wohnung um 8 Uhr.","to leave"],
  ["versuchen","","—","Ich versuche, täglich Sport zu machen.","to try / attempt"],
  ["verteilen","","—","Bitte verteile die Aufgaben.","to distribute"],
  ["vorbereiten","","—","Ich bereite mich auf die Prüfung vor.","to prepare"],
  ["vorstellen","","—","Darf ich mich vorstellen?","to introduce"],
  ["wechseln","","—","Ich muss Geld wechseln.","to change / exchange"],
  ["wiederholen","","—","Bitte wiederhol das noch einmal.","to repeat"],
  ["wünschen","","—","Ich wünsche dir viel Erfolg!","to wish"],
  ["zahlen","","—","Kann ich bitte zahlen?","to pay"],
  ["zeichnen","","—","Er zeichnet sehr gut.","to draw"],
  ["zuhören","","—","Hör mir bitte zu.","to listen (to someone)"],
  ["zunehmen","","—","Ich habe im Urlaub zugenommen.","to gain weight / increase"],
  ["zurückkommen","","—","Wann kommst du zurück?","to come back / return"],
  ["zusammenpassen","","—","Die beiden passen gut zusammen.","to go together / match"],
  ["Abschnitt","der","Abschnitte","Lies bitte den ersten Abschnitt.","section / paragraph"],
  ["Absatz","der","Absätze","Der erste Absatz ist sehr gut.","paragraph / heel"],
  ["Ahnung","die","Ahnungen","Ich habe keine Ahnung davon.","idea / clue"],
  ["Alltag","der","—","Das ist mein normaler Alltag.","everyday life"],
  ["Anforderung","die","Anforderungen","Die Anforderungen sind sehr hoch.","requirement"],
  ["Anlass","der","Anlässe","Aus welchem Anlass feiern wir?","occasion / reason"],
  ["Ansicht","die","Ansichten","Das ist meine persönliche Ansicht.","view / opinion"],
  ["Aufmerksamkeit","die","—","Vielen Dank für Ihre Aufmerksamkeit.","attention"],
  ["Ausdruck","der","Ausdrücke","Das ist ein schwieriger Ausdruck.","expression"],
  ["Aussicht","die","Aussichten","Die Aussicht vom Berg ist wunderschön.","view / prospect"],
  ["Bekanntschaft","die","Bekanntschaften","Es ist eine schöne Bekanntschaft.","acquaintance"],
  ["Beziehung","die","Beziehungen","Sie haben eine gute Beziehung.","relationship"],
  ["Eigenschaft","die","Eigenschaften","Was sind seine guten Eigenschaften?","quality / characteristic"],
  ["Einstellung","die","Einstellungen","Ich bewundere seine Einstellung.","attitude / setting"],
  ["Erleichterung","die","—","Was für eine Erleichterung!","relief"],
  ["Erscheinung","die","Erscheinungen","Das ist eine merkwürdige Erscheinung.","appearance / phenomenon"],
  ["Gegenstand","der","Gegenstände","Was ist das für ein Gegenstand?","object / item"],
  ["Grundlage","die","Grundlagen","Das ist die Grundlage unserer Arbeit.","basis / foundation"],
  ["Hintergrund","der","Hintergründe","Was ist der Hintergrund dieser Geschichte?","background"],
  ["Lage","die","Lagen","Die Lage ist sehr ernst.","situation / location"],
  ["Lust","die","—","Hast du Lust, ins Kino zu gehen?","desire / mood / feel like"],
  ["Maßstab","der","Maßstäbe","Das ist ein hoher Maßstab.","scale / standard"],
  ["Mittel","das","Mittel","Haben wir die nötigen Mittel dafür?","means / remedy"],
  ["Rücksicht","die","—","Bitte nehm Rücksicht auf andere.","consideration / regard"],
  ["Schwierigkeit","die","Schwierigkeiten","Wir haben Schwierigkeiten gehabt.","difficulty"],
  ["Stärke","die","Stärken","Was ist deine größte Stärke?","strength"],
  ["Umstand","der","Umstände","Unter diesen Umständen ist es schwierig.","circumstance"],
  ["Verbindung","die","Verbindungen","Gibt es eine direkte Verbindung?","connection"],
  ["Wirklichkeit","die","—","Das ist leider die Wirklichkeit.","reality"],
  ["Staat","der","Staaten","Der Staat hat neue Gesetze verabschiedet.","state / country"],
  ["Regierung","die","Regierungen","Die Regierung hat neue Maßnahmen beschlossen.","government"],
  ["Parlament","das","Parlamente","Das Parlament debattiert über das neue Gesetz.","parliament"],
  ["Demokratie","die","Demokratien","Die Demokratie ist eine wichtige Staatsform.","democracy"],
  ["Partei","die","Parteien","Er ist Mitglied einer politischen Partei.","political party"],
  ["Stimme","die","Stimmen","Jede Stimme zählt bei der Wahl.","vote / voice"],
  ["Bürger","der","Bürger","Die Bürger der Stadt protestieren.","citizen"],
  ["Bürgerin","die","Bürgerinnen","Die Bürgerinnen haben das Recht zu wählen.","citizen (female)"],
  ["Gemeinschaft","die","Gemeinschaften","Das Gemeinschaftsgefühl ist sehr stark.","community"],
  ["Minderheit","die","Minderheiten","Die Rechte der Minderheiten müssen geschützt werden.","minority"],
  ["Mehrheit","die","Mehrheiten","Die Mehrheit stimmte für den Antrag.","majority"],
  ["Konflikt","der","Konflikte","Der Konflikt zwischen den Parteien dauert an.","conflict"],
  ["Krise","die","Krisen","Das Land steckt in einer wirtschaftlichen Krise.","crisis"],
  ["Industrie","die","Industrien","Die Industrie ist ein wichtiger Wirtschaftszweig.","industry"],
  ["Handel","der","—","Der internationale Handel nimmt zu.","trade / commerce"],
  ["Export","der","Exporte","Der Export von Autos ist sehr wichtig.","export"],
  ["Import","der","Importe","Der Import von Elektronik ist gestiegen.","import"],
  ["Investition","die","Investitionen","Die Investitionen in erneuerbare Energien steigen.","investment"],
  ["Kapital","das","Kapitale","Er hat viel Kapital in Aktien angelegt.","capital"],
  ["Aktie","die","Aktien","Er hat viele Aktien an der Börse.","share / stock"],
  ["Börse","die","Börsen","Die Börse hat heute stark schwankt.","stock exchange"],
  ["Inflation","die","—","Die Inflation ist auf einem hohen Niveau.","inflation"],
  ["Arbeitslosigkeit","die","—","Die Arbeitslosigkeit ist gesunken.","unemployment"],
  ["Sozialversicherung","die","—","Die Sozialversicherung schützt die Arbeitnehmer.","social insurance"],
  ["Gewerkschaft","die","Gewerkschaften","Die Gewerkschaft fordert höhere Löhne.","trade union"],
  ["Streik","der","Streiks","Die Arbeiter haben einen Streik ausgerufen.","strike"],
  ["Armut","die","—","Die Armut ist ein weltweites Problem.","poverty"],
  ["Reichtum","der","—","Der Reichtum ist sehr ungleich verteilt.","wealth"],
  ["Steuern","die","—","Die Steuern sind dieses Jahr gestiegen.","taxes"],
  ["Haushalt","der","Haushalte","Der Staatshaushalt ist ausgeglichen.","budget / household"],
  ["Gerechtigkeit","die","—","Er kämpft für mehr soziale Gerechtigkeit.","justice"],
  ["Ungerechtigkeit","die","Ungerechtigkeiten","Diese Ungerechtigkeit muss beseitigt werden.","injustice"],
  ["Gleichheit","die","—","Gleichheit vor dem Gesetz ist ein Grundprinzip.","equality"],
  ["Würde","die","—","Die Würde des Menschen ist unantastbar.","dignity"],
  ["Grundgesetz","das","—","Das Grundgesetz ist die Verfassung Deutschlands.","Basic Law (German constitution)"],
  ["Verfassung","die","Verfassungen","Die Verfassung schützt die Grundrechte.","constitution"],
  ["Gericht","das","Gerichte","Das Gericht hat das Urteil gesprochen.","court"],
  ["Urteil","das","Urteile","Das Urteil des Richters war sehr streng.","verdict / judgment"],
  ["Richter","der","Richter","Der Richter ist für seine Gerechtigkeit bekannt.","judge"],
  ["Anwalt","der","Anwälte","Mein Anwalt vertritt mich vor Gericht.","lawyer"],
  ["Verbrechen","das","Verbrechen","Das Verbrechen wurde aufgeklärt.","crime"],
  ["Strafe","die","Strafen","Die Strafe muss dem Vergehen entsprechen.","punishment"],
  ["Polizei","die","—","Die Polizei hat den Täter gefasst.","police"],
  ["Täter","der","Täter","Der Täter wurde verhaftet.","perpetrator"],
  ["Opfer","das","Opfer","Das Opfer des Angriffs ist im Krankenhaus.","victim"],
  ["Zeuge","der","Zeugen","Der Zeuge hat alles gesehen.","witness"],
  ["Beweis","der","Beweise","Die Beweise sind eindeutig.","evidence / proof"],
  ["Bildung","die","—","Bildung ist der Schlüssel zum Erfolg.","education"],
  ["Hypothese","die","Hypothesen","Die Hypothese muss noch bewiesen werden.","hypothesis"],
  ["Erkenntnis","die","Erkenntnisse","Diese Erkenntnis verändert alles.","insight / finding"],
  ["Analyse","die","Analysen","Die Analyse der Daten ist abgeschlossen.","analysis"],
  ["Statistik","die","Statistiken","Die Statistik zeigt einen klaren Trend.","statistics"],
  ["Studie","die","Studien","Eine neue Studie belegt dies.","study"],
  ["Veröffentlichung","die","Veröffentlichungen","Die Veröffentlichung ist für nächste Woche geplant.","publication"],
  ["These","die","Thesen","Die These des Autors ist überzeugend.","thesis"],
  ["Philosophie","die","Philosophien","Die Philosophie beschäftigt sich mit Grundfragen.","philosophy"],
  ["Psychologie","die","—","Die Psychologie erforscht das menschliche Verhalten.","psychology"],
  ["Soziologie","die","—","Die Soziologie untersucht gesellschaftliche Strukturen.","sociology"],
  ["Physik","die","—","Die Physik erklärt die Gesetze der Natur.","physics"],
  ["Chemie","die","—","In der Chemie wird viel experimentiert.","chemistry"],
  ["Biologie","die","—","Die Biologie untersucht das Leben.","biology"],
  ["Informatik","die","—","Informatik ist ein wachsendes Fachgebiet.","computer science"],
  ["Medizin","die","—","Er studiert Medizin im dritten Semester.","medicine"],
  ["Rechtswissenschaft","die","—","Er studiert Rechtswissenschaft in Heidelberg.","law (as a subject)"],
  ["Literatur","die","—","Die deutsche Literatur ist sehr vielfältig.","literature"],
  ["Linguistik","die","—","Die Linguistik beschäftigt sich mit Sprachen.","linguistics"],
  ["Gemälde","das","Gemälde","Das Gemälde hängt im Museum.","painting"],
  ["Skulptur","die","Skulpturen","Die Skulptur steht vor dem Rathaus.","sculpture"],
  ["Galerie","die","Galerien","Die Galerie zeigt zeitgenössische Kunst.","gallery"],
  ["Architektur","die","—","Die Architektur Berlins ist sehr vielfältig.","architecture"],
  ["Roman","der","Romane","Dieser Roman ist ein Meisterwerk.","novel"],
  ["Drama","das","Dramen","Das Drama spielt im 19. Jahrhundert.","drama"],
  ["Autor","der","Autoren","Der Autor dieses Buches ist weltbekannt.","author (male)"],
  ["Autorin","die","Autorinnen","Die Autorin hat viele Preise gewonnen.","author (female)"],
  ["Verleger","der","Verleger","Der Verleger hat das Buch abgelehnt.","publisher (male)"],
  ["Verlag","der","Verlage","Der Verlag ist auf Krimis spezialisiert.","publishing house"],
  ["Journalismus","der","—","Journalismus ist die vierte Gewalt.","journalism"],
  ["Journalist","der","Journalisten","Der Journalist recherchiert eine Geschichte.","journalist (male)"],
  ["Journalistin","die","Journalistinnen","Die Journalistin schreibt für eine große Zeitung.","journalist (female)"],
  ["Redaktion","die","Redaktionen","Die Redaktion trifft sich jeden Montag.","editorial office"],
  ["Medien","die","—","Die Medien berichten über den Vorfall.","media"],
  ["Presse","die","—","Die Pressefreiheit ist ein Grundrecht.","press"],
  ["Rundfunk","der","—","Der öffentliche Rundfunk ist gebührenpflichtig.","broadcasting"],
  ["Fernsehen","das","—","Das Fernsehen wird von vielen täglich genutzt.","television"],
  ["Sendung","die","Sendungen","Die Sendung beginnt um 20 Uhr.","broadcast / programme"],
  ["Nachrichten","die","—","Die Nachrichten berichten über die Lage.","news"],
  ["Dokumentation","die","Dokumentationen","Die Dokumentation über den Klimawandel ist sehenswert.","documentary"],
  ["Regie","die","—","Die Regie des Films liegt bei einem bekannten Regisseur.","direction (film)"],
  ["Regisseur","der","Regisseure","Der Regisseur hat einen Oscar gewonnen.","director (film, male)"],
  ["Schauspieler","der","Schauspieler","Der Schauspieler hat eine Hauptrolle.","actor"],
  ["Schauspielerin","die","Schauspielerinnen","Die Schauspielerin hat viele Preise gewonnen.","actress"],
  ["Bühne","die","Bühnen","Die Bühne ist für die Vorstellung bereit.","stage"],
  ["Aufführung","die","Aufführungen","Die Aufführung war ausverkauft.","performance"],
  ["Publikum","das","—","Das Publikum applaudierte begeistert.","audience"],
  ["Kritiker","der","Kritiker","Die Kritiker loben das neue Werk.","critic"],
  ["Rezension","die","Rezensionen","Die Rezension in der Zeitung war sehr positiv.","review"],
  ["Umweltverschmutzung","die","—","Die Umweltverschmutzung muss bekämpft werden.","environmental pollution"],
  ["Treibhausgas","das","Treibhausgase","Die Treibhausgase müssen reduziert werden.","greenhouse gas"],
  ["Kohlendioxid","das","—","Der Ausstoß von Kohlendioxid muss sinken.","carbon dioxide"],
  ["Erderwärmung","die","—","Die Erderwärmung hat dramatische Folgen.","global warming"],
  ["Nachhaltigkeit","die","—","Nachhaltigkeit ist ein wichtiges Prinzip.","sustainability"],
  ["erneuerbare Energie","die","erneuerbare Energien","Erneuerbare Energien sind die Zukunft.","renewable energy"],
  ["Solarenergie","die","—","Solarenergie wird immer erschwinglicher.","solar energy"],
  ["Windkraft","die","—","Windkraft liefert viel Strom.","wind power"],
  ["Atomkraft","die","—","Deutschland steigt aus der Atomkraft aus.","nuclear power"],
  ["Naturkatastrophe","die","Naturkatastrophen","Die Naturkatastrophe forderte viele Opfer.","natural disaster"],
  ["Dürre","die","Dürren","Die Dürre hat die Ernte zerstört.","drought"],
  ["Überschwemmung","die","Überschwemmungen","Die Überschwemmung hat viele Häuser zerstört.","flood"],
  ["Erdbeben","das","Erdbeben","Das Erdbeben hatte eine Stärke von 7.","earthquake"],
  ["Vulkan","der","Vulkane","Der Vulkan ist wieder aktiv.","volcano"],
  ["Artenschutz","der","—","Der Artenschutz ist eine globale Aufgabe.","species protection"],
  ["Artenvielfalt","die","—","Die Artenvielfalt nimmt ab.","biodiversity"],
  ["Ökosystem","das","Ökosysteme","Das Ökosystem ist sehr empfindlich.","ecosystem"],
  ["Ressource","die","Ressourcen","Die natürlichen Ressourcen sind begrenzt.","resource"],
  ["Recycling","das","—","Recycling ist wichtig für die Umwelt.","recycling"],
  ["Abfall","der","Abfälle","Der Abfall muss getrennt werden.","waste / garbage"],
  ["Müllentsorgung","die","—","Die Müllentsorgung funktioniert gut.","waste disposal"],
  ["Wasserversorgung","die","—","Die Wasserversorgung ist gesichert.","water supply"],
  ["Trinkwasser","das","—","Sauberes Trinkwasser ist ein Menschenrecht.","drinking water"],
  ["Luftqualität","die","—","Die Luftqualität in der Stadt ist schlecht.","air quality"],
  ["Lärm","der","—","Der Lärm in der Stadt ist unerträglich.","noise"],
  ["Diagnose","die","Diagnosen","Die Diagnose des Arztes war eindeutig.","diagnosis"],
  ["Therapie","die","Therapien","Die Therapie zeigt erste Erfolge.","therapy"],
  ["Behandlung","die","Behandlungen","Die Behandlung dauert mehrere Wochen.","treatment"],
  ["Operation","die","Operationen","Die Operation verlief erfolgreich.","operation"],
  ["Impfung","die","Impfungen","Die Impfung schützt vor der Krankheit.","vaccination"],
  ["Nebenwirkung","die","Nebenwirkungen","Das Medikament hat viele Nebenwirkungen.","side effect"],
  ["Symptom","das","Symptome","Die Symptome traten plötzlich auf.","symptom"],
  ["Virus","das","Viren","Das Virus ist sehr ansteckend.","virus"],
  ["Bakterie","die","Bakterien","Die Bakterien wurden abgetötet.","bacterium"],
  ["Infektion","die","Infektionen","Die Infektion verbreitet sich schnell.","infection"],
  ["Pandemie","die","Pandemien","Die Pandemie hat die Welt verändert.","pandemic"],
  ["Epidemie","die","Epidemien","Die Epidemie ist unter Kontrolle.","epidemic"],
  ["Prävention","die","—","Prävention ist besser als Heilung.","prevention"],
  ["Heilung","die","Heilungen","Die Heilung kam schneller als erwartet.","healing / cure"],
  ["Chirurgie","die","—","Die Chirurgie hat große Fortschritte gemacht.","surgery"],
  ["Onkologie","die","—","Die Onkologie erforscht Krebserkrankungen.","oncology"],
  ["Genetik","die","—","Die Genetik erklärt viele Erbkrankheiten.","genetics"],
  ["Stammzelle","die","Stammzellen","Stammzellen könnten viele Krankheiten heilen.","stem cell"],
  ["Künstliche Intelligenz","die","—","Künstliche Intelligenz verändert die Arbeitswelt.","artificial intelligence"],
  ["Algorithmus","der","Algorithmen","Der Algorithmus sortiert die Daten.","algorithm"],
  ["Datenbank","die","Datenbanken","Die Datenbank enthält Millionen von Einträgen.","database"],
  ["Software","die","Softwares","Die Software wurde aktualisiert.","software"],
  ["Hardware","die","—","Die Hardware ist veraltet.","hardware"],
  ["Netzwerk","das","Netzwerke","Das Netzwerk ist ausgefallen.","network"],
  ["Datenschutz","der","—","Datenschutz ist in Europa sehr wichtig.","data protection"],
  ["Cybersicherheit","die","—","Cybersicherheit ist ein wachsendes Problem.","cybersecurity"],
  ["Automatisierung","die","—","Die Automatisierung verändert die Industrie.","automation"],
  ["Roboter","der","Roboter","Roboter übernehmen viele Aufgaben.","robot"],
  ["Digitalisierung","die","—","Die Digitalisierung schreitet voran.","digitalization"],
  ["Bewusstsein","das","—","Das Bewusstsein für das Problem wächst.","consciousness / awareness"],
  ["Unterbewusstsein","das","—","Das Unterbewusstsein beeinflusst unser Handeln.","subconscious"],
  ["Persönlichkeit","die","Persönlichkeiten","Sie hat eine starke Persönlichkeit.","personality"],
  ["Charakter","der","Charaktere","Sein Charakter ist sehr ausgeprägt.","character"],
  ["Temperament","das","Temperamente","Jeder Mensch hat ein anderes Temperament.","temperament"],
  ["Motivation","die","Motivationen","Die Motivation ist der Schlüssel zum Erfolg.","motivation"],
  ["Ambition","die","Ambitionen","Er hat große Ambitionen.","ambition"],
  ["Ehrgeiz","der","—","Ihr Ehrgeiz ist bewundernswert.","ambition / drive"],
  ["Leidenschaft","die","Leidenschaften","Er verfolgt seine Leidenschaft mit Eifer.","passion"],
  ["Begeisterung","die","—","Die Begeisterung der Fans war riesig.","enthusiasm"],
  ["Enttäuschung","die","Enttäuschungen","Die Enttäuschung war groß.","disappointment"],
  ["Überraschung","die","Überraschungen","Die Überraschung kam völlig unerwartet.","surprise"],
  ["Scham","die","—","Er empfindet keine Scham.","shame"],
  ["Schuld","die","Schulden","Er gibt sich die Schuld daran.","guilt / blame"],
  ["Reue","die","—","Er zeigt echte Reue für sein Handeln.","remorse / regret"],
  ["Eifersucht","die","—","Eifersucht kann Beziehungen zerstören.","jealousy"],
  ["Neid","der","—","Neid führt zu nichts Gutem.","envy"],
  ["Stolz","der","—","Er ist sehr stolz auf seine Kinder.","pride"],
  ["Demut","die","—","Demut ist eine seltene Tugend.","humility"],
  ["Ungeduld","die","—","Seine Ungeduld ist manchmal störend.","impatience"],
  ["Selbstvertrauen","das","—","Er hat viel Selbstvertrauen.","self-confidence"],
  ["Selbstzweifel","der","Selbstzweifel","Selbstzweifel können lähmend sein.","self-doubt"],
  ["Empathie","die","—","Empathie ist sehr wichtig im Umgang mit anderen.","empathy"],
  ["Mitgefühl","das","—","Er zeigt großes Mitgefühl.","compassion"],
  ["Verständnis","das","—","Danke für dein Verständnis.","understanding"],
  ["Neugier","die","—","Neugier ist der Motor des Lernens.","curiosity"],
  ["Kreativität","die","—","Kreativität ist in vielen Berufen gefragt.","creativity"],
  ["Fantasie","die","—","Ein Kind braucht viel Fantasie.","imagination / fantasy"],
  ["Intuition","die","—","Manchmal sollte man auf seine Intuition hören.","intuition"],
  ["Kommunikation","die","—","Gute Kommunikation ist entscheidend.","communication"],
  ["Missverständnis","das","Missverständnisse","Das war ein Missverständnis.","misunderstanding"],
  ["Kontext","der","Kontexte","Die Bedeutung hängt vom Kontext ab.","context"],
  ["Metapher","die","Metaphern","Er benutzt viele Metaphern in seiner Rede.","metaphor"],
  ["Ironie","die","—","Ironie ist schwer zu verstehen.","irony"],
  ["Rhetorik","die","—","Seine Rhetorik ist sehr überzeugend.","rhetoric"],
  ["Verhandlung","die","Verhandlungen","Die Verhandlungen dauern noch an.","negotiation"],
  ["Konfliktlösung","die","—","Konfliktlösung ist eine wichtige Fähigkeit.","conflict resolution"],
  ["Spracherwerb","der","—","Der Spracherwerb bei Kindern ist erstaunlich.","language acquisition"],
  ["Zweisprachigkeit","die","—","Zweisprachigkeit hat viele Vorteile.","bilingualism"],
  ["Muttersprache","die","Muttersprachen","Meine Muttersprache ist Japanisch.","mother tongue"],
  ["Fremdsprache","die","Fremdsprachen","Ich lerne drei Fremdsprachen.","foreign language"],
  ["Dialekt","der","Dialekte","In Bayern spricht man einen starken Dialekt.","dialect"],
  ["Wortschatz","der","Wortschätze","Ich erweitere ständig meinen Wortschatz.","vocabulary"],
  ["Syntax","die","—","Die Syntax des Deutschen ist besonders.","syntax"],
  ["Semantik","die","—","Die Semantik beschäftigt sich mit Bedeutungen.","semantics"],
  ["Moral","die","—","Moral ist die Grundlage des Zusammenlebens.","morals / ethics"],
  ["Ethik","die","—","Die Ethik beschäftigt sich mit Werten.","ethics"],
  ["Tugend","die","Tugenden","Ehrlichkeit ist eine wichtige Tugend.","virtue"],
  ["Laster","das","Laster","Faulheit ist sein größtes Laster.","vice"],
  ["Wahrheit","die","Wahrheiten","Die Wahrheit ist manchmal unbequem.","truth"],
  ["Lüge","die","Lügen","Die Lüge hat ein kurzes Leben.","lie"],
  ["Ehrlichkeit","die","—","Ehrlichkeit ist die beste Politik.","honesty"],
  ["Integrität","die","—","Er ist für seine Integrität bekannt.","integrity"],
  ["Konsequenz","die","Konsequenzen","Jede Handlung hat Konsequenzen.","consequence"],
  ["Solidarität","die","—","Solidarität ist in schweren Zeiten wichtig.","solidarity"],
  ["Menschlichkeit","die","—","In dieser Situation hat er Menschlichkeit gezeigt.","humanity"],
  ["Vernunft","die","—","Die Vernunft sollte das Handeln leiten.","reason / rationality"],
  ["Logik","die","—","Seine Argumentation folgt keiner Logik.","logic"],
  ["Paradox","das","Paradoxe","Das ist ein interessantes Paradox.","paradox"],
  ["Globalisierung","die","—","Die Globalisierung hat die Welt verändert.","globalization"],
  ["Internationalisierung","die","—","Die Internationalisierung schreitet voran.","internationalization"],
  ["Migration","die","—","Migration ist ein wichtiges Thema.","migration"],
  ["Einwanderung","die","—","Die Einwanderung hat zugenommen.","immigration"],
  ["Auswanderung","die","—","Auswanderung ist immer eine schwere Entscheidung.","emigration"],
  ["Flüchtling","der","Flüchtlinge","Viele Flüchtlinge kommen aus Kriegsgebieten.","refugee"],
  ["Asyl","das","—","Er hat Asyl in Deutschland beantragt.","asylum"],
  ["Integration","die","—","Die Integration gelingt nicht immer leicht.","integration"],
  ["Diplomatie","die","—","Diplomatie ist der Schlüssel zur Konfliktlösung.","diplomacy"],
  ["Botschaft","die","Botschaften","Die Botschaft befindet sich im Stadtzentrum.","embassy / message"],
  ["Botschafter","der","Botschafter","Der Botschafter traf den Außenminister.","ambassador"],
  ["Außenpolitik","die","—","Die Außenpolitik steht vor großen Herausforderungen.","foreign policy"],
  ["Innenpolitik","die","—","Die Innenpolitik ist von Reformen geprägt.","domestic policy"],
  ["Sicherheitspolitik","die","—","Die Sicherheitspolitik muss angepasst werden.","security policy"],
  ["NATO","die","—","Deutschland ist Mitglied der NATO.","NATO"],
  ["Vereinte Nationen","die","—","Die Vereinten Nationen fördern den Frieden.","United Nations"],
  ["Menschenrechte","die","—","Die Menschenrechte müssen überall geschützt werden.","human rights"],
  ["analysieren","","—","Wir müssen die Situation genau analysieren.","to analyze"],
  ["argumentieren","","—","Er argumentiert sehr überzeugend.","to argue"],
  ["beachten","","—","Bitte beachten Sie die Hinweisschilder.","to observe / pay attention to"],
  ["beeinflussen","","—","Die Medien beeinflussen die öffentliche Meinung.","to influence"],
  ["berichten","","—","Der Journalist berichtet über den Vorfall.","to report"],
  ["berücksichtigen","","—","Bitte berücksichtigen Sie alle Aspekte.","to consider / take into account"],
  ["beurteilen","","—","Wie beurteilen Sie die Lage?","to assess / judge"],
  ["bezeichnen","","—","Man bezeichnet ihn als Experten.","to describe / call / designate"],
  ["darstellen","","—","Wie kann man das besser darstellen?","to represent / depict"],
  ["durchführen","","—","Das Experiment wurde erfolgreich durchgeführt.","to carry out / conduct"],
  ["einschätzen","","—","Wie schätzen Sie die Risiken ein?","to assess / estimate"],
  ["erzielen","","—","Wir konnten gute Ergebnisse erzielen.","to achieve / attain"],
  ["feststellen","","—","Ich habe festgestellt, dass das nicht stimmt.","to establish / determine / notice"],
  ["fördern","","—","Die Regierung fördert erneuerbare Energien.","to promote / support / encourage"],
  ["gewährleisten","","—","Die Sicherheit muss gewährleistet werden.","to ensure / guarantee"],
  ["hervorheben","","—","Er hob die wichtigsten Punkte hervor.","to emphasize / highlight"],
  ["interpretieren","","—","Wie interpretieren Sie das Ergebnis?","to interpret"],
  ["kritisieren","","—","Die Opposition kritisiert die Regierung.","to criticize"],
  ["nachweisen","","—","Er konnte seine Unschuld nachweisen.","to prove / demonstrate"],
  ["präsentieren","","—","Sie präsentierte ihre Ergebnisse überzeugend.","to present"],
  ["rechtfertigen","","—","Kannst du dein Verhalten rechtfertigen?","to justify"],
  ["unterscheiden","","—","Kannst du die Unterschiede erkennen?","to distinguish / differentiate"],
  ["vermuten","","—","Ich vermute, dass er krank ist.","to suspect / assume"],
  ["veröffentlichen","","—","Die Studie wurde veröffentlicht.","to publish"],
  ["verzichten","","—","Ich verzichte heute auf Fleisch.","to do without / give up"],
  ["widersprechen","","—","Das widerspricht meiner Erfahrung.","to contradict"],
  ["zusammenfassen","","—","Kannst du die wichtigsten Punkte zusammenfassen?","to summarize"],
  ["abschließen","","—","Wir haben den Vertrag abgeschlossen.","to conclude / finish"],
  ["anpassen","","—","Wir müssen uns an die neuen Umstände anpassen.","to adapt / adjust"],
  ["aufbauen","","—","Wir müssen etwas Neues aufbauen.","to build up / establish"],
  ["ausdrücken","","—","Er kann seine Gefühle nicht ausdrücken.","to express"],
  ["auswählen","","—","Bitte wähle sorgfältig aus.","to select / choose"],
  ["beabsichtigen","","—","Was beabsichtigen Sie damit?","to intend"],
  ["begrenzen","","—","Die Ausgaben müssen begrenzt werden.","to limit / restrict"],
  ["beschränken","","—","Der Zugang ist auf Mitglieder beschränkt.","to restrict / limit"],
  ["betonen","","—","Er betonte die Wichtigkeit der Maßnahme.","to emphasize"],
  ["bewirken","","—","Was hat das bewirkt?","to cause / bring about"],
  ["ermöglichen","","—","Das ermöglicht uns neue Wege.","to enable / make possible"],
  ["gestalten","","—","Wie wollen wir die Zukunft gestalten?","to shape / design"],
  ["herausfordern","","—","Die Situation fordert uns heraus.","to challenge"],
  ["hinweisen","","—","Ich möchte auf ein Problem hinweisen.","to point out / indicate"],
  ["lösen","","—","Wir müssen das Problem lösen.","to solve / dissolve"],
  ["übernehmen","","—","Er hat die Verantwortung übernommen.","to take over / assume"],
  ["umsetzen","","—","Die Idee wurde erfolgreich umgesetzt.","to implement / put into practice"],
  ["verbinden","","—","Kunst verbindet Menschen.","to connect / link"],
  ["verwenden","","—","Wofür wird das verwendet?","to use / apply"],
  ["vorschlagen","","—","Ich möchte einen anderen Ansatz vorschlagen.","to suggest / propose"],
  ["wählen","","—","Ich wähle immer die beste Option.","to choose / elect"],
  ["abweichen","","—","Das Ergebnis weicht von der Erwartung ab.","to deviate"],
  ["anstreben","","—","Wir streben nach mehr Nachhaltigkeit.","to strive for / aim at"],
  ["aufgreifen","","—","Das Thema wurde in der Diskussion aufgegriffen.","to pick up / address"],
  ["auseinandersetzen","","—","Er setzt sich intensiv mit dem Thema auseinander.","to engage with / deal with"],
  ["basieren","","—","Die Entscheidung basiert auf Fakten.","to be based on"],
  ["beitragen","","—","Jeder kann zum Klimaschutz beitragen.","to contribute"],
  ["beziehen","","—","Wie beziehen Sie sich auf das Thema?","to refer to / relate to"],
  ["differenzieren","","—","Man muss hier differenzieren.","to differentiate"],
  ["einbeziehen","","—","Alle Beteiligten wurden einbezogen.","to include / involve"],
  ["einschränken","","—","Die Freiheit darf nicht eingeschränkt werden.","to restrict / limit"],
  ["entsprechen","","—","Das entspricht meinen Erwartungen.","to correspond to / meet"],
  ["erfordern","","—","Das erfordert viel Geduld.","to require"],
  ["ergeben","","—","Was ergibt das?","to result in / yield"],
  ["erkennen","","—","Ich erkenne das Problem.","to recognize / realize"],
  ["erweitern","","—","Wir wollen unser Angebot erweitern.","to expand / extend"],
  ["konzentrieren","","—","Konzentriere dich auf das Wesentliche.","to concentrate"],
  ["nachdenken","","—","Ich muss darüber nachdenken.","to think about / reflect"],
  ["überzeugen","","—","Er konnte mich nicht überzeugen.","to convince / persuade"],
  ["umgehen","","—","Wie geht man damit um?","to deal with / handle"],
  ["verdeutlichen","","—","Kannst du das verdeutlichen?","to clarify / illustrate"],
  ["vorhersagen","","—","Das Wetter lässt sich schwer vorhersagen.","to predict"],
  ["wahrnehmen","","—","Wie nimmst du die Situation wahr?","to perceive"],
  ["widerspiegeln","","—","Das widerspiegelt die Realität.","to reflect"],
  ["abstrakt","","—","Das Konzept ist sehr abstrakt.","abstract"],
  ["aktuell","","—","Das ist ein sehr aktuelles Thema.","current / up-to-date"],
  ["angemessen","","—","Das ist eine angemessene Reaktion.","appropriate / adequate"],
  ["anspruchsvoll","","—","Die Aufgabe ist sehr anspruchsvoll.","demanding / sophisticated"],
  ["ausreichend","","—","Sind die Mittel ausreichend?","sufficient / adequate"],
  ["bedeutend","","—","Er ist ein bedeutender Politiker.","significant / important"],
  ["bemerkenswert","","—","Das ist ein bemerkenswerter Fortschritt.","remarkable"],
  ["bewusst","","—","Er tut das bewusst.","conscious / deliberate / aware"],
  ["deutlich","","—","Das ist deutlich zu sehen.","clear / distinct"],
  ["effektiv","","—","Die Methode ist sehr effektiv.","effective"],
  ["effizient","","—","Sie arbeitet sehr effizient.","efficient"],
  ["eindeutig","","—","Das Ergebnis ist eindeutig.","clear / unambiguous"],
  ["einheitlich","","—","Wir brauchen eine einheitliche Regelung.","uniform / consistent"],
  ["erheblich","","—","Das ist ein erheblicher Unterschied.","considerable / significant"],
  ["erkennbar","","—","Der Fortschritt ist erkennbar.","recognizable / noticeable"],
  ["erstaunlich","","—","Das ist ein erstaunliches Ergebnis.","astonishing / amazing"],
  ["fortschrittlich","","—","Das ist eine fortschrittliche Idee.","progressive / advanced"],
  ["fundamental","","—","Das ist ein fundamentaler Fehler.","fundamental"],
  ["gesellschaftlich","","—","Das ist ein gesellschaftliches Problem.","social"],
  ["global","","—","Das ist ein globales Problem.","global"],
  ["gründlich","","—","Er hat das gründlich untersucht.","thorough"],
  ["inhaltlich","","—","Inhaltlich stimme ich dir zu.","in terms of content"],
  ["intensiv","","—","Er betreibt intensives Studium.","intensive"],
  ["komplex","","—","Das ist ein sehr komplexes Thema.","complex"],
  ["konstruktiv","","—","Das ist eine konstruktive Kritik.","constructive"],
  ["kontrovers","","—","Das Thema ist sehr kontrovers.","controversial"],
  ["kritisch","","—","Er hat eine kritische Haltung.","critical"],
  ["kulturell","","—","Das ist ein kulturelles Missverständnis.","cultural"],
  ["nachhaltig","","—","Wir brauchen nachhaltige Lösungen.","sustainable"],
  ["notwendig","","—","Das ist notwendig.","necessary"],
  ["objektiv","","—","Bitte bleib objektiv.","objective"],
  ["ökologisch","","—","Das ist eine ökologische Katastrophe.","ecological"],
  ["ökonomisch","","—","Das hat ökonomische Konsequenzen.","economic"],
  ["persönlich","","—","Das ist meine persönliche Meinung.","personal"],
  ["politisch","","—","Das ist eine politische Entscheidung.","political"],
  ["praktisch","","—","Das ist eine praktische Lösung.","practical"],
  ["präzise","","—","Bitte drücke dich präziser aus.","precise"],
  ["problematisch","","—","Das ist sehr problematisch.","problematic"],
  ["produktiv","","—","Der Tag war sehr produktiv.","productive"],
  ["professionell","","—","Er arbeitet sehr professionell.","professional"],
  ["relevant","","—","Das ist ein relevantes Detail.","relevant"],
  ["sachlich","","—","Bleib sachlich in der Diskussion.","factual / objective"],
  ["sinnvoll","","—","Das ist eine sinnvolle Maßnahme.","sensible / meaningful"],
  ["sozial","","—","Das ist ein soziales Problem.","social"],
  ["strukturell","","—","Das ist ein strukturelles Problem.","structural"],
  ["subjektiv","","—","Das ist eine subjektive Meinung.","subjective"],
  ["systematisch","","—","Er geht sehr systematisch vor.","systematic"],
  ["technisch","","—","Das ist ein technisches Problem.","technical"],
  ["theoretisch","","—","Theoretisch ist das möglich.","theoretical"],
  ["typisch","","—","Das ist typisch deutsch.","typical"],
  ["umfangreich","","—","Das ist eine umfangreiche Arbeit.","extensive / comprehensive"],
  ["umfassend","","—","Er hat eine umfassende Ausbildung.","comprehensive"],
  ["unbedingt","","—","Das müssen wir unbedingt tun.","absolutely / by all means"],
  ["ursprünglich","","—","Ursprünglich war das nicht geplant.","originally"],
  ["verantwortlich","","—","Er ist dafür verantwortlich.","responsible"],
  ["vergleichbar","","—","Die Ergebnisse sind vergleichbar.","comparable"],
  ["wesentlich","","—","Das ist wesentlich besser.","essential / considerably"],
  ["wirtschaftlich","","—","Das ist wirtschaftlich nicht sinnvoll.","economic / financially"],
  ["wissenschaftlich","","—","Das ist nicht wissenschaftlich belegt.","scientific"],
  ["zunächst","","—","Zunächst möchte ich mich vorstellen.","first of all / initially"],
  ["zweifellos","","—","Das ist zweifellos richtig.","undoubtedly"],
  ["allerdings","","—","Das stimmt, allerdings gibt es Ausnahmen.","however / though / admittedly"],
  ["andererseits","","—","Andererseits hat das auch Vorteile.","on the other hand"],
  ["anscheinend","","—","Er ist anscheinend krank.","apparently"],
  ["ausdrücklich","","—","Er hat das ausdrücklich verboten.","explicitly"],
  ["ausgerechnet","","—","Ausgerechnet heute muss es regnen.","of all things / precisely"],
  ["bekanntlich","","—","Deutschland ist bekanntlich für sein Bier bekannt.","as is well known"],
  ["bereits","","—","Das habe ich bereits gewusst.","already"],
  ["dabei","","—","Dabei muss man vorsichtig sein.","in doing so / at the same time"],
  ["dadurch","","—","Dadurch hat sich die Situation verbessert.","thereby / as a result"],
  ["dagegen","","—","Er ist dagegen.","against it / on the other hand"],
  ["daher","","—","Daher ist das wichtig.","therefore / hence"],
  ["damit","","—","Er lernt, damit er Erfolg hat.","so that / with it"],
  ["daran","","—","Ich zweifle daran.","at/on/about it"],
  ["darauf","","—","Darauf kommt es an.","on it / thereof"],
  ["daraus","","—","Was schließt du daraus?","from it / out of it"],
  ["darüber","","—","Darüber müssen wir reden.","about it / over it"],
  ["darum","","—","Darum geht es mir nicht.","about that / therefore"],
  ["demnach","","—","Demnach ist die Situation ernst.","accordingly / therefore"],
  ["dennoch","","—","Dennoch halte ich das für richtig.","nevertheless"],
  ["doch","","—","Das stimmt doch nicht.","but / yet / however / after all"],
  ["ebenso","","—","Das gilt ebenso für den anderen Fall.","likewise / equally"],
  ["einerseits","","—","Einerseits hat das Vorteile.","on the one hand"],
  ["entsprechend","","—","Handle entsprechend.","accordingly / appropriate"],
  ["erst","","—","Das habe ich erst jetzt erfahren.","only / not until / first"],
  ["falls","","—","Falls es regnet, bleiben wir zu Hause.","in case / if"],
  ["folglich","","—","Folglich müssen wir handeln.","consequently"],
  ["gerade","","—","Das habe ich gerade erledigt.","just now / straight / precisely"],
  ["immerhin","","—","Immerhin hat er es versucht.","at least / after all"],
  ["immer noch","","—","Er wartet immer noch.","still"],
  ["indem","","—","Er lernt, indem er Karteikarten benutzt.","by (doing something)"],
  ["infolgedessen","","—","Infolgedessen mussten wir handeln.","as a result / consequently"],
  ["insbesondere","","—","Das gilt insbesondere für junge Menschen.","in particular / especially"],
  ["insgesamt","","—","Insgesamt war es ein Erfolg.","overall / in total"],
  ["inwieweit","","—","Inwieweit stimmt das?","to what extent"],
  ["jedenfalls","","—","Jedenfalls war es eine Erfahrung.","in any case / at any rate"],
  ["jedoch","","—","Das ist jedoch nicht so einfach.","however / yet"],
  ["kaum","","—","Er hat kaum geschlafen.","hardly / barely"],
  ["keineswegs","","—","Das ist keineswegs selbstverständlich.","by no means"],
  ["letztendlich","","—","Letztendlich kommt es auf das Ergebnis an.","ultimately / in the end"],
  ["möglicherweise","","—","Das ist möglicherweise falsch.","possibly"],
  ["nachdem","","—","Nachdem er gegessen hatte, schlief er.","after"],
  ["nämlich","","—","Er kommt nicht, er ist nämlich krank.","namely / you see"],
  ["obwohl","","—","Obwohl es schwer ist, versuche ich es.","although / even though"],
  ["offenbar","","—","Er ist offenbar nicht informiert.","apparently / evidently"],
  ["ohnehin","","—","Das war ohnehin klar.","anyway / in any case"],
  ["schließlich","","—","Schließlich haben wir eine Lösung gefunden.","finally / after all"],
  ["selbstverständlich","","—","Das ist doch selbstverständlich.","of course / naturally"],
  ["sobald","","—","Sobald er kommt, rufe ich dich an.","as soon as"],
  ["sofern","","—","Sofern du einverstanden bist, machen wir das so.","provided that / as long as"],
  ["sondern","","—","Er ist kein Lehrer, sondern Arzt.","but rather"],
  ["soweit","","—","Soweit ich weiß, stimmt das.","as far as"],
  ["sowohl … als auch","","—","Das gilt sowohl für Kinder als auch für Erwachsene.","both … and"],
  ["stattdessen","","—","Er kam nicht, stattdessen schickte er eine Nachricht.","instead"],
  ["tatsächlich","","—","Das ist tatsächlich passiert.","actually / indeed"],
  ["überhaupt","","—","Warum bist du überhaupt hier?","at all / in general"],
  ["übrigens","","—","Übrigens, hast du schon von ihm gehört?","by the way"],
  ["vorher","","—","Lass mich das vorher erledigen.","beforehand / before that"],
  ["weder … noch","","—","Er trinkt weder Alkohol noch raucht er.","neither … nor"],
  ["weil","","—","Ich bleibe zu Hause, weil ich krank bin.","because"],
  ["wenn auch","","—","Wenn auch schwierig, ist es möglich.","even if / although"],
  ["wenngleich","","—","Wenngleich das wahr ist, ändert es nichts.","even though / although"],
  ["wiederum","","—","Das wiederum ist fraglich.","in turn / on the other hand"],
  ["wobei","","—","Wobei man beachten muss, dass…","whereby / in which / while"],
  ["worauf","","—","Worauf wartest du?","what … on / whereupon"],
  ["zumindest","","—","Zumindest hat er es versucht.","at least"],
  ["zunehmend","","—","Das Problem wird zunehmend größer.","increasingly"],
  ["zwar","","—","Zwar ist das schwierig, aber möglich.","it's true that / admittedly"],
  ["zwar … aber","","—","Das ist zwar teuer, aber qualitativ hochwertig.","it's true … but"],
  ["Ausmaß","das","Ausmaße","Das Ausmaß des Schadens ist enorm.","extent / scale"],
  ["Auswirkung","die","Auswirkungen","Die Auswirkungen sind noch nicht absehbar.","impact / effect"],
  ["Bezug","der","Bezüge","In Bezug auf das Thema ist er Experte.","reference / relation"],
  ["Darstellung","die","Darstellungen","Die Darstellung der Fakten ist verzerrt.","presentation / depiction"],
  ["Einschätzung","die","Einschätzungen","Was ist deine Einschätzung der Lage?","assessment / estimation"],
  ["Gesichtspunkt","der","Gesichtspunkte","Aus diesem Gesichtspunkt betrachtet, stimmt das.","viewpoint / perspective"],
  ["Kernpunkt","der","Kernpunkte","Das ist der Kernpunkt der Diskussion.","key point / crux"],
  ["Merkmal","das","Merkmale","Das ist ein typisches Merkmal.","feature / characteristic"],
  ["Phänomen","das","Phänomene","Das ist ein interessantes Phänomen.","phenomenon"],
  ["Schlussfolgerung","die","Schlussfolgerungen","Die Schlussfolgerung ist logisch.","conclusion / inference"],
  ["Schwerpunkt","der","Schwerpunkte","Der Schwerpunkt liegt auf der Forschung.","focus / main point"],
  ["Stellenwert","der","Stellenwerte","Bildung hat einen hohen Stellenwert.","importance / value / status"],
  ["Tendenz","die","Tendenzen","Es gibt eine Tendenz zur Digitalisierung.","tendency / trend"],
  ["Überzeugung","die","Überzeugungen","Das ist meine feste Überzeugung.","conviction / belief"],
  ["Voraussetzung","die","Voraussetzungen","Das ist eine wichtige Voraussetzung.","prerequisite / condition"],
  ["Widerspruch","der","Widersprüche","Das ist ein innerer Widerspruch.","contradiction"],
  ["Zweck","der","Zwecke","Was ist der Zweck dieser Maßnahme?","purpose / aim"],
  ["Wohlfahrt","die","—","Die Wohlfahrt der Gesellschaft ist wichtig.","welfare"],
  ["Fürsorge","die","—","Die staatliche Fürsorge muss verbessert werden.","care / welfare"],
  ["Krankenversicherung","die","Krankenversicherungen","Ich habe eine gesetzliche Krankenversicherung.","health insurance"],
  ["Rentenversicherung","die","—","Die Rentenversicherung sichert das Alter.","pension insurance"],
  ["Pflegeversicherung","die","—","Die Pflegeversicherung unterstützt Bedürftige.","long-term care insurance"],
  ["Sozialhilfe","die","—","Er bezieht Sozialhilfe vom Staat.","social welfare"],
  ["Kindergeld","das","—","Für jedes Kind gibt es Kindergeld.","child benefit"],
  ["Elterngeld","das","—","Elterngeld wird für ein Jahr gezahlt.","parental allowance"],
  ["Wohngeld","das","—","Er bekommt Wohngeld vom Staat.","housing benefit"],
  ["Arbeitslosengeld","das","—","Das Arbeitslosengeld läuft nach zwölf Monaten aus.","unemployment benefit"],
  ["Grundeinkommen","das","—","Das bedingungslose Grundeinkommen wird diskutiert.","basic income"],
  ["Mindestlohn","der","—","Der Mindestlohn wurde erhöht.","minimum wage"],
  ["Tarifvertrag","der","Tarifverträge","Der Tarifvertrag regelt die Löhne.","collective agreement"],
  ["Beamter","der","Beamte","Als Beamter hat er bestimmte Privilegien.","civil servant"],
  ["Verwaltung","die","Verwaltungen","Die Verwaltung muss effizienter werden.","administration"],
  ["Bürokratie","die","—","Die Bürokratie ist manchmal überwältigend.","bureaucracy"],
  ["Behörde","die","Behörden","Die Behörde hat den Antrag abgelehnt.","authority / government office"],
  ["Amt","das","Ämter","Er ist seit Jahren im Amt.","office / authority"],
  ["Beitrag","der","Beiträge","Der monatliche Beitrag beträgt 200 Euro.","contribution / article / fee"],
  ["Anspruch","der","Ansprüche","Er hat Anspruch auf Arbeitslosengeld.","claim / entitlement"],
  ["Wahrnehmung","die","Wahrnehmungen","Die Wahrnehmung der Realität ist subjektiv.","perception"],
  ["Illusion","die","Illusionen","Das ist eine Illusion.","illusion"],
  ["Abstraktion","die","Abstraktionen","Das ist eine hohe Stufe der Abstraktion.","abstraction"],
  ["Dogma","das","Dogmen","Er hält starr an seinen Dogmen fest.","dogma"],
  ["Ideologie","die","Ideologien","Jede Ideologie hat ihre Grenzen.","ideology"],
  ["Weltanschauung","die","Weltanschauungen","Seine Weltanschauung ist sehr konservativ.","worldview / ideology"],
  ["Paradigma","das","Paradigmen","Das ist ein Paradigmenwechsel.","paradigm"],
  ["Dialektik","die","—","Die Dialektik ist eine Methode des Denkens.","dialectics"],
  ["Ontologie","die","—","Die Ontologie beschäftigt sich mit dem Sein.","ontology"],
  ["Erkenntnistheorie","die","—","Die Erkenntnistheorie fragt nach dem Wissen.","epistemology"],
  ["Zivilisation","die","Zivilisationen","Die Zivilisation hat sich lange entwickelt.","civilization"],
  ["Antike","die","—","Die Antike hat unsere Kultur geprägt.","antiquity"],
  ["Mittelalter","das","—","Im Mittelalter war die Kirche sehr mächtig.","Middle Ages"],
  ["Renaissance","die","—","Die Renaissance war eine Blütezeit der Kunst.","Renaissance"],
  ["Revolution","die","Revolutionen","Die Französische Revolution veränderte Europa.","revolution"],
  ["Aufklärung","die","—","Die Aufklärung brachte neue Ideen.","Enlightenment"],
  ["Industrialisierung","die","—","Die Industrialisierung begann im 18. Jahrhundert.","industrialization"],
  ["Kolonialismus","der","—","Der Kolonialismus hatte schlimme Folgen.","colonialism"],
  ["Holocaust","der","—","Der Holocaust ist ein dunkles Kapitel der Geschichte.","Holocaust"],
  ["Wiedervereinigung","die","—","Die Wiedervereinigung Deutschlands war 1990.","reunification"],
  ["Diktatur","die","Diktaturen","In einer Diktatur gibt es keine Pressefreiheit.","dictatorship"],
  ["Totalitarismus","der","—","Der Totalitarismus unterdrückt alle Freiheiten.","totalitarianism"],
  ["Imperialismus","der","—","Der Imperialismus des 19. Jahrhunderts hatte weitreichende Folgen.","imperialism"],
  ["Nationalismus","der","—","Nationalismus kann gefährlich sein.","nationalism"],
  ["Patriotismus","der","—","Er zeigt einen gesunden Patriotismus.","patriotism"],
  ["Erbe","das","Erben","Das kulturelle Erbe muss bewahrt werden.","heritage / inheritance"],
  ["Gedenkstätte","die","Gedenkstätten","Die Gedenkstätte erinnert an die Vergangenheit.","memorial site"],
  ["Archiv","das","Archive","Die Dokumente befinden sich im Archiv.","archive"],
  ["Materie","die","Materien","Materie und Energie sind untrennbar.","matter"],
  ["Kraft","die","Kräfte","Welche Kräfte wirken hier?","force / power / strength"],
  ["Schwerkraft","die","—","Die Schwerkraft hält uns auf der Erde.","gravity"],
  ["Licht","das","Lichter","Licht ist eine elektromagnetische Welle.","light"],
  ["Welle","die","Wellen","Licht breitet sich in Wellen aus.","wave"],
  ["Teilchen","das","Teilchen","Das Atom besteht aus Teilchen.","particle"],
  ["Elektron","das","Elektronen","Das Elektron ist negativ geladen.","electron"],
  ["Proton","das","Protonen","Das Proton befindet sich im Kern.","proton"],
  ["Neutron","das","Neutronen","Das Neutron hat keine Ladung.","neutron"],
  ["Molekül","das","Moleküle","Wasser besteht aus H₂O-Molekülen.","molecule"],
  ["Atom","das","Atome","Das Atom ist die kleinste Einheit.","atom"],
  ["Element","das","Elemente","Sauerstoff ist ein chemisches Element.","element"],
  ["Reaktion","die","Reaktionen","Die chemische Reaktion ist exotherm.","reaction"],
  ["Säure","die","Säuren","Zitronensäure macht den Saft sauer.","acid"],
  ["Gen","das","Gene","Gene bestimmen unsere Eigenschaften.","gene"],
  ["DNA","die","—","Die DNA trägt die Erbinformationen.","DNA"],
  ["Zelle","die","Zellen","Der menschliche Körper hat Billionen von Zellen.","cell"],
  ["Organ","das","Organe","Das Organ muss transplantiert werden.","organ"],
  ["Gehirn","das","Gehirne","Das Gehirn ist unser Kontrollzentrum.","brain"],
  ["Nervensystem","das","Nervensysteme","Das Nervensystem steuert den Körper.","nervous system"],
  ["Hormon","das","Hormone","Hormone regulieren viele Körperfunktionen.","hormone"],
  ["Immunsystem","das","Immunsysteme","Das Immunsystem schützt uns vor Krankheiten.","immune system"],
  ["Evolution","die","—","Die Evolution erklärt die Vielfalt des Lebens.","evolution"],
  ["Ökologie","die","—","Die Ökologie untersucht Lebensräume.","ecology"],
  ["Fotosynthese","die","—","Pflanzen betreiben Fotosynthese.","photosynthesis"],
  ["ableiten","","—","Daraus können wir eine Schlussfolgerung ableiten.","to derive / deduce"],
  ["anerkennen","","—","Er wurde als Experte anerkannt.","to recognize / acknowledge"],
  ["behaupten","","—","Er behauptet, die Wahrheit zu kennen.","to claim / assert"],
  ["beraten","","—","Der Arzt berät den Patienten.","to advise / consult"],
  ["bestätigen","","—","Die Studie bestätigt die Hypothese.","to confirm"],
  ["bezweifeln","","—","Ich bezweifle das.","to doubt"],
  ["definieren","","—","Definiere bitte den Begriff.","to define"],
  ["einräumen","","—","Er räumte seinen Fehler ein.","to admit / concede"],
  ["entstehen","","—","Daraus entsteht ein Konflikt.","to arise / develop"],
  ["erfassen","","—","Die Studie erfasst alle Aspekte.","to capture / comprehend / record"],
  ["erläutern","","—","Kannst du das näher erläutern?","to explain / elaborate"],
  ["erwähnen","","—","Er hat das kurz erwähnt.","to mention"],
  ["festhalten","","—","Ich möchte das festhalten.","to note / maintain / hold on to"],
  ["formulieren","","—","Kannst du das besser formulieren?","to formulate"],
  ["hinterfragen","","—","Wir müssen das hinterfragen.","to question / critically examine"],
  ["illustrieren","","—","Das illustriert das Problem.","to illustrate"],
  ["implizieren","","—","Was impliziert das?","to imply"],
  ["kennzeichnen","","—","Das kennzeichnet den Unterschied.","to characterize / mark"],
  ["konzipieren","","—","Das Projekt wurde gut konzipiert.","to design / conceive"],
  ["offenlegen","","—","Die Daten wurden offengelegt.","to disclose / reveal"],
  ["problematisieren","","—","Man muss das problematisieren.","to problematize"],
  ["relativieren","","—","Das relativiert die Aussage.","to put into perspective / relativize"],
  ["strukturieren","","—","Der Text ist gut strukturiert.","to structure"],
  ["thematisieren","","—","Das Thema wird in dem Buch thematisiert.","to address / deal with a topic"],
  ["überdenken","","—","Ich muss das überdenken.","to reconsider"],
  ["übergehen","","—","Das wurde im Bericht übergangen.","to skip / pass over"],
  ["überprüfen","","—","Bitte überprüfe die Daten.","to check / verify"],
  ["verdrängen","","—","Das Problem wurde verdrängt.","to displace / repress / push out"],
  ["vernachlässigen","","—","Das darf nicht vernachlässigt werden.","to neglect"],
  ["verweisen","","—","Ich verweise auf den Artikel.","to refer / point"],
  ["voraussetzen","","—","Das setzt Kenntnisse voraus.","to presuppose / require"],
  ["vorgehen","","—","Wie sollen wir vorgehen?","to proceed / go about"],
  ["weitergehen","","—","So kann es nicht weitergehen.","to continue / go on"],
  ["zuordnen","","—","Ordne die Begriffe den Kategorien zu.","to assign / categorize"],
  ["zurückführen","","—","Das lässt sich auf diesen Faktor zurückführen.","to attribute / trace back to"],
  ["ambivalent","","—","Ich habe ein ambivalentes Gefühl dabei.","ambivalent"],
  ["aufschlussreich","","—","Das Experiment war sehr aufschlussreich.","informative / revealing"],
  ["ausgewogen","","—","Der Bericht ist sehr ausgewogen.","balanced"],
  ["bahnbrechend","","—","Das ist eine bahnbrechende Entdeckung.","groundbreaking"],
  ["beachtlich","","—","Das ist ein beachtlicher Fortschritt.","considerable / noteworthy"],
  ["dringend","","—","Das ist eine dringende Angelegenheit.","urgent"],
  ["eindringlich","","—","Er sprach sehr eindringlich.","urgently / impressively"],
  ["einflussreich","","—","Er ist ein sehr einflussreicher Politiker.","influential"],
  ["eingehend","","—","Er hat das eingehend untersucht.","thorough / in depth"],
  ["entspannend","","—","Musik ist sehr entspannend.","relaxing"],
  ["erhellend","","—","Das Gespräch war sehr erhellend.","enlightening / illuminating"],
  ["erschöpfend","","—","Die Antwort ist erschöpfend.","exhaustive / comprehensive"],
  ["folgenschwer","","—","Das war eine folgenschwere Entscheidung.","far-reaching / consequential"],
  ["fundiert","","—","Das ist eine fundierte Kritik.","well-founded / solid"],
  ["herausragend","","—","Das ist eine herausragende Leistung.","outstanding / exceptional"],
  ["innovativ","","—","Das ist ein innovativer Ansatz.","innovative"],
  ["kompetent","","—","Er ist sehr kompetent auf diesem Gebiet.","competent"],
  ["kontextabhängig","","—","Das ist sehr kontextabhängig.","context-dependent"],
  ["kurzfristig","","—","Das ist eine kurzfristige Lösung.","short-term"],
  ["langfristig","","—","Wir brauchen eine langfristige Strategie.","long-term"],
  ["maßgeblich","","—","Das ist ein maßgeblicher Faktor.","decisive / authoritative"],
  ["mittelfristig","","—","Mittelfristig wird sich das ändern.","medium-term"],
  ["naheliegend","","—","Das ist die naheliegendste Lösung.","obvious / natural"],
  ["nüchtern","","—","Er betrachtet die Dinge sehr nüchtern.","sober / matter-of-fact"],
  ["offensichtlich","","—","Das ist offensichtlich falsch.","obvious / evident"],
  ["plausibel","","—","Das klingt plausibel.","plausible"],
  ["prägnant","","—","Er drückt sich sehr prägnant aus.","concise / succinct"],
  ["qualitativ","","—","Das ist qualitativ sehr hochwertig.","qualitative"],
  ["quantitativ","","—","Das sind quantitativ beeindruckende Zahlen.","quantitative"],
  ["schlüssig","","—","Die Argumentation ist schlüssig.","conclusive / consistent / logical"],
  ["stichhaltig","","—","Das ist ein stichhaltiges Argument.","valid / sound"],
  ["tiefgründig","","—","Das ist eine tiefgründige Analyse.","profound / in-depth"],
  ["überzeugend","","—","Seine Argumentation war sehr überzeugend.","convincing / persuasive"],
  ["umstritten","","—","Das Thema ist sehr umstritten.","controversial / disputed"],
  ["unbestritten","","—","Das ist unbestritten richtig.","undisputed"],
  ["unvermeidlich","","—","Das ist unvermeidlich.","inevitable"],
  ["vielschichtig","","—","Das ist ein vielschichtiges Thema.","multi-layered / complex"],
  ["vielfältig","","—","Das Angebot ist sehr vielfältig.","diverse / varied"],
  ["weitreichend","","—","Das hat weitreichende Konsequenzen.","far-reaching"],
  ["widersprüchlich","","—","Die Aussagen sind widersprüchlich.","contradictory"],
  ["zutreffend","","—","Das ist nicht zutreffend.","accurate / applicable"],
  ["zweckmäßig","","—","Das ist eine zweckmäßige Lösung.","appropriate / expedient"],
  ["Notaufnahme","die","Notaufnahmen","Er wurde in die Notaufnahme eingeliefert.","emergency room"],
  ["Intensivstation","die","Intensivstationen","Der Patient liegt auf der Intensivstation.","intensive care unit"],
  ["Rettungswagen","der","Rettungswagen","Der Rettungswagen kam in drei Minuten.","ambulance"],
  ["Blutdruck","der","—","Mein Blutdruck ist zu hoch.","blood pressure"],
  ["Herzinfarkt","der","Herzinfarkte","Er hat einen Herzinfarkt erlitten.","heart attack"],
  ["Schlaganfall","der","Schlaganfälle","Nach dem Schlaganfall ist er gelähmt.","stroke"],
  ["Diabetes","der","—","Er leidet an Diabetes.","diabetes"],
  ["Allergie","die","Allergien","Ich habe eine Allergie gegen Pollen.","allergy"],
  ["Asthma","das","—","Sie hat seit Kindheit Asthma.","asthma"],
  ["Depression","die","Depressionen","Depressionen sind eine ernste Erkrankung.","depression"],
  ["Burnout","das","—","Er erlitt einen Burnout.","burnout"],
  ["Physiotherapie","die","—","Nach der OP folgt Physiotherapie.","physiotherapy"],
  ["Psychotherapie","die","—","Er macht eine Psychotherapie.","psychotherapy"],
  ["Rehabilitation","die","Rehabilitationen","Die Rehabilitation dauert Monate.","rehabilitation"],
  ["Pfleger","der","Pfleger","Der Pfleger kümmert sich um die Patienten.","male nurse / carer"],
  ["Pflegerin","die","Pflegerinnen","Die Pflegerin ist sehr einfühlsam.","female nurse / carer"],
  ["Spezialist","der","Spezialisten","Er ist Spezialist für Herzkrankheiten.","specialist (male)"],
  ["Spezialistin","die","Spezialistinnen","Die Spezialistin ist sehr kompetent.","specialist (female)"],
  ["Gutachten","das","Gutachten","Das Gutachten bestätigt die Diagnose.","expert opinion / report"],
  ["Krankenakte","die","Krankenakten","Die Krankenakte enthält alle Informationen.","medical record"],
  ["Infrastruktur","die","Infrastrukturen","Die Infrastruktur des Landes ist gut.","infrastructure"],
  ["Stadtplanung","die","—","Die Stadtplanung muss nachhaltiger werden.","urban planning"],
  ["Bebauungsplan","der","Bebauungspläne","Der Bebauungsplan ist verbindlich.","development plan"],
  ["Hochhaus","das","Hochhäuser","Das Hochhaus hat 40 Etagen.","skyscraper"],
  ["Einfamilienhaus","das","Einfamilienhäuser","Sie wohnen in einem Einfamilienhaus.","detached house"],
  ["Reihenhaus","das","Reihenhäuser","Das Reihenhaus hat einen kleinen Garten.","terraced house"],
  ["Mietwohnung","die","Mietwohnungen","Ich wohne in einer Mietwohnung.","rented apartment"],
  ["Eigentumswohnung","die","Eigentumswohnungen","Er hat eine Eigentumswohnung gekauft.","owner-occupied apartment"],
  ["Neubau","der","Neubauten","Der Neubau wird nächstes Jahr fertig.","new building"],
  ["Altbau","der","Altbauten","Altbauwohnungen haben hohe Decken.","old building"],
  ["Denkmalschutz","der","—","Das Gebäude steht unter Denkmalschutz.","listed building protection"],
  ["Sanierung","die","Sanierungen","Die Sanierung des Hauses dauert sechs Monate.","renovation / refurbishment"],
  ["Renovierung","die","Renovierungen","Nach der Renovierung sieht die Wohnung toll aus.","renovation"],
  ["Grundriss","der","Grundrisse","Der Grundriss der Wohnung ist gut durchdacht.","floor plan"],
  ["Management","das","—","Das Management hat neue Ziele gesetzt.","management"],
  ["Führungsstil","der","Führungsstile","Sein Führungsstil ist sehr kooperativ.","management style"],
  ["Unternehmenskultur","die","—","Die Unternehmenskultur ist sehr offen.","corporate culture"],
  ["Leitbild","das","Leitbilder","Das Leitbild des Unternehmens ist klar.","mission statement"],
  ["Marketing","das","—","Das Marketing des Produkts war erfolgreich.","marketing"],
  ["Kampagne","die","Kampagnen","Die Werbekampagne war sehr erfolgreich.","campaign"],
  ["Zielgruppe","die","Zielgruppen","Die Zielgruppe sind junge Erwachsene.","target group"],
  ["Marktanteil","der","Marktanteile","Der Marktanteil ist gestiegen.","market share"],
  ["Umsatz","der","Umsätze","Der Umsatz ist dieses Jahr gestiegen.","revenue / turnover"],
  ["Gewinn","der","Gewinne","Der Gewinn hat sich verdoppelt.","profit"],
  ["Verlust","der","Verluste","Das Unternehmen schreibt Verluste.","loss"],
  ["Budget","das","Budgets","Das Budget reicht nicht aus.","budget"],
  ["Kosten","die","—","Die Kosten sind zu hoch.","costs"],
  ["Ausgaben","die","—","Die Ausgaben müssen reduziert werden.","expenditure / expenses"],
  ["Einnahmen","die","—","Die Einnahmen sind gestiegen.","income / revenue"],
  ["Bilanz","die","Bilanzen","Die Bilanz ist positiv.","balance sheet"],
  ["Jahresbericht","der","Jahresberichte","Der Jahresbericht ist veröffentlicht.","annual report"],
  ["Aktionär","der","Aktionäre","Die Aktionäre sind zufrieden.","shareholder"],
  ["Vorstand","der","Vorstände","Der Vorstand trifft die wichtigen Entscheidungen.","board of directors"],
  ["Aufsichtsrat","der","Aufsichtsräte","Der Aufsichtsrat kontrolliert den Vorstand.","supervisory board"],
  ["Geschäftsführer","der","Geschäftsführer","Der Geschäftsführer hat das Unternehmen gegründet.","managing director"],
  ["Lieferant","der","Lieferanten","Der Lieferant kommt jeden Dienstag.","supplier"],
  ["Abnehmer","der","Abnehmer","Wir suchen neue Abnehmer.","customer / buyer"],
  ["Kooperation","die","Kooperationen","Eine Kooperation wäre sinnvoll.","cooperation"],
  ["Fusion","die","Fusionen","Die Fusion beider Unternehmen ist geplant.","merger"],
  ["Übernahme","die","Übernahmen","Die feindliche Übernahme scheiterte.","takeover / acquisition"],
  ["Insolvenz","die","Insolvenzen","Das Unternehmen hat Insolvenz angemeldet.","insolvency"],
  ["Start-up","das","Start-ups","Das Start-up wächst sehr schnell.","start-up"],
  ["Programmierung","die","—","Programmierung ist eine wichtige Fähigkeit.","programming"],
  ["Quellcode","der","—","Der Quellcode ist gut kommentiert.","source code"],
  ["Schnittstelle","die","Schnittstellen","Die Schnittstelle zwischen den Systemen ist komplex.","interface"],
  ["Plattform","die","Plattformen","Die Plattform hat Millionen Nutzer.","platform"],
  ["Benutzer","der","Benutzer","Der Benutzer kann die Einstellungen ändern.","user"],
  ["Nutzer","der","Nutzer","Die Nutzer der App sind sehr aktiv.","user"],
  ["Profil","das","Profile","Er hat sein Profil aktualisiert.","profile"],
  ["Verschlüsselung","die","—","Die Datenverschlüsselung schützt private Daten.","encryption"],
  ["Backup","das","Backups","Mach regelmäßig ein Backup.","backup"],
  ["Update","das","Updates","Das Update enthält wichtige Sicherheitspatches.","update"],
  ["Download","der","Downloads","Der Download dauert noch ein paar Minuten.","download"],
  ["Upload","der","Uploads","Der Upload war erfolgreich.","upload"],
  ["Streaming","das","—","Streaming hat den Musikmarkt verändert.","streaming"],
  ["Cloud","die","Clouds","Die Daten sind in der Cloud gespeichert.","cloud"],
  ["Server","der","Server","Der Server ist überlastet.","server"],
  ["Browser","der","Browser","Bitte aktualisiere deinen Browser.","browser"],
  ["Suchmaschine","die","Suchmaschinen","Suchmaschinen haben das Internet verändert.","search engine"],
  ["Soziales Netzwerk","das","Sozialen Netzwerke","Soziale Netzwerke sind allgegenwärtig.","social network"],
  ["Influencer","der","Influencer","Der Influencer hat viele Follower.","influencer"],
  ["Hacker","der","Hacker","Der Hacker hat die Daten gestohlen.","hacker"],
  ["Firewall","die","Firewalls","Eine Firewall schützt das Netzwerk.","firewall"],
  ["Chip","der","Chips","Der Chip ist sehr leistungsfähig.","chip"],
  ["Prozessor","der","Prozessoren","Der Prozessor ist zu langsam.","processor"],
  ["Identität","die","Identitäten","Die nationale Identität ist wichtig.","identity"],
  ["Selbstbild","das","Selbstbilder","Sein Selbstbild ist sehr positiv.","self-image"],
  ["Vorurteil","das","Vorurteile","Vorurteile sollten abgebaut werden.","prejudice"],
  ["Stereotyp","das","Stereotype","Stereotype sind oft falsch.","stereotype"],
  ["Diskriminierung","die","Diskriminierungen","Diskriminierung darf nicht toleriert werden.","discrimination"],
  ["Rassismus","der","—","Rassismus ist ein globales Problem.","racism"],
  ["Sexismus","der","—","Sexismus am Arbeitsplatz muss bekämpft werden.","sexism"],
  ["Homophobie","die","—","Homophobie hat keinen Platz in unserer Gesellschaft.","homophobia"],
  ["Diversität","die","—","Diversität bereichert uns alle.","diversity"],
  ["Inklusion","die","—","Inklusion ist ein wichtiges Ziel.","inclusion"],
  ["Toleranz","die","—","Toleranz ist eine Grundlage der Demokratie.","tolerance"],
  ["Intoleranz","die","—","Intoleranz gefährdet den Frieden.","intolerance"],
  ["Akzeptanz","die","—","Akzeptanz ist wichtig für das Wohlbefinden.","acceptance"],
  ["Ablehnung","die","Ablehnungen","Die Ablehnung schmerzt ihn sehr.","rejection"],
  ["Ausgrenzung","die","Ausgrenzungen","Ausgrenzung hat langfristige Folgen.","exclusion / marginalization"],
  ["Zugehörigkeit","die","—","Das Gefühl der Zugehörigkeit ist wichtig.","sense of belonging"],
  ["Gemeinsamkeit","die","Gemeinsamkeiten","Wir haben viele Gemeinsamkeiten.","commonality / shared trait"],
  ["Mediation","die","Mediationen","Die Mediation hat geholfen.","mediation"],
  ["abwägen","","—","Man muss die Vor- und Nachteile abwägen.","to weigh up"],
  ["andeuten","","—","Was willst du damit andeuten?","to hint at / suggest"],
  ["aufzeigen","","—","Die Studie zeigt die Probleme auf.","to demonstrate / show"],
  ["auseinandernehmen","","—","Er hat das Argument auseinandergenommen.","to take apart / dismantle"],
  ["bedingen","","—","A bedingt B.","to cause / necessitate"],
  ["beeinträchtigen","","—","Das Lärm beeinträchtigt die Konzentration.","to impair / affect negatively"],
  ["belegen","","—","Kannst du das belegen?","to prove / demonstrate / support"],
  ["einleiten","","—","Der Richter leitete das Verfahren ein.","to initiate / introduce"],
  ["erschließen","","—","Neue Märkte sollen erschlossen werden.","to open up / access"],
  ["evaluieren","","—","Das Projekt wird evaluiert.","to evaluate"],
  ["hervorgehen","","—","Daraus geht hervor, dass…","to emerge / result from"],
  ["integrieren","","—","Er wurde gut in die Gruppe integriert.","to integrate"],
  ["manifestieren","","—","Das manifestiert sich in verschiedener Weise.","to manifest"],
  ["modifizieren","","—","Das Konzept muss modifiziert werden.","to modify"],
  ["optimieren","","—","Wir müssen den Prozess optimieren.","to optimize"],
  ["pauschalisieren","","—","Man sollte nicht pauschalisieren.","to generalize broadly"],
  ["plädieren","","—","Er plädiert für eine friedliche Lösung.","to plead for / advocate"],
  ["priorisieren","","—","Wir müssen die Aufgaben priorisieren.","to prioritize"],
  ["qualifizieren","","—","Er hat sich für den Job qualifiziert.","to qualify"],
  ["quantifizieren","","—","Das lässt sich schwer quantifizieren.","to quantify"],
  ["reflektieren","","—","Man sollte regelmäßig reflektieren.","to reflect"],
  ["reformieren","","—","Das System muss reformiert werden.","to reform"],
  ["regulieren","","—","Der Markt wird vom Staat reguliert.","to regulate"],
  ["revidieren","","—","Er musste seine Meinung revidieren.","to revise"],
  ["stabilisieren","","—","Die Lage hat sich stabilisiert.","to stabilize"],
  ["stimulieren","","—","Das stimuliert die Wirtschaft.","to stimulate"],
  ["transformieren","","—","Die Digitalisierung transformiert die Gesellschaft.","to transform"],
  ["validieren","","—","Die Ergebnisse wurden validiert.","to validate"],
  ["veranschaulichen","","—","Das veranschaulicht das Problem sehr gut.","to illustrate / demonstrate"],
  ["verfügen","","—","Er verfügt über viel Erfahrung.","to have at one's disposal"],
  ["verknüpfen","","—","Wie lassen sich die beiden Konzepte verknüpfen?","to link / connect"],
  ["vermitteln","","—","Er vermittelt zwischen den Parteien.","to mediate / convey"],
  ["widmmen","","—","Er widmet sich ganz seiner Arbeit.","to dedicate (oneself)"],
  ["zurückweisen","","—","Er wies die Kritik zurück.","to reject / dismiss"],
  ["ausgeprägt","","—","Er hat eine ausgeprägte Persönlichkeit.","pronounced / strong"],
  ["ausschlaggebend","","—","Das war der ausschlaggebende Faktor.","decisive / determining"],
  ["beschränkt","","—","Die Ressourcen sind beschränkt.","limited / restricted"],
  ["bezeichnend","","—","Das ist bezeichnend für sein Verhalten.","characteristic / telling"],
  ["eindimensional","","—","Die Analyse ist zu eindimensional.","one-dimensional"],
  ["eigenständig","","—","Er hat eigenständig gearbeitet.","independent / autonomous"],
  ["einschlägig","","—","Er hat einschlägige Erfahrung.","relevant / pertinent"],
  ["exemplarisch","","—","Das ist exemplarisch für das Problem.","exemplary / representative"],
  ["fachübergreifend","","—","Das ist ein fachübergreifendes Thema.","interdisciplinary"],
  ["folgerichtig","","—","Das ist eine folgerichtige Entscheidung.","logical / consistent"],
  ["gewichtig","","—","Das ist ein gewichtiges Argument.","weighty / significant"],
  ["gleichwertig","","—","Beide Optionen sind gleichwertig.","equivalent"],
  ["grundlegend","","—","Das ist eine grundlegende Veränderung.","fundamental"],
  ["handlungsfähig","","—","Die Regierung muss handlungsfähig bleiben.","capable of acting"],
  ["hinreichend","","—","Das ist nicht hinreichend bewiesen.","sufficient"],
  ["hintergründig","","—","Der Witz ist sehr hintergründig.","subtle / profound"],
  ["hypothetisch","","—","Das ist eine hypothetische Frage.","hypothetical"],
  ["kategorisch","","—","Er lehnte kategorisch ab.","categorical"],
  ["kompromisslos","","—","Er ist in dieser Sache kompromisslos.","uncompromising"],
  ["kurzlebig","","—","Das ist ein kurzlebiger Trend.","short-lived"],
  ["langlebig","","—","Das Produkt ist sehr langlebig.","long-lasting / durable"],
  ["logisch","","—","Das ist die logische Konsequenz.","logical"],
  ["maßvoll","","—","Eine maßvolle Reaktion ist angemessen.","moderate / measured"],
  ["methodisch","","—","Er geht sehr methodisch vor.","methodical"],
  ["nachvollziehbar","","—","Das ist gut nachvollziehbar.","comprehensible / understandable"],
  ["normativ","","—","Das ist eine normative Aussage.","normative"],
  ["nuanciert","","—","Eine nuancierte Analyse ist wichtig.","nuanced"],
  ["pragmatisch","","—","Eine pragmatische Lösung ist gefragt.","pragmatic"],
  ["proportional","","—","Die Reaktion muss proportional sein.","proportional"],
  ["repräsentativ","","—","Das ist eine repräsentative Studie.","representative"],
  ["restriktiv","","—","Die Maßnahmen sind sehr restriktiv.","restrictive"],
  ["rigid","","—","Seine Haltung ist zu rigid.","rigid"],
  ["seriös","","—","Das ist eine seriöse Quelle.","serious / reputable"],
  ["signifikant","","—","Der Unterschied ist signifikant.","significant"],
  ["spezialisiert","","—","Er ist sehr spezialisiert.","specialized"],
  ["strittig","","—","Das ist ein strittiger Punkt.","controversial / disputed"],
  ["tiefgreifend","","—","Das ist eine tiefgreifende Veränderung.","profound / far-reaching"],
  ["transparent","","—","Die Entscheidungen müssen transparent sein.","transparent"],
  ["treffend","","—","Das ist eine sehr treffende Bemerkung.","apt / accurate"],
  ["übergeordnet","","—","Das ist ein übergeordnetes Ziel.","superordinate / overarching"],
  ["übertragbar","","—","Das Modell ist übertragbar.","transferable / applicable"],
  ["unausweichlich","","—","Das ist unausweichlich.","unavoidable"],
  ["undifferenziert","","—","Die Kritik ist zu undifferenziert.","undifferentiated / oversimplified"],
  ["unfruchtbar","","—","Diese Diskussion ist unfruchtbar.","unproductive / futile"],
  ["unzulänglich","","—","Die Erklärung ist unzulänglich.","inadequate / insufficient"],
  ["vage","","—","Die Aussage ist sehr vage.","vague"],
  ["verbindlich","","—","Das ist eine verbindliche Regelung.","binding / mandatory"],
  ["vertieft","","—","Eine vertiefte Analyse ist nötig.","in-depth / deepened"],
  ["vorläufig","","—","Das ist ein vorläufiges Ergebnis.","preliminary / provisional"],
  ["wegweisend","","—","Das ist eine wegweisende Entscheidung.","pioneering / path-breaking"],
  ["wertend","","—","Das ist eine wertende Aussage.","evaluative / judgemental"],
  ["wünschenswert","","—","Das wäre wünschenswert.","desirable"],
  ["zielgerichtet","","—","Er arbeitet sehr zielgerichtet.","focused / targeted"],
  ["zukunftsweisend","","—","Das ist ein zukunftsweisendes Konzept.","forward-looking"],
];

const freshStats = () => ({
  deToEn: { level: 0, seen: 0, lastSeen: 0 },
  enToDe: { level: 0, seen: 0, lastSeen: 0 },
});

const makeWord = (g) => ({
  id: "w-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
  german: g[0], gender: g[1], plural: g[2], exampleDE: g[3], english: g[4],
  stats: freshStats(),
});

/* ─── 永続化（artifact storage、無ければメモリにフォールバック）─── */
const KEY = "vokabel:words:v1";
function loadWords() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return JSON.parse(stored);
  } catch (_) {}
  return null;
}
function saveWords(words) {
  try {
    localStorage.setItem(KEY, JSON.stringify(words));
  } catch (_) {}
}

/* ─── シャッフル（Fisher-Yates） ─── */
function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/* ─── 出題キュー：習熟度が低い順、同じレベル内ではシャッフル ─── */
function buildQueue(words, dir) {
  // 習熟度レベルごとにグループ化
  const grouped = {};
  words.forEach((w) => {
    const level = w.stats[dir].level;
    if (!grouped[level]) grouped[level] = [];
    grouped[level].push(w.id);
  });
  
  // 各レベル内でシャッフル、習熟度順に結合
  const queue = [];
  for (let level = 0; level <= MAX_LEVEL; level++) {
    if (grouped[level]) {
      queue.push(...shuffle(grouped[level]));
    }
  }
  return queue;
}

const MAX_LEVEL = 5;

/* ══════════════════════════════════════════════════════════ */
export default function App() {
  const [words, setWords] = useState(null);   // null = 読み込み中
  const [view, setView] = useState("study");  // study | manage
  const [dir, setDir] = useState("deToEn");   // deToEn | enToDe

  const [queue, setQueue] = useState([]);
  const [qPos, setQPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionDone, setSessionDone] = useState({ deleted: 0, retest: 0 });

  const [editing, setEditing] = useState(null); // word | "new" | null
  const [filter, setFilter] = useState("");

  /* 初回ロード */
  useEffect(() => {
    const stored = loadWords();
    if (stored && stored.length) {
      setWords(stored);
    } else {
      const seeded = SEED.map(makeWord);
      setWords(seeded);
      saveWords(seeded);
    }
  }, []);

  /* 保存（words 変化時） */
  const firstSave = useRef(true);
  useEffect(() => {
    if (words === null) return;
    if (firstSave.current) { firstSave.current = false; return; }
    saveWords(words);
  }, [words]);

  /* セッション開始 */
  const startSession = useCallback(() => {
    if (!words) return;
    setQueue(buildQueue(words, dir));
    setQPos(0);
    setFlipped(false);
    setSessionDone({ deleted: 0, retest: 0 });
  }, [words, dir]);

  /* セッション開始 */
  useEffect(() => {
    if (words && words.length > 0) {
      startSession();
    }
  }, [dir, words, startSession]);

  const wordById = (id) => words?.find((w) => w.id === id);
  const currentId = queue[qPos];
  const current = currentId ? wordById(currentId) : null;

  /* 削除：単語帳から消して次へ */
  function deleteCurrent() {
    if (!current) return;
    const id = current.id;
    setWords((prev) => prev.filter((w) => w.id !== id));
    setQueue((prev) => prev.filter((qid) => qid !== id));
    setSessionDone((d) => ({ ...d, deleted: d.deleted + 1 }));
    setFlipped(false);
  }

  /* 再テスト：キュー末尾付近に再挿入 */
  function retestCurrent() {
    if (!current) return;
    const id = current.id;
    setQueue((prev) => {
      const next = prev.filter((qid) => qid !== id);
      const insertAt = next.length > 2
        ? next.length - Math.floor(Math.random() * Math.min(3, next.length)) - 1
        : next.length;
      const result = [...next];
      result.splice(insertAt, 0, id);
      return result;
    });
    setSessionDone((d) => ({ ...d, retest: d.retest + 1 }));
    setFlipped(false);
    setQPos((p) => p + 1);
  }

  /* シャッフル */
  function shuffleQueue() {
    setQueue((prev) => shuffle(prev));
    setQPos(0);
    setFlipped(false);
  }

  /* 単語の保存／削除 */
  function upsertWord(data) {
    setWords((prev) => {
      if (data.id && prev.some((w) => w.id === data.id)) {
        return prev.map((w) => (w.id === data.id ? { ...w, ...data } : w));
      }
      const nw = {
        id: "w-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
        stats: freshStats(), ...data,
      };
      return [nw, ...prev];
    });
    setEditing(null);
  }
  function deleteWord(id) {
    setWords((prev) => prev.filter((w) => w.id !== id));
  }

  /* 書き出し／読み込み */
  function exportJSON() {
    const blob = new Blob([JSON.stringify(words, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "vokabel-backup.json"; a.click();
    URL.revokeObjectURL(url);
  }
  function importJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arr = JSON.parse(reader.result);
        if (Array.isArray(arr)) {
          const cleaned = arr.map((w) => ({ ...w, stats: w.stats || freshStats() }));
          setWords(cleaned);
        }
      } catch (_) { alert("ファイルを読み込めませんでした。"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  if (words === null) {
    return (
      <div className="vk-root" style={{ display: "grid", placeItems: "center", padding: 24 }}>
        <style>{STYLE}</style>
        <div style={{ opacity: .6, fontSize: 14 }}>読み込み中…</div>
      </div>
    );
  }

  return (
    <div className="vk-root">
      <style>{STYLE}</style>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "18px 18px 32px", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>

        {/* ── ヘッダー ── */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
            <span className="vk-serif" style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-.01em" }}>Vokabel</span>
            <span className="vk-mono" style={{ fontSize: 10.5, color: "#6F727D", letterSpacing: ".08em" }}>DE · EN</span>
          </div>
          <nav style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.05)", padding: 4, borderRadius: 12 }}>
            <TabBtn active={view === "study"} onClick={() => setView("study")}><Layers size={15} /> 学習</TabBtn>
            <TabBtn active={view === "manage"} onClick={() => setView("manage")}><Search size={15} /> 単語帳</TabBtn>
          </nav>
        </header>

        {view === "study"
          ? <StudyView
              dir={dir} setDir={setDir}
              current={current} flipped={flipped} setFlipped={setFlipped}
              onDelete={deleteCurrent} onRetest={retestCurrent} onShuffle={shuffleQueue}
              qPos={qPos} total={queue.length}
              sessionDone={sessionDone} restart={startSession}
              hasWords={words.length > 0} goManage={() => { setView("manage"); setEditing("new"); }}
            />
          : <ManageView
              words={words} filter={filter} setFilter={setFilter}
              onAdd={() => setEditing("new")} onEdit={(w) => setEditing(w)}
              onDelete={deleteWord} onExport={exportJSON} onImport={importJSON}
            />
        }
      </div>

      {editing && (
        <WordForm
          word={editing === "new" ? null : editing}
          onSave={upsertWord}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/* ─── タブ ─── */
function TabBtn({ active, onClick, children }) {
  return (
    <button className="vk-btn" onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "7px 13px",
        borderRadius: 9, fontSize: 13, fontWeight: 600,
        background: active ? "#EDEAE2" : "transparent",
        color: active ? "#16171C" : "#9A9DA6",
      }}>
      {children}
    </button>
  );
}

/* ════════ 学習ビュー ════════ */
function StudyView({ dir, setDir, current, flipped, setFlipped, onDelete, onRetest, onShuffle, qPos, total, sessionDone, restart, hasWords, goManage }) {
  const progress = total ? Math.min(qPos, total) / total : 0;

  if (!hasWords) {
    return (
      <EmptyState
        title="まだ単語がありません"
        body="最初の単語を登録して学習を始めましょう。性・複数形・例文も記録できます。"
        action="単語を追加" onAction={goManage}
      />
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {/* 方向トグル + シャッフルボタン */}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <DirectionToggle dir={dir} setDir={setDir} />
        </div>
        <button className="vk-btn vk-icon-btn" onClick={onShuffle} title="シャッフル"
          style={{ width: 46, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 13, color: "#9DA1AB" }}>
          <Shuffle size={17} />
        </button>
      </div>

      {/* 進捗バー */}
      <div style={{ height: 4, background: "rgba(255,255,255,.07)", borderRadius: 99, margin: "16px 0 18px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress * 100}%`, background: "linear-gradient(90deg,#3B79B6,#2E9C6A)", borderRadius: 99, transition: "width .4s ease" }} />
      </div>

      {qPos >= total
        ? <SessionComplete done={sessionDone} onRestart={restart} />
        : current && (
          <FlashCard
            key={current.id + dir}
            word={current} dir={dir} flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            onDelete={onDelete} onRetest={onRetest}
            counter={`${qPos + 1} / ${total}`}
          />
        )}
    </div>
  );
}

function DirectionToggle({ dir, setDir }) {
  const isDE = dir === "deToEn";
  return (
    <button className="vk-btn" onClick={() => setDir(isDE ? "enToDe" : "deToEn")}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 13, padding: "11px 16px", width: "100%",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="vk-mono" style={{ fontSize: 15, fontWeight: 600, color: "#F2EFE7" }}>
          {isDE ? "DE" : "EN"}
        </span>
        <span style={{ fontSize: 13, color: "#9DA1AB" }}>
          を見て答える
        </span>
      </div>
      <ArrowLeftRight size={15} color="#5E6170" />
    </button>
  );
}

/* ─── フラッシュカード本体 ─── */
function FlashCard({ word, dir, flipped, onFlip, onDelete, onRetest, counter }) {
  const gc = genderColor(word.gender);
  const isNoun = !!word.gender;
  const germanIsPrompt = dir === "deToEn";

  return (
    <div className="vk-pop" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div className="vk-card-shell" style={{ flex: 1, minHeight: 340, height: 340, position: "relative" }}>
        <div className={"vk-card-inner" + (flipped ? " flipped" : "")} onClick={onFlip} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onFlip(); } }}
          style={{ cursor: "pointer", position: "absolute", inset: 0 }}>

          {/* 表 */}
          <div className="vk-face" style={faceStyle(germanIsPrompt ? gc : "#8A8A95")}>
            {germanIsPrompt
              ? <GermanFace word={word} gc={gc} isNoun={isNoun} counter={counter} prompt />
              : <EnglishFace word={word} counter={counter} prompt />}
          </div>

          {/* 裏 */}
          <div className="vk-face back" style={faceStyle(germanIsPrompt ? "#8A8A95" : gc)}>
            {germanIsPrompt
              ? <EnglishFace word={word} counter={counter} />
              : <GermanFace word={word} gc={gc} isNoun={isNoun} counter={counter} />}
          </div>
        </div>
      </div>

      {/* 操作部：裏面表示時のみボタンを表示 */}
      {flipped && (
        <div className="vk-fade" style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <ActionBtn onClick={onDelete} tone="delete">削除<span>Löschen</span></ActionBtn>
          <ActionBtn onClick={onRetest} tone="retest">再テスト<span>Nochmal</span></ActionBtn>
        </div>
      )}
    </div>
  );
}

function faceStyle(edge) {
  return {
    background: "linear-gradient(180deg,#FBF9F3,#F3EFE4)",
    color: "#1A1A20",
    borderLeft: `6px solid ${edge}`,
    boxShadow: "0 18px 40px -16px rgba(0,0,0,.6), 0 2px 0 rgba(255,255,255,.04)",
  };
}

/* ドイツ語の面（辞書エントリ風） */
function GermanFace({ word, gc, isNoun, counter, prompt }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "22px 24px" }}>
      <FaceTag text={prompt ? "Deutsch" : "Antwort"} sub={counter} color={gc} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
        <div>
          {isNoun && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className="vk-serif" style={{ fontSize: 20, fontWeight: 600, fontStyle: "italic", color: gc }}>{word.gender}</span>
              <span style={{ fontSize: 10.5, letterSpacing: ".06em", color: gc, opacity: .8, textTransform: "uppercase" }}>{GENDERS[word.gender].label}</span>
            </div>
          )}
          <div className="vk-serif" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-.015em", color: "#16161B" }}>
            {word.german}
          </div>
          {isNoun && word.plural && word.plural !== "—" && (
            <div className="vk-mono" style={{ fontSize: 13, color: "#76747A", marginTop: 8 }}>
              Pl. {word.plural}
            </div>
          )}
        </div>
        {word.exampleDE && (
          <div className="vk-serif" style={{ fontStyle: "italic", fontSize: 16, lineHeight: 1.5, color: "#494750", borderLeft: "2px solid " + gc, paddingLeft: 12 }}>
            {word.exampleDE}
          </div>
        )}
      </div>
    </div>
  );
}

/* 英語の面 */
function EnglishFace({ word, counter, prompt }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "22px 24px" }}>
      <FaceTag text={prompt ? "English" : "Answer"} sub={counter} color="#8A8A95" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-.02em", color: "#16161B", textAlign: "center" }}>
          {word.english}
        </div>
        {!prompt && word.gender && (
          <div className="vk-mono" style={{ marginTop: 10, fontSize: 12, color: genderColor(word.gender) }}>
            {word.gender} {word.german}
          </div>
        )}
      </div>
    </div>
  );
}

function FaceTag({ text, sub, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color }}>{text}</span>
      <span className="vk-mono" style={{ fontSize: 11, color: "#A8A39A" }}>{sub}</span>
    </div>
  );
}

function ActionBtn({ onClick, tone, children }) {
  const styles = tone === "retest"
    ? { bg: "rgba(59,121,182,.14)", bd: "rgba(59,121,182,.4)", fg: "#7FA8D6" }
    : { bg: "rgba(190,71,99,.13)", bd: "rgba(190,71,99,.4)", fg: "#E58AA0" };
  return (
    <button className="vk-btn vk-rate" onClick={onClick}
      style={{ flex: 1, padding: "14px", borderRadius: 14, background: styles.bg, border: `1px solid ${styles.bd}`, color: styles.fg, fontWeight: 600, fontSize: 15, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      {children[0]}
      <span className="vk-mono" style={{ fontSize: 10, opacity: .6, fontWeight: 400 }}>{children[1]}</span>
    </button>
  );
}

/* ─── セッション完了 ─── */
function SessionComplete({ done, onRestart }) {
  return (
    <div className="vk-pop" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 18, padding: 20 }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(46,156,106,.15)", display: "grid", placeItems: "center" }}>
        <Check size={30} color="#7BD3A6" />
      </div>
      <div>
        <div className="vk-serif" style={{ fontSize: 24, fontWeight: 600 }}>ひと回り完了</div>
        <div style={{ fontSize: 14, color: "#9A9DA6", marginTop: 6 }}>
          削除 {done.deleted} ・ 再テスト {done.retest}
        </div>
      </div>
      <button className="vk-btn" onClick={onRestart}
        style={{ padding: "12px 22px", borderRadius: 13, background: "#EDEAE2", color: "#16171C", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <RotateCcw size={16} /> もう一周する
      </button>
    </div>
  );
}

/* ════════ 単語帳ビュー ════════ */
function ManageView({ words, filter, setFilter, onAdd, onEdit, onDelete, onExport, onImport }) {
  const q = filter.trim().toLowerCase();
  const list = q
    ? words.filter((w) => (w.german + " " + w.english).toLowerCase().includes(q))
    : words;

  return (
    <div className="vk-fade" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={15} color="#62656F" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }} />
          <input className="vk-input" style={{ paddingLeft: 36 }} placeholder="検索…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <button className="vk-btn" onClick={onAdd}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", borderRadius: 12, background: "#EDEAE2", color: "#16171C", fontWeight: 600, fontSize: 14 }}>
          <Plus size={17} /> 追加
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 2px" }}>
        <span style={{ fontSize: 12, color: "#6F727D" }}>{list.length} 語</span>
        <div style={{ display: "flex", gap: 4 }}>
          <label className="vk-btn vk-icon-btn" style={{ width: 34, height: 34, color: "#9A9DA6", cursor: "pointer" }} title="読み込み">
            <Upload size={15} />
            <input type="file" accept="application/json" onChange={onImport} style={{ display: "none" }} />
          </label>
          <button className="vk-btn vk-icon-btn" style={{ width: 34, height: 34, color: "#9A9DA6" }} title="書き出し" onClick={onExport}>
            <Download size={15} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
        {list.length === 0 && (
          <div style={{ textAlign: "center", color: "#62656F", fontSize: 14, padding: "40px 0" }}>該当する単語がありません</div>
        )}
        {list.map((w) => (
          <WordRow key={w.id} word={w} onEdit={() => onEdit(w)} onDelete={() => onDelete(w.id)} />
        ))}
      </div>
    </div>
  );
}

function WordRow({ word, onEdit, onDelete }) {
  const gc = genderColor(word.gender);
  const [confirm, setConfirm] = useState(false);
  // 双方向の平均習熟度
  const lvl = (word.stats.deToEn.level + word.stats.enToDe.level) / 2;
  return (
    <div className="vk-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 13, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.05)" }}>
      <div style={{ width: 3, alignSelf: "stretch", borderRadius: 99, background: gc, minHeight: 30 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          {word.gender && <span className="vk-serif" style={{ fontStyle: "italic", fontSize: 13, color: gc }}>{word.gender}</span>}
          <span className="vk-serif" style={{ fontSize: 17, fontWeight: 600, color: "#EDEAE2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{word.german}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "#83868F", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{word.english}</div>
      </div>
      <LevelDots level={lvl} />
      {confirm ? (
        <div style={{ display: "flex", gap: 4 }}>
          <button className="vk-btn vk-icon-btn" style={{ width: 32, height: 32, color: "#E58AA0", background: "rgba(190,71,99,.12)" }} onClick={onDelete}><Check size={15} /></button>
          <button className="vk-btn vk-icon-btn" style={{ width: 32, height: 32, color: "#9A9DA6" }} onClick={() => setConfirm(false)}><X size={15} /></button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 2 }}>
          <button className="vk-btn vk-icon-btn" style={{ width: 32, height: 32, color: "#9A9DA6" }} onClick={onEdit}><Pencil size={14} /></button>
          <button className="vk-btn vk-icon-btn" style={{ width: 32, height: 32, color: "#9A9DA6" }} onClick={() => setConfirm(true)}><Trash2 size={14} /></button>
        </div>
      )}
    </div>
  );
}

function LevelDots({ level }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: i < Math.round(level) ? "#2E9C6A" : "rgba(255,255,255,.13)" }} />
      ))}
    </div>
  );
}

/* ════════ 入力フォーム（追加・編集）════════ */
function WordForm({ word, onSave, onCancel }) {
  const [f, setF] = useState({
    german: word?.german || "",
    gender: word?.gender || "",
    plural: word?.plural || "",
    exampleDE: word?.exampleDE || "",
    english: word?.english || "",
  });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const valid = f.german.trim() && f.english.trim();

  function submit() {
    if (!valid) return;
    onSave({ id: word?.id, ...f, german: f.german.trim(), english: f.english.trim() });
  }

  return (
    <div className="vk-fade" onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(8,9,12,.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
      <div className="vk-pop" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, background: "#17181E", borderTopLeftRadius: 24, borderTopRightRadius: 24, border: "1px solid rgba(255,255,255,.08)", padding: "20px 18px calc(20px + env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span className="vk-serif" style={{ fontSize: 19, fontWeight: 600 }}>{word ? "単語を編集" : "新しい単語"}</span>
          <button className="vk-btn vk-icon-btn" style={{ width: 34, height: 34, color: "#9A9DA6" }} onClick={onCancel}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="ドイツ語 *">
            <input className="vk-input" value={f.german} onChange={set("german")} placeholder="Haus" autoFocus />
          </Field>

          <div>
            <Label>性（名詞のみ）</Label>
            <div style={{ display: "flex", gap: 7 }}>
              {["", "der", "die", "das"].map((g) => (
                <button key={g || "none"} className="vk-btn"
                  onClick={() => setF((p) => ({ ...p, gender: g }))}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 11, fontSize: 14, fontWeight: 600,
                    fontFamily: g ? "'Spectral',serif" : "inherit", fontStyle: g ? "italic" : "normal",
                    background: f.gender === g ? (g ? genderColor(g) : "#3A3D47") : "rgba(255,255,255,.05)",
                    color: f.gender === g ? "#fff" : "#8A8D96",
                    border: "1px solid " + (f.gender === g ? "transparent" : "rgba(255,255,255,.07)"),
                  }}>
                  {g || "なし"}
                </button>
              ))}
            </div>
          </div>

          <Field label="複数形">
            <input className="vk-input" value={f.plural} onChange={set("plural")} placeholder="Häuser" />
          </Field>
          <Field label="例文（ドイツ語）">
            <textarea className="vk-input" rows={2} value={f.exampleDE} onChange={set("exampleDE")} placeholder="Das Haus ist groß." style={{ resize: "none", lineHeight: 1.5 }} />
          </Field>
          <Field label="英語の意味 *">
            <input className="vk-input" value={f.english} onChange={set("english")} placeholder="house" />
          </Field>
        </div>

        <button className="vk-btn" onClick={submit} disabled={!valid}
          style={{ width: "100%", marginTop: 18, padding: "14px", borderRadius: 14, background: valid ? "#EDEAE2" : "#2A2C34", color: valid ? "#16171C" : "#5A5D66", fontWeight: 600, fontSize: 15, cursor: valid ? "pointer" : "not-allowed" }}>
          {word ? "保存する" : "追加する"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div><Label>{label}</Label>{children}</div>;
}
function Label({ children }) {
  return <div style={{ fontSize: 12, color: "#83868F", marginBottom: 6, fontWeight: 500 }}>{children}</div>;
}

/* ─── 空状態 ─── */
function EmptyState({ title, body, action, onAction }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 14, padding: 24 }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: "rgba(255,255,255,.05)", display: "grid", placeItems: "center" }}>
        <Layers size={26} color="#7E818B" />
      </div>
      <div>
        <div className="vk-serif" style={{ fontSize: 21, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 14, color: "#9A9DA6", marginTop: 6, maxWidth: 280, lineHeight: 1.55 }}>{body}</div>
      </div>
      <button className="vk-btn" onClick={onAction}
        style={{ padding: "12px 20px", borderRadius: 13, background: "#EDEAE2", color: "#16171C", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <Plus size={17} /> {action}
      </button>
    </div>
  );
}
